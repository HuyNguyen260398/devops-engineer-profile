locals {
  # Merge user-provided tags with defaults
  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )

  # GitHub OIDC Configuration
  github_oidc_provider_url = "https://token.actions.githubusercontent.com"
  github_oidc_provider_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"

  # Filter out empty environment names
  valid_environments = [for env in var.github_actions_environments : env if env != ""]
}

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}

# Data source to get current AWS partition (supports commercial and GovCloud regions)
data "aws_partition" "current" {}
