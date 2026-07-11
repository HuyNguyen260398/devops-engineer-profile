# Local values for reusable expressions

locals {
  name_prefix = "blog"

  # The blog is served under a path (nghuy.link/blogs); the CloudFront
  # distribution owns the apex domain itself, not a dedicated subdomain.
  domain = var.root_domain

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}
