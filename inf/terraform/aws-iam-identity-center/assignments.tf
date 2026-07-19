# ===========================================================================
# Account Assignments
# ===========================================================================
# An assignment binds (permission set, principal, target account). This is
# the point at which a permission set materializes as a real IAM role in the
# member account.
#
# Only GROUP principals are supported. Assigning permission sets to
# individual users is possible in the AWS API but deliberately unsupported
# here — per-user grants are how access matrices become unauditable.
# ===========================================================================

resource "aws_ssoadmin_account_assignment" "this" {
  for_each = local.assignments

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.permission_set].arn

  principal_type = "GROUP"
  principal_id   = aws_identitystore_group.this[each.value.group_key].group_id

  target_type = "AWS_ACCOUNT"
  target_id   = var.accounts[each.value.account_alias]

  lifecycle {
    precondition {
      condition     = contains(keys(var.accounts), each.value.account_alias)
      error_message = "Group '${each.value.group_key}' grants '${each.value.permission_set}' in account alias '${each.value.account_alias}', which is not defined in var.accounts. Add it there, or fix the typo."
    }

    precondition {
      condition     = contains(keys(local.permission_sets), each.value.permission_set)
      error_message = "Group '${each.value.group_key}' references permission set '${each.value.permission_set}', which exists neither in the baseline nor in var.permission_sets."
    }
  }
}
