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

variable "boundary_denied_actions" {
  description = "Actions explicitly denied by the permissions boundary policy. Any principal carrying the boundary can never perform these, regardless of its own policies."
  type        = list(string)
  default = [
    "organizations:*",
    "account:*",
    "iam:CreateUser",
    "iam:CreateAccessKey",
    "iam:DeleteAccountPasswordPolicy",
  ]
}

variable "boundary_allowed_regions" {
  description = "Regions in which boundary-carrying principals may operate. Empty list disables the region restriction. Global services (IAM, CloudFront, Route53) are exempted automatically."
  type        = list(string)
  default     = []
}

variable "policies" {
  description = "Customer-managed IAM policies to create, keyed by policy name suffix. Each statement is rendered into an aws_iam_policy_document."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    path        = optional(string, "/")
    statements = list(object({
      sid       = optional(string, null)
      effect    = optional(string, "Allow")
      actions   = list(string)
      resources = list(string)
      condition = optional(list(object({
        test     = string
        variable = string
        values   = list(string)
      })), [])
    }))
  }))
  default = {}

  validation {
    condition = alltrue([
      for policy_key, policy in var.policies : alltrue([
        for statement in policy.statements :
        !(contains(statement.actions, "*") && contains(statement.resources, "*"))
      ])
    ])
    error_message = "A policy statement must not combine Action \"*\" with Resource \"*\". Scope at least one of them. This is the single most common IAM misconfiguration."
  }

  validation {
    condition = alltrue([
      for policy_key, policy in var.policies : alltrue([
        for statement in policy.statements :
        contains(["Allow", "Deny"], statement.effect)
      ])
    ])
    error_message = "Policy statement effect must be exactly \"Allow\" or \"Deny\" (case-sensitive)."
  }
}
