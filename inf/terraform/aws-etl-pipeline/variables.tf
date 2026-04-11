# ============================================================================
# Input Variables — AWS ETL Pipeline
# ============================================================================

variable "aws_region" {
  description = "AWS region where all resources are provisioned"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "project" {
  description = "Project identifier used for resource naming and tagging"
  type        = string
  default     = "aws-etl-pipeline"
}

# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------

variable "raw_bucket_name" {
  description = "Name of the S3 bucket that receives raw Markdown files from the html-to-md app"
  type        = string
}

variable "clean_bucket_name" {
  description = "Name of the S3 bucket that stores Bedrock-extracted clean Markdown and metadata JSON"
  type        = string
}

# ---------------------------------------------------------------------------
# Bedrock
# ---------------------------------------------------------------------------

variable "bedrock_model_id" {
  description = "Foundation model ID used by the Bedrock Agent for content extraction"
  type        = string
  default     = "anthropic.claude-haiku-3-5-v1:0"
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the dedicated ETL VPC — must not overlap with existing account VPCs"
  type        = string
  default     = "10.10.0.0/24"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for the two private subnets (AZ-a and AZ-b)"
  type        = list(string)
  default     = ["10.10.0.0/26", "10.10.0.64/26"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2
    error_message = "Exactly two private subnet CIDRs are required (one per AZ)."
  }
}

variable "availability_zones" {
  description = "Two availability zones for the private subnets"
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Exactly two availability zones are required."
  }
}

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------

variable "orchestrator_timeout_seconds" {
  description = "Lambda timeout for the ETL orchestrator (max 900s; accommodates Bedrock streaming latency)"
  type        = number
  default     = 300
}

variable "loader_timeout_seconds" {
  description = "Lambda timeout for the ETL loader (S3 PutObject + DynamoDB PutItem; keep short to fail fast)"
  type        = number
  default     = 15
}

variable "orchestrator_reserved_concurrency" {
  description = "Reserved concurrency for the orchestrator Lambda — caps simultaneous Bedrock invocations to control cost"
  type        = number
  default     = 5
}

# ---------------------------------------------------------------------------
# Interface Endpoints — multi-AZ toggle (REC-022)
# ---------------------------------------------------------------------------

variable "interface_endpoint_multi_az" {
  description = "When true, deploy Interface Endpoints in both private subnets (production HA). When false, single-AZ to reduce cost."
  type        = bool
  default     = false
}
