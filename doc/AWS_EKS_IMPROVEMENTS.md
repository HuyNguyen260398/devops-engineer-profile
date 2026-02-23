# AWS EKS Terraform Deployment — Improvements Summary

**Date:** 2026-02-22  
**Scope:** `inf/terraform/aws-eks/`, `.github/workflows/`

---

## Overview

A review of the `aws-eks` Terraform module was performed against current AWS EKS and Terraform best practices. Eight issues were identified and resolved, spanning critical security/correctness bugs and important improvements to reliability, observability, and CI/CD completeness.

---

## Critical Fixes

### 1. Removed `timestamp()` from Resource Tags

**File:** `inf/terraform/aws-eks/locals.tf`

**Problem:** The `CreatedAt` tag used `formatdate("YYYY-MM-DD", timestamp())`, which is evaluated on every `terraform plan`. This caused a perpetual diff — Terraform detected a change on every run and marked resources as needing updates even when nothing had changed.

**Fix:** Removed the `CreatedAt` tag entirely. Resource creation timestamps are available via CloudTrail and AWS Config, which are more reliable sources.

**Impact:** Eliminates false-positive plan diffs; prevents unintended resource updates triggered by CI pipelines.

---

### 2. Production Kubernetes Version Updated (End-of-Life)

**Files:** `inf/terraform/aws-eks/variables.tf`, `inf/terraform/aws-eks/environments/production.tfvars`

**Problem:** The production environment was pinned to Kubernetes `1.28`, which reached End-of-Life in **November 2024**. AWS no longer provides security patches or bug fixes for this version. Running EOL Kubernetes in production is a compliance and security risk.

**Fix:** Updated to `1.32` (currently supported). The default value in `variables.tf` was also updated from `1.28` to `1.32`.

> **Important:** EKS does not support skipping minor versions. Upgrades must be performed one minor version at a time:
> ```
> 1.28 → 1.29 → 1.30 → 1.31 → 1.32
> ```
> Verify workload health at each step before proceeding.

---

### 3. Remote S3 Backend Configuration Added

**File:** `inf/terraform/aws-eks/backend.tf` *(new file)*

**Problem:** `terraform.tfstate` and `terraform.tfstate.backup` files were present in the repository. Storing Terraform state in git is a security anti-pattern — state files contain sensitive resource metadata (ARNs, endpoint URLs, certificates) and do not support concurrent access locking.

**Fix:** Added `backend.tf` with a commented-out S3 + DynamoDB backend configuration. The file includes full setup instructions:

- Create an S3 bucket with versioning and KMS encryption enabled
- Block all public access on the bucket
- Create a DynamoDB table for state locking
- Migrate existing local state using `terraform init -migrate-state`

Once configured, delete `terraform.tfstate` and `terraform.tfstate.backup` from the repository and add them to `.gitignore`.

---

### 4. Stale Variables Removed from `production.tfvars`

**File:** `inf/terraform/aws-eks/environments/production.tfvars`

**Problem:** Nine variables were present in the `aws-eks` module's `production.tfvars` that are not defined in its `variables.tf`:

| Variable | Correct Module |
|----------|----------------|
| `enable_prometheus` | `aws-eks-argocd` |
| `enable_grafana` | `aws-eks-argocd` |
| `prometheus_namespace` | `aws-eks-argocd` |
| `enable_argocd` | `aws-eks-argocd` |
| `argocd_chart_version` | `aws-eks-argocd` |
| `argocd_admin_password_hash` | `aws-eks-argocd` |
| `argocd_app_of_apps_repo_url` | `aws-eks-argocd` |
| `argocd_app_of_apps_target_revision` | `aws-eks-argocd` |
| `argocd_app_of_apps_path` | `aws-eks-argocd` |

**Fix:** Removed all stale variables and added a comment directing to `inf/terraform/aws-eks-argocd/environments/` for ArgoCD/monitoring configuration.

---

## Improvements

### 5. `metrics-server` Helm Release Added

**Files:** `inf/terraform/aws-eks/main.tf`, `inf/terraform/aws-eks/variables.tf`, both `*.tfvars` files

**Problem:** The `metrics-server` was not deployed. This is a prerequisite for:

- **Horizontal Pod Autoscaler (HPA)** — HPA cannot read CPU/memory metrics without `metrics-server`. All `HorizontalPodAutoscaler` resources would remain non-functional.
- **`kubectl top nodes` / `kubectl top pods`** — both commands fail without it.

The cluster already had `enable_cluster_autoscaler = true` and HPA-dependent workloads enabled, making this a functional gap.

**Fix:** Added a `helm_release.metrics_server` resource controlled by a new `enable_metrics_server` variable (default `true`). Added explicitly to both `staging.tfvars` and `production.tfvars`.

---

