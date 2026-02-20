#!/usr/bin/env bash
# ============================================================================
# deploy-aws.sh – ArgoCD Deployment Script for AWS EKS
# ============================================================================
# Deploys and manages ArgoCD on an AWS EKS cluster using Helm and kubectl.
# AWS-specific infrastructure (IRSA role) must be provisioned first via:
#   cd inf/terraform/aws-eks-argocd
#   terraform apply -var-file environments/<env>.tfvars
#
# Usage:
#   bash deploy-aws.sh <command> [environment]
#
# Commands:
#   install     Create namespace, install ArgoCD Helm chart, apply manifests
#   upgrade     Upgrade existing ArgoCD Helm release with current values
#   uninstall   Remove ArgoCD Helm release, namespace, and standalone manifests
#   status      Show pod/service/ingress status in the argocd namespace
#   password    Retrieve the initial admin password from the cluster
#   app-of-apps Apply the App-of-Apps bootstrap Application
#
# Required environment variables:
#   ARGOCD_IRSA_ROLE_ARN   IAM role ARN from `terraform output -raw argocd_irsa_role_arn`
#   ENVIRONMENT            staging | production  (default: staging)
#
# Optional environment variables (for app-of-apps command only):
#   ARGOCD_APPS_REPO_URL          Git repo URL for the App-of-Apps
#   ARGOCD_APPS_TARGET_REVISION   Branch/tag to track (default: HEAD)
#   ARGOCD_APPS_PATH              Path inside repo   (default: ops/k8s/argocd-apps)
#
# Example – full install:
#   export ARGOCD_IRSA_ROLE_ARN=$(cd ../../inf/terraform/aws-eks-argocd && terraform output -raw argocd_irsa_role_arn)
#   export ENVIRONMENT=staging
#   bash deploy-aws.sh install
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

COMMAND="${1:-}"
ENVIRONMENT="${2:-${ENVIRONMENT:-staging}}"

ARGOCD_NAMESPACE="argocd"
ARGOCD_CHART_VERSION="9.4.2"
HELM_RELEASE_NAME="argocd"
HELM_REPO_NAME="argo"
HELM_REPO_URL="https://argoproj.github.io/argo-helm"

MANIFESTS_DIR="${SCRIPT_DIR}/manifests"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[$(date +%H:%M:%S)] $*"; }
err()  { echo "[ERROR] $*" >&2; }
die()  { err "$*"; exit 1; }

require_env() {
  local var="$1"
  [[ -n "${!var:-}" ]] || die "Required environment variable '${var}' is not set."
}

helm_repo_add() {
  if ! helm repo list | grep -q "^${HELM_REPO_NAME}"; then
    log "Adding Helm repo '${HELM_REPO_NAME}'…"
    helm repo add "${HELM_REPO_NAME}" "${HELM_REPO_URL}"
  fi
  helm repo update "${HELM_REPO_NAME}"
}

