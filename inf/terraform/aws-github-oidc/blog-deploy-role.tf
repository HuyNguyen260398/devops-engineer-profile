# ==============================================================================
# GitHub Actions OIDC deploy role for the aws-s3-web stack
# ==============================================================================
# Assumed by .github/workflows/blog-deploy.yml (push to main / dispatch on main)
# to `terraform apply` the unified portfolio-site + serverless-blog stack. Its ARN
# is wired into the AWS_DEPLOY_ROLE_ARN repository secret.
#
# Data-plane services (S3, DynamoDB, Lambda, CloudWatch Logs, IAM) are scoped to
# the blog resources + Terraform state so this role cannot touch unrelated
# resources in the shared account. Control-plane services the stack must create
# (VPC/EC2, Cognito, API Gateway, CloudFront, ACM, Route53) are broad.
# ==============================================================================

variable "blog_deploy_role_name" {
  description = "Name of the IAM role GitHub Actions assumes to deploy the aws-s3-web stack."
  type        = string
  default     = "github-actions-blog-deploy"
  nullable    = false
}

variable "blog_site_bucket_name" {
  description = "Website bucket managed/imported by the aws-s3-web stack."
  type        = string
  default     = "s3.nghuy.link"
  nullable    = false
}

variable "blog_media_bucket_name" {
  description = "Media bucket created by the aws-s3-web stack."
  type        = string
  default     = "blogs-nghuy-link-media-010382427026"
  nullable    = false
}

variable "tf_state_bucket_name" {
  description = "S3 bucket holding the aws-s3-web Terraform state."
  type        = string
  default     = "aws-github-oidc-tfstate-010382427026"
  nullable    = false
}

variable "tf_lock_table_name" {
  description = "DynamoDB table used for Terraform state locking."
  type        = string
  default     = "aws-github-oidc-tfstate-lock"
  nullable    = false
}

locals {
  blog_account_id = data.aws_caller_identity.current.account_id
  blog_partition  = data.aws_partition.current.partition
}

resource "aws_iam_role" "blog_deploy" {
  count = var.enable_oidc_authentication ? 1 : 0

  name = var.blog_deploy_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = local.github_oidc_provider_arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Scoped to main — blog-deploy.yml runs on push to / dispatch on main.
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_owner}/${var.github_repository}:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  description = "GitHub Actions OIDC role to deploy the aws-s3-web stack (portfolio site + serverless blog)."
  tags        = local.common_tags

  depends_on = [aws_iam_openid_connect_provider.github]
}

resource "aws_iam_policy" "blog_deploy" {
  count = var.enable_oidc_authentication ? 1 : 0

  name        = "${var.blog_deploy_role_name}-policy"
  description = "Provisioning permissions for the aws-s3-web stack + Terraform state access."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "InfraProvisioning"
        Effect = "Allow"
        Action = [
          "ec2:*",
          "cognito-idp:*",
          "apigateway:*",
          "cloudfront:*",
          "acm:*",
          "route53:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "DynamoDBBlogTable"
        Effect = "Allow"
        Action = ["dynamodb:*"]
        Resource = [
          "arn:${local.blog_partition}:dynamodb:${var.aws_region}:${local.blog_account_id}:table/blog-posts",
          "arn:${local.blog_partition}:dynamodb:${var.aws_region}:${local.blog_account_id}:table/blog-posts/index/*"
        ]
      },
      {
        Sid    = "BlogBucketsReadWrite"
        Effect = "Allow"
        Action = ["s3:*"]
        Resource = [
          "arn:${local.blog_partition}:s3:::${var.blog_site_bucket_name}",
          "arn:${local.blog_partition}:s3:::${var.blog_site_bucket_name}/*",
          "arn:${local.blog_partition}:s3:::${var.blog_media_bucket_name}",
          "arn:${local.blog_partition}:s3:::${var.blog_media_bucket_name}/*"
        ]
      },
      {
        Sid    = "LambdaFunctions"
        Effect = "Allow"
        Action = ["lambda:*"]
        Resource = [
          "arn:${local.blog_partition}:lambda:${var.aws_region}:${local.blog_account_id}:function:blog-*"
        ]
      },
      {
        Sid    = "LambdaLogs"
        Effect = "Allow"
        Action = ["logs:*"]
        Resource = [
          "arn:${local.blog_partition}:logs:${var.aws_region}:${local.blog_account_id}:log-group:/aws/lambda/blog-*",
          "arn:${local.blog_partition}:logs:${var.aws_region}:${local.blog_account_id}:log-group:/aws/lambda/blog-*:*"
        ]
      },
      {
        Sid    = "IamLambdaExecutionRole"
        Effect = "Allow"
        Action = [
          "iam:GetRole",
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:PassRole",
          "iam:PutRolePolicy",
          "iam:GetRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:ListRolePolicies",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole",
          "iam:UpdateAssumeRolePolicy"
        ]
        Resource = "arn:${local.blog_partition}:iam::${local.blog_account_id}:role/blog-*"
      },
      {
        Sid      = "TerraformStateBucket"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = "arn:${local.blog_partition}:s3:::${var.tf_state_bucket_name}"
      },
      {
        Sid      = "TerraformStateObjects"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "arn:${local.blog_partition}:s3:::${var.tf_state_bucket_name}/aws-s3-web/*"
      },
      {
        Sid      = "TerraformStateLock"
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:DescribeTable"]
        Resource = "arn:${local.blog_partition}:dynamodb:${var.aws_region}:${local.blog_account_id}:table/${var.tf_lock_table_name}"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "blog_deploy" {
  count      = var.enable_oidc_authentication ? 1 : 0
  role       = aws_iam_role.blog_deploy[0].name
  policy_arn = aws_iam_policy.blog_deploy[0].arn
}

output "blog_deploy_role_arn" {
  description = "ARN of the GitHub Actions OIDC role that deploys the aws-s3-web stack (set as AWS_DEPLOY_ROLE_ARN)."
  value       = var.enable_oidc_authentication ? aws_iam_role.blog_deploy[0].arn : null
}
