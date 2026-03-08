# ============================================================================
# S3 Bucket for Resume PDF Storage (Private)
# ============================================================================

resource "aws_s3_bucket" "resume_bucket" {
  #checkov:skip=CKV_AWS_145: KMS encryption is parameterised via use_kms_encryption; AES256 (SSE-S3) is the intentional default for this personal-portfolio asset bucket.
  #checkov:skip=CKV_AWS_144: Cross-region replication is not required for a personal-portfolio resume bucket with no availability SLA.
  #checkov:skip=CKV2_AWS_61: Lifecycle policy is not required; versioned objects are managed manually for this low-churn, single-file bucket.
  #checkov:skip=CKV2_AWS_62: S3 event notifications are not required for this static read-only asset bucket.
  bucket = var.resume_bucket_name

  tags = {
    Name        = "Resume PDF Storage"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "resume_bucket" {
  bucket = aws_s3_bucket.resume_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning for resume files
resource "aws_s3_bucket_versioning" "resume_bucket" {
  bucket = aws_s3_bucket.resume_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "resume_bucket" {
  bucket = aws_s3_bucket.resume_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.use_kms_encryption ? "aws:kms" : "AES256"
      kms_master_key_id = var.use_kms_encryption ? var.kms_key_id : null
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Logging
resource "aws_s3_bucket_logging" "resume_bucket" {
  count = var.enable_s3_logging ? 1 : 0

  bucket = aws_s3_bucket.resume_bucket.id

  target_bucket = var.s3_log_bucket_name
  target_prefix = "resume-bucket-logs/"
}

# ============================================================================
# CloudFront Origin Access Control (OAC)
# ============================================================================

resource "aws_cloudfront_origin_access_control" "resume_oac" {
  name                              = "resume-s3-oac"
  description                       = "Origin Access Control for Resume S3 Bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ============================================================================
# CloudFront Distribution
# ============================================================================

resource "aws_cloudfront_distribution" "resume_cdn" {
  #checkov:skip=CKV_AWS_68: WAF is parameterised via enable_waf; not required for a personal-portfolio CDN serving static PDF downloads.
  #checkov:skip=CKV2_AWS_47: WAFv2 AMR Log4j rule group is only applicable when WAF is enabled; WAF is opt-in via enable_waf.
  #checkov:skip=CKV_AWS_305: No HTML root object exists; this distribution serves downloads at explicit signed paths, not a web-app root.
  #checkov:skip=CKV_AWS_310: Origin failover requires a secondary origin; not warranted for a single-origin personal-portfolio CDN.
  #checkov:skip=CKV2_AWS_32: Response-headers policy is not required for this non-interactive, download-only CDN with no browser-rendered content.
  #checkov:skip=CKV2_AWS_42: Custom SSL certificate is parameterised via use_custom_domain/acm_certificate_arn; CloudFront default certificate is intentional when use_custom_domain=false.
  enabled             = true
  comment             = "CDN for Resume PDF Downloads"
  price_class         = var.cloudfront_price_class
  default_root_object = ""
  web_acl_id          = var.enable_waf ? var.waf_web_acl_id : null

  origin {
    domain_name              = aws_s3_bucket.resume_bucket.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.resume_bucket.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.resume_oac.id

    origin_path = "/resume" # Store PDFs in /resume folder
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.resume_bucket.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000 # 1 year

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }
  }

  # Custom error responses
  custom_error_response {
    error_code         = 403
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "logging_config" {
    for_each = var.enable_cloudfront_logging ? [1] : []
    content {
      include_cookies = false
      bucket          = "${var.cloudfront_log_bucket_name}.s3.amazonaws.com"
      prefix          = "cloudfront-resume-logs/"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.use_custom_domain ? false : true
    acm_certificate_arn            = var.use_custom_domain ? var.acm_certificate_arn : null
    ssl_support_method             = var.use_custom_domain ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  tags = {
    Name        = "Resume CDN"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ============================================================================
# S3 Bucket Policy - Allow CloudFront OAC Access
# ============================================================================

data "aws_iam_policy_document" "resume_bucket_policy" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.resume_bucket.arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.resume_cdn.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "resume_bucket" {
  bucket = aws_s3_bucket.resume_bucket.id
  policy = data.aws_iam_policy_document.resume_bucket_policy.json
}

# ============================================================================
# Optional: Route53 Alias for Custom Domain
# ============================================================================

resource "aws_route53_record" "resume_cdn_alias" {
  count = var.use_custom_domain && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.cdn_subdomain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.resume_cdn.domain_name
    zone_id                = aws_cloudfront_distribution.resume_cdn.hosted_zone_id
    evaluate_target_health = false
  }
}
