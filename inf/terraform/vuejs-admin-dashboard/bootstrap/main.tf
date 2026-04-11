# ============================================================================
# Bootstrap — S3 + DynamoDB Remote State Backend
# ============================================================================
# Run ONCE before the main module is initialised:
#   cd inf/terraform/vuejs-admin-dashboard/bootstrap
#   terraform init
#   terraform apply
#
# These resources are intentionally NOT managed by the main module's remote
# backend — they must exist before the backend can be configured.
# ============================================================================

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "vuejs-admin-dashboard"
      Project     = "vuejs-admin-dashboard"
      ManagedBy   = "Terraform"
      Environment = "bootstrap"
    }
  }
}

variable "aws_region" {
  description = "AWS region for bootstrap resources"
  type        = string
  default     = "ap-southeast-1"
}

# ============================================================================
# S3 State Bucket
# ============================================================================

resource "aws_s3_bucket" "tf_state" {
  #checkov:skip=CKV_AWS_144: Cross-region replication not required for a Terraform state bucket in this single-region deployment.
  #checkov:skip=CKV2_AWS_62: Event notifications not required for a Terraform state bucket.
  bucket = "vuejs-admin-dashboard-tf-state"

  tags = {
    Name = "vuejs-admin-dashboard-tf-state"
  }
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ============================================================================
# DynamoDB State Lock Table
# ============================================================================

resource "aws_dynamodb_table" "tf_lock" {
  name         = "vuejs-admin-dashboard-tf-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "vuejs-admin-dashboard-tf-lock"
  }
}

# ============================================================================
# Outputs
# ============================================================================

output "state_bucket_name" {
  description = "Name of the S3 bucket used for Terraform state"
  value       = aws_s3_bucket.tf_state.bucket
}

output "lock_table_name" {
  description = "Name of the DynamoDB table used for state locking"
  value       = aws_dynamodb_table.tf_lock.name
}
