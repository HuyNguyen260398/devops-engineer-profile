# ============================================================================
# Data sources + shared locals
# ============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name
  name_prefix = "${var.project_name}-${var.environment}"
}

# ============================================================================
# CodeBuild IAM Role
# ============================================================================

data "aws_iam_policy_document" "codebuild_assume_role" {
  statement {
    sid     = "CodeBuildAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild_role" {
  name               = "${local.name_prefix}-codebuild-role"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume_role.json

  tags = {
    Name = "${local.name_prefix}-codebuild-role"
  }
}

data "aws_iam_policy_document" "codebuild_policy" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/codebuild/${local.name_prefix}",
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/codebuild/${local.name_prefix}:*",
    ]
  }

  statement {
    sid    = "ArtifactBucketAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
    ]
    #tfsec:ignore:aws-iam-no-policy-wildcards
    resources = [
      # bucket-level ARN required for s3:GetBucketVersioning; object-level /* required for object operations.
      # Both ARNs are scoped to this specific bucket — not a true wildcard.
      aws_s3_bucket.pipeline_artifacts.arn,
      "${aws_s3_bucket.pipeline_artifacts.arn}/*",
    ]
  }

  statement {
    sid    = "SSMParameterAccess"
    effect = "Allow"
    actions = [
      "ssm:GetParameters",
      "ssm:GetParameter",
    ]
    resources = [
      "arn:aws:ssm:${local.region}:${local.account_id}:parameter/${var.project_name}/${var.environment}/*",
    ]
  }

  statement {
    sid    = "CodeCommitPull"
    effect = "Allow"
    actions = [
      "codecommit:GitPull",
    ]
    resources = [local.codecommit_repo_arn]
  }
}

resource "aws_iam_role_policy" "codebuild_policy" {
  name   = "${local.name_prefix}-codebuild-policy"
  role   = aws_iam_role.codebuild_role.id
  policy = data.aws_iam_policy_document.codebuild_policy.json
}

# ============================================================================
# CodePipeline IAM Role
# ============================================================================

