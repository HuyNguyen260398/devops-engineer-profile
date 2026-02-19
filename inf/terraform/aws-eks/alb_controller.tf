# ============================================================================
# AWS Load Balancer Controller for EKS
# ============================================================================
# Deploys the AWS Load Balancer Controller using Helm with IRSA.
# This controller watches for Kubernetes Ingress resources and automatically
# provisions AWS Application Load Balancers (ALBs) or Network Load Balancers.
#
# Architecture: User → ALB (internet-facing) → ClusterIP Service → Pods
# ============================================================================

# ============================================================================
# IAM Policy for AWS Load Balancer Controller
# ============================================================================
# The controller needs specific IAM permissions to manage ALBs, target groups,
# security groups, and other AWS resources on behalf of the cluster.
# ============================================================================

data "http" "lb_controller_iam_policy" {
  count = var.enable_aws_lb_controller ? 1 : 0
  url   = "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v${var.aws_lb_controller_version}/docs/install/iam_policy.json"
}

resource "aws_iam_policy" "lb_controller" {
  count = var.enable_aws_lb_controller ? 1 : 0

  name_prefix = "${local.cluster_name}-aws-lb-controller-"
  description = "IAM policy for AWS Load Balancer Controller on EKS cluster ${local.cluster_name}"
  policy      = data.http.lb_controller_iam_policy[0].response_body

  tags = local.common_tags
}

# ============================================================================
# IRSA - IAM Role for AWS Load Balancer Controller Service Account
# ============================================================================

module "aws_lb_controller_irsa" {
  count   = var.enable_aws_lb_controller ? 1 : 0
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name_prefix = "${local.cluster_name}-aws-lb-ctrl-"

  role_policy_arns = {
    policy = aws_iam_policy.lb_controller[0].arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.common_tags
}

# ============================================================================
# AWS Load Balancer Controller Helm Release
# ============================================================================

resource "helm_release" "aws_lb_controller" {
  count = var.enable_aws_lb_controller ? 1 : 0

  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = var.aws_lb_controller_chart_version
  namespace  = "kube-system"

  set {
    name  = "clusterName"
    value = local.cluster_name
  }

  set {
    name  = "region"
    value = var.aws_region
  }

  set {
    name  = "vpcId"
    value = module.vpc.vpc_id
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.aws_lb_controller_irsa[0].iam_role_arn
  }

  # Enable shield, waf, and wafv2 if needed
  set {
    name  = "enableShield"
    value = "false"
  }

  set {
    name  = "enableWaf"
    value = "false"
  }

  set {
    name  = "enableWafv2"
    value = "false"
  }

  # Resource limits
  set {
    name  = "resources.requests.cpu"
    value = "100m"
  }

  set {
    name  = "resources.requests.memory"
    value = "128Mi"
  }

  set {
    name  = "resources.limits.cpu"
    value = "200m"
  }

  set {
    name  = "resources.limits.memory"
    value = "256Mi"
  }

  wait    = true
  timeout = 300

  depends_on = [
    module.eks,
    aws_iam_policy.lb_controller
  ]
}
