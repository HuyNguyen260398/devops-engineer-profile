<div align="center">

# DevOps Engineer Profile

[![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?style=flat-square&logo=terraform)](https://www.terraform.io/)
[![ArgoCD](https://img.shields.io/badge/ArgoCD-GitOps-EF7B4D?style=flat-square&logo=argo)](https://argoproj.github.io/cd/)
[![AWS](https://img.shields.io/badge/AWS-EKS%20%7C%20S3%20%7C%20CloudFront-FF9900?style=flat-square&logo=amazonaws)](https://aws.amazon.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI%2FCD-2088FF?style=flat-square&logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

A production-grade DevOps platform showcasing cloud infrastructure, GitOps continuous delivery, multi-tenant Kubernetes, and full-stack observability on AWS EKS.

[Overview](#overview) • [Architecture](#architecture) • [Getting Started](#getting-started) • [Project Structure](#project-structure) • [Key Commands](#key-commands) • [CI/CD](#cicd-workflows)

</div>

---

## Overview

This repository is both a working infrastructure platform and a portfolio of DevOps engineering practices. It is not a traditional application — it is a collection of production-ready infrastructure-as-code, GitOps manifests, CI/CD pipelines, and operational scripts that work together to run a fully automated Kubernetes platform on AWS.

**What it demonstrates:**

- **GitOps** — ArgoCD App-of-Apps pattern as the single source of truth for all Kubernetes workloads
- **Infrastructure as Code** — Five independent Terraform root modules managing AWS EKS, S3, CloudFront, IAM, and GitHub OIDC
- **Multi-tenant Kubernetes** — Three tenant tiers (Basic/Advanced/Premium) with namespace isolation and resource quotas
- **Full-stack observability** — Prometheus + Grafana for metrics, ELK Stack + Fluent Bit for logs, CloudWatch for AWS-layer visibility
- **Keyless CI/CD** — GitHub OIDC replaces all static AWS credentials; IRSA scopes IAM to individual pods
- **Progressive delivery** — ArgoCD sync waves enforce dependency ordering across infrastructure layers and tenant tiers

---

## Architecture

The platform is composed of four cohesive subsystems:

| Subsystem | Path | Description |
|---|---|---|
| GitOps Platform | `gitops/` | ArgoCD App-of-Apps on EKS — the main deliverable |
| Infrastructure as Code | `inf/terraform/` | Five independent Terraform root modules |
| Operational Automation | `ops/` | Python lifecycle scripts for local and cloud operations |
| Portfolio Website | `src/` | Static site deployed to S3 + CloudFront |

### GitOps Platform Layout

```
gitops/
├── bootstrap/          ArgoCD install, AppProjects (RBAC boundaries), root Applications
├── control-plane/      RBAC, Argo Workflows for tenant onboarding/offboarding
├── application-plane/  Environment-specific manifests (local / staging / production)
│   └── {env}/
│       ├── infrastructure/   Monitoring, logging, AWX — sync waves -1 to 1
│       ├── pooled-envs/      Basic tier shared namespace pools
│       └── tenants/          Tenant Applications by tier (basic / advanced / premium)
├── applicationsets/    Dynamic Application generation from Git directory structure
└── helm-charts/        Centralized Helm values overrides for all deployed charts
```

### Sync Wave Ordering

Infrastructure components are deployed in strict dependency order using ArgoCD sync waves:

```
Wave -1 → ECK Operator           (CRD prerequisites)
Wave  0 → kube-prometheus-stack, eck-stack
Wave  1 → Fluent Bit, AWX, Jenkins pool
Wave 2+ → Tenant applications
```

### Terraform Modules

| Module | Purpose |
|---|---|
| `aws-eks/` | EKS cluster, VPC, node groups, ArgoCD bootstrap, CloudWatch logging |
| `aws-eks-argocd/` | IRSA roles for ArgoCD pods to access ECR and other AWS services |
| `aws-s3-web/` | S3 bucket for static website hosting with versioning and encryption |
| `aws-github-oidc/` | GitHub OIDC provider and IAM role for keyless CI/CD authentication |
| `aws-cloudfront-s3-oac-resume/` | CloudFront distribution with Origin Access Control |

> [!NOTE]
> Each Terraform module has independent state stored in its own S3 backend path. Cross-module references use `terraform_remote_state` data sources.

---

## Getting Started

### Prerequisites

| Tool | Purpose |
|---|---|
| [Terraform >= 1.5](https://developer.hashicorp.com/terraform/install) | Infrastructure provisioning |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | Kubernetes cluster interaction |
| [ArgoCD CLI](https://argo-cd.readthedocs.io/en/stable/cli_installation/) | GitOps management |
| [Helm >= 3](https://helm.sh/docs/intro/install/) | Kubernetes package management |
| [Python >= 3.10](https://www.python.org/downloads/) | Operational scripts |
| [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) | AWS interactions |
| A local cluster (minikube / kind / k3s) | Local GitOps testing |

### Local Development (No AWS Required)

The `deploy_gitops_stacks_local.py` script bootstraps the full GitOps platform on a local cluster:

```bash
pip install -r ops/requirements.txt
pip install rich

python ops/deploy_gitops_stacks_local.py \
  --gitops-path . \
  --repo-url https://github.com/<your-org>/<your-repo>.git \
  --action deploy
```

This deploys ArgoCD, kube-prometheus-stack, ELK Stack, AWX, and Jenkins in correct wave order with status polling.

> [!TIP]
> Run with `--action menu` (the default) for an interactive menu to deploy, check status, or clean up individual stacks.

Available actions: `deploy` | `status` | `cleanup` | `menu`

### AWS Deployment

Deploy in the following order — each module has isolated state:

```bash
# 1. GitHub OIDC trust (required for CI/CD authentication)
cd inf/terraform/aws-github-oidc
terraform init && terraform apply -var-file="environments/staging.tfvars"

# 2. Static website bucket
cd inf/terraform/aws-s3-web
terraform init && terraform apply -var-file="environments/staging.tfvars"

# 3. EKS cluster + ArgoCD bootstrap
cd inf/terraform/aws-eks
terraform init && terraform apply -var-file="environments/staging.tfvars"

# 4. IRSA for ArgoCD
cd inf/terraform/aws-eks-argocd
terraform init && terraform apply -var-file="environments/staging.tfvars"

# 5. Bootstrap GitOps platform (ArgoCD self-manages everything after this)
kubectl apply -k gitops/bootstrap/
```

After step 5, ArgoCD reconciles the entire platform from Git — no further manual steps.

---

## Project Structure

```
devops-engineer-profile/
├── gitops/             ArgoCD-based GitOps platform (main deliverable)
├── inf/
│   └── terraform/      Five independent Terraform root modules
├── ops/                Python operational scripts and automation
├── src/
│   └── aws-s3-web/     Portfolio website static assets (HTML/CSS/JS)
├── docs/               Architecture guides, implementation notes, RCAs
├── plan/               Feature planning documents
├── .github/
│   ├── workflows/      GitHub Actions CI/CD pipelines
│   ├── instructions/   Copilot domain-specific coding guidelines
│   ├── agents/         Copilot custom agents
│   └── prompts/        Copilot prompt templates
├── .claude/            Claude Code skills
├── .tflint.hcl         Terraform lint rules (naming, tags, documentation)
└── CLAUDE.md           Claude Code guidance for this repository
```

---

## Key Commands

### Terraform

```bash
# From any inf/terraform/<project>/ directory
terraform init
terraform validate
terraform plan -var-file="environments/staging.tfvars"
terraform apply -var-file="environments/staging.tfvars"

# Lint all modules from repo root
tflint --recursive
```

### GitOps (ArgoCD)

```bash
# Bootstrap on a local cluster
kubectl apply -k gitops/bootstrap/

# Check sync status of all Applications
kubectl get applications -n argocd

# Watch sync progress
kubectl get applications -n argocd -w
```

### Python Scripts

```bash
pip install -r ops/requirements.txt

# Full platform lifecycle on local cluster
python ops/deploy_gitops_stacks_local.py \
  --gitops-path . \
  --repo-url https://github.com/<org>/<repo>.git \
  --action deploy|status|cleanup|menu
```

---

## CI/CD Workflows

All workflows authenticate to AWS via **GitHub OIDC** — no long-lived credentials are stored.

| Workflow | Trigger | What it does |
|---|---|---|
| `terraform-plan.yml` | PR touching `inf/terraform/**` | Auto-discovers changed projects, runs `terraform plan` as a matrix, comments results on the PR |
| `terraform-apply.yml` | Merge to `main` | Applies approved plans per environment |
| `terraform-validation.yml` | Every push | Syntax validation gate (`terraform validate`) |
| `aws-s3-web-sync-staging.yml` | Push to `main` | Syncs `src/` to staging S3 bucket |
| `aws-s3-web-sync-prod.yml` | Push to `main` | Syncs `src/` to production S3 bucket |

> [!IMPORTANT]
> The `terraform-plan.yml` workflow auto-discovers Terraform projects by scanning `inf/terraform/*/environments/*.tfvars`. Adding a new module requires no workflow changes — just follow the standard module structure.

---

## Observability Stack

The platform ships with a full observability stack deployed via GitOps:

| Concern | Tools |
|---|---|
| Metrics | Prometheus + Grafana + Alertmanager (kube-prometheus-stack) |
| Logs | Elasticsearch + Kibana (ECK) + Fluent Bit |
| AWS control plane | CloudWatch Logs (API, audit, authenticator) |
| Network | VPC Flow Logs → CloudWatch |

---

## Multi-Tenant Model

Tenants are stratified into three tiers with increasing isolation:

| Tier | Namespace | Isolation | Environments |
|---|---|---|---|
| Basic | `pool-1` (shared) | Resource quotas on shared pool | local, staging, production |
| Advanced | `tenant-{name}` | Dedicated controller per tenant | staging, production |
| Premium | `tenant-{name}` (silo) | Full namespace + node isolation | production only |

ApplicationSets in `gitops/applicationsets/` auto-discover tenant configurations from the Git directory structure — onboarding a new tenant is a pull request, not a manual operation.

---

## Architecture Documentation

Detailed documentation is available in `docs/`:

- [`Project_Architecture_Blueprint.md`](docs/Project_Architecture_Blueprint.md) — Comprehensive architecture reference with C4 diagrams, ADRs, and implementation patterns
- [`GITOPS_LOCAL_DEPLOYMENT_GUIDE.md`](docs/GITOPS_LOCAL_DEPLOYMENT_GUIDE.md) — Step-by-step local bootstrap guide
- [`TODO.md`](docs/TODO.md) — Roadmap and outstanding work

---

## Conventions

This repository enforces consistent practices through automated tooling:

- **Terraform naming** — all identifiers must use `snake_case` (enforced by `tflint`)
- **Required tags** — every AWS resource must carry `Environment`, `Project`, and `ManagedBy` tags
- **Documented variables** — all Terraform variables and outputs require `description` and `type`
- **Pinned versions** — all Terraform modules and Helm chart versions must be pinned
- **Pod security** — `restricted` Pod Security Standards applied to all infrastructure workloads