build_aws_values() {
  # Substitute ARGOCD_IRSA_ROLE_ARN into the AWS values template and write
  # to a temp file so Helm can consume it.
  require_env ARGOCD_IRSA_ROLE_ARN
  local tmp
  tmp="$(mktemp /tmp/argocd-values-aws-XXXXX.yaml)"
  envsubst < "${SCRIPT_DIR}/argocd-values-aws.yaml" > "${tmp}"
  echo "${tmp}"
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
cmd_install() {
  log "Installing ArgoCD ${ARGOCD_CHART_VERSION} (environment: ${ENVIRONMENT})"

  require_env ARGOCD_IRSA_ROLE_ARN

  # 1. Namespace
  log "Applying namespace…"
  kubectl apply -f "${MANIFESTS_DIR}/namespace.yaml"

  # 2. Helm install
  helm_repo_add
  local aws_values
  aws_values="$(build_aws_values)"
  trap "rm -f ${aws_values}" EXIT

  log "Installing ArgoCD Helm release '${HELM_RELEASE_NAME}'…"
  helm upgrade --install "${HELM_RELEASE_NAME}" "${HELM_REPO_NAME}/argo-cd" \
    --namespace "${ARGOCD_NAMESPACE}" \
    --version "${ARGOCD_CHART_VERSION}" \
    -f "${SCRIPT_DIR}/argocd-values.yaml" \
    -f "${aws_values}" \
    --wait --timeout 15m

  # 3. Standalone ALB Ingress
  log "Applying ALB Ingress…"
  kubectl apply -f "${MANIFESTS_DIR}/ingress.yaml"

  # 4. ArgoCD Projects
  log "Applying ArgoCD projects…"
  kubectl apply -f "${MANIFESTS_DIR}/projects/infrastructure.yaml"
  kubectl apply -f "${MANIFESTS_DIR}/projects/applications.yaml"

  log ""
  log "ArgoCD installed successfully!"
  cmd_status
}

cmd_upgrade() {
  log "Upgrading ArgoCD ${ARGOCD_CHART_VERSION} (environment: ${ENVIRONMENT})"

  require_env ARGOCD_IRSA_ROLE_ARN

  helm_repo_add
  local aws_values
  aws_values="$(build_aws_values)"
  trap "rm -f ${aws_values}" EXIT

  helm upgrade "${HELM_RELEASE_NAME}" "${HELM_REPO_NAME}/argo-cd" \
    --namespace "${ARGOCD_NAMESPACE}" \
    --version "${ARGOCD_CHART_VERSION}" \
    -f "${SCRIPT_DIR}/argocd-values.yaml" \
    -f "${aws_values}" \
    --wait --timeout 15m

  # Re-apply standalone manifests (idempotent)
  kubectl apply -f "${MANIFESTS_DIR}/ingress.yaml"
  kubectl apply -f "${MANIFESTS_DIR}/projects/infrastructure.yaml"
  kubectl apply -f "${MANIFESTS_DIR}/projects/applications.yaml"

  log "ArgoCD upgraded successfully!"
}

cmd_uninstall() {
  log "Uninstalling ArgoCD (environment: ${ENVIRONMENT})"

  # Remove standalone manifests first so ALB controller cleans up the ALB
  log "Removing standalone Ingress (triggers ALB deletion)…"
  kubectl delete -f "${MANIFESTS_DIR}/ingress.yaml" --ignore-not-found

  log "Removing ArgoCD projects…"
  kubectl delete -f "${MANIFESTS_DIR}/projects/applications.yaml" --ignore-not-found
  kubectl delete -f "${MANIFESTS_DIR}/projects/infrastructure.yaml" --ignore-not-found

  # Wait for ALB to be fully deleted before removing the Helm release
  log "Waiting 20s for ALB Controller to clean up the ALB…"
  sleep 20

  log "Uninstalling Helm release '${HELM_RELEASE_NAME}'…"
  helm uninstall "${HELM_RELEASE_NAME}" --namespace "${ARGOCD_NAMESPACE}" --ignore-not-found

  log "Deleting namespace '${ARGOCD_NAMESPACE}'…"
  kubectl delete namespace "${ARGOCD_NAMESPACE}" --ignore-not-found

  log "ArgoCD uninstalled."
}

cmd_status() {
  log "=== ArgoCD Status ==="
  echo ""
  kubectl get pods     -n "${ARGOCD_NAMESPACE}" -o wide 2>/dev/null || true
  echo ""
  kubectl get svc      -n "${ARGOCD_NAMESPACE}"          2>/dev/null || true
  echo ""
  kubectl get ingress  -n "${ARGOCD_NAMESPACE}"          2>/dev/null || true
  echo ""
  local alb_dns
  alb_dns="$(kubectl get ingress argocd-server -n "${ARGOCD_NAMESPACE}" \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
  if [[ -n "${alb_dns}" ]]; then
    log "ArgoCD UI:  http://${alb_dns}"
  else
    log "ALB DNS not yet assigned – check again in 1-2 minutes."
  fi
}

cmd_password() {
  log "Retrieving ArgoCD admin password…"
  kubectl get secret argocd-initial-admin-secret \
    -n "${ARGOCD_NAMESPACE}" \
    -o jsonpath="{.data.password}" \
    | base64 --decode
  echo ""
}

cmd_app_of_apps() {
  log "Applying App-of-Apps manifest (environment: ${ENVIRONMENT})"

  require_env ARGOCD_APPS_REPO_URL

  local tmp
  tmp="$(mktemp /tmp/argocd-app-of-apps-XXXXX.yaml)"
  trap "rm -f ${tmp}" EXIT

  # Export defaults so envsubst resolves optional variables
  export ARGOCD_APPS_TARGET_REVISION="${ARGOCD_APPS_TARGET_REVISION:-HEAD}"
  export ARGOCD_APPS_PATH="${ARGOCD_APPS_PATH:-ops/k8s/argocd-apps}"

  envsubst < "${MANIFESTS_DIR}/app-of-apps.yaml" > "${tmp}"
  kubectl apply -f "${tmp}"
  log "App-of-Apps applied."
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
case "${COMMAND}" in
  install)     cmd_install ;;
  upgrade)     cmd_upgrade ;;
  uninstall)   cmd_uninstall ;;
  status)      cmd_status ;;
  password)    cmd_password ;;
  app-of-apps) cmd_app_of_apps ;;
  *)
    echo "Usage: bash deploy-aws.sh <install|upgrade|uninstall|status|password|app-of-apps> [environment]"
    echo ""
    echo "Commands:"
    echo "  install       Install ArgoCD and apply all manifests"
    echo "  upgrade       Upgrade the Helm release and re-apply manifests"
    echo "  uninstall     Remove ArgoCD, Ingress, projects, and namespace"
    echo "  status        Show pods, services, and Ingress/ALB URL"
    echo "  password      Print the initial admin password"
    echo "  app-of-apps   Apply the App-of-Apps bootstrap Application"
    echo ""
    echo "Required env vars: ARGOCD_IRSA_ROLE_ARN, ENVIRONMENT"
    exit 1
    ;;
esac
