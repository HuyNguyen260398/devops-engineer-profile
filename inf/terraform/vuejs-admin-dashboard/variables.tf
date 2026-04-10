# ============================================================================
# General
# ============================================================================

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name used as a tag value and resource name prefix"
  type        = string
  default     = "vuejs-admin-dashboard"
}

variable "environment" {
  description = "Deployment environment — used as a resource name suffix and tag value (e.g. production, staging)"
  type        = string
}

# ============================================================================
# CodeCommit
# ============================================================================

variable "codecommit_repo_name" {
  description = "Name of the AWS CodeCommit repository (shared across environments)"
  type        = string
}

variable "create_codecommit_repo" {
  description = "Create the CodeCommit repository. Set to false in non-primary environments that reuse an already-created repo."
  type        = bool
  default     = true
}

variable "pipeline_branch" {
  description = "Git branch this environment's pipeline monitors and deploys (e.g. main for production, develop for staging)"
  type        = string
  default     = "main"
}

# ============================================================================
# Amplify
# ============================================================================

variable "amplify_app_name" {
  description = "Display name for the AWS Amplify application"
  type        = string
}

variable "amplify_branch_stage" {
  description = "Amplify branch deployment stage (PRODUCTION or DEVELOPMENT)"
  type        = string
  default     = "PRODUCTION"

  validation {
    condition     = contains(["PRODUCTION", "BETA", "DEVELOPMENT", "EXPERIMENTAL", "PULL_REQUEST"], var.amplify_branch_stage)
    error_message = "amplify_branch_stage must be one of: PRODUCTION, BETA, DEVELOPMENT, EXPERIMENTAL, PULL_REQUEST."
  }
}

variable "custom_domain" {
  description = "Optional custom domain to associate with the Amplify app (leave empty to skip)"
  type        = string
  default     = ""
}

# ============================================================================
# CodeBuild
# ============================================================================

variable "codebuild_compute_type" {
  description = "CodeBuild compute type (e.g. BUILD_GENERAL1_SMALL, BUILD_GENERAL1_MEDIUM)"
  type        = string
  default     = "BUILD_GENERAL1_SMALL"
}

variable "codebuild_image" {
  description = "CodeBuild managed image for the build environment"
  type        = string
  default     = "aws/codebuild/standard:7.0"
}
