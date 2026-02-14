# ============================================================================
# Required Variables
# ============================================================================

variable "resume_bucket_name" {
  description = "Name of the S3 bucket for storing resume PDFs"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., production, staging, dev)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-southeast-1"
}

# ============================================================================
# CloudFront Configuration
# ============================================================================

variable "cloudfront_price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
}

variable "use_custom_domain" {
  description = "Whether to use a custom domain for CloudFront"
  type        = bool
  default     = false
}

variable "cdn_subdomain" {
  description = "Subdomain for CDN (e.g., cdn.example.com)"
  type        = string
  default     = "cdn"
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for custom domain (must be in ap-southeast-1)"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for custom domain"
  type        = string
  default     = ""
}

# ============================================================================
# Security Configuration
# ============================================================================

variable "enable_s3_logging" {
  description = "Enable S3 access logging"
  type        = bool
  default     = true
}

variable "s3_log_bucket_name" {
  description = "S3 bucket name for storing access logs (required if enable_s3_logging is true)"
  type        = string
  default     = ""
}

variable "enable_cloudfront_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = true
}

variable "cloudfront_log_bucket_name" {
  description = "S3 bucket name for CloudFront logs (required if enable_cloudfront_logging is true)"
  type        = string
  default     = ""
}

variable "use_kms_encryption" {
  description = "Use KMS customer-managed key for S3 encryption (additional cost)"
  type        = bool
  default     = false
}

variable "kms_key_id" {
  description = "KMS key ID for S3 encryption (required if use_kms_encryption is true)"
  type        = string
  default     = ""
}

variable "enable_waf" {
  description = "Enable AWS WAF for CloudFront distribution (additional cost)"
  type        = bool
  default     = false
}

variable "waf_web_acl_id" {
  description = "WAF Web ACL ID (required if enable_waf is true)"
  type        = string
  default     = ""
}

# ============================================================================
# Tags
# ============================================================================

variable "tags" {
  description = "Additional tags for all resources"
  type        = map(string)
  default     = {}
}
