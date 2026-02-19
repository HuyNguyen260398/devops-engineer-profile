# ============================================================================
# ArgoCD AWS Infrastructure Module
# ============================================================================
# Manages AWS-specific resources required for ArgoCD running on EKS:
#   - IRSA (IAM Role for Service Accounts) granting ArgoCD ECR read access
#
# ArgoCD itself is deployed via Helm/kubectl commands.
# See ops/argocd/ for Kubernetes manifests and the deploy-aws.sh script.
#
# Workflow:
#   1. terraform apply -var-file environments/staging.tfvars
#   2. terraform output -raw argocd_irsa_role_arn  → pass to deploy-aws.sh
#   3. cd ops/argocd && bash deploy-aws.sh install staging
# ============================================================================

# ============================================================================
# Data Sources
# ============================================================================

data "aws_caller_identity" "current" {}

# Look up the EKS cluster to derive the OIDC provider ARN
data "aws_eks_cluster" "this" {
  name = var.cluster_name
}

# ============================================================================
# IRSA – IAM Role for ArgoCD Service Accounts
# ============================================================================
# Grants ArgoCD server, application-controller, and repo-server the ability
# to pull images from ECR in the same AWS account.
# The role ARN must be annotated on the Kubernetes service accounts — see
# ops/argocd/argocd-values-aws.yaml for how to pass it via Helm values.
# ============================================================================

module "argocd_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name_prefix = "${var.cluster_name}-argocd-"

  role_policy_arns = {
    ecr_readonly = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  }

  oidc_providers = {
    main = {
      provider_arn = local.oidc_provider_arn
      namespace_service_accounts = [
        "${var.argocd_namespace}:argocd-server",
        "${var.argocd_namespace}:argocd-application-controller",
        "${var.argocd_namespace}:argocd-repo-server",
      ]
    }
  }

  tags = local.common_tags
}
