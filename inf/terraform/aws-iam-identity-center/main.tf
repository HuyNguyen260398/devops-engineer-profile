# ===========================================================================
# aws-iam-identity-center — module entrypoint
# ===========================================================================
# IAM Identity Center for the AWS Organization. Runs in the MANAGEMENT
# account only.
#
#   permission_sets.tf   permission sets, baseline merged with overrides
#   identity_store.tf    users, groups, memberships
#   assignments.tf       account assignments from the flattened access matrix
#
# This file holds instance discovery, which every other file depends on.
#
# PREREQUISITE: IAM Identity Center must already be enabled in the AWS
# console. No Terraform resource can enable it.
#
# The data source below returns EMPTY LISTS rather than an error when
# Identity Center is not enabled, or when credentials point at a member
# account instead of the management account. Without the postcondition, that
# failure surfaces as an opaque "index 0 out of range" much later in the run.
# ===========================================================================

data "aws_ssoadmin_instances" "this" {
  lifecycle {
    postcondition {
      condition     = length(self.arns) == 1
      error_message = "Expected exactly one IAM Identity Center instance, found ${length(self.arns)}. Confirm that (a) Identity Center is enabled in the AWS console, and (b) these credentials resolve to the Organizations MANAGEMENT account, not a member account."
    }
  }
}

# Used to build AWS-managed policy ARNs in the permission set baseline, so
# the module works in non-commercial partitions (GovCloud, China).
data "aws_partition" "current" {}
