# The portfolio + blog static export is served from an existing website bucket
# (var.site_bucket_name, e.g. s3.nghuy.link) managed by the aws-s3-web stack. This
# stack only owns the media bucket; the site bucket is referenced as a CloudFront
# custom origin in cdn.tf.
resource "aws_s3_bucket" "media" {
  bucket = var.media_bucket_name
  tags   = merge(local.common_tags, { Name = var.media_bucket_name, Type = "BlogMedia" })
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
