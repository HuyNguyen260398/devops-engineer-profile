# ============================================================================
# CloudWatch Log Group for CodeBuild
# ============================================================================

#tfsec:ignore:aws-cloudwatch-log-group-customer-key
resource "aws_cloudwatch_log_group" "codebuild" {
  #checkov:skip=CKV_AWS_158: CMK encryption not required for CI/CD build logs in this portfolio project.
  name              = "/codebuild/${local.name_prefix}"
  retention_in_days = 14

  tags = {
    Name = "/codebuild/${local.name_prefix}"
  }
}

# ============================================================================
# CodeBuild Project
# ============================================================================

resource "aws_codebuild_project" "app" {
  name          = local.name_prefix
  description   = "Builds the Vue.js Admin Dashboard SPA (${var.environment})"
  service_role  = aws_iam_role.codebuild_role.arn
  build_timeout = 10

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = var.codebuild_compute_type
    image                       = var.codebuild_image
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "ENVIRONMENT"
      value = var.environment
    }

    # CodeArtifact — used by buildspec.yml to configure npm to pull packages
    # from the private proxy instead of registry.npmjs.org directly.
    environment_variable {
      name  = "CODEARTIFACT_DOMAIN"
      value = aws_codeartifact_domain.app.domain
    }

    environment_variable {
      name  = "CODEARTIFACT_DOMAIN_OWNER"
      value = local.account_id
    }

    environment_variable {
      name  = "CODEARTIFACT_REPO"
      value = aws_codeartifact_repository.npm.repository
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }

  cache {
    type  = "LOCAL"
    modes = ["LOCAL_SOURCE_CACHE", "LOCAL_CUSTOM_CACHE"]
  }

  logs_config {
    cloudwatch_logs {
      group_name  = aws_cloudwatch_log_group.codebuild.name
      stream_name = "build"
      status      = "ENABLED"
    }
  }

  tags = {
    Name = local.name_prefix
  }
}

# ============================================================================
# Lambda — Amplify Deploy Trigger
# ============================================================================

data "archive_file" "amplify_deploy_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/amplify_deploy.py"
  output_path = "${path.module}/lambda/amplify_deploy.zip"
}

resource "aws_lambda_function" "amplify_deploy_trigger" {
  function_name    = "${local.name_prefix}-amplify-deploy"
  description      = "Triggers Amplify deployment from CodePipeline artifact (${var.environment})"
  role             = aws_iam_role.amplify_deploy_lambda_role.arn
  runtime          = "python3.12"
  handler          = "amplify_deploy.handler"
  filename         = data.archive_file.amplify_deploy_lambda.output_path
  source_code_hash = data.archive_file.amplify_deploy_lambda.output_base64sha256
  timeout          = 120

  environment {
    variables = {
      AMPLIFY_APP_ID = aws_amplify_app.app.id
      AMPLIFY_BRANCH = var.pipeline_branch
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${local.name_prefix}-amplify-deploy"
  }
}

#tfsec:ignore:aws-cloudwatch-log-group-customer-key
resource "aws_cloudwatch_log_group" "amplify_deploy_lambda" {
  #checkov:skip=CKV_AWS_158: CMK encryption not required for Lambda function logs in this portfolio project.
  name              = "/aws/lambda/${local.name_prefix}-amplify-deploy"
  retention_in_days = 14

  tags = {
    Name = "/aws/lambda/${local.name_prefix}-amplify-deploy"
  }
}

# ============================================================================
# CodePipeline — Source → Build → Deploy
# ============================================================================
# Two mutually exclusive pipeline resources selected by enable_codedeploy_deploy:
#   amplify   (count=1 when false) — Deploy stage invokes Lambda → Amplify
#   codedeploy (count=1 when true) — Deploy stage uses CodeDeploy → S3 + CF
#
# IMPORTANT: If you are changing enable_codedeploy_deploy on an existing state,
# run the following before terraform apply to avoid resource recreation:
#   terraform state mv aws_codepipeline.app aws_codepipeline.amplify[0]

locals {
  active_pipeline_arn = (
    var.enable_codedeploy_deploy
    ? aws_codepipeline.codedeploy[0].arn
    : aws_codepipeline.amplify[0].arn
  )
}

# --- Path A: Lambda → Amplify (default) ------------------------------------

resource "aws_codepipeline" "amplify" {
  count    = var.enable_codedeploy_deploy ? 0 : 1
  name     = "${local.name_prefix}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    location = aws_s3_bucket.pipeline_artifacts.bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeCommit"
      version          = "1"
      output_artifacts = ["SourceArtifact"]

      configuration = {
        RepositoryName       = local.codecommit_repo_name
        BranchName           = var.pipeline_branch
        OutputArtifactFormat = "CODE_ZIP"
        PollForSourceChanges = "false"
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceArtifact"]
      output_artifacts = ["BuildArtifact"]

      configuration = {
        ProjectName = aws_codebuild_project.app.name
      }
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "DeployToAmplify"
      category        = "Invoke"
      owner           = "AWS"
      provider        = "Lambda"
      version         = "1"
      input_artifacts = ["BuildArtifact"]

      configuration = {
        FunctionName   = aws_lambda_function.amplify_deploy_trigger.function_name
        UserParameters = jsonencode({ app_id = aws_amplify_app.app.id, branch = var.pipeline_branch })
      }
    }
  }

  tags = {
    Name = "${local.name_prefix}-pipeline"
  }
}

# --- Path B: CodeDeploy → S3 + CloudFront (opt-in) -------------------------

resource "aws_codepipeline" "codedeploy" {
  count    = var.enable_codedeploy_deploy ? 1 : 0
  name     = "${local.name_prefix}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    location = aws_s3_bucket.pipeline_artifacts.bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeCommit"
      version          = "1"
      output_artifacts = ["SourceArtifact"]

      configuration = {
        RepositoryName       = local.codecommit_repo_name
        BranchName           = var.pipeline_branch
        OutputArtifactFormat = "CODE_ZIP"
        PollForSourceChanges = "false"
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["SourceArtifact"]
      output_artifacts = ["BuildArtifact"]

      configuration = {
        ProjectName = aws_codebuild_project.app.name
      }
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "DeployToS3ViaCodeDeploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeploy"
      version         = "1"
      input_artifacts = ["BuildArtifact"]

      configuration = {
        ApplicationName     = aws_codedeploy_app.app[0].name
        DeploymentGroupName = aws_codedeploy_deployment_group.app[0].deployment_group_name
      }
    }
  }

  tags = {
    Name = "${local.name_prefix}-pipeline"
  }
}

# ============================================================================
# EventBridge — Trigger pipeline on CodeCommit branch push
# ============================================================================

resource "aws_cloudwatch_event_rule" "codecommit_branch_push" {
  name        = "${local.name_prefix}-codecommit-push"
  description = "Triggers the ${var.environment} CodePipeline on push to ${var.pipeline_branch}"

  event_pattern = jsonencode({
    source      = ["aws.codecommit"]
    detail-type = ["CodeCommit Repository State Change"]
    resources   = [local.codecommit_repo_arn]
    detail = {
      event         = ["referenceUpdated", "referenceCreated"]
      referenceType = ["branch"]
      referenceName = [var.pipeline_branch]
    }
  })

  tags = {
    Name = "${local.name_prefix}-codecommit-push"
  }
}

resource "aws_cloudwatch_event_target" "pipeline_trigger" {
  rule     = aws_cloudwatch_event_rule.codecommit_branch_push.name
  arn      = local.active_pipeline_arn
  role_arn = aws_iam_role.events_pipeline_trigger_role.arn
}
