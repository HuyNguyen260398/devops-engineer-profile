# ===========================================================================
# Remote State Backend — S3 + DynamoDB
# ===========================================================================
# WHY: Terraform state files contain sensitive resource metadata (ARNs,
# GitHub token references, etc.). Storing them in git is a security
# anti-pattern. This backend provides:
#   - Encryption at rest (S3 SSE-S3) and in transit (HTTPS)
#   - Locking via DynamoDB to prevent concurrent apply conflicts
#   - Shared access for team members and CI/CD runners
#   - Audit trail via S3 versioning
#
# The bucket and lock table were bootstrapped once via AWS CLI (not
# Terraform, to avoid a chicken-and-egg problem):
#   aws-github-oidc-tfstate-010382427026 (versioned, SSE-S3, public access blocked)
#   aws-github-oidc-tfstate-lock (DynamoDB, PAY_PER_REQUEST)
# ===========================================================================

terraform {
  backend "s3" {
    bucket         = "aws-github-oidc-tfstate-010382427026"
    key            = "aws-github-oidc/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "aws-github-oidc-tfstate-lock"
  }
}
