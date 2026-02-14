# ============================================================================
# S3 Bucket Outputs
# ============================================================================

output "s3_bucket_name" {
  description = "Name of the S3 bucket storing resume PDFs"
  value       = aws_s3_bucket.resume_bucket.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.resume_bucket.arn
}

output "s3_bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.resume_bucket.bucket_regional_domain_name
}

# ============================================================================
# CloudFront Outputs
# ============================================================================

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.resume_cdn.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.resume_cdn.domain_name
}

output "cloudfront_url" {
  description = "Full HTTPS URL for CloudFront distribution"
  value       = "https://${local.cdn_domain}"
}

output "resume_download_url" {
  description = "Full URL to download the resume PDF via CloudFront"
  value       = local.download_url
}

output "custom_domain_url" {
  description = "Custom domain URL if configured"
  value       = var.use_custom_domain ? "https://${local.cdn_domain}" : "Not configured"
}

# ============================================================================
# Upload Instructions Output
# ============================================================================

output "upload_instructions" {
  description = "Instructions for uploading resume PDF to S3"
  value       = <<-EOT
    To upload your resume PDF:
    
    1. Upload via AWS CLI:
       aws s3 cp your-resume.pdf s3://${aws_s3_bucket.resume_bucket.id}/resume/Nguyen-Gia-Huy-DevOps-Engineer.pdf
    
    2. Access URL:
       ${local.download_url}
    
    3. Invalidate CloudFront cache after upload:
       aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.resume_cdn.id} --paths "/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
  EOT
}

# ============================================================================
# Data Source for Route53 (if custom domain is used)
# ============================================================================

data "aws_route53_zone" "selected" {
  count = var.use_custom_domain && var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
}
