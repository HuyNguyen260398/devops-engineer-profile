# ===========================================================================
# aws-iam — module entrypoint
# ===========================================================================
# Per-account IAM. Resources are split by concern across sibling files so
# that each trust story is readable in one place:
#
#   boundary.tf             permissions boundary policy
#   policies.tf             customer-managed policies (data-driven)
#   roles_service.tf        service-principal roles (data-driven)
#   roles_cross_account.tf  cross-account roles (explicit trust in HCL)
#   role_break_glass.tf     emergency admin role (explicit trust in HCL)
#   groups.tf               groups, policy attachments, memberships
#   users.tf                IAM users (none by default, no access keys)
#   account.tf              account password policy (gated)
#
# This file holds only the account-context data sources shared by all of them.
# ===========================================================================

data "aws_caller_identity" "current" {}

data "aws_partition" "current" {}
