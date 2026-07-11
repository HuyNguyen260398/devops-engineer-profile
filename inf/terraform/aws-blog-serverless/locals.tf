locals {
  name_prefix = "blog"
  domain      = "${var.blog_subdomain}.${var.root_domain}"

  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
