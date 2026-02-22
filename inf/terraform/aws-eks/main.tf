# Data Sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC Module
# Flow Logs are enabled below via enable_flow_log = true. tfsec raises a false positive
# because it only inspects the aws_vpc resource inside the module source and cannot
# correlate it with the separate aws_flow_log resource the module creates.
# tfsec:ignore:aws-ec2-require-vpc-flow-logs-for-all-vpcs
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.6.0"

  name = "${local.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs             = local.azs
  private_subnets = local.private_subnet_cidrs
  public_subnets  = local.public_subnet_cidrs

  # Enable NAT Gateway for private subnets
  enable_nat_gateway   = true
  single_nat_gateway   = var.environment == "staging" ? true : false
  enable_dns_hostnames = true
  enable_dns_support   = true

  # Enable VPC flow logs to CloudWatch
  enable_flow_log                                 = true
  create_flow_log_cloudwatch_iam_role             = true
  create_flow_log_cloudwatch_log_group            = true
  flow_log_cloudwatch_log_group_retention_in_days = var.cloudwatch_log_retention_days

  # Kubernetes-specific tags for subnet discovery
  public_subnet_tags = {
    "kubernetes.io/role/elb"                      = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"             = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "shared"
  }

  tags = local.common_tags
}

# EKS Cluster Module
# Public endpoint: gated by cluster_endpoint_public_access (default false) + a validated
# CIDR list that rejects 0.0.0.0/0. The check fires for staging where public access is
# intentionally enabled with a restricted, organisation-specific CIDR.
# Node egress: worker nodes must reach ECR/Docker Hub (image pulls), AWS service endpoints,
# and OS package repos. Blocking internet egress would prevent pods from scheduling.
# tfsec:ignore:aws-eks-no-public-cluster-access
# tfsec:ignore:aws-eks-no-public-cluster-access-to-cidr
# tfsec:ignore:aws-ec2-no-public-egress-sgr
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "21.15.1"

  name  = local.cluster_name
  kubernetes_version  = var.cluster_version

  # Cluster endpoint access
  endpoint_public_access       = var.cluster_endpoint_public_access
  endpoint_private_access      = var.cluster_endpoint_private_access
  endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  # Enable IRSA for service accounts
  enable_irsa = var.enable_irsa

  # CloudWatch logging
  enabled_log_types = var.enable_cloudwatch_logs ? [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ] : []
  create_cloudwatch_log_group            = false
  cloudwatch_log_group_retention_in_days = var.cloudwatch_log_retention_days

  # VPC and networking
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # Cluster security group
  security_group_additional_rules = {
    ingress_nodes_ephemeral_ports = {
      description                = "Nodes to cluster API"
      protocol                   = "tcp"
      from_port                  = 1025
      to_port                    = 65535
      type                       = "ingress"
      source_node_security_group = true
    }
  }

  # Node security group
  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }

    ingress_cluster_all = {
      description                   = "Cluster to node all ports/protocols"
      protocol                      = "-1"
      from_port                     = 0
      to_port                       = 0
      type                          = "ingress"
      source_cluster_security_group = true
    }

    egress_all = {
      description      = "Node all egress"
      protocol         = "-1"
      from_port        = 0
      to_port          = 0
      type             = "egress"
      cidr_blocks      = ["0.0.0.0/0"]
      ipv6_cidr_blocks = ["::/0"]
    }
  }

  # EKS Managed Node Groups
  eks_managed_node_groups = var.node_groups

  # Cluster add-ons
  addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = var.enable_ebs_csi_driver ? {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa[0].iam_role_arn
    } : null
  }

  # Authentication mode (API is preferred over aws-auth ConfigMap in v20+)
  authentication_mode                      = "API_AND_CONFIG_MAP"
  enable_cluster_creator_admin_permissions = true

  tags = local.common_tags
}

# IAM Role for EBS CSI Driver (if enabled)
module "ebs_csi_irsa" {
  count   = var.enable_ebs_csi_driver ? 1 : 0
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts"
  version = "6.4.0"

  use_name_prefix = "${local.cluster_name}-ebs-csi-"

  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.common_tags
}

# IAM Role for Cluster Autoscaler (if enabled)
module "cluster_autoscaler_irsa" {
  count   = var.enable_cluster_autoscaler ? 1 : 0
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts"
  version = "6.4.0"

  use_name_prefix = "${local.cluster_name}-cluster-autoscaler-"

  attach_cluster_autoscaler_policy = true
  cluster_autoscaler_cluster_names = [local.cluster_name]

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:cluster-autoscaler"]
    }
  }

  tags = local.common_tags
}

# Deploy Cluster Autoscaler (if enabled)
resource "helm_release" "cluster_autoscaler" {
  count = var.enable_cluster_autoscaler ? 1 : 0

  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  namespace  = "kube-system"
  # Check latest: helm repo add autoscaler https://kubernetes.github.io/autoscaler
  #               helm search repo autoscaler/cluster-autoscaler --versions
  version = "9.43.2"

  set = [
    {
      name  = "autoDiscovery.clusterName"
      value = local.cluster_name
    },
    {
      name  = "awsRegion"
      value = var.aws_region
    },
    {
      name  = "rbac.serviceAccount.create"
      value = "true"
    },
    {
      name  = "rbac.serviceAccount.name"
      value = "cluster-autoscaler"
    },
    {
      name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
      value = module.cluster_autoscaler_irsa[0].iam_role_arn
    }
  ]

  depends_on = [module.eks]
}

# Deploy Metrics Server (required for HPA — Horizontal Pod Autoscaler)
# Without metrics-server, `kubectl top` and all HPA resources will fail.
resource "helm_release" "metrics_server" {
  count = var.enable_metrics_server ? 1 : 0

  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  namespace  = "kube-system"
  # Check latest: helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
  #               helm search repo metrics-server/metrics-server --versions
  version = "3.12.2"

  set = [
    {
      name  = "args[0]"
      value = "--kubelet-insecure-tls"
    }
  ]

  depends_on = [module.eks]
}
