# ===========================================================================
# Break-Glass Admin Role
# ===========================================================================
# Last-resort access path for when IAM Identity Center is unavailable
# (SSO outage, IdP misconfiguration, expired certificate).
#
# Deliberate design choices:
#   - Trusted by the account root, so it survives deletion of every other
#     principal in the account.
#   - MFA is mandatory and NOT configurable. A break-glass role without MFA
#     is a standing backdoor.
#   - Carries the permissions boundary. Even in an emergency, the denied
#     action set (organizations:*, account:*) stays denied.
#   - prevent_destroy — a terraform destroy that removes the emergency access
#     path during an incident is precisely the wrong outcome.
#
# OPERATIONAL NOTE: assumption of this role should raise a CloudTrail alarm.
# Wiring that alarm is out of scope for this module — it belongs in the
# monitoring stack — but it is a required follow-up before relying on this.
# ===========================================================================

data "aws_iam_policy_document" "break_glass_trust" {
  count = var.enable_break_glass_role ? 1 : 0

  statement {
    sid     = "AllowRootAccountAssumeRoleWithMFA"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:root"]
    }

    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }

    # Reject sessions where MFA was satisfied long ago.
    condition {
      test     = "NumericLessThan"
      variable = "aws:MultiFactorAuthAge"
      values   = ["3600"]
    }
  }
}

resource "aws_iam_role" "break_glass" {
  count = var.enable_break_glass_role ? 1 : 0

  name                 = "${local.name_prefix}-break-glass"
  description          = "Emergency administrator access. Assumption must be alarmed and reviewed."
  assume_role_policy   = data.aws_iam_policy_document.break_glass_trust[0].json
  max_session_duration = var.break_glass_max_session_duration
  permissions_boundary = aws_iam_policy.permissions_boundary.arn

  tags = merge(local.common_tags, {
    Purpose = "break-glass"
  })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role_policy_attachment" "break_glass_admin" {
  count = var.enable_break_glass_role ? 1 : 0

  role       = aws_iam_role.break_glass[0].name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AdministratorAccess"
}
