locals {
  sso_instance_arn  = one(data.aws_ssoadmin_instances.this.arns)
  identity_store_id = one(data.aws_ssoadmin_instances.this.identity_store_ids)

  # Merge caller-supplied tags with the three tags required by .tflint.hcl.
  # The required tags are listed last so they cannot be overridden by var.tags.
  common_tags = merge(
    var.tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  )
}

# ===========================================================================
# Permission Set Baseline
# ===========================================================================
# A curated starting set. var.permission_sets is merged OVER this map, so a
# user-supplied key of the same name replaces the baseline entry entirely —
# nothing here is unavoidably imposed.
#
# session_duration is PT1H for AdministratorAccess, matching the AWS default.
# Lower-privilege sets get longer sessions, since the cost of a long-lived
# read-only session is far lower than a long-lived admin session.
# ===========================================================================

locals {
  baseline_permission_sets = {
    AdministratorAccess = {
      description                      = "Full administrative access. Assign sparingly and prefer time-bound assignment."
      session_duration                 = "PT1H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/AdministratorAccess"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    PowerUserAccess = {
      description                      = "Full access except IAM and Organizations management."
      session_duration                 = "PT4H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/PowerUserAccess"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    ReadOnlyAccess = {
      description                      = "Read-only access to all services."
      session_duration                 = "PT8H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/ReadOnlyAccess"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    BillingAccess = {
      description                      = "Billing and cost management access."
      session_duration                 = "PT4H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/job-function/Billing"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }

    SecurityAudit = {
      description                      = "Read-only access for security auditing and configuration review."
      session_duration                 = "PT8H"
      relay_state                      = null
      managed_policy_arns              = ["arn:${data.aws_partition.current.partition}:iam::aws:policy/SecurityAudit"]
      customer_managed_policy_names    = []
      inline_policy                    = null
      permissions_boundary_policy_name = null
    }
  }

  # User-supplied sets win outright on key collision.
  permission_sets = merge(local.baseline_permission_sets, var.permission_sets)
}

# ===========================================================================
# Access Matrix Flattening
# ===========================================================================
# Turns the group-centric matrix in var.groups:
#
#   groups = {
#     platform-admins = {
#       permission_sets = { AdministratorAccess = ["prod", "staging"] }
#     }
#   }
#
# into one entry per (group, permission set, account) triple, keyed
# "<group>/<permission_set>/<account_alias>".
#
# The key is a stable composite STRING, not a positional index. Reordering
# var.groups, or adding a new group, therefore never re-creates existing
# assignments — which would briefly revoke live access on apply.
# ===========================================================================

locals {
  assignments = {
    for triple in flatten([
      for group_key, group in var.groups : [
        for ps_name, account_aliases in group.permission_sets : [
          for account_alias in account_aliases : {
            key            = "${group_key}/${ps_name}/${account_alias}"
            group_key      = group_key
            permission_set = ps_name
            account_alias  = account_alias
          }
        ]
      ]
    ]) : triple.key => triple
  }
}
