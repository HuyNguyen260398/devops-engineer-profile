# ===========================================================================
# Remote State Backend — S3 + DynamoDB
# ===========================================================================
# WHY: Terraform state files contain sensitive resource metadata (ARNs,
# endpoint URLs, etc.). Storing them in git is a security anti-pattern.
# A remote backend provides:
#   - Encryption at rest (S3 SSE) and in transit (HTTPS)
#   - Locking via DynamoDB to prevent concurrent apply conflicts
#   - Shared access for team members and CI/CD runners
#   - Audit trail via S3 versioning
#
# SETUP (run once per environment before the first `terraform init`):
#
#   aws s3api create-bucket \
#     --bucket <YOUR_BUCKET_NAME> \
#     --region ap-southeast-1 \
#     --create-bucket-configuration LocationConstraint=ap-southeast-1
#
#   aws s3api put-bucket-versioning \
#     --bucket <YOUR_BUCKET_NAME> \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket <YOUR_BUCKET_NAME> \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
#
#   aws dynamodb create-table \
#     --table-name <YOUR_LOCK_TABLE_NAME> \
#     --attribute-definitions AttributeName=LockID,AttributeType=S \
#     --key-schema AttributeName=LockID,KeyType=HASH \
#     --billing-mode PAY_PER_REQUEST \
#     --region ap-southeast-1
#
#   aws s3api put-public-access-block \
#     --bucket <YOUR_BUCKET_NAME> \
#     --public-access-block-configuration \
#       "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
#
# MIGRATE existing local state:
#   1. Fill in the backend config below.
#   2. Run `terraform init -migrate-state` — Terraform will copy local state to S3.
#   3. Delete `terraform.tfstate` and `terraform.tfstate.backup` from git,
#      and add them to `.gitignore`.
#
# RECOMMENDED bucket naming:
#   <project>-tfstate-<environment>   e.g. dep-tfstate-staging
# ===========================================================================

terraform {
  # Uncomment and replace placeholders once the S3 bucket and DynamoDB table
  # are provisioned (see setup instructions above).

  # backend "s3" {
  #   bucket         = "<YOUR_BUCKET_NAME>"            # e.g. dep-tfstate-staging
  #   key            = "aws-eks/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "<YOUR_LOCK_TABLE_NAME>"        # e.g. dep-tfstate-lock
  #   # Use OIDC / IAM role when running from GitHub Actions — never store
  #   # AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in the repository.
  # }
}
