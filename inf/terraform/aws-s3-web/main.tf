# AWS S3 Static Website Hosting
# This configuration creates and manages S3 buckets for static website hosting

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# S3 Bucket for static website
resource "aws_s3_bucket" "website" {
  #checkov:skip=CKV2_AWS_6: Public access block is intentionally disabled — this bucket serves a public static website; all four block_public_* flags are set explicitly in aws_s3_bucket_public_access_block.
  #checkov:skip=CKV_AWS_145: KMS encryption is not required for public static website assets; SSE-S3 (AES256) is the intentional default.
  #checkov:skip=CKV_AWS_144: Cross-region replication is not required for a personal-portfolio static website with no availability SLA.
  #checkov:skip=CKV2_AWS_62: S3 event notifications are not required for a static read-only website asset bucket.
  bucket = var.bucket_name

  tags = merge(
    local.common_tags,
    {
      Name = var.bucket_name
      Type = "StaticWebsite"
    }
  )
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# S3 Bucket Website Configuration
resource "aws_s3_bucket_website_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  index_document {
    suffix = var.index_document
  }

  error_document {
    key = var.error_document
  }

  dynamic "routing_rule" {
    for_each = var.routing_rules
    content {
      condition {
        key_prefix_equals               = lookup(routing_rule.value.condition, "key_prefix_equals", null)
        http_error_code_returned_equals = lookup(routing_rule.value.condition, "http_error_code_returned_equals", null)
      }
      redirect {
        host_name               = lookup(routing_rule.value.redirect, "host_name", null)
        http_redirect_code      = lookup(routing_rule.value.redirect, "http_redirect_code", null)
        protocol                = lookup(routing_rule.value.redirect, "protocol", null)
        replace_key_prefix_with = lookup(routing_rule.value.redirect, "replace_key_prefix_with", null)
        replace_key_with        = lookup(routing_rule.value.redirect, "replace_key_with", null)
      }
    }
  }
}

# S3 Bucket Public Access Block Configuration
# All four flags are intentionally false: S3 static website hosting requires a public
# bucket policy (s3:GetObject for Principal "*") which cannot coexist with these blocks.
resource "aws_s3_bucket_public_access_block" "website" {
  #checkov:skip=CKV_AWS_53: Public ACLs must be unblocked to support S3 static website hosting with a public bucket policy.
  #checkov:skip=CKV_AWS_54: Public bucket policy must be unblocked to allow the s3:GetObject grant required for static website serving.
  #checkov:skip=CKV_AWS_55: Public ACLs must not be ignored to support S3 static website hosting.
  #checkov:skip=CKV_AWS_56: Restricting public buckets would block the public bucket policy required for static website serving.
  bucket = aws_s3_bucket.website.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 Bucket Policy for Public Read Access
resource "aws_s3_bucket_policy" "website" {
  #checkov:skip=CKV_AWS_70: Principal "*" with s3:GetObject is intentional — this bucket is a public static website that must be readable by anonymous internet users.
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.website.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.website]
}

# S3 Bucket Server Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Logging (Optional)
resource "aws_s3_bucket_logging" "website" {
  count = var.enable_logging ? 1 : 0

  bucket = aws_s3_bucket.website.id

  target_bucket = var.logging_bucket_name != "" ? var.logging_bucket_name : aws_s3_bucket.website.id
  target_prefix = "logs/${var.environment}/"
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "website" {
  count = var.enable_lifecycle_rules ? 1 : 0

  bucket = aws_s3_bucket.website.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# S3 Bucket CORS Configuration
resource "aws_s3_bucket_cors_configuration" "website" {
  count = length(var.cors_rules) > 0 ? 1 : 0

  bucket = aws_s3_bucket.website.id

  dynamic "cors_rule" {
    for_each = var.cors_rules
    content {
      allowed_headers = cors_rule.value.allowed_headers
      allowed_methods = cors_rule.value.allowed_methods
      allowed_origins = cors_rule.value.allowed_origins
      expose_headers  = lookup(cors_rule.value, "expose_headers", null)
      max_age_seconds = lookup(cors_rule.value, "max_age_seconds", null)
    }
  }
}
