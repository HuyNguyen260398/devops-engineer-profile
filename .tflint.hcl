# TFLint Configuration
# https://github.com/terraform-linters/tflint

config {
  # Inspect called modules as well as the root module.
  # Replaces the "module" attribute, which was removed in tflint v0.54.0.
  call_module_type = "all"

  # Force the provider source to be declared
  force = false
  
  # Disables warning output about modules that are not installed
  disabled_by_default = false
}

# AWS Plugin Configuration
plugin "aws" {
  enabled = true
  version = "0.30.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

# Terraform Plugin Configuration
plugin "terraform" {
  enabled = true
  version = "0.5.0"
  source  = "github.com/terraform-linters/tflint-ruleset-terraform"
  
  preset = "recommended"
}

# =============================================================================
# AWS Rules Configuration
# =============================================================================

# Enforce naming conventions
rule "aws_resource_missing_tags" {
  enabled = true
  tags = [
    "Environment",
    "Project",
    "ManagedBy"
  ]
}

# Security rules
rule "aws_instance_invalid_type" {
  enabled = true
}

rule "aws_db_instance_invalid_type" {
  enabled = true
}

rule "aws_elasticache_cluster_invalid_type" {
  enabled = true
}

# NOTE: "aws_s3_bucket_public_access" was declared here previously. No such
# rule exists in tflint-ruleset-aws 0.30.0, and its presence caused the whole
# config to fail to load. Public-access blocking is asserted directly in the
# S3 modules instead.

# =============================================================================
# Terraform Rules Configuration
# =============================================================================

# Module versioning
rule "terraform_module_version" {
  enabled = true
}

# Naming conventions
rule "terraform_naming_convention" {
  enabled = true
  
  # Resource naming
  resource {
    format = "snake_case"
  }
  
  # Variable naming
  variable {
    format = "snake_case"
  }
  
  # Output naming
  output {
    format = "snake_case"
  }
  
  # Module naming
  module {
    format = "snake_case"
  }
  
  # Data source naming
  data {
    format = "snake_case"
  }
}

# Documentation
rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_documented_outputs" {
  enabled = true
}

# Type declarations
rule "terraform_typed_variables" {
  enabled = true
}

# Required providers
rule "terraform_required_providers" {
  enabled = true
}

rule "terraform_required_version" {
  enabled = true
}

# Unused declarations
# The exclude list was previously in a second, duplicate declaration of this
# rule at the end of the file. Merged here — tflint rejects duplicate rule
# blocks.
rule "terraform_unused_declarations" {
  enabled = true
  exclude = [
    "**/examples/**",
    "**/*.example.tf"
  ]
}

# Deprecated syntax
rule "terraform_deprecated_index" {
  enabled = true
}

rule "terraform_deprecated_interpolation" {
  enabled = true
}

# Standard module structure
rule "terraform_standard_module_structure" {
  enabled = true
}

# Workspace usage
rule "terraform_workspace_remote" {
  enabled = true
}
