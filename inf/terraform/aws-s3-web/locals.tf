# Local values for reusable expressions

locals {
  name_prefix = "blog"

  # The blog and portfolio are served under the apex (nghuy.link); the roadmap
  # component gets a dedicated subdomain served off the same distribution via a
  # host-aware viewer-request function.
  domain         = var.root_domain
  roadmap_domain = "roadmap.${var.root_domain}"
  cert_domains   = [local.domain, local.roadmap_domain]

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}
