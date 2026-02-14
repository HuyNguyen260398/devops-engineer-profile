# ============================================================================
# Local Values
# ============================================================================

locals {
  # CloudFront domain
  cdn_domain = var.use_custom_domain ? "${var.cdn_subdomain}.${data.aws_route53_zone.selected[0].name}" : aws_cloudfront_distribution.resume_cdn.domain_name

  # Full download URL
  download_url = "https://${local.cdn_domain}/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
}
