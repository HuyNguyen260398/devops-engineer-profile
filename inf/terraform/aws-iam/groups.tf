# ===========================================================================
# IAM Groups
# ===========================================================================
# Groups exist to carry policies for IAM users. With Identity Center handling
# human access, groups here are mainly for legacy service accounts.
#
# Note: aws_iam_group is not a taggable resource — the .tflint.hcl
# required-tags rule does not apply to it.
# ===========================================================================

resource "aws_iam_group" "this" {
  for_each = var.groups

  name = "${local.name_prefix}-${each.key}"
  path = each.value.path
}

locals {
  group_managed_attachments = {
    for pair in flatten([
      for group_key, group in var.groups : [
        for policy_arn in group.managed_policy_arns : {
          key        = "${group_key}/${policy_arn}"
          group_key  = group_key
          policy_arn = policy_arn
        }
      ]
    ]) : pair.key => pair
  }

  group_custom_attachments = {
    for pair in flatten([
      for group_key, group in var.groups : [
        for policy_key in group.custom_policy_keys : {
          key        = "${group_key}/${policy_key}"
          group_key  = group_key
          policy_key = policy_key
        }
      ]
    ]) : pair.key => pair
  }

  # user -> group pairs, derived from each user's group list.
  user_group_memberships = {
    for pair in flatten([
      for user_key, user in var.users : [
        for group_key in user.groups : {
          key       = "${user_key}/${group_key}"
          user_key  = user_key
          group_key = group_key
        }
      ]
    ]) : pair.key => pair
  }
}

resource "aws_iam_group_policy_attachment" "managed" {
  for_each = local.group_managed_attachments

  group      = aws_iam_group.this[each.value.group_key].name
  policy_arn = each.value.policy_arn
}

resource "aws_iam_group_policy_attachment" "custom" {
  for_each = local.group_custom_attachments

  group      = aws_iam_group.this[each.value.group_key].name
  policy_arn = aws_iam_policy.custom[each.value.policy_key].arn
}

# aws_iam_user_group_membership is used rather than aws_iam_group_membership
# because the latter takes exclusive ownership of a group's entire member
# list and will remove members added by any other process.
resource "aws_iam_user_group_membership" "this" {
  for_each = local.user_group_memberships

  user   = aws_iam_user.this[each.value.user_key].name
  groups = [aws_iam_group.this[each.value.group_key].name]
}
