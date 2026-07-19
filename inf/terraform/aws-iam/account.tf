# ===========================================================================
# Account Password Policy
# ===========================================================================
# aws_iam_account_password_policy is an ACCOUNT SINGLETON — there is exactly
# one per AWS account. If two Terraform stacks both declare it, each apply
# will revert the other's settings, producing permanent drift.
#
# Gated behind manage_account_password_policy (default false). Enable it in
# exactly one stack per account.
#
# hard_expiry deserves a warning: when true, users whose password expires are
# locked out entirely and require an administrator to reset them. In an
# account where the administrator's own password expires, this locks everyone
# out. Left false by default for that reason.
#
# This resource is not taggable, so the .tflint.hcl required-tags rule does
# not apply.
# ===========================================================================

resource "aws_iam_account_password_policy" "this" {
  count = var.manage_account_password_policy ? 1 : 0

  minimum_password_length        = var.password_policy.minimum_password_length
  require_lowercase_characters   = var.password_policy.require_lowercase_characters
  require_uppercase_characters   = var.password_policy.require_uppercase_characters
  require_numbers                = var.password_policy.require_numbers
  require_symbols                = var.password_policy.require_symbols
  allow_users_to_change_password = var.password_policy.allow_users_to_change_password
  max_password_age               = var.password_policy.max_password_age
  password_reuse_prevention      = var.password_policy.password_reuse_prevention
  hard_expiry                    = var.password_policy.hard_expiry
}
