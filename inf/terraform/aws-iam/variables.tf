variable "aws_region" {
  description = "AWS region for provider configuration. IAM is global, but the provider and remote state still require a region."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment name, applied as the Environment tag on every resource."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project identifier, applied as the Project tag and used as a name prefix for created resources."
  type        = string
}

variable "tags" {
  description = "Additional tags merged into every resource on top of the required Environment, Project, and ManagedBy tags."
  type        = map(string)
  default     = {}
}
