# ===========================================================================
# Identity Store Users and Groups
# ===========================================================================
# Valid ONLY because the identity source is the built-in Identity Center
# directory.
#
# WARNING: if this organization ever switches its identity source to an
# external IdP with SCIM provisioning (Entra ID, Okta, Google Workspace),
# these resources MUST be removed. SCIM would provision the same principals
# independently, producing duplicates and permanent drift. In that scenario,
# replace these resources with data sources that look principals up by name.
# ===========================================================================

resource "aws_identitystore_user" "this" {
  for_each = var.users

  identity_store_id = local.identity_store_id

  user_name    = each.key
  display_name = each.value.display_name

  name {
    given_name  = each.value.given_name
    family_name = each.value.family_name
  }

  emails {
    value   = each.value.email
    primary = true
  }
}

resource "aws_identitystore_group" "this" {
  for_each = var.groups

  identity_store_id = local.identity_store_id
  display_name      = each.key
  description       = each.value.description
}

locals {
  # user -> group pairs, keyed on a stable composite string so that adding
  # one membership never re-creates the others.
  group_memberships = {
    for pair in flatten([
      for group_key, group in var.groups : [
        for user_key in group.members : {
          key       = "${group_key}/${user_key}"
          group_key = group_key
          user_key  = user_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_identitystore_group_membership" "this" {
  for_each = local.group_memberships

  identity_store_id = local.identity_store_id
  group_id          = aws_identitystore_group.this[each.value.group_key].group_id
  member_id         = aws_identitystore_user.this[each.value.user_key].user_id

  lifecycle {
    precondition {
      condition     = contains(keys(var.users), each.value.user_key)
      error_message = "Group '${each.value.group_key}' lists member '${each.value.user_key}', which is not defined in var.users."
    }
  }
}
