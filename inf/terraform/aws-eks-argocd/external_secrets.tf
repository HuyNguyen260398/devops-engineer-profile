# ============================================================================
# IRSA – External Secrets Operator
# ============================================================================
# Grants the ESO controller (external-secrets/external-secrets service
# account) read-only access to AWS Secrets Manager entries under the
# gitops/<environment>/ prefix. ESO syncs these into Kubernetes Secrets
# declared as ExternalSecret resources in the GitOps repo.
#
# Secrets Manager naming convention: gitops/<environment>/<name>
#   e.g. gitops/production/grafana-admin
# Entries are created out-of-band (never in Terraform — keeps secret
# values out of state). See README for the create-secret commands.
# ============================================================================

resource "aws_iam_policy" "external_secrets" {
  count = var.enable_external_secrets ? 1 : 0

  name_prefix = "${var.cluster_name}-eso-"
  description = "Read-only Secrets Manager access for External Secrets Operator (gitops/${var.environment}/* prefix)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadGitopsSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:gitops/${var.environment}/*"
      }
    ]
  })

  tags = local.common_tags
}

module "external_secrets_irsa" {
  count  = var.enable_external_secrets ? 1 : 0
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-iam.git//modules/iam-role-for-service-accounts-eks?ref=e803e25ce20a6ebd5579e0896f657fa739f6f03e"

  role_name_prefix = "${var.cluster_name}-eso-"

  role_policy_arns = {
    secrets_read = aws_iam_policy.external_secrets[0].arn
  }

  oidc_providers = {
    main = {
      provider_arn               = local.oidc_provider_arn
      namespace_service_accounts = ["external-secrets:external-secrets"]
    }
  }

  tags = local.common_tags
}
