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
}
