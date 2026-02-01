variable "github_owner" {
  description = "GitHub repository owner (organization or username)"
  type        = string
  nullable    = false
}

variable "github_repository" {
  description = "GitHub repository name"
  type        = string
  nullable    = false
}

variable "github_token" {
  description = "GitHub Personal Access Token or OAuth token for repository management"
  type        = string
  sensitive   = true
  nullable    = false
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  nullable    = false
}

variable "aws_role_name" {
  description = "Name of the IAM role for GitHub Actions OIDC"
  type        = string
  default     = "github-actions-s3-sync-role"
  nullable    = false
}

variable "aws_account_id" {
  description = "AWS account ID for the IAM role and resources"
  type        = string
  default     = ""
  nullable    = false
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket for syncing web content"
  type        = string
  nullable    = false
}

variable "environment" {
  description = "Environment name for resource tagging and organization"
  type        = string
  default     = "production"
  nullable    = false
}

variable "project_name" {
  description = "Project name for resource tagging and identification"
  type        = string
  default     = "devops-engineer-profile"
  nullable    = false
}

variable "aws_access_key_id" {
  description = "AWS access key ID (fallback authentication for GitHub Actions)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "aws_secret_access_key" {
  description = "AWS secret access key (fallback authentication for GitHub Actions)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "enable_oidc_authentication" {
  description = "Enable GitHub Actions OIDC-based authentication with AWS (recommended over access keys)"
  type        = bool
  default     = true
  nullable    = false
}

variable "github_actions_environments" {
  description = "List of GitHub Actions environment names that can assume the IAM role"
  type        = list(string)
  default     = [""]
  nullable    = false
}

variable "create_github_variables" {
  description = "Whether to create GitHub Actions variables (requires token with repo and workflow scopes)"
  type        = bool
  default     = true
  nullable    = false
}

variable "create_github_secrets" {
  description = "Whether to create GitHub Actions secrets (requires token with repo and workflow scopes)"
  type        = bool
  default     = false
  nullable    = false
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
