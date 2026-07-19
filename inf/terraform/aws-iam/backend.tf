# ===========================================================================
# Remote State Backend — S3 + DynamoDB
# ===========================================================================
# WHY: Terraform state for an IAM module contains role ARNs, policy documents,
# and principal identifiers. Storing it in git is a security anti-pattern.
# A remote backend provides:
#   - Encryption at rest (S3 SSE) and in transit (HTTPS)
#   - Locking via DynamoDB to prevent concurrent apply conflicts
#   - Shared access for team members and CI/CD runners
#   - Audit trail via S3 versioning
#
# SETUP (run once, before the first `terraform init`). The bucket and lock
# table are bootstrapped via AWS CLI rather than Terraform to avoid the
# chicken-and-egg problem of storing a backend's state in itself.
#
#   ACCOUNT_ID=<THIS_ACCOUNT_ID>
#
#   aws s3api create-bucket \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --region ap-southeast-1 \
#     --create-bucket-configuration LocationConstraint=ap-southeast-1
#
#   aws s3api put-bucket-versioning \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws s3api put-public-access-block \
#     --bucket aws-iam-tfstate-${ACCOUNT_ID} \
#     --public-access-block-configuration \
#       "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
#
#   aws dynamodb create-table \
#     --table-name aws-iam-tfstate-lock \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region ap-southeast-1
#
# Then uncomment the block below, substitute the account ID, and run
# `terraform init`.
# ===========================================================================

terraform {
  # backend "s3" {
  #   bucket         = "aws-iam-tfstate-<ACCOUNT_ID>"
  #   key            = "aws-iam/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "aws-iam-tfstate-lock"
  #   # Authenticate via GitHub OIDC / IAM role assumption in CI.
  #   # Never store AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in this repo.
  # }
}