### 6. Cluster Autoscaler Chart Version Bumped

**File:** `inf/terraform/aws-eks/main.tf`

| | Before | After |
|--|--------|-------|
| Chart version | `9.29.3` | `9.43.2` |

The pinned chart version was over a year old. Updated to a current release and added a comment with the command to verify the latest available version.

---

### 7. Terraform `required_version` and CI Pin Updated

**Files:** `inf/terraform/aws-eks/provider.tf`, `.github/workflows/terraform-*.yml`

| | Before | After |
|--|--------|-------|
| `required_version` | `>= 1.5.0` | `>= 1.9.0` |
| CI `TERRAFORM_VERSION` | `1.7.0` | `1.9.8` |

Terraform `1.9.x` introduced `optional()` type constraints for object variables (used in fix #8 below) and several performance improvements. The version was synced across all three workflow files (`terraform-plan.yml`, `terraform-validation.yml`, `terraform-apply.yml`).

---

### 8. `node_groups` Variable Enhanced with `labels` and `taints`

**File:** `inf/terraform/aws-eks/variables.tf`

**Problem:** The `node_groups` variable type did not include fields for Kubernetes node labels or taints. This prevented workload segregation patterns (e.g., GPU nodes, spot-only nodes, system-reserved nodes) from being configured via variables.

**Fix:** Added two optional fields to the `node_groups` object type:

```hcl
labels = optional(map(string), {})
taints = optional(list(object({
  key    = string
  value  = optional(string)
  effect = string  # NO_SCHEDULE | NO_EXECUTE | PREFER_NO_SCHEDULE
})), [])
```

Both fields are optional with safe defaults so existing `node_groups` configurations require no changes.

---

### 9. `terraform-apply` GitHub Actions Workflow Created

**File:** `.github/workflows/terraform-apply.yml` *(new file)*

**Problem:** The CI/CD pipeline had validation (`terraform-validation.yml`) and planning (`terraform-plan.yml`) but no apply step. The deployment pipeline was incomplete — applies had to be run manually from a local machine, bypassing all CI controls.

**Fix:** Created a `terraform-apply.yml` workflow with the following design principles:

| Feature | Detail |
|---------|--------|
| **Trigger** | `workflow_dispatch` only — no automatic applies |
| **Confirmation guard** | Requires typing `"apply"` before the job proceeds |
| **AWS authentication** | OIDC via `aws-actions/configure-aws-credentials` — no long-lived secrets |
| **Pre-apply plan** | Runs a fresh `terraform plan` immediately before apply as a final check |
| **Environment gates** | References GitHub Environments (`staging` / `production`) — add required reviewers in repository Settings → Environments for production approval |
| **Concurrency** | Scoped per `environment + directory` to prevent parallel state conflicts |
| **Outputs** | Captures `terraform output` into the step summary after a successful apply |
| **Failure guidance** | Prints remediation steps on failure; never exits silently |

---

## Files Changed

| File | Change Type |
|------|-------------|
| `inf/terraform/aws-eks/locals.tf` | Modified — removed `timestamp()` tag |
| `inf/terraform/aws-eks/variables.tf` | Modified — updated default K8s version, enhanced `node_groups` type, added `enable_metrics_server` |
| `inf/terraform/aws-eks/main.tf` | Modified — added `metrics-server` release, bumped autoscaler chart version |
| `inf/terraform/aws-eks/provider.tf` | Modified — updated `required_version` |
| `inf/terraform/aws-eks/backend.tf` | **New** — remote S3 backend configuration template |
| `inf/terraform/aws-eks/environments/production.tfvars` | Modified — updated K8s version, removed stale variables, added `enable_metrics_server` |
| `inf/terraform/aws-eks/environments/staging.tfvars` | Modified — added `enable_metrics_server` |
| `.github/workflows/terraform-apply.yml` | **New** — Terraform apply CI/CD workflow |
| `.github/workflows/terraform-plan.yml` | Modified — synced `TERRAFORM_VERSION` to `1.9.8` |
| `.github/workflows/terraform-validation.yml` | Modified — synced `TERRAFORM_VERSION` to `1.9.8` |

---

## Recommended Next Steps

1. **Provision the S3 backend** using the commands in `backend.tf`, then uncomment the backend block and run `terraform init -migrate-state`.
2. **Add `terraform.tfstate` and `terraform.tfstate.backup` to `.gitignore`** and remove them from git history.
3. **Perform the K8s upgrade incrementally** — do not skip from `1.28` directly to `1.32`.
4. **Create GitHub Environments** (`staging`, `production`) in repository Settings → Environments and add required reviewers to `production` before using the apply workflow.
5. **Set `AWS_DEPLOY_ROLE_ARN`** as a repository secret pointing to the OIDC role provisioned by `inf/terraform/aws-github-oidc/`.
