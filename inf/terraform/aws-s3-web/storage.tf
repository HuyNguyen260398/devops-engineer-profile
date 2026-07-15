# The portfolio + blog static export is served from the website bucket defined in
# main.tf (aws_s3_bucket.website, e.g. s3.nghuy.link), fronted as a CloudFront
# custom origin in cdn.tf. This file owns the private media bucket that holds post
# bodies and images.
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

# The editor uploads cover/body images straight to this bucket from the browser
# via a presigned PUT (see src/aws-s3-web/src/lib/blog/upload.ts). That is a
# cross-origin request from https://<root_domain> to the bucket's S3 REST host,
# so the browser sends a CORS preflight the bucket must answer. Reads happen
# same-origin through CloudFront (/media/*), so only the upload origin is needed.
# allowed_headers is "*" to cover content-type plus the AWS SDK's checksum
# headers (x-amz-checksum-*, x-amz-sdk-checksum-algorithm) sent on PutObject.
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${var.root_domain}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
