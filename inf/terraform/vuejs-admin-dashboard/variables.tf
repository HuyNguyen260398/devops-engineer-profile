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

# ============================================================================
# GitHub — OIDC-based CodeCommit sync role
# ============================================================================

variable "github_owner" {
  description = "GitHub organisation or user that owns the source repository (used to scope the OIDC trust policy for the CodeCommit sync role)"
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name that hosts the Vue.js Admin Dashboard source (used to scope the OIDC trust policy for the CodeCommit sync role)"
  type        = string
}

variable "codecommit_sync_branch" {
  description = "Git branch in the GitHub source repository whose merges are allowed to assume the CodeCommit sync role (default: main)"
  type        = string
  default     = "main"
}

variable "create_codecommit_sync_role" {
  description = "Create the IAM role that GitHub Actions assumes via OIDC to push to CodeCommit. Only the environment that creates the CodeCommit repo should create this role (typically production)."
  type        = bool
  default     = false
}

# ============================================================================
# CodeDeploy (optional)
# ============================================================================

variable "enable_codedeploy_deploy" {
  description = "When true, the CodePipeline Deploy stage uses CodeDeploy to deploy the built SPA artifact to an S3 static-website bucket fronted by CloudFront, instead of invoking the Lambda→Amplify path. Amplify resources are always provisioned regardless of this flag."
  type        = bool
  default     = false
}

variable "cloudfront_price_class" {
  description = "CloudFront price class for the web distribution (only used when enable_codedeploy_deploy = true). PriceClass_100 covers US, Canada, and Europe edge locations and is the most cost-effective option."
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cloudfront_price_class)
    error_message = "cloudfront_price_class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}
