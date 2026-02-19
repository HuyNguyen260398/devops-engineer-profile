locals {
  # Derive OIDC provider URL and ARN from the EKS cluster data source
  oidc_provider_url = trimprefix(
    data.aws_eks_cluster.this.identity[0].oidc[0].issuer,
    "https://"
  )
  oidc_provider_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${local.oidc_provider_url}"

  # Common tags applied to all resources in this module
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Component   = "argocd"
    },
    var.additional_tags
  )
}
