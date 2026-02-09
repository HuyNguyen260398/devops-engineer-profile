# Local values for reusable expressions

locals {
  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "devops-engineer-profile"
      CreatedDate = timestamp()
    },
    var.tags
  )

  bucket_website_endpoint = aws_s3_bucket_website_configuration.website.website_endpoint
  bucket_domain_name      = aws_s3_bucket.website.bucket_domain_name
}
