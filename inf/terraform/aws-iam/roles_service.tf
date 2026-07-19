# ===========================================================================
# Service Roles
# ===========================================================================
# Roles assumed by AWS services. Trust here is intentionally simple — a bare
# Service principal. Any role needing conditional trust (ExternalId, MFA,
# OIDC subject claims) belongs in explicit HCL where the condition is
# visible in a PR diff, not buried in a tfvars map.
# ===========================================================================

data "aws_iam_policy_document" "service_role_trust" {
  for_each = var.service_roles

  statement {
    sid     = "AllowServiceAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = each.value.service_principals
    }
  }
}

resource "aws_iam_role" "service" {
  for_each = var.service_roles

  name                 = "${local.name_prefix}-${each.key}"
  description          = each.value.description
  assume_role_policy   = data.aws_iam_policy_document.service_role_trust[each.key].json
  max_session_duration = each.value.max_session_duration
  permissions_boundary = each.value.attach_boundary ? aws_iam_policy.permissions_boundary.arn : null

  tags = local.common_tags
}

# Flatten role -> managed policy ARN pairs into a map with a stable composite
# key, so adding one attachment never re-creates the others.
locals {
  service_role_managed_attachments = {
    for pair in flatten([
      for role_key, role in var.service_roles : [
        for policy_arn in role.managed_policy_arns : {
          key        = "${role_key}/${policy_arn}"
          role_key   = role_key
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  service_role_custom_attachments = {
    for pair in flatten([
      for role_key, role in var.service_roles : [
        for policy_key in role.custom_policy_keys : {
          key        = "${role_key}/${policy_key}"
          role_key   = role_key
          policy_key = policy_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_iam_role_policy_attachment" "service_managed" {
  for_each = local.service_role_managed_attachments

  role       = aws_iam_role.service[each.value.role_key].name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_role_policy_attachment" "service_custom" {
  for_each = local.service_role_custom_attachments

  role       = aws_iam_role.service[each.value.role_key].name
  policy_arn = aws_iam_policy.custom[each.value.policy_key].arn

  lifecycle {
    precondition {
      condition     = contains(keys(var.policies), each.value.policy_key)
      error_message = "service_roles references custom_policy_keys entry '${each.value.policy_key}', which is not defined in var.policies."
    }
  }
}
