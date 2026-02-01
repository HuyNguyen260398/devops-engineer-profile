# ==============================================================================
# GitHub Repository Secrets Management
# ==============================================================================

# GitHub repository secret for AWS region
# Note: Requires GitHub token with 'repo' and 'workflow' scopes
resource "github_actions_secret" "aws_region" {
  count            = var.create_github_secrets ? 1 : 0
  repository       = var.github_repository
  secret_name      = "AWS_REGION"
  plaintext_value  = var.aws_region
  depends_on       = []
}

# GitHub repository secret for AWS access key ID (fallback authentication)
# Only create if access key is provided and OIDC is disabled or not primary
# Note: Requires GitHub token with 'repo' and 'workflow' scopes
resource "github_actions_secret" "aws_access_key_id" {
  count            = var.aws_access_key_id != "" && var.create_github_secrets ? 1 : 0
  repository       = var.github_repository
  secret_name      = "AWS_ACCESS_KEY_ID"
  plaintext_value  = var.aws_access_key_id
  depends_on       = []
}

# GitHub repository secret for AWS secret access key (fallback authentication)
# Only create if secret access key is provided and OIDC is disabled or not primary
# Note: Requires GitHub token with 'repo' and 'workflow' scopes
resource "github_actions_secret" "aws_secret_access_key" {
  count            = var.aws_secret_access_key != "" && var.create_github_secrets ? 1 : 0
  repository       = var.github_repository
  secret_name      = "AWS_SECRET_ACCESS_KEY"
  plaintext_value  = var.aws_secret_access_key
  depends_on       = []
}

# GitHub repository secret for AWS IAM role ARN (OIDC-based authentication)
# Note: Requires GitHub token with 'repo' and 'workflow' scopes
resource "github_actions_secret" "aws_role_to_assume" {
  count            = var.enable_oidc_authentication && var.create_github_secrets ? 1 : 0
  repository       = var.github_repository
  secret_name      = "AWS_ROLE_TO_ASSUME"
  plaintext_value  = aws_iam_role.github_actions_oidc[0].arn
  depends_on       = [aws_iam_role.github_actions_oidc]
}

# ==============================================================================
# GitHub Repository Variables
# ==============================================================================

# GitHub repository variable for S3 bucket name
# Note: Requires GitHub token with 'repo' and 'workflow' scopes
resource "github_actions_variable" "s3_bucket_name" {
  count            = var.create_github_variables ? 1 : 0
  repository       = var.github_repository
  variable_name    = "S3_BUCKET_NAME"
  value            = var.s3_bucket_name_prod
  depends_on       = []
}

# ==============================================================================
# AWS IAM - OIDC Identity Provider
# ==============================================================================

# Register GitHub as an OIDC provider in AWS
resource "aws_iam_openid_connect_provider" "github" {
  count = var.enable_oidc_authentication ? 1 : 0

  url = local.github_oidc_provider_url

  client_id_list = ["sts.amazonaws.com"]

  # GitHub's OIDC provider certificate thumbprint
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",  # Current thumbprint (as of 2024)
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"   # Legacy thumbprint
  ]

  tags = local.common_tags

  lifecycle {
    ignore_changes = [tags_all]
  }
}

# ==============================================================================
# AWS IAM - Role for GitHub Actions
# ==============================================================================

# IAM role that GitHub Actions will assume via OIDC
resource "aws_iam_role" "github_actions_oidc" {
  count = var.enable_oidc_authentication ? 1 : 0

  name = var.aws_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = local.github_oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_owner}/${var.github_repository}:*"
          }
        }
      }
    ]
  })

  description = "Role for GitHub Actions to assume via OIDC for S3 sync operations"
  tags        = local.common_tags

  lifecycle {
    ignore_changes = [tags_all]
  }

  depends_on = [aws_iam_openid_connect_provider.github]
}

# ==============================================================================
# AWS IAM - Policy for S3 Sync Operations
# ==============================================================================

# IAM policy allowing S3 sync operations (read/write to specific bucket)
resource "aws_iam_policy" "github_actions_s3_sync" {
  name        = "${var.aws_role_name}-s3-sync-policy"
  description = "Policy for GitHub Actions to sync files to S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3SyncOperations"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:${data.aws_partition.current.partition}:s3:::${var.s3_bucket_name_prod}",
          "arn:${data.aws_partition.current.partition}:s3:::${var.s3_bucket_name_prod}/*",
          "arn:${data.aws_partition.current.partition}:s3:::${var.s3_bucket_name_staging}",
          "arn:${data.aws_partition.current.partition}:s3:::${var.s3_bucket_name_staging}/*"
        ]
      },
      {
        Sid    = "S3ListAllMyBuckets"
        Effect = "Allow"
        Action = [
          "s3:ListAllMyBuckets",
          "s3:GetBucketLocation"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags

  lifecycle {
    ignore_changes = [tags_all]
  }
}

# Attach the S3 sync policy to the GitHub Actions OIDC role
resource "aws_iam_role_policy_attachment" "github_actions_s3_sync" {
  count      = var.enable_oidc_authentication ? 1 : 0
  role       = aws_iam_role.github_actions_oidc[0].name
  policy_arn = aws_iam_policy.github_actions_s3_sync.arn
}
