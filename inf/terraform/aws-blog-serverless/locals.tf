locals {
  name_prefix = "blog"
  # The blog is served under a path (nghuy.link/blogs); the distribution owns the
  # apex domain itself, not a dedicated subdomain.
  domain = var.root_domain

  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
