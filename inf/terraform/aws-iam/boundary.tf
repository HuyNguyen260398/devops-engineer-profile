# ===========================================================================
# Permissions Boundary
# ===========================================================================
# A permissions boundary caps the maximum permissions a principal can have.
# It grants nothing on its own — effective permissions are the intersection
# of the principal's identity policies and this boundary.
#
# Attach via the permissions_boundary argument on aws_iam_role / aws_iam_user.
#
# The boundary ARN is constructed from the partition, account ID, and policy
# name rather than referencing aws_iam_policy.permissions_boundary.arn.
# Referencing the resource attribute here would create a dependency cycle:
# the policy document would depend on the policy, which depends on the
# document.
# ===========================================================================

locals {
  permissions_boundary_name = "${local.name_prefix}-permissions-boundary"

  permissions_boundary_arn = "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:policy/${local.permissions_boundary_name}"
}

data "aws_iam_policy_document" "permissions_boundary" {
  # Broad allow — the boundary caps, it does not grant.
  statement {
    sid       = "AllowAllByDefault"
    effect    = "Allow"
    actions   = ["*"]
    resources = ["*"]
  }

  statement {
    sid       = "DenySensitiveActions"
    effect    = "Deny"
    actions   = var.boundary_denied_actions
    resources = ["*"]
  }

  # Prevent a boundary-carrying principal from detaching its own boundary
  # or escalating by creating an unbounded role.
  statement {
    sid    = "DenyBoundaryEscape"
    effect = "Deny"
    actions = [
      "iam:DeleteRolePermissionsBoundary",
      "iam:DeleteUserPermissionsBoundary",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "DenyRoleCreationWithoutBoundary"
    effect = "Deny"
    actions = [
      "iam:CreateRole",
      "iam:PutRolePermissionsBoundary",
    ]
    resources = ["*"]

    condition {
      test     = "StringNotEquals"
      variable = "iam:PermissionsBoundary"
      values   = [local.permissions_boundary_arn]
    }
  }

  dynamic "statement" {
    for_each = length(var.boundary_allowed_regions) > 0 ? [1] : []

    content {
      sid       = "DenyOutsideAllowedRegions"
      effect    = "Deny"
      actions   = ["*"]
      resources = ["*"]

      condition {
        test     = "StringNotEquals"
        variable = "aws:RequestedRegion"
        values   = var.boundary_allowed_regions
      }

      # Global services have no meaningful region and would otherwise be
      # blocked outright by the condition above.
      condition {
        test     = "ForAllValues:StringNotEquals"
        variable = "aws:PrincipalServiceName"
        values   = ["iam.amazonaws.com", "cloudfront.amazonaws.com", "route53.amazonaws.com"]
      }
    }
  }
}

resource "aws_iam_policy" "permissions_boundary" {
  name        = local.permissions_boundary_name
  path        = "/"
  description = "Permissions boundary capping the maximum permissions of roles and users created by the aws-iam module."
  policy      = data.aws_iam_policy_document.permissions_boundary.json

  tags = local.common_tags
}
