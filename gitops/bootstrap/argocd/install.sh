#!/usr/bin/env bash
# ============================================================================
# ArgoCD Installation Script for GitOps Bootstrap
# ============================================================================
# Installs/upgrades ArgoCD via Helm with environment-specific overrides.
#
# Usage:
#   ./install.sh <command> [environment]
#
# Commands:
#   install   <env>   Install ArgoCD for environment (local|staging|production)
#   upgrade   <env>   Upgrade ArgoCD for environment
#   uninstall         Remove ArgoCD from cluster
#   status            Show ArgoCD deployment status
#   password          Retrieve ArgoCD admin password
#   bootstrap <env>   Install ArgoCD + apply App-of-Apps + projects
#
# Environment:
#   local       Local development (Minikube, Kind, Docker Desktop)
#   staging     AWS EKS staging cluster
#   production  AWS EKS production cluster
#
# Prerequisites:
#   - kubectl configured with target cluster context
#   - helm 3.x installed
#   - envsubst (for AWS environments)
# ============================================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
ARGOCD_CHART_VERSION="7.8.0"
ARGOCD_NAMESPACE="argocd"
RELEASE_NAME="argocd"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GITOPS_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Functions ──────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 <command> [environment]"
  echo ""
  echo "Commands:"
  echo "  install   <env>   Install ArgoCD (local|staging|production)"
  echo "  upgrade   <env>   Upgrade ArgoCD"
  echo "  uninstall         Remove ArgoCD"
  echo "  status            Show ArgoCD status"
  echo "  password          Get admin password"
  echo "  bootstrap <env>   Full bootstrap (install + projects + app-of-apps)"
  exit 1
}

ensure_namespace() {
  kubectl apply -f "${SCRIPT_DIR}/namespace.yaml"
}

helm_install_or_upgrade() {
  local cmd="$1"
  local env="$2"

  ensure_namespace

  local helm_args=(
    "${cmd}" "${RELEASE_NAME}" argo/argo-cd
    --namespace "${ARGOCD_NAMESPACE}"
    --version "${ARGOCD_CHART_VERSION}"
    --values "${SCRIPT_DIR}/values-base.yaml"
    --wait
    --timeout 10m
  )

  # Add environment-specific values
  case "${env}" in
    local)
      helm_args+=(--values "${SCRIPT_DIR}/values-local.yaml")
      ;;
    staging|production)
      # AWS environments require envsubst for IRSA role ARN
      if [[ -z "${ARGOCD_IRSA_ROLE_ARN:-}" ]]; then
        log_warn "ARGOCD_IRSA_ROLE_ARN not set. IRSA annotations will be empty."
      fi
      envsubst < "${SCRIPT_DIR}/values-aws.yaml" > /tmp/argocd-values-aws-resolved.yaml
      helm_args+=(--values /tmp/argocd-values-aws-resolved.yaml)
      ;;
    *)
      log_error "Unknown environment: ${env}"
      usage
      ;;
  esac

  log_info "Running: helm ${cmd} ArgoCD (env=${env}, chart=${ARGOCD_CHART_VERSION})"
  helm repo add argo https://argoproj.github.io/argo-helm 2>/dev/null || true
  helm repo update argo

  helm "${helm_args[@]}"
  log_info "ArgoCD ${cmd} completed successfully."
}

apply_projects() {
  log_info "Applying ArgoCD AppProjects..."
  kubectl apply -f "${GITOPS_ROOT}/bootstrap/projects/"
  log_info "AppProjects applied."
}

apply_app_of_apps() {
  local env="$1"

  log_info "Applying App-of-Apps for environment: ${env}"

  export ENVIRONMENT="${env}"
  export ARGOCD_APPS_REPO_URL="${ARGOCD_APPS_REPO_URL:-https://github.com/your-org/devops-engineer-profile.git}"
  export ARGOCD_APPS_TARGET_REVISION="${ARGOCD_APPS_TARGET_REVISION:-HEAD}"

  envsubst < "${GITOPS_ROOT}/bootstrap/app-of-apps.yaml" | kubectl apply -f -
  log_info "App-of-Apps applied."
}

do_uninstall() {
  log_info "Uninstalling ArgoCD..."
  helm uninstall "${RELEASE_NAME}" --namespace "${ARGOCD_NAMESPACE}" 2>/dev/null || true
  kubectl delete namespace "${ARGOCD_NAMESPACE}" --ignore-not-found
  log_info "ArgoCD uninstalled."
}

do_status() {
  log_info "ArgoCD deployment status:"
  kubectl get all -n "${ARGOCD_NAMESPACE}" 2>/dev/null || echo "ArgoCD not found."
  echo ""
  helm list -n "${ARGOCD_NAMESPACE}" 2>/dev/null || true
}

do_password() {
  local pw
  pw=$(kubectl -n "${ARGOCD_NAMESPACE}" get secret argocd-initial-admin-secret \
    -o jsonpath="{.data.password}" 2>/dev/null | base64 -d)
  if [[ -n "${pw}" ]]; then
    echo "ArgoCD Admin Password: ${pw}"
  else
    log_warn "Initial admin secret not found. It may have been deleted after first login."
  fi
}

# ── Main ───────────────────────────────────────────────────────────────────

[[ $# -lt 1 ]] && usage

COMMAND="$1"
ENV="${2:-}"

case "${COMMAND}" in
  install)
    [[ -z "${ENV}" ]] && { log_error "Environment required."; usage; }
    helm_install_or_upgrade install "${ENV}"
    ;;
  upgrade)
    [[ -z "${ENV}" ]] && { log_error "Environment required."; usage; }
    helm_install_or_upgrade upgrade "${ENV}"
    ;;
  uninstall)
    do_uninstall
    ;;
  status)
    do_status
    ;;
  password)
    do_password
    ;;
  bootstrap)
    [[ -z "${ENV}" ]] && { log_error "Environment required."; usage; }
    helm_install_or_upgrade install "${ENV}"
    apply_projects
    apply_app_of_apps "${ENV}"
    log_info "Bootstrap complete for ${ENV}!"
    ;;
  *)
    log_error "Unknown command: ${COMMAND}"
    usage
    ;;
esac
