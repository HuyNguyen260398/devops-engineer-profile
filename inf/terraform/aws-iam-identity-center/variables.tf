variable "aws_region" {
  description = "AWS region for provider configuration and remote state."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment name, applied as the Environment tag. Identity Center is organization-wide, so this is normally 'prod'."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project identifier, applied as the Project tag and used as a name prefix."
  type        = string
}

variable "tags" {
  description = "Additional tags merged into every taggable resource on top of the required Environment, Project, and ManagedBy tags."
  type        = map(string)
  default     = {}
}

variable "accounts" {
  description = "Map of friendly account alias to 12-digit AWS account ID. The access matrix in var.groups references accounts by alias, never by raw ID — raw account IDs scattered through an access matrix are unreviewable."
  type        = map(string)

  validation {
    condition = alltrue([
      for alias, account_id in var.accounts :
      can(regex("^\\d{12}$", account_id))
    ])
    error_message = "Every account ID must be exactly 12 digits."
  }

  validation {
    condition     = length(var.accounts) > 0
    error_message = "At least one account must be defined, otherwise no assignment can target anything."
  }
}
