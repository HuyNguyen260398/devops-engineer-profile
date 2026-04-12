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

# ============================================================================
# CodeBuild → CodeArtifact Policy
# ============================================================================
# Allows CodeBuild to obtain a short-lived CodeArtifact authorization token
# and read npm packages from the private repository.

data "aws_iam_policy_document" "codebuild_codeartifact_policy" {
  statement {
    sid    = "CodeArtifactToken"
    effect = "Allow"
    actions = [
      "sts:GetServiceBearerToken",
    ]
    # STS bearer token is not resource-scoped; condition narrows to CodeArtifact only.
    #tfsec:ignore:aws-iam-no-policy-wildcards
    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "sts:AWSServiceName"
      values   = ["codeartifact.amazonaws.com"]
    }
  }

  statement {
    sid    = "CodeArtifactDomainRead"
    effect = "Allow"
    actions = [
      "codeartifact:GetAuthorizationToken",
      "codeartifact:GetRepositoryEndpoint",
    ]
    resources = [aws_codeartifact_domain.app.arn]
  }

  statement {
    sid    = "CodeArtifactPackageRead"
    effect = "Allow"
    actions = [
      "codeartifact:ReadFromRepository",
      "codeartifact:GetPackageVersionAsset",
      "codeartifact:GetPackageVersionReadme",
      "codeartifact:ListPackages",
      "codeartifact:ListPackageVersions",
      "codeartifact:ListPackageVersionAssets",
      "codeartifact:DescribePackageVersion",
    ]
    resources = [aws_codeartifact_repository.npm.arn]
  }
}

resource "aws_iam_role_policy" "codebuild_codeartifact_policy" {
  name   = "${local.name_prefix}-codebuild-codeartifact-policy"
  role   = aws_iam_role.codebuild_role.id
  policy = data.aws_iam_policy_document.codebuild_codeartifact_policy.json
}

# ============================================================================
# CodeDeploy Service Role (conditional)
# ============================================================================

data "aws_iam_policy_document" "codedeploy_assume_role" {
  statement {
    sid     = "CodeDeployAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codedeploy.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codedeploy_role" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  name               = "${local.name_prefix}-codedeploy-role"
  assume_role_policy = data.aws_iam_policy_document.codedeploy_assume_role.json

  tags = {
    Name = "${local.name_prefix}-codedeploy-role"
  }
}

# AWS managed policy granting CodeDeploy permissions to describe/manage EC2
# instances, Auto Scaling groups, ELBs, and SNS notifications.
resource "aws_iam_role_policy_attachment" "codedeploy_managed_policy" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  role       = aws_iam_role.codedeploy_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
}

data "aws_iam_policy_document" "codedeploy_s3_cloudfront_policy" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  statement {
    sid    = "ArtifactBucketRead"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
      "s3:ListBucket",
    ]
    #tfsec:ignore:aws-iam-no-policy-wildcards
    resources = [
      # bucket-level ARN for s3:ListBucket; object-level /* for object access.
      # Both are scoped to the specific artifact bucket — not a true wildcard.
      aws_s3_bucket.pipeline_artifacts.arn,
      "${aws_s3_bucket.pipeline_artifacts.arn}/*",
    ]
  }

  statement {
    sid    = "WebBucketWrite"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:ListBucket",
    ]
    #tfsec:ignore:aws-iam-no-policy-wildcards
    resources = [
      # bucket-level ARN for s3:ListBucket; object-level /* for object access.
      # Both are scoped to the specific web bucket — not a true wildcard.
      aws_s3_bucket.web[0].arn,
      "${aws_s3_bucket.web[0].arn}/*",
    ]
  }

  statement {
    sid    = "CloudFrontInvalidation"
    effect = "Allow"
    actions = [
      "cloudfront:CreateInvalidation",
    ]
    resources = [aws_cloudfront_distribution.web[0].arn]
  }
}

resource "aws_iam_role_policy" "codedeploy_s3_cloudfront_policy" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  name   = "${local.name_prefix}-codedeploy-s3-cloudfront-policy"
  role   = aws_iam_role.codedeploy_role[0].id
  policy = data.aws_iam_policy_document.codedeploy_s3_cloudfront_policy[0].json
}

# ============================================================================
# CodePipeline → CodeDeploy Policy (conditional)
# ============================================================================

data "aws_iam_policy_document" "codepipeline_codedeploy_policy" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  statement {
    sid    = "CodeDeployAccess"
    effect = "Allow"
    actions = [
      "codedeploy:CreateDeployment",
      "codedeploy:GetDeployment",
      "codedeploy:GetDeploymentConfig",
      "codedeploy:RegisterApplicationRevision",
      "codedeploy:GetApplicationRevision",
    ]
    resources = [
      aws_codedeploy_app.app[0].arn,
      "arn:aws:codedeploy:${local.region}:${local.account_id}:deploymentgroup:${local.name_prefix}/${local.name_prefix}",
      "arn:aws:codedeploy:${local.region}:${local.account_id}:deploymentconfig:CodeDeployDefault.AllAtOnce",
    ]
  }
}

resource "aws_iam_role_policy" "codepipeline_codedeploy_policy" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  name   = "${local.name_prefix}-codepipeline-codedeploy-policy"
  role   = aws_iam_role.codepipeline_role.id
  policy = data.aws_iam_policy_document.codepipeline_codedeploy_policy[0].json
}
