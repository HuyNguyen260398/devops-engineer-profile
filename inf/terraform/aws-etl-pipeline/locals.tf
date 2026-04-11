# ============================================================================
# Local Values
# ============================================================================

locals {
  common_tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "Terraform"
    Repository  = "devops-engineer-profile"
  }

  name_prefix = "${var.project}-${var.environment}"

  # Bedrock model ARN for IAM policy scoping
  bedrock_model_arn = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.bedrock_model_id}"
}
