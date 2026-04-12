# ============================================================================
# CodeCommit
# ============================================================================

output "codecommit_clone_url_http" {
  description = "HTTPS clone URL for the CodeCommit repository"
  value = (
    var.create_codecommit_repo
    ? aws_codecommit_repository.app[0].clone_url_http
    : data.aws_codecommit_repository.app[0].clone_url_http
  )
}

output "codecommit_clone_url_ssh" {
  description = "SSH clone URL for the CodeCommit repository"
  value = (
    var.create_codecommit_repo
    ? aws_codecommit_repository.app[0].clone_url_ssh
    : data.aws_codecommit_repository.app[0].clone_url_ssh
  )
}

# ============================================================================
# Amplify
# ============================================================================

output "amplify_app_id" {
  description = "Amplify application ID"
  value       = aws_amplify_app.app.id
}

output "amplify_default_domain" {
  description = "Default Amplify domain for the application"
  value       = aws_amplify_app.app.default_domain
}

output "amplify_branch_url" {
  description = "Live URL for the deployed branch"
  value       = "https://${var.pipeline_branch}.${aws_amplify_app.app.default_domain}"
}

# ============================================================================
# CodePipeline / CodeBuild
# ============================================================================

output "codepipeline_name" {
  description = "Name of the CodePipeline pipeline"
  value       = var.enable_codedeploy_deploy ? aws_codepipeline.codedeploy[0].name : aws_codepipeline.amplify[0].name
}

output "codebuild_project_name" {
  description = "Name of the CodeBuild project"
  value       = aws_codebuild_project.app.name
}

output "artifact_bucket_name" {
  description = "Name of the S3 bucket used for pipeline artifacts"
  value       = aws_s3_bucket.pipeline_artifacts.bucket
}

# ============================================================================
# CodeCommit Sync Role (GitHub OIDC)
# ============================================================================

output "codecommit_sync_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions via OIDC to mirror the app into CodeCommit. Null in environments that do not create the role."
  value = (
    var.create_codecommit_sync_role
    ? aws_iam_role.codecommit_sync_role[0].arn
    : null
  )
}

# ============================================================================
# CodeArtifact
# ============================================================================

output "codeartifact_repository_endpoint" {
  description = "CodeArtifact npm repository endpoint URL. Use this in buildspec.yml to configure npm: aws codeartifact get-authorization-token ... && npm config set registry <this_url>"
  value       = "https://${aws_codeartifact_domain.app.domain}-${local.account_id}.d.codeartifact.${local.region}.amazonaws.com/npm/${aws_codeartifact_repository.npm.repository}/"
}

# ============================================================================
# CodeDeploy / S3 + CloudFront (conditional)
# ============================================================================

output "codedeploy_app_name" {
  description = "CodeDeploy application name. Null when enable_codedeploy_deploy = false."
  value       = var.enable_codedeploy_deploy ? aws_codedeploy_app.app[0].name : null
}

output "web_bucket_name" {
  description = "S3 web bucket used as the CodeDeploy deployment target. Null when enable_codedeploy_deploy = false."
  value       = var.enable_codedeploy_deploy ? aws_s3_bucket.web[0].bucket : null
}

output "cloudfront_distribution_domain" {
  description = "CloudFront distribution domain name fronting the S3 web bucket. Null when enable_codedeploy_deploy = false."
  value       = var.enable_codedeploy_deploy ? aws_cloudfront_distribution.web[0].domain_name : null
}