data "aws_iam_policy_document" "codepipeline_assume_role" {
  statement {
    sid     = "CodePipelineAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codepipeline_role" {
  name               = "${local.name_prefix}-codepipeline-role"
  assume_role_policy = data.aws_iam_policy_document.codepipeline_assume_role.json

  tags = {
    Name = "${local.name_prefix}-codepipeline-role"
  }
}

data "aws_iam_policy_document" "codepipeline_policy" {
  statement {
    sid    = "CodeCommitSource"
    effect = "Allow"
    actions = [
      "codecommit:GetBranch",
      "codecommit:GetCommit",
      "codecommit:GetUploadArchiveStatus",
      "codecommit:UploadArchive",
    ]
    resources = [local.codecommit_repo_arn]
  }

  statement {
    sid    = "CodeBuildAccess"
    effect = "Allow"
    actions = [
      "codebuild:BatchGetBuilds",
      "codebuild:StartBuild",
    ]
    resources = ["arn:aws:codebuild:${local.region}:${local.account_id}:project/${local.name_prefix}"]
  }

  statement {
    sid    = "ArtifactBucketAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:PutObject",
      "s3:GetBucketVersioning",
    ]
    #tfsec:ignore:aws-iam-no-policy-wildcards
    resources = [
      # bucket-level ARN required for s3:GetBucketVersioning; object-level /* required for object operations.
      # Both ARNs are scoped to this specific bucket — not a true wildcard.
      aws_s3_bucket.pipeline_artifacts.arn,
      "${aws_s3_bucket.pipeline_artifacts.arn}/*",
    ]
  }

  statement {
    sid    = "LambdaInvoke"
    effect = "Allow"
    actions = [
      "lambda:InvokeFunction",
      "lambda:ListFunctions",
    ]
    resources = [
      "arn:aws:lambda:${local.region}:${local.account_id}:function:${local.name_prefix}-amplify-deploy",
    ]
  }
}

resource "aws_iam_role_policy" "codepipeline_policy" {
  name   = "${local.name_prefix}-codepipeline-policy"
  role   = aws_iam_role.codepipeline_role.id
  policy = data.aws_iam_policy_document.codepipeline_policy.json
}

# ============================================================================
# Amplify Service Role
# ============================================================================

data "aws_iam_policy_document" "amplify_assume_role" {
  statement {
    sid     = "AmplifyAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["amplify.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "amplify_service_role" {
  name               = "${local.name_prefix}-amplify-service-role"
  assume_role_policy = data.aws_iam_policy_document.amplify_assume_role.json

  tags = {
    Name = "${local.name_prefix}-amplify-service-role"
  }
}

data "aws_iam_policy_document" "amplify_policy" {
  statement {
    sid    = "AmplifyDeployAccess"
    effect = "Allow"
    actions = [
      "amplify:CreateDeployment",
      "amplify:StartDeployment",
      "amplify:GetDeployment",
    ]
    resources = [
      "arn:aws:amplify:${local.region}:${local.account_id}:apps/*",
    ]
  }

  statement {
    sid    = "ArtifactBucketRead"
    effect = "Allow"
    actions = [
      "s3:GetObject",
    ]
    #tfsec:ignore:aws-iam-no-policy-wildcards
    resources = [
      # /* is required to grant object-level access; scoped to this specific artifact bucket — not a true wildcard.
      "${aws_s3_bucket.pipeline_artifacts.arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "amplify_policy" {
  name   = "${local.name_prefix}-amplify-policy"
  role   = aws_iam_role.amplify_service_role.id
  policy = data.aws_iam_policy_document.amplify_policy.json
}

# ============================================================================
# Lambda Amplify Deploy Trigger IAM Role
# ============================================================================

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    sid     = "LambdaAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "amplify_deploy_lambda_role" {
  name               = "${local.name_prefix}-amplify-deploy-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = {
    Name = "${local.name_prefix}-amplify-deploy-lambda-role"
  }
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/lambda/${local.name_prefix}-amplify-deploy",
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:/aws/lambda/${local.name_prefix}-amplify-deploy:*",
    ]
  }

  statement {
    sid    = "AmplifyDeploy"
    effect = "Allow"
    actions = [
      "amplify:CreateDeployment",
      "amplify:StartDeployment",
    ]
    resources = [
      "arn:aws:amplify:${local.region}:${local.account_id}:apps/*",
    ]
  }

  statement {
    sid    = "ArtifactBucketRead"
    effect = "Allow"
    actions = [
      "s3:GetObject",
    ]
    #tfsec:ignore:aws-iam-no-policy-wildcards
    resources = [
      # /* is required to grant object-level access; scoped to this specific artifact bucket — not a true wildcard.
      "${aws_s3_bucket.pipeline_artifacts.arn}/*",
    ]
  }

  statement {
    sid    = "CodePipelineJobResults"
    effect = "Allow"
    actions = [
      "codepipeline:PutJobSuccessResult",
      "codepipeline:PutJobFailureResult",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "lambda_policy" {
  name   = "${local.name_prefix}-amplify-deploy-lambda-policy"
  role   = aws_iam_role.amplify_deploy_lambda_role.id
  policy = data.aws_iam_policy_document.lambda_policy.json
}

# ============================================================================
# EventBridge CodePipeline Trigger Role
# ============================================================================

data "aws_iam_policy_document" "events_assume_role" {
  statement {
    sid     = "EventsAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "events_pipeline_trigger_role" {
  name               = "${local.name_prefix}-events-pipeline-trigger-role"
  assume_role_policy = data.aws_iam_policy_document.events_assume_role.json

  tags = {
    Name = "${local.name_prefix}-events-pipeline-trigger-role"
  }
}

data "aws_iam_policy_document" "events_pipeline_trigger_policy" {
  statement {
    sid    = "StartPipeline"
    effect = "Allow"
    actions = [
      "codepipeline:StartPipelineExecution",
    ]
    resources = [
      "arn:aws:codepipeline:${local.region}:${local.account_id}:${local.name_prefix}-pipeline",
    ]
  }
}

resource "aws_iam_role_policy" "events_pipeline_trigger_policy" {
  name   = "${local.name_prefix}-events-pipeline-trigger-policy"
  role   = aws_iam_role.events_pipeline_trigger_role.id
  policy = data.aws_iam_policy_document.events_pipeline_trigger_policy.json
}

# ============================================================================
# GitHub Actions → CodeCommit Sync Role (OIDC federated)
# ============================================================================
# IAM role assumed by a GitHub Actions workflow via OIDC to mirror the
# src/vuejs-admin-dashboard/ subtree of the monorepo into the CodeCommit
# repository on every merged PR. The trust policy is scoped to merges on a
# single branch of a single GitHub repository. The inline policy grants
# only the CodeCommit actions required to push to the single shared repo.
#
# Only the environment that owns the CodeCommit repository should create
# this role (set create_codecommit_sync_role = true in production).
#
# Prerequisite: the GitHub OIDC identity provider
# (token.actions.githubusercontent.com) must already exist in the AWS
# account. It is provisioned by inf/terraform/aws-github-oidc/.

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_codecommit_sync_role ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "codecommit_sync_assume_role" {
  count = var.create_codecommit_sync_role ? 1 : 0

  statement {
    sid     = "GitHubOIDCAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github[0].arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_owner}/${var.github_repository}:ref:refs/heads/${var.codecommit_sync_branch}",
      ]
    }
  }
}

resource "aws_iam_role" "codecommit_sync_role" {
  count = var.create_codecommit_sync_role ? 1 : 0

  name               = "${local.name_prefix}-codecommit-sync-role"
  description        = "Assumed via GitHub OIDC by the vuejs-admin-dashboard-codecommit-sync workflow to mirror the app subtree into CodeCommit"
  assume_role_policy = data.aws_iam_policy_document.codecommit_sync_assume_role[0].json

  tags = {
    Name = "${local.name_prefix}-codecommit-sync-role"
  }
}

data "aws_iam_policy_document" "codecommit_sync_policy" {
  count = var.create_codecommit_sync_role ? 1 : 0

  statement {
    sid    = "CodeCommitPushAccess"
    effect = "Allow"
    actions = [
      "codecommit:GitPush",
      "codecommit:GitPull",
      "codecommit:GetRepository",
      "codecommit:GetBranch",
      "codecommit:BatchGetRepositories",
    ]
    resources = [local.codecommit_repo_arn]
  }
}

resource "aws_iam_role_policy" "codecommit_sync_policy" {
  count = var.create_codecommit_sync_role ? 1 : 0

  name   = "${local.name_prefix}-codecommit-sync-policy"
  role   = aws_iam_role.codecommit_sync_role[0].id
  policy = data.aws_iam_policy_document.codecommit_sync_policy[0].json
}
