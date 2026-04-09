# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a DevOps engineering portfolio and working infrastructure project demonstrating cloud architecture, IaC, GitOps, observability, and automation on AWS EKS. It is not a traditional application — it is a collection of infrastructure-as-code, GitOps manifests, and operational scripts.

## Directory Structure

```
inf/        - Terraform and CloudFormation infrastructure
src/        - Static web assets (portfolio site)
ops/        - Python operational scripts and automation
gitops/     - ArgoCD-based GitOps platform (the main deliverable)
docs/       - Architecture and implementation guides
plan/       - Planning documents
.github/    - GitHub Actions workflows, Copilot agents/prompts/instructions
.claude/    - Claude Code skills
```

## Key Commands

### Terraform
```bash
# Validate and plan (from a specific inf/terraform/<project>/ directory)
terraform init
terraform validate
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"

# Lint (run from repo root)
tflint --recursive
```

### Python Scripts (ops/)
```bash
pip install -r ops/requirements.txt   # boto3, requests
pip install rich                       # required for deploy_gitops_stacks_local.py

# Local GitOps platform lifecycle (interactive menu by default)
python ops/deploy_gitops_stacks_local.py \
  --gitops-path . \
  --repo-url https://github.com/<org>/<repo>.git \
  --action deploy|status|cleanup|menu
```

### GitOps Bootstrap (ArgoCD)
```bash
# Bootstrap ArgoCD on a local cluster (minikube/kind/k3s)
kubectl apply -k gitops/bootstrap/

# Check ArgoCD sync status
kubectl get applications -n argocd
```

## Architecture: GitOps Platform

The `gitops/` directory implements an **App-of-Apps** pattern on AWS EKS:

- **`gitops/bootstrap/`** — Installs ArgoCD and AppProjects that own all other apps
- **`gitops/control-plane/`** — Infrastructure-layer apps synced before tenants (sync waves -1 to 1):
  - `monitoring/` — kube-prometheus-stack (Prometheus, Grafana, Alertmanager, node-exporter)
  - `logging/` — ECK Operator + ELK Stack (Elasticsearch, Kibana) + Fluent Bit
  - `automation/` — AWX (Ansible Automation Platform), Jenkins
- **`gitops/application-plane/`** — Tenant namespaces and shared resources
- **`gitops/applicationsets/`** — ApplicationSet definitions that dynamically generate ArgoCD Applications per tenant
- **`gitops/helm-charts/`** — Custom `values.yaml` overrides for all deployed Helm charts

**Tenant tiers:** `pool-1` (Basic/shared), `tenant-A/B/C` (Advanced/Premium with dedicated resources).

## Architecture: Infrastructure (Terraform)

Each `inf/terraform/<project>/` is an independent Terraform root module with its own state. Common projects provision:
- S3 + CloudFront for static site hosting
- EKS clusters and node groups
- IAM roles with GitHub OIDC trust for keyless CI/CD authentication

**Terraform conventions enforced by `.tflint.hcl`:**
- All resources, variables, outputs, modules, and data sources must use `snake_case`
- Required tags on all AWS resources: `Environment`, `Project`, `ManagedBy`
- All variables and outputs must have descriptions and types
- All modules must pin a version

## CI/CD Workflows

GitHub Actions in `.github/workflows/`:
- `terraform-plan.yml` — Runs on PRs; auto-discovers changed Terraform directories and fans out a matrix plan
- `terraform-apply.yml` — Applies after merge to main
- `terraform-validation.yml` — Validates syntax on every push
- `aws-s3-web-sync-staging/prod.yml` — Syncs `src/` to S3 on push

Authentication uses GitHub OIDC → AWS IAM role assumption (no long-lived credentials).

## Copilot Instructions

Domain-specific Copilot instructions live in `.github/instructions/` and cover Terraform, Kubernetes manifests, GitHub Actions, Python, Ansible, Docker, and more. When generating code in these areas, follow the patterns in those files.
