# ============================================================================
# ArgoCD Deployment on EKS
# ============================================================================
# Deploys ArgoCD using Helm with IRSA for secure AWS integration,
# following GitOps best practices and the App-of-Apps pattern.
# ============================================================================

# Kubernetes namespace for ArgoCD
resource "kubernetes_namespace" "argocd" {
  metadata {
    name = var.argocd_namespace

    labels = {
      "app.kubernetes.io/name"       = "argocd"
      "app.kubernetes.io/part-of"    = "argocd"
      "app.kubernetes.io/managed-by" = "terraform"
      "environment"                  = var.environment
    }
  }
}

# ============================================================================
# IRSA - IAM Role for ArgoCD Service Account
# ============================================================================
# Provides ArgoCD with least-privilege AWS access for:
# - Reading ECR images
# - Accessing S3 Helm chart repositories (if used)
# - Accessing Secrets Manager / Parameter Store (optional)
# ============================================================================

module "argocd_irsa" {
  count   = var.enable_argocd ? 1 : 0
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name_prefix = "${local.cluster_name}-argocd-"

  role_policy_arns = {
    ecr_readonly = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["${var.argocd_namespace}:argocd-server", "${var.argocd_namespace}:argocd-application-controller", "${var.argocd_namespace}:argocd-repo-server"]
    }
  }

  tags = local.common_tags
}

# ============================================================================
# ArgoCD Helm Release
# ============================================================================

resource "helm_release" "argocd" {
  count = var.enable_argocd ? 1 : 0

  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.argocd_chart_version
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  # Use values file for base configuration
  values = [
    file("${path.module}/helm-values/argocd-values.yaml")
  ]

  # Override IRSA service account annotations
  set {
    name  = "server.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.argocd_irsa[0].iam_role_arn
  }

  set {
    name  = "controller.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.argocd_irsa[0].iam_role_arn
  }

  set {
    name  = "repoServer.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.argocd_irsa[0].iam_role_arn
  }

  # Set admin password (bcrypt hash)
  set_sensitive {
    name  = "configs.secret.argocdServerAdminPassword"
    value = var.argocd_admin_password_hash
  }

  # Wait for ArgoCD to be ready
  wait    = true
  timeout = 600

  depends_on = [
    module.eks,
    kubernetes_namespace.argocd
  ]
}

# ============================================================================
# ArgoCD App-of-Apps Bootstrap Application
# ============================================================================
# This bootstraps the App-of-Apps pattern:
# - ArgoCD manages a root application that points to a Git repository
# - The root application contains definitions for all other applications
# - Changes to applications are made via Git commits (GitOps)
# ============================================================================

resource "kubectl_manifest" "argocd_app_of_apps" {
  count = var.enable_argocd && var.argocd_app_of_apps_repo_url != "" ? 1 : 0

  yaml_body = templatefile("${path.module}/manifests/argocd-app-of-apps.yaml.tftpl", {
    app_name        = "app-of-apps"
    project         = "default"
    repo_url        = var.argocd_app_of_apps_repo_url
    target_revision = var.argocd_app_of_apps_target_revision
    path            = var.argocd_app_of_apps_path
    namespace       = var.argocd_namespace
    environment     = var.environment
    cluster_name    = local.cluster_name
  })

  depends_on = [helm_release.argocd]
}

# ============================================================================
# ArgoCD Project - Infrastructure
# ============================================================================

resource "kubectl_manifest" "argocd_project_infrastructure" {
  count = var.enable_argocd ? 1 : 0

  yaml_body = templatefile("${path.module}/manifests/argocd-project-infrastructure.yaml.tftpl", {
    namespace    = var.argocd_namespace
    environment  = var.environment
    cluster_name = local.cluster_name
  })

  depends_on = [helm_release.argocd]
}

# ============================================================================
# ArgoCD Project - Applications
# ============================================================================

resource "kubectl_manifest" "argocd_project_applications" {
  count = var.enable_argocd ? 1 : 0

  yaml_body = templatefile("${path.module}/manifests/argocd-project-applications.yaml.tftpl", {
    namespace    = var.argocd_namespace
    environment  = var.environment
    cluster_name = local.cluster_name
  })

  depends_on = [helm_release.argocd]
}
