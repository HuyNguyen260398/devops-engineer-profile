# ===========================================================================
# Customer-Managed Policies
# ===========================================================================
# Policies defined data-driven via var.policies. Rendered through
# aws_iam_policy_document rather than heredoc JSON so that syntax errors
# surface at plan time and the document renders readably in plan output.
#
# NOTE: policies created here can be referenced by name from IAM Identity
# Center permission sets (see the aws-iam-identity-center module) as
# customer managed policy references. That is a name-level contract — the
# name must match exactly, and this module must be applied in the target
# account BEFORE the assignment referencing it.
# ===========================================================================

data "aws_iam_policy_document" "custom" {
  for_each = var.policies

  dynamic "statement" {
    for_each = each.value.statements

    content {
      sid       = statement.value.sid
      effect    = statement.value.effect
      actions   = statement.value.actions
      resources = statement.value.resources

      dynamic "condition" {
        for_each = statement.value.condition

        content {
          test     = condition.value.test
          variable = condition.value.variable
          values   = condition.value.values
        }
      }
    }
  }
}

resource "aws_iam_policy" "custom" {
  for_each = var.policies

  name        = "${local.name_prefix}-${each.key}"
  path        = each.value.path
  description = each.value.description
  policy      = data.aws_iam_policy_document.custom[each.key].json

  tags = local.common_tags
}
