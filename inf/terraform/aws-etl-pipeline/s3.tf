# ============================================================================
# S3 Buckets — Raw (ingestion) and Clean (output)
# ============================================================================

# ---------------------------------------------------------------------------
# RAW BUCKET — receives .md uploads from html-to-md app
# Access restricted to VPC Endpoint (aws:sourceVpce condition in bucket policy)
# ---------------------------------------------------------------------------

#tfsec:ignore:AVD-AWS-0089 -- S3 access logging to a dedicated log bucket is out of scope; VPC Flow Logs provide network-level audit coverage for this private-VPC pipeline.
resource "aws_s3_bucket" "etl_raw" {
  #checkov:skip=CKV_AWS_144: Cross-region replication is not required for this low-volume async pipeline.
  #checkov:skip=CKV2_AWS_61: Lifecycle rules are managed separately in aws_s3_bucket_lifecycle_configuration.
  bucket = var.raw_bucket_name

  tags = {
    Name = var.raw_bucket_name
    Type = "ETLRaw"
  }
}

resource "aws_s3_bucket_public_access_block" "etl_raw" {
  bucket = aws_s3_bucket.etl_raw.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "etl_raw" {
  bucket = aws_s3_bucket.etl_raw.id

  versioning_configuration {
    status = "Enabled"
  }
}

#tfsec:ignore:AVD-AWS-0132 -- SSE-S3 (AES256) provides encryption at rest; a CMK would add KMS key cost and rotation overhead disproportionate to this portfolio pipeline's risk profile.
resource "aws_s3_bucket_server_side_encryption_configuration" "etl_raw" {
  bucket = aws_s3_bucket.etl_raw.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "etl_raw" {
  bucket = aws_s3_bucket.etl_raw.id

  rule {
    id     = "transition-and-expire-raw-files"
    status = "Enabled"

    filter {}

    # REC-023: Transition to IA before expiry for cost savings
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
}

# Enable EventBridge notifications so all ObjectCreated events flow to the default bus
resource "aws_s3_bucket_notification" "etl_raw" {
  bucket      = aws_s3_bucket.etl_raw.id
  eventbridge = true

  depends_on = [aws_s3_bucket.etl_raw]
}

# Bucket policy: deny object read/write unless request comes from the VPC S3 Endpoint
# RISK-008: blocks aws s3 cp from a laptop — use SSM Session Manager on an EC2 in the VPC,
# or temporarily remove the policy for initial test uploads.
resource "aws_s3_bucket_policy" "etl_raw" {
  bucket = aws_s3_bucket.etl_raw.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonVPCObjectAccess"
        Effect    = "Deny"
        Principal = "*"
        Action    = ["s3:GetObject", "s3:PutObject"]
        Resource  = "${aws_s3_bucket.etl_raw.arn}/*"
        Condition = {
          StringNotEquals = {
            "aws:SourceVpce" = aws_vpc_endpoint.s3.id
          }
        }
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.etl_raw,
    aws_vpc_endpoint.s3,
  ]
}

# ---------------------------------------------------------------------------
# CLEAN BUCKET — stores Bedrock-extracted Markdown + metadata JSON sidecars
# Accessed by Blog app via pre-signed URLs (SigV4 auth enforced, no public access)
# ---------------------------------------------------------------------------

#tfsec:ignore:AVD-AWS-0089 -- see raw bucket note above.
resource "aws_s3_bucket" "etl_clean" {
  #checkov:skip=CKV_AWS_144: Cross-region replication is not required for this low-volume portfolio pipeline.
  #checkov:skip=CKV2_AWS_61: Lifecycle rules are managed separately in aws_s3_bucket_lifecycle_configuration.
  bucket = var.clean_bucket_name

  tags = {
    Name = var.clean_bucket_name
    Type = "ETLClean"
  }
}

resource "aws_s3_bucket_public_access_block" "etl_clean" {
  bucket = aws_s3_bucket.etl_clean.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "etl_clean" {
  bucket = aws_s3_bucket.etl_clean.id

  versioning_configuration {
    status = "Enabled"
  }
}

#tfsec:ignore:AVD-AWS-0132 -- same rationale as raw bucket SSE configuration above.
resource "aws_s3_bucket_server_side_encryption_configuration" "etl_clean" {
  bucket = aws_s3_bucket.etl_clean.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# REC-017: Intelligent tiering for older published articles
resource "aws_s3_bucket_lifecycle_configuration" "etl_clean" {
  bucket = aws_s3_bucket.etl_clean.id

  rule {
    id     = "transition-clean-to-ia"
    status = "Enabled"

    filter {}

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 180
      storage_class = "GLACIER_IR"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 3
    }
  }
}

# Athena query results land here — kept separate from article content via prefix
resource "aws_s3_bucket_object_lock_configuration" "etl_clean" {
  #checkov:skip=CKV2_AWS_65: Object Lock requires bucket created with object_lock_enabled=true; this is a follow-up hardening step for production.
  count  = 0 # Enable in production by recreating bucket with object_lock_enabled=true (REC-009)
  bucket = aws_s3_bucket.etl_clean.id
}
