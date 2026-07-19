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

variable "service_roles" {
  description = "IAM roles assumed by AWS services, keyed by role name suffix. Trust is a simple Service principal — for roles needing conditional trust (OIDC, cross-account), use explicit HCL instead."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # Service principals permitted to assume the role, e.g. ["lambda.amazonaws.com"].
    service_principals = list(string)
    # ARNs of AWS-managed policies, e.g. ["arn:aws:iam::aws:policy/ReadOnlyAccess"].
    managed_policy_arns = optional(list(string), [])
    # Keys into var.policies for customer-managed policies created by this module.
    custom_policy_keys   = optional(list(string), [])
    max_session_duration = optional(number, 3600)
    attach_boundary      = optional(bool, false)
  }))
  default = {}

  validation {
    condition = alltrue([
      for role_key, role in var.service_roles :
      role.max_session_duration >= 3600 && role.max_session_duration <= 43200
    ])
    error_message = "max_session_duration must be between 3600 and 43200 seconds (AWS limit)."
  }

  validation {
    condition = alltrue([
      for role_key, role in var.service_roles : alltrue([
        for principal in role.service_principals :
        endswith(principal, ".amazonaws.com")
      ])
    ])
    error_message = "service_principals must be AWS service principals ending in .amazonaws.com (e.g. lambda.amazonaws.com)."
  }
}

variable "cross_account_roles" {
  description = "Roles assumable from other AWS accounts. Trust conditions (ExternalId, MFA) are enforced in HCL, not configurable per-role, so they remain visible in review."
  type = map(object({
    description = optional(string, "Managed by Terraform")
    # 12-digit account IDs permitted to assume this role.
    trusted_account_ids = list(string)
    # Specific role/user ARNs in those accounts. If empty, the whole account root is trusted.
    trusted_principal_arns = optional(list(string), [])
    # sts:ExternalId value. Strongly recommended for third-party access (confused deputy).
    external_id = optional(string, null)
    # Require MFA on the assuming session.
    require_mfa          = optional(bool, true)
    managed_policy_arns  = optional(list(string), [])
    custom_policy_keys   = optional(list(string), [])
    max_session_duration = optional(number, 3600)
    attach_boundary      = optional(bool, true)
  }))
  default = {}

  validation {
    condition = alltrue([
      for role_key, role in var.cross_account_roles : alltrue([
        for account_id in role.trusted_account_ids :
        can(regex("^\\d{12}$", account_id))
      ])
    ])
    error_message = "trusted_account_ids entries must be exactly 12 digits."
  }

  validation {
    condition = alltrue([
      for role_key, role in var.cross_account_roles :
      length(role.trusted_account_ids) > 0
    ])
    error_message = "Each cross-account role must trust at least one account ID."
  }
}

variable "enable_break_glass_role" {
  description = "Create the break-glass admin role. This role grants AdministratorAccess and should exist in production accounts as a last-resort access path when Identity Center is unavailable."
  type        = bool
  default     = false
}

variable "break_glass_max_session_duration" {
  description = "Maximum session duration in seconds for the break-glass role. Kept short deliberately — this is an emergency path, not a working session."
  type        = number
  default     = 3600

  validation {
    condition     = var.break_glass_max_session_duration >= 3600 && var.break_glass_max_session_duration <= 14400
    error_message = "break_glass_max_session_duration must be between 3600 and 14400 seconds. Longer emergency sessions are not justifiable."
  }
}

variable "groups" {
  description = "IAM groups to create, keyed by group name suffix, with the policies attached to each."
  type = map(object({
    path                = optional(string, "/")
    managed_policy_arns = optional(list(string), [])
    custom_policy_keys  = optional(list(string), [])
  }))
  default = {}
}

variable "users" {
  description = "IAM users to create, keyed by user name. Defaults to none by design — use Identity Center for humans and roles for workloads. Reserve IAM users for break-glass and legacy service accounts that cannot assume a role."
  type = map(object({
    path   = optional(string, "/")
    groups = optional(list(string), [])
    # Base64-encoded PGP public key, or a keybase:username reference. Required
    # to create a console login profile — the encrypted password appears in
    # state and is only decryptable by this key's holder.
    pgp_key         = optional(string, null)
    attach_boundary = optional(bool, true)
  }))
  default = {}

  validation {
    condition = alltrue([
      for user_key, user in var.users :
      can(regex("^[a-zA-Z0-9._+=,@-]{1,64}$", user_key))
    ])
    error_message = "User names must match AWS's allowed pattern: alphanumerics and the characters _+=,.@- , max 64 characters."
  }
}

variable "manage_account_password_policy" {
  description = "Manage the account-wide IAM password policy. Defaults to false because this is an account singleton — if two Terraform stacks both manage it, they will fight on every apply."
  type        = bool
  default     = false
}

variable "password_policy" {
  description = "Account-wide IAM password policy settings. Only applied when manage_account_password_policy is true."
  type = object({
    minimum_password_length        = optional(number, 14)
    require_lowercase_characters   = optional(bool, true)
    require_uppercase_characters   = optional(bool, true)
    require_numbers                = optional(bool, true)
    require_symbols                = optional(bool, true)
    allow_users_to_change_password = optional(bool, true)
    max_password_age               = optional(number, 90)
    password_reuse_prevention      = optional(number, 24)
    hard_expiry                    = optional(bool, false)
  })
  default = {}

  validation {
    condition     = var.password_policy.minimum_password_length >= 14
    error_message = "minimum_password_length must be at least 14, per CIS AWS Foundations Benchmark."
  }

  validation {
    condition     = var.password_policy.password_reuse_prevention >= 1 && var.password_policy.password_reuse_prevention <= 24
    error_message = "password_reuse_prevention must be between 1 and 24 (AWS limit)."
  }
}
