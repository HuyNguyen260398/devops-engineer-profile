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

variable "permission_sets" {
  description = "Permission sets to create, merged over the built-in baseline. A key matching a baseline name replaces that baseline entry entirely."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # ISO-8601 duration. Defaults to PT1H, matching the AWS default.
    session_duration = optional(string, "PT1H")
    # URL the user lands on after assuming this permission set.
    relay_state = optional(string, null)
    # ARNs of AWS-managed policies.
    managed_policy_arns = optional(list(string), [])
    # Customer-managed policies referenced BY NAME, resolved in each TARGET
    # account at assignment time. The policy must already exist there —
    # typically created by the aws-iam module.
    customer_managed_policy_names = optional(list(string), [])
    # Inline policy JSON. Supported but discouraged: inline policies are
    # invisible in the IAM console of member accounts.
    inline_policy = optional(string, null)
    # Name of a customer-managed policy in the target account to use as the
    # permissions boundary.
    permissions_boundary_policy_name = optional(string, null)
  }))
  default = {}

  validation {
    condition = alltrue([
      for ps_name, ps in var.permission_sets :
      can(regex("^PT([0-9]+H)?([0-9]+M)?$", ps.session_duration))
    ])
    error_message = "session_duration must be an ISO-8601 duration of the form PT<hours>H, PT<minutes>M, or PT<hours>H<minutes>M — e.g. PT1H, PT30M, PT2H30M."
  }

  validation {
    condition = alltrue([
      for ps_name, ps in var.permission_sets :
      can(regex("^[\\w+=,.@-]{1,32}$", ps_name))
    ])
    error_message = "Permission set names must be 1-32 characters of alphanumerics and _+=,.@- (AWS limit)."
  }
}

variable "users" {
  description = "Identity Store users to create, keyed by username. Only valid when the identity source is the built-in Identity Center directory — if the org migrates to an external IdP with SCIM, this must be emptied and the resources removed from state."
  type = map(object({
    display_name = string
    given_name   = string
    family_name  = string
    email        = string
  }))
  default = {}

  validation {
    condition = alltrue([
      for user_key, user in var.users :
      can(regex("^[^@]+@[^@]+\\.[^@]+$", user.email))
    ])
    error_message = "Each user's email must be a valid address."
  }
}

variable "groups" {
  description = "Identity Store groups and their access. The permission_sets field is the access matrix: permission set name -> list of account ALIASES (keys of var.accounts) where this group holds it."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # Keys into var.users.
    members = optional(list(string), [])
    # Permission set name -> list of account aliases.
    permission_sets = optional(map(list(string)), {})
  }))
  default = {}

  validation {
    condition = alltrue([
      for group_key, group in var.groups :
      can(regex("^[\\w+=,.@ -]{1,128}$", group_key))
    ])
    error_message = "Group names must be 1-128 characters of alphanumerics, spaces, and _+=,.@- (AWS limit)."
  }
}
