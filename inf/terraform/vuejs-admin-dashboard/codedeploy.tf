# ============================================================================
# S3 Web Bucket — static-site hosting target for CodeDeploy (conditional)
# ============================================================================

#tfsec:ignore:aws-s3-enable-bucket-logging
#tfsec:ignore:aws-s3-encryption-customer-key
resource "aws_s3_bucket" "web" {
  #checkov:skip=CKV_AWS_144: Cross-region replication not required for a static-website hosting bucket.
  #checkov:skip=CKV2_AWS_62: Event notifications not required for a static-website hosting bucket.
  #checkov:skip=CKV_AWS_18:  Access logging not required for a portfolio static-website bucket.
  #checkov:skip=CKV_AWS_145: CMK encryption is disproportionate for static-website assets; SSE-S3 (AES256) is sufficient.
  count  = var.enable_codedeploy_deploy ? 1 : 0
  bucket = "${local.name_prefix}-web"

  tags = {
    Name = "${local.name_prefix}-web"
  }
}

resource "aws_s3_bucket_versioning" "web" {
  count  = var.enable_codedeploy_deploy ? 1 : 0
  bucket = aws_s3_bucket.web[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

#tfsec:ignore:aws-s3-encryption-customer-key
resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  #checkov:skip=CKV_AWS_145: CMK is disproportionate for static-website assets; SSE-S3 (AES256) is sufficient.
  count  = var.enable_codedeploy_deploy ? 1 : 0
  bucket = aws_s3_bucket.web[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "web" {
  count  = var.enable_codedeploy_deploy ? 1 : 0
  bucket = aws_s3_bucket.web[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "web" {
  count  = var.enable_codedeploy_deploy ? 1 : 0
  bucket = aws_s3_bucket.web[0].id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# ============================================================================
# CloudFront Origin Access Control (OAC) — replaces legacy OAI
# ============================================================================

resource "aws_cloudfront_origin_access_control" "web" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  name                              = "${local.name_prefix}-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ============================================================================
# CloudFront Distribution — fronts the S3 web bucket with HTTPS
# ============================================================================

#tfsec:ignore:aws-cloudfront-enable-logging
#tfsec:ignore:aws-cloudfront-use-secure-tls-policy
resource "aws_cloudfront_distribution" "web" {
  #checkov:skip=CKV_AWS_86:  Access logging not required for a portfolio CDN; disproportionate overhead.
  #checkov:skip=CKV_AWS_68:  WAF not required for a read-only static portfolio site.
  #checkov:skip=CKV2_AWS_47: WAF ACL not required for a read-only static portfolio site.
  #checkov:skip=CKV2_AWS_42: Default CloudFront certificate is acceptable for portfolio; custom ACM cert can be added later.
  count = var.enable_codedeploy_deploy ? 1 : 0

  enabled             = true
  default_root_object = "index.html"
  price_class         = var.cloudfront_price_class
  comment             = "Vue.js Admin Dashboard SPA CDN (${var.environment})"

  origin {
    domain_name              = aws_s3_bucket.web[0].bucket_regional_domain_name
    origin_id                = "${local.name_prefix}-web-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.web[0].id
  }

  default_cache_behavior {
    target_origin_id       = "${local.name_prefix}-web-origin"
    viewer_protocol_policy = "https-only"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Vue Router history-mode fallback: 403/404 from S3 → serve index.html
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Default CloudFront certificate (*.cloudfront.net domain).
  # For a custom domain with TLS 1.2 enforcement, replace with acm_certificate_arn.
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${local.name_prefix}-web-cdn"
  }
}

# ============================================================================
# S3 Bucket Policy — allow CloudFront OAC to read web bucket objects
# ============================================================================

data "aws_iam_policy_document" "web_cloudfront_oac" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  statement {
    sid    = "AllowCloudFrontOACRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web[0].arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web[0].arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web_cloudfront_oac" {
  count  = var.enable_codedeploy_deploy ? 1 : 0
  bucket = aws_s3_bucket.web[0].id
  policy = data.aws_iam_policy_document.web_cloudfront_oac[0].json

  depends_on = [aws_s3_bucket_public_access_block.web]
}

# ============================================================================
# CodeDeploy Application
# ============================================================================

resource "aws_codedeploy_app" "app" {
  count            = var.enable_codedeploy_deploy ? 1 : 0
  name             = local.name_prefix
  compute_platform = "Server"

  tags = {
    Name = local.name_prefix
  }
}

# ============================================================================
# CodeDeploy Deployment Group
# ============================================================================
# Targets EC2 instances tagged with:  CodeDeployTarget = <name_prefix>
# The EC2 instances must run the CodeDeploy agent and carry an instance
# profile that grants s3:GetObject on the artifact bucket and s3:PutObject +
# cloudfront:CreateInvalidation for the deployment lifecycle scripts.

resource "aws_codedeploy_deployment_group" "app" {
  count = var.enable_codedeploy_deploy ? 1 : 0

  app_name               = aws_codedeploy_app.app[0].name
  deployment_group_name  = local.name_prefix
  service_role_arn       = aws_iam_role.codedeploy_role[0].arn
  deployment_config_name = "CodeDeployDefault.AllAtOnce"

  deployment_style {
    deployment_type   = "IN_PLACE"
    deployment_option = "WITHOUT_TRAFFIC_CONTROL"
  }

  ec2_tag_filter {
    key   = "CodeDeployTarget"
    type  = "KEY_AND_VALUE"
    value = local.name_prefix
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }

  tags = {
    Name = local.name_prefix
  }
}
