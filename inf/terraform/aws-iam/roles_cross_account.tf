# ===========================================================================
# Cross-Account Roles
# ===========================================================================
# Trust policies live in explicit HCL because this is where IAM mistakes
# become incidents. A missing ExternalId on a third-party role is the classic
# confused-deputy vulnerability; a missing MFA condition turns a leaked
# long-lived credential into full account access.
#
# Both conditions are enforced here rather than exposed as free-form tfvars
# so that changing them requires a code diff a reviewer will actually see.
# ===========================================================================

data "aws_iam_policy_document" "cross_account_trust" {
  for_each = var.cross_account_roles

  statement {
    sid     = "AllowCrossAccountAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type = "AWS"
      # Prefer specific principal ARNs when supplied; fall back to account root.
      identifiers = length(each.value.trusted_principal_arns) > 0 ? each.value.trusted_principal_arns : [
        for account_id in each.value.trusted_account_ids :
        "arn:${data.aws_partition.current.partition}:iam::${account_id}:root"
      ]
    }

    # Confused-deputy protection for third-party access.
    dynamic "condition" {
      for_each = each.value.external_id != null ? [1] : []

      content {
        test     = "StringEquals"
        variable = "sts:ExternalId"
        values   = [each.value.external_id]
      }
    }

    dynamic "condition" {
      for_each = each.value.require_mfa ? [1] : []

      content {
        test     = "Bool"
        variable = "aws:MultiFactorAuthPresent"
        values   = ["true"]
      }
    }
  }
}

resource "aws_iam_role" "cross_account" {
  for_each = var.cross_account_roles

  name                 = "${local.name_prefix}-${each.key}"
  description          = each.value.description
  assume_role_policy   = data.aws_iam_policy_document.cross_account_trust[each.key].json
  max_session_duration = each.value.max_session_duration
  permissions_boundary = each.value.attach_boundary ? aws_iam_policy.permissions_boundary.arn : null

  tags = local.common_tags
}

locals {
  cross_account_managed_attachments = {
    for pair in flatten([
      for role_key, role in var.cross_account_roles : [
        for policy_arn in role.managed_policy_arns : {
          key        = "${role_key}/${policy_arn}"
          role_key   = role_key
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  cross_account_custom_attachments = {
    for pair in flatten([
      for role_key, role in var.cross_account_roles : [
        for policy_key in role.custom_policy_keys : {
          key        = "${role_key}/${policy_key}"
          role_key   = role_key
          policy_key = policy_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_iam_role_policy_attachment" "cross_account_managed" {
  for_each = local.cross_account_managed_attachments

  role       = aws_iam_role.cross_account[each.value.role_key].name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_role_policy_attachment" "cross_account_custom" {
  for_each = local.cross_account_custom_attachments

  role       = aws_iam_role.cross_account[each.value.role_key].name
  policy_arn = aws_iam_policy.custom[each.value.policy_key].arn
}
