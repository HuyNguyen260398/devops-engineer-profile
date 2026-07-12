# Terraform settings + AWS providers for the aws-s3-web stack.
#
# This root module manages the portfolio static-site bucket AND the serverless
# blog (CloudFront apex distribution, API Gateway, Lambda, Cognito, DynamoDB,
# media bucket). It is production-only; state lives in the S3 backend configured
# via -backend-config at `terraform init`.

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
  backend "s3" {} # configured via -backend-config in CI
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# CloudFront viewer certificates (ACM) must be issued in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.common_tags
  }
}
