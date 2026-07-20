# ===========================================================================
# Remote State Backend — S3 + DynamoDB
# ===========================================================================
# WHY: this state maps every human principal to every permission they hold
# across the organization. It is among the most sensitive state in the estate
# and must never live in git.
#
# The bucket lives in the MANAGEMENT account — a different account, and
# therefore a different bucket, from the aws-iam module's state.
#
# The bucket and lock table were bootstrapped once via AWS CLI (not
# Terraform, to avoid the chicken-and-egg problem of storing a backend's
# state in itself):
#   aws-iam-identity-center-tfstate-010382427026
#     (versioned, SSE-S3/AES256, public access blocked)
#   aws-iam-identity-center-tfstate-lock
#     (DynamoDB, PAY_PER_REQUEST, LockID hash key)
#
# Local state was migrated into this backend on 2026-07-20 via
# `terraform init -migrate-state`.
# ===========================================================================

terraform {
  backend "s3" {
    bucket         = "aws-iam-identity-center-tfstate-010382427026"
    key            = "aws-iam-identity-center/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "aws-iam-identity-center-tfstate-lock"
    # Authenticate via GitHub OIDC / IAM role assumption in CI.
    # Never store AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in this repo.
  }
}
