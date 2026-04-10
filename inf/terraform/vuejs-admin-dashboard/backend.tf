# ============================================================================
# Remote State Backend — partial configuration
# ============================================================================
# The bucket, key, and table are supplied at init time via a backend config
# file so that each environment uses its own state key.
#
# Usage:
#   terraform init -backend-config=environments/production/backend.hcl
#   terraform init -backend-config=environments/staging/backend.hcl
#
# The bootstrap module must be applied once before running init here:
#   cd inf/terraform/vuejs-admin-dashboard/bootstrap && terraform apply
# ============================================================================

terraform {
  backend "s3" {}
}
