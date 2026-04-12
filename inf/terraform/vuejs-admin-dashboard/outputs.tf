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
  value       = aws_codepipeline.app.name
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
