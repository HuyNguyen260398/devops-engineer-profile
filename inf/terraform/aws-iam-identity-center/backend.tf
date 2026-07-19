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
# SETUP (run once in the management account, before the first
# `terraform init`). Bootstrapped via AWS CLI rather than Terraform to avoid
# the chicken-and-egg problem.
#
#   MGMT_ACCOUNT_ID=<MANAGEMENT_ACCOUNT_ID>
#
#   aws s3api create-bucket \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --region ap-southeast-1 \
#     --create-bucket-configuration LocationConstraint=ap-southeast-1
#
#   aws s3api put-bucket-versioning \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --versioning-configuration Status=Enabled
#
#   aws s3api put-bucket-encryption \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --server-side-encryption-configuration \
#       '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
#
#   aws s3api put-public-access-block \
#     --bucket aws-iam-identity-center-tfstate-${MGMT_ACCOUNT_ID} \
#     --public-access-block-configuration \
#       "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
#
#   aws dynamodb create-table \
#     --table-name aws-iam-identity-center-tfstate-lock \
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
  #   bucket         = "aws-iam-identity-center-tfstate-<MANAGEMENT_ACCOUNT_ID>"
  #   key            = "aws-iam-identity-center/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   encrypt        = true
  #   dynamodb_table = "aws-iam-identity-center-tfstate-lock"
  #   # Authenticate via GitHub OIDC / IAM role assumption in CI.
  #   # Never store AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in this repo.
  # }
}
