# ===========================================================================
# IAM Users
# ===========================================================================
# var.users defaults to {} deliberately.
#
# Use instead:
#   - Humans          -> IAM Identity Center (see aws-iam-identity-center)
#   - EKS workloads   -> IRSA (see aws-eks / aws-eks-argocd)
#   - EC2 / Lambda    -> service roles (roles_service.tf)
#   - CI/CD           -> GitHub OIDC (see aws-github-oidc)
#
# IAM users are appropriate only for break-glass and legacy service accounts
# that genuinely cannot assume a role.
#
# THIS MODULE CREATES NO ACCESS KEYS. aws_iam_access_key writes the secret
# into Terraform state in plaintext. Create keys out-of-band via the console
# or CLI, and rotate them on a schedule.
# ===========================================================================

resource "aws_iam_user" "this" {
  for_each = var.users

  name                 = each.key
  path                 = each.value.path
  permissions_boundary = each.value.attach_boundary ? aws_iam_policy.permissions_boundary.arn : null

  # force_destroy removes the user's non-Terraform-managed attachments
  # (access keys, MFA devices) on destroy. Left false so that destroying a
  # user with live credentials fails loudly rather than silently.
  force_destroy = false

  tags = local.common_tags
}

# Console login profile. The generated password is PGP-encrypted with the
# supplied key; the encrypted value lands in state and can only be decrypted
# by that key's holder. Without a pgp_key, no login profile is created.
resource "aws_iam_user_login_profile" "this" {
  for_each = {
    for user_key, user in var.users : user_key => user
    if user.pgp_key != null
  }

  user                    = aws_iam_user.this[each.key].name
  pgp_key                 = each.value.pgp_key
  password_reset_required = true

  lifecycle {
    # Terraform cannot read the current password back, so it would otherwise
    # propose a replacement on every plan.
    ignore_changes = [password_length, password_reset_required, pgp_key]
  }
}
