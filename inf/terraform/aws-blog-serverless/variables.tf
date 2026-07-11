# Variable definitions for the serverless blog stack (path-based at nghuy.link/blogs)

variable "aws_region" {
  description = "Primary AWS region for the blog stack."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name (staging or production)."
  type        = string
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "project_name" {
  description = "Project name for naming and tagging."
  type        = string
  default     = "devops-engineer-profile"
}

variable "root_domain" {
  description = "Apex domain that owns the Route53 hosted zone, e.g. nghuy.link."
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for root_domain."
  type        = string
}

variable "site_bucket_name" {
  description = "Name of the existing S3 website bucket that serves the portfolio + blog static export (e.g. s3.nghuy.link). Referenced as a CloudFront custom origin; not created by this stack."
  type        = string
}

variable "media_bucket_name" {
  description = "Globally-unique S3 bucket name for post bodies and images."
  type        = string
}

variable "admin_email" {
  description = "Email of the single admin user seeded in Cognito."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the blog VPC."
  type        = string
  default     = "10.42.0.0/16"
}
