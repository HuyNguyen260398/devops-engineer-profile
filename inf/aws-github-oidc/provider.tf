terraform {
  required_version = ">= 1.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 5.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# GitHub Provider Configuration
provider "github" {
  owner = var.github_owner
  token = var.github_token

  # Add app_auth block if using GitHub App authentication
  # app_auth {
  #   id              = var.github_app_id
  #   installation_id = var.github_app_installation_id
  #   pem_file        = var.github_app_pem_file
  # }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    }
  }
}
