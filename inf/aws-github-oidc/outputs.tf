output "github_repository_secrets" {
  description = "GitHub Actions secrets created for the repository"
  value = {
    aws_region              = try(github_actions_secret.aws_region[0].secret_name, null)
    aws_access_key_id       = try(github_actions_secret.aws_access_key_id[0].secret_name, null)
    aws_secret_access_key   = try(github_actions_secret.aws_secret_access_key[0].secret_name, null)
    aws_role_to_assume      = try(github_actions_secret.aws_role_to_assume[0].secret_name, null)
  }
  sensitive = false
}

output "github_repository_variables" {
  description = "GitHub Actions variables created for the repository"
  value = {
    s3_bucket_name = try(github_actions_variable.s3_bucket_name[0].variable_name, null)
  }
  sensitive = false
}

output "aws_oidc_provider_arn" {
  description = "ARN of the AWS OIDC provider registered for GitHub"
  value       = try(aws_iam_openid_connect_provider.github[0].arn, null)
  sensitive   = false
}

output "aws_iam_role_arn" {
  description = "ARN of the IAM role for GitHub Actions to assume via OIDC"
  value       = try(aws_iam_role.github_actions_oidc[0].arn, null)
  sensitive   = false
}

output "aws_iam_role_name" {
  description = "Name of the IAM role for GitHub Actions"
  value       = try(aws_iam_role.github_actions_oidc[0].name, null)
  sensitive   = false
}

output "aws_iam_policy_arn" {
  description = "ARN of the IAM policy for S3 sync operations"
  value       = aws_iam_policy.github_actions_s3_sync.arn
  sensitive   = false
}

output "authentication_method" {
  description = "Authentication method configured for GitHub Actions (OIDC or access keys)"
  value       = var.enable_oidc_authentication ? "OIDC (Recommended)" : "Access Keys (Legacy)"
  sensitive   = false
}

output "configuration_summary" {
  description = "Summary of the configured GitHub Actions and AWS resources"
  value = {
    github_owner              = var.github_owner
    github_repository         = var.github_repository
    aws_region                = var.aws_region
    s3_bucket_name            = var.s3_bucket_name
    oidc_enabled              = var.enable_oidc_authentication
    fallback_keys_configured  = var.aws_access_key_id != "" && var.aws_secret_access_key != ""
    project_name              = var.project_name
    environment               = var.environment
  }
  sensitive = true
}

