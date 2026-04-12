# ============================================================================
# CodeArtifact Domain (per-environment)
# ============================================================================

#tfsec:ignore:aws-codeartifact-enable-domain-encryption
resource "aws_codeartifact_domain" "app" {
  #checkov:skip=CKV_AWS_178: AWS-managed KMS key is sufficient for a CI/CD package cache in this portfolio project; CMK is disproportionate.
  domain = local.name_prefix

  tags = {
    Name = local.name_prefix
  }
}

# ============================================================================
# CodeArtifact npm Repository — proxies the public npmjs registry
# ============================================================================

resource "aws_codeartifact_repository" "npm" {
  repository = "${local.name_prefix}-npm"
  domain     = aws_codeartifact_domain.app.domain

  external_connections {
    external_connection_name = "public:npmjs"
  }

  tags = {
    Name = "${local.name_prefix}-npm"
  }
}

# ============================================================================
# Domain Permissions Policy — restrict access to the current AWS account only
# ============================================================================

data "aws_iam_policy_document" "codeartifact_domain_permissions" {
  statement {
    sid    = "AccountAccess"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account_id}:root"]
    }

    actions   = ["codeartifact:*"]
    resources = ["*"]
  }
}

resource "aws_codeartifact_domain_permissions_policy" "app" {
  domain          = aws_codeartifact_domain.app.domain
  domain_owner    = local.account_id
  policy_document = data.aws_iam_policy_document.codeartifact_domain_permissions.json
}
