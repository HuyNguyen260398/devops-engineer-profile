resource "aws_cognito_user_pool" "blog" {
  name                     = "${local.name_prefix}-users"
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true # self-signup disabled
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-users" })
}

resource "aws_cognito_user_pool_client" "blog" {
  name            = "${local.name_prefix}-spa"
  user_pool_id    = aws_cognito_user_pool.blog.id
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.blog.id
  username     = var.admin_email

  attributes = {
    email          = var.admin_email
    email_verified = "true"
  }

  # Cognito emails a temporary password on first apply; the admin sets a
  # permanent one at first login (NEW_PASSWORD_REQUIRED challenge).
}
