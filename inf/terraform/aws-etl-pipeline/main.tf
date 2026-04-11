# ============================================================================
# AWS ETL Pipeline — Terraform Root Module
# Manages: VPC, S3, Lambda, Bedrock Agent, DynamoDB, Athena, EventBridge
# All compute runs inside a dedicated VPC with private subnets + VPC Endpoints.
# No NAT Gateway; all AWS service traffic stays on the AWS private backbone.
# ============================================================================

terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.35"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------

data "aws_caller_identity" "current" {}
