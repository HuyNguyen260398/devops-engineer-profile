# ===========================================================================
# Permission Sets
# ===========================================================================
# A permission set is a template. It becomes a real IAM role in a member
# account only when assigned to a principal for that account (see
# assignments.tf).
#
# Attachments are split across four resource types because AWS models them
# separately. Each is flattened into a map with a stable composite key so
# that adding one attachment never re-creates the others.
# ===========================================================================

resource "aws_ssoadmin_permission_set" "this" {
  for_each = local.permission_sets

  name             = each.key
  description      = each.value.description
  instance_arn     = local.sso_instance_arn
  session_duration = each.value.session_duration
  relay_state      = each.value.relay_state

  tags = local.common_tags
}

locals {
  permission_set_managed_attachments = {
    for pair in flatten([
      for ps_name, ps in local.permission_sets : [
        for policy_arn in ps.managed_policy_arns : {
          key        = "${ps_name}/${policy_arn}"
          ps_name    = ps_name
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  permission_set_customer_attachments = {
    for pair in flatten([
      for ps_name, ps in local.permission_sets : [
        for policy_name in ps.customer_managed_policy_names : {
          key         = "${ps_name}/${policy_name}"
          ps_name     = ps_name
          policy_name = policy_name
        }
      ]
    ]) : pair.key => pair
  }

  permission_sets_with_inline = {
    for ps_name, ps in local.permission_sets : ps_name => ps
    if ps.inline_policy != null
  }

  permission_sets_with_boundary = {
    for ps_name, ps in local.permission_sets : ps_name => ps
    if ps.permissions_boundary_policy_name != null
  }
}

resource "aws_ssoadmin_managed_policy_attachment" "this" {
  for_each = local.permission_set_managed_attachments

  instance_arn       = local.sso_instance_arn
  managed_policy_arn = each.value.policy_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.ps_name].arn
}

# Resolved by NAME in each TARGET account at assignment time. If the named
# policy does not exist in a target account, the ASSIGNMENT fails at apply
# time — not here, and not at plan time. See README "Apply order".
resource "aws_ssoadmin_customer_managed_policy_attachment" "this" {
  for_each = local.permission_set_customer_attachments

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.value.ps_name].arn

  customer_managed_policy_reference {
    name = each.value.policy_name
    path = "/"
  }
}

# Discouraged — inline policies are invisible in the member account's IAM
# console, which makes them hard to audit during an incident.
resource "aws_ssoadmin_permission_set_inline_policy" "this" {
  for_each = local.permission_sets_with_inline

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.key].arn
  inline_policy      = each.value.inline_policy
}

resource "aws_ssoadmin_permissions_boundary_attachment" "this" {
  for_each = local.permission_sets_with_boundary

  instance_arn       = local.sso_instance_arn
  permission_set_arn = aws_ssoadmin_permission_set.this[each.key].arn

  permissions_boundary {
    customer_managed_policy_reference {
      name = each.value.permissions_boundary_policy_name
      path = "/"
    }
  }
}
