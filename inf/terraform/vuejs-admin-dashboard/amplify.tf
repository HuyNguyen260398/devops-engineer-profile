# ============================================================================
# Amplify Application (per-environment)
# ============================================================================
# Each environment gets its own Amplify app to avoid cross-state ownership
# conflicts.  Production watches the `main` branch; staging watches `develop`.

resource "aws_amplify_app" "app" {
  name                        = var.amplify_app_name
  iam_service_role_arn        = aws_iam_role.amplify_service_role.arn
  enable_branch_auto_deletion = true

  # Vue Router history mode: rewrite all non-asset paths to index.html
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json|webp)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }

  # HTTPS redirect (SEC-004)
  custom_rule {
    source = "http://<*>"
    target = "https://<*>"
    status = "302"
  }

  tags = {
    Name = var.amplify_app_name
  }
}

# ============================================================================
# Amplify Branch (one per environment, matching pipeline_branch)
# ============================================================================

resource "aws_amplify_branch" "primary" {
  app_id      = aws_amplify_app.app.id
  branch_name = var.pipeline_branch
  stage       = var.amplify_branch_stage

  # Builds are triggered by CodePipeline, not Amplify's built-in CI
  enable_auto_build = false

  tags = {
    Name = "${var.amplify_app_name}-${var.pipeline_branch}"
  }
}

# ============================================================================
# Optional: Custom Domain Association (production only)
# ============================================================================

resource "aws_amplify_domain_association" "app" {
  count = var.custom_domain != "" ? 1 : 0

  app_id      = aws_amplify_app.app.id
  domain_name = var.custom_domain

  sub_domain {
    branch_name = aws_amplify_branch.primary.branch_name
    prefix      = ""
  }

  sub_domain {
    branch_name = aws_amplify_branch.primary.branch_name
    prefix      = "www"
  }
}
