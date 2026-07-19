locals {
  # Merge caller-supplied tags with the three tags required by .tflint.hcl.
  # The required tags are listed last so they cannot be overridden by var.tags.
  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )

  name_prefix = "${var.project_name}-${var.environment}"
}

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}
