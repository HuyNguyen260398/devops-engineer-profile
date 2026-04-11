# ============================================================================
# CodeCommit Repository
# ============================================================================
# The repository is shared across environments (production creates it;
# staging references it via a data source).  Use create_codecommit_repo = false
# in any environment that is not the first one applied.

resource "aws_codecommit_repository" "app" {
  count = var.create_codecommit_repo ? 1 : 0

  repository_name = var.codecommit_repo_name
  description     = "Source repository for the Vue.js Admin Dashboard SPA"

  tags = {
    Name = var.codecommit_repo_name
  }
}

data "aws_codecommit_repository" "app" {
  count = var.create_codecommit_repo ? 0 : 1

  repository_name = var.codecommit_repo_name
}

locals {
  # Unified reference regardless of whether this env created the repo
  codecommit_repo_arn  = var.create_codecommit_repo ? aws_codecommit_repository.app[0].arn : data.aws_codecommit_repository.app[0].arn
  codecommit_repo_name = var.codecommit_repo_name
}

# ============================================================================
# CodePipeline Artifact Bucket (per-environment)
# ============================================================================

resource "aws_s3_bucket" "pipeline_artifacts" {
  #checkov:skip=CKV_AWS_144: Cross-region replication not required for a short-lived pipeline artifact bucket.
  #checkov:skip=CKV2_AWS_62: Event notifications not required for a pipeline artifact bucket.
  bucket = "${local.name_prefix}-artifacts"

  tags = {
    Name = "${local.name_prefix}-artifacts"
  }
}

resource "aws_s3_bucket_versioning" "pipeline_artifacts" {
  bucket = aws_s3_bucket.pipeline_artifacts.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pipeline_artifacts" {
  bucket = aws_s3_bucket.pipeline_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "pipeline_artifacts" {
  bucket = aws_s3_bucket.pipeline_artifacts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "pipeline_artifacts" {
  bucket = aws_s3_bucket.pipeline_artifacts.id

  rule {
    id     = "expire-artifacts"
    status = "Enabled"

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}
