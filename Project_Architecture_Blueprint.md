# Project Architecture Blueprint

> **Generated:** 2026-03-21 | **Repository:** `devops-engineer-profile`
> **Purpose:** Definitive architectural reference for maintaining consistency and guiding new development.

---

## Table of Contents

1. [Architectural Overview](#1-architectural-overview)
2. [Architecture Visualization](#2-architecture-visualization)
3. [Core Architectural Components](#3-core-architectural-components)
4. [Architectural Layers and Dependencies](#4-architectural-layers-and-dependencies)
5. [Data Architecture](#5-data-architecture)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Service Communication Patterns](#7-service-communication-patterns)
8. [Technology-Specific Patterns](#8-technology-specific-patterns)
9. [Implementation Patterns](#9-implementation-patterns)
10. [Testing Architecture](#10-testing-architecture)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Extension and Evolution Patterns](#12-extension-and-evolution-patterns)
13. [Architectural Pattern Examples](#13-architectural-pattern-examples)
14. [Architectural Decision Records](#14-architectural-decision-records)
15. [Architecture Governance](#15-architecture-governance)
16. [Blueprint for New Development](#16-blueprint-for-new-development)

---

## 1. Architectural Overview

This repository is a **multi-layer DevOps showcase platform** with four distinct subsystems operating cohesively under a single monorepo. It is not a single application but a portfolio of production-grade DevOps solutions demonstrating cloud infrastructure design, GitOps practices, and CI/CD automation.

### Guiding Principles

| Principle | Expression in the Codebase |
|---|---|
| **GitOps as single source of truth** | All desired cluster state lives in Git (`gitops/`); ArgoCD reconciles continuously |
| **Infrastructure as Code everywhere** | Both Terraform (`inf/terraform/`) and CloudFormation (`inf/cloudformation/`) are used; nothing is clickOps |
| **Security-first, least privilege** | OIDC replaces static credentials; KMS encrypts secrets; IRSA scopes IAM to pods |
| **Immutable delivery** | Container images are versioned; S3 deployments use `--delete` for idempotency |
| **Environment parity** | Local/staging/production environments share the same manifests, differing only in `tfvars`/kustomize overlays |
| **Progressive delivery** | Wave-based sync ordering and staggered deployment workflows prevent blast-radius across tiers |

### Subsystem Map

```
devops-engineer-profile/
├── src/          ← Portfolio Website  (HTML/CSS/JS – static site)
├── inf/          ← Infrastructure as Code  (Terraform + CloudFormation)
├── gitops/       ← GitOps Platform  (ArgoCD + Helm + Kustomize on EKS)
├── ops/          ← Operations Scripts  (Python + shell automation)
├── plan/         ← Feature planning documents
└── .github/      ← CI/CD Pipelines  (GitHub Actions) + Copilot configuration
```

---

## 2. Architecture Visualization

### High-Level System Diagram (C4 Context)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Repository                                   │
│   (Single source of truth for code, infrastructure, and desired cluster state)   │
│                                                                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│   │   src/        │  │   inf/        │  │   gitops/     │  │   ops/        │       │
│   │ Portfolio     │  │ Terraform +   │  │ ArgoCD Apps   │  │ Python/Shell  │       │
│   │ Website       │  │ CloudFormation│  │ Helm Charts   │  │ Automation    │       │
│   └──────┬───────┘  └──────┬────────┘  └──────┬────────┘  └──────────────┘       │
└──────────┼────────────────┼────────────────────┼──────────────────────────────────┘
           │                │                    │
           │  push:main     │  PR → tf plan      │  reconcile loop
           ▼                ▼                    ▼
┌──────────────────┐  ┌────────────────┐  ┌─────────────────────────────────────────┐
│  GitHub Actions  │  │ GitHub Actions  │  │         AWS EKS Cluster                 │
│  aws-s3-web-     │  │ terraform-      │  │                                         │
│  sync-prod.yml   │  │ plan/apply/     │  │  ┌─────────────┐                        │
│                  │  │ validation.yml  │  │  │   ArgoCD     │◄── git pull (gitops/)  │
│  uses OIDC →     │  │                 │  │  │  GitOps Ctrl │                        │
│  AWS IAM Role    │  │  uses OIDC →    │  │  └──────┬──────┘                        │
└──────────┬───────┘  │  AWS IAM Role   │  │         │ deploys                       │
           │          └────────┬────────┘  │  ┌──────▼───────────────────────────┐  │
           ▼                   │           │  │  Infrastructure Plane (waves -1…1) │  │
┌──────────────────┐           ▼           │  │  kube-prometheus-stack             │  │
│   AWS S3 Bucket  │  ┌────────────────┐  │  │  ECK Operator + Elasticsearch      │  │
│  (Static Website)│  │  AWS Resources  │  │  │  Fluent Bit DaemonSet              │  │
│  CloudFront CDN  │  │  EKS, VPC, IAM  │  │  └────────────────────────────────────┘  │
│  (Resume PDF)    │  │  KMS, S3, OAC   │  │  ┌──────▼───────────────────────────┐  │
└──────────────────┘  └────────────────┘  │  │  Application Plane  (waves 2–5)    │  │
                                           │  │  Jenkins: basic / advanced / premium│  │
                                           │  └────────────────────────────────────┘  │
                                           └─────────────────────────────────────────┘
```

### CI/CD Pipeline Flow

```
Developer → git push → GitHub
                          │
            ┌─────────────┴──────────────────┐
            │                                │
     feature/* branch                     main branch
            │                                │
   aws-s3-web-sync-staging.yml      aws-s3-web-sync-prod.yml
   (OIDC → s3-nghuy-link)           (OIDC → s3.nghuy.link)
            │                                │
     Pull Request ──────────────────────────►│
            │                                │
   terraform-validation.yml         terraform-apply.yml
   terraform-plan.yml               (requires PR merge)
   (matrix: all changed tf dirs)
```

### GitOps Sync Wave Ordering

```
Wave -1 │  ECK Operator (CRDs must exist before stack)
Wave  0 │  kube-prometheus-stack, ECK Stack (Elasticsearch + Kibana)
Wave  1 │  Fluent Bit DaemonSet, Jenkins pool-1 (shared)
Wave  2 │  Jenkins basic tenants
Wave  3 │  Jenkins advanced tenants
Wave  5 │  Jenkins premium tenants (manual sync safety gate)
```

---

## 3. Core Architectural Components

### 3.1 Portfolio Website (`src/aws-s3-web/`)

**Purpose:** Static personal portfolio served via AWS S3 (and optionally CloudFront).

**Internal Structure:**
- `index.html` — single-page portfolio with Bootstrap 5, AOS animations, Typed.js, Swiper, GLightbox
- `assets/css/main.css` — custom styles layered over Bootstrap
- `assets/js/main.js` — interactive behavior (scroll, typed text, lightbox, isotope grid)
- `assets/vendor/` — vendored third-party libraries (no build step required)
- `forms/contact.php` — PHP contact form stub (static hosting ignores this)

**Interaction Patterns:**
- Deployed to S3 via GitHub Actions `aws-s3-web-sync-prod.yml` / `aws-s3-web-sync-staging.yml`
- No backend; all interactivity is client-side JavaScript
- CloudFront (optional, configured in `inf/terraform/aws-cloudfront-s3-oac-resume/`) delivers PDF resume securely via OAC

---

### 3.2 Infrastructure as Code (`inf/`)

Four independent Terraform root modules, each self-contained:

| Module | Purpose | Key Resources |
|---|---|---|
| `aws-s3-web/` | Static website S3 bucket | S3, bucket policy, CORS, versioning, lifecycle |
| `aws-github-oidc/` | Passwordless CI/CD auth | AWS OIDC provider, IAM role + policy, GitHub Secrets/Variables |
| `aws-eks/` | Full EKS cluster | VPC (multi-AZ), EKS, node groups, add-ons, KMS, IRSA, Cluster Autoscaler, Metrics Server |
| `aws-cloudfront-s3-oac-resume/` | Secure PDF CDN | CloudFront OAC, private S3, signed URLs, Route53 alias |
| `aws-eks-argocd/` | ArgoCD IRSA | IAM role for ArgoCD service accounts to pull from ECR |

**CloudFormation (Legacy/Alternative):**
- `s3_static_web_deployment.yaml` — equivalent to `aws-s3-web/` Terraform
- `lambda_github_s3_sync_deployment.yaml` — Lambda-based GitHub-to-S3 sync (alternative to GitHub Actions)

---

### 3.3 GitOps Platform (`gitops/`)

A **multi-tenant SaaS GitOps platform** running on EKS, inspired by the AWS EKS SaaS GitOps Workshop.

**Structural Planes:**

```
gitops/
├── bootstrap/          ← ArgoCD installation + App-of-Apps root Applications
├── applicationsets/    ← Alternative git-file-generator discovery
├── helm-charts/        ← Wrapper Helm charts (lock upstream versions)
├── application-plane/  ← Per-environment desired state
│   ├── local/
│   ├── staging/
│   └── production/
│       ├── infrastructure/   ← Cluster-wide services
│       ├── pooled-envs/      ← Shared Jenkins pools (basic tier)
│       ├── tier-templates/   ← Copy-fill tenant blueprints
│       └── tenants/          ← Active tenant Applications
│           ├── basic/
│           ├── advanced/
│           └── premium/
└── control-plane/      ← Argo Workflows for lifecycle automation
    ├── rbac/
    └── workflows/
        ├── onboarding-workflow.yaml    ← 4-step tenant onboarding
        ├── offboarding-workflow.yaml   ← 4-step tenant offboarding
        └── deployment-workflow.yaml    ← Staggered 4-wave promotion
```

**Tenant Isolation Tiers:**

| Tier | Isolation | Resources | Storage | Environments |
|---|---|---|---|---|
| Basic | Shared namespace | Minimal | Pool PVC | All |
| Advanced | Dedicated namespace | 500m–2 CPU | 20Gi gp3 | Staging, Production |
| Premium | Dedicated namespace + HA | 2–8 CPU, 4–8Gi | 100Gi gp3 | Production only |

---

### 3.4 Operations Scripts (`ops/`)

| Script | Language | Purpose |
|---|---|---|
| `github_s3_sync.py` | Python | Downloads GitHub repo ZIP via API and syncs to S3 with hash-based change detection |
| `deploy_lambda.py` | Python | Deploys Python functions to AWS Lambda |
| `deploy_resume.sh` | Bash | Manual resume PDF upload script |
| `resume_upload.py` | Python | Programmatic resume S3 upload |
| `deploy-gitops-stacks-local.ps1` | PowerShell | Local cluster bootstrap for development |
| `requirements.txt` | — | `boto3>=1.26.0`, `requests>=2.28.0` |

---

### 3.5 CI/CD Pipelines (`.github/workflows/`)

| Workflow | Trigger | Purpose |
|---|---|---|
| `aws-s3-web-sync-prod.yml` | `push:main` on `src/aws-s3-web/**` | Sync portfolio to production S3 |
| `aws-s3-web-sync-staging.yml` | `push:feature/*` on `src/aws-s3-web/**` | Sync portfolio to staging S3 |
| `terraform-validation.yml` | PR + push | fmt, validate, tflint, security scan |
| `terraform-plan.yml` | PR on `inf/terraform/**` | Auto-matrix plan across all changed modules |
| `terraform-apply.yml` | PR merge to main | Apply Terraform after approval |

---

## 4. Architectural Layers and Dependencies

### Dependency Hierarchy

```
Layer 0: Security Foundation
  aws-github-oidc/  ─────────────────────────────────────────┐
  (OIDC provider + IAM role)                                  │
         │                                                    │
         ▼                                                    ▼
Layer 1: Compute/Network Infrastructure              Layer 1b: Static Web Infrastructure
  aws-eks/                                             aws-s3-web/
  (VPC, EKS, node groups, KMS, IRSA)                  (S3 bucket, website config)
         │                                                    │
         ▼                                                    ▼
Layer 2: Platform Services                           Layer 2b: CDN
  aws-eks-argocd/                                     aws-cloudfront-s3-oac-resume/
  (ArgoCD IRSA)                                        (CloudFront OAC, private S3)
         │
         ▼
Layer 3: GitOps Workloads (gitops/)
  bootstrap/ → application-plane/ → control-plane/
```

### Dependency Rules

- Terraform modules are **independent root modules** — no cross-module Terraform dependencies
- GitOps depends on EKS existing (`aws-eks/` applied first)
- ArgoCD IRSA (`aws-eks-argocd/`) depends on the EKS OIDC provider ARN from `aws-eks/` outputs
- GitHub Actions always authenticate through OIDC (`aws-github-oidc/` must be applied before any workflow runs)
- Sync wave ordering enforces Kubernetes-level ordering within the GitOps plane

---

## 5. Data Architecture

### State Management

| Artifact | Storage | Locking |
|---|---|---|
| Terraform state | S3 backend (configured, pending activation) | DynamoDB table |
| ArgoCD desired state | Git repository (`gitops/`) | Git branch protection |
| ArgoCD live state | Kubernetes etcd | Kubernetes API |
| EKS secrets | etcd with KMS envelope encryption (customer-managed key) | — |

### Data Flow: Portfolio Update

```
Developer commits src/aws-s3-web/
  → GitHub Actions (OIDC auth)
    → aws s3 sync --delete (idempotent, hash-based)
      → S3 Bucket (s3.nghuy.link)
        → End user browser
```

### Data Flow: Infrastructure Change

```
Developer opens PR with inf/terraform/**
  → terraform-validation (fmt, validate, tflint, security scan)
  → terraform-plan (matrix: per changed module × per environment)
    → Plan output posted as PR comment
PR merged to main
  → terraform-apply (OIDC auth, workspace per environment)
    → AWS resources updated
```

### Data Flow: Tenant Onboarding

```
Operator triggers Argo Workflow (tenant-onboarding)
  → Step 1: Validate (name, tier, env)
  → Step 2: Generate manifest from tier-template
  → Step 3: git commit to gitops/application-plane/{env}/tenants/{tier}/
  → Step 4: Wait for ArgoCD Application to reach Synced+Healthy
```

### Data Validation Patterns

- **Terraform variables**: typed declarations with `validation {}` blocks (e.g., environment must be `staging|production`; CIDR blocks validated to reject `0.0.0.0/0` and RFC-1918 ranges on public endpoint)
- **GitHub Actions**: `workflow_dispatch` inputs use `type: choice` with explicit `options` enum
- **Argo Workflows**: `enum` constraints on `tier` and `environment` parameters

---

## 6. Cross-Cutting Concerns

### Authentication & Authorization

**GitHub → AWS (OIDC):**
- AWS IAM OIDC identity provider registered for `token.actions.githubusercontent.com`
- IAM role `github-actions-s3-sync-role` trusted only for this repository's tokens
- Role scoped to `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on specific buckets
- Terraform validation workflow uses a separate OIDC role scoped to read-only plan operations

**Kubernetes (IRSA):**
- ArgoCD service accounts (server, application-controller, repo-server) use IRSA to assume an IAM role scoped to `AmazonEC2ContainerRegistryReadOnly`
- EBS CSI driver uses dedicated IRSA with `EBS_CSI_Policy`
- Cluster Autoscaler uses IRSA with auto-discovery policy

**Kubernetes RBAC:**
- Argo Workflows uses `gitops-workflow-sa` ServiceAccount with a dedicated ClusterRole (`workflow-rbac.yaml`)
- ArgoCD AppProjects (`infrastructure`, `applications`, `tenants`) restrict which namespaces each project can deploy to

**EKS Authentication:**
- `authentication_mode = "API_AND_CONFIG_MAP"` — supports both API-based and legacy ConfigMap access
- Cluster creator granted admin permissions automatically

### Secret Management

- **No secrets in Git** — enforced by `.gitignore`, git-credentials stored in Kubernetes Secrets (referenced via template `git-credentials-template.yaml`)
- **GitHub Actions secrets** — injected at runtime from repository/environment secrets
- **KMS envelope encryption** — all EKS Kubernetes Secrets encrypted at rest with a customer-managed KMS key
- **EBS volumes** — encrypted at rest via gp3 StorageClass with KMS

### Error Handling & Resilience

- **ArgoCD retry policies**: `limit: 5`, exponential backoff (5s base, factor 2, max 3m)
- **Terraform**: `continue-on-error: true` on init (graceful handling of lock issues)
- **GitHub Actions**: `PIPESTATUS[0]` checked for `aws s3 sync` exit codes; logs uploaded as artifacts on failure
- **Cluster Autoscaler**: scales nodes 0→N based on pending pod pressure
- **HPA**: Horizontal Pod Autoscaler enabled via Metrics Server deployment

### Logging & Monitoring

**Stack:**
```
Fluent Bit DaemonSet  →  Elasticsearch (3-node HA in production, 1-node local)
                                │
                          Kibana (UI)

kube-prometheus-stack:
  Prometheus  →  Grafana (dashboards, 30d retention in production)
  Alertmanager  (failure/degradation alerts on premium tier)
```

**Log Retention:**
- Production: 30-day Prometheus retention, 100Gi Elasticsearch
- Staging: 7-day Prometheus retention, 30Gi Elasticsearch
- Local: 3-day Prometheus retention, 5Gi Elasticsearch

**CloudWatch:** EKS control plane logs (`api`, `audit`, `authenticator`, `controllerManager`, `scheduler`) retained per `cloudwatch_log_retention_days` variable (default: 7 days).

### Configuration Management

- **Terraform**: `environments/{env}.tfvars` pattern per module; never committed with secrets
- **Helm**: wrapper chart `Chart.yaml` + `values.yaml` base defaults; environment overrides in Application manifests
- **ArgoCD**: `values-base.yaml` + `values-aws.yaml` / `values-local.yaml` overlay pattern
- **Kustomize**: `kustomization.yaml` aggregates Application manifests per tier per environment

### Pod Security

- **Pod Security Standards**: `Restricted` profile enforced via namespace labels on ArgoCD namespace
- All Helm charts configured with `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`

---

## 7. Service Communication Patterns

### External-Facing

| Endpoint | Protocol | Security |
|---|---|---|
| `nghuy.link` (portfolio) | HTTPS via S3 website | Public read (bucket policy) |
| Resume PDF CDN | HTTPS via CloudFront | OAC → private S3, min TLS 1.2 |
| EKS API server | HTTPS | Private endpoint + optional restricted public CIDR |

### Internal Kubernetes

| Communication | Pattern | Example |
|---|---|---|
| ArgoCD → Git | HTTPS pull (read-only) | Periodic reconcile + webhook push |
| ArgoCD → Kubernetes | Server-side apply | `kubectl apply --server-side` via ArgoCD |
| Fluent Bit → Elasticsearch | HTTP (cluster-internal) | DaemonSet → Service → StatefulSet |
| Prometheus → targets | HTTP scrape | ServiceMonitor CRDs |
| Argo Workflows → ArgoCD | `argocd app sync` CLI | Exec in workflow pod |

### Deployment Strategy

- **Basic/Advanced tenants**: Auto-sync with prune + self-heal
- **Premium tenants**: Manual sync (explicit approval required, `syncPolicy: automated` disabled)
- **Infrastructure**: Auto-sync with `Replace: true` for CRD-heavy components

---

## 8. Technology-Specific Patterns

### Terraform

**Module Structure (per root module):**
```
module/
├── main.tf        ← Resources, data sources, modules
├── variables.tf   ← Typed variables with validation + description
├── outputs.tf     ← Exported values
├── provider.tf    ← Provider and version constraints
├── locals.tf      ← Derived values and common tags
├── backend.tf     ← Remote state (S3 + DynamoDB)
└── environments/  ← {env}.tfvars (no secrets)
```

**Patterns observed:**
- `default_tags` in `provider "aws"` block for consistent tagging
- `count` for optional single resources (e.g., `count = var.enable_ebs_csi_driver ? 1 : 0`)
- `for_each` with maps for node groups
- `checkov:skip` inline with justification comments for intentional security exceptions
- `tfsec:ignore` for false positives with explanatory comments
- `lifecycle { ignore_changes = [tags_all] }` to prevent tag drift from AWS-managed tags

**Linting (`.tflint.hcl`):**
- `aws` plugin v0.30.0 with `aws_resource_missing_tags` enforcing `Environment`, `Project`, `ManagedBy`
- `terraform` plugin v0.5.0 with `recommended` preset
- `snake_case` enforced on all names; documented variables/outputs required; typed variables required

### GitHub Actions

**Security patterns:**
- `permissions: id-token: write` scoped to workflows needing OIDC
- `permissions: contents: read` as default; `pull-requests: write` only where PR comments are posted
- `concurrency` group prevents parallel terraform plans for the same environment
- `actions/cache@v5` with `hashFiles(*.lock.hcl)` key for Terraform provider caching
- `fetch-depth: 1` on all checkouts
- `retention-days: 30` on uploaded artifacts

**Matrix strategy (terraform-plan.yml):**
- `setup` job auto-discovers changed Terraform directories and available `.tfvars` environments
- Matrix dynamically built from discovered directories × environments
- `fail-fast: false` allows all matrix jobs to complete even if one fails

### Kubernetes / GitOps

**ArgoCD patterns:**
- App-of-Apps (directory mode) for environment bootstrapping
- ApplicationSet (git file generator) as complementary discovery mechanism
- `argocd.argoproj.io/sync-wave` annotations for ordered deployments
- `ServerSideApply=true` to avoid field ownership conflicts on CRD-heavy stacks
- `ignoreDifferences` for operator-managed fields (e.g., `Prometheus.spec.replicas`)

**Helm wrapper chart pattern:**
```yaml
# Chart.yaml
dependencies:
  - name: jenkins
    version: "5.8.139"
    repository: "https://charts.jenkins.io"
```
- Pins upstream chart version explicitly
- `values.yaml` contains security-hardened base configuration
- Per-tenant overrides passed inline in the ArgoCD Application `helm.values` field

---

## 9. Implementation Patterns

### Adding a New Terraform Module

1. Create `inf/terraform/{module-name}/` directory
2. Include: `main.tf`, `variables.tf`, `outputs.tf`, `provider.tf`, `locals.tf`
3. Add `environments/{env}.tfvars` — never commit secrets
4. Add optional `backend.tf` for remote state (follow the `aws-eks/backend.tf` pattern)
5. Add `.tflint.hcl` in the module directory if it needs local overrides
6. `terraform-plan.yml` auto-discovers it via `find inf/terraform -mindepth 1 -maxdepth 1 -type d`

### Adding a New Tenant

```bash
# 1. Copy the appropriate tier template
cp gitops/application-plane/production/tier-templates/advanced_tenant_template.yaml \
   gitops/application-plane/production/tenants/advanced/acme-corp.yaml

# 2. Fill in TENANT_NAME placeholder
sed -i 's/TENANT_NAME/acme-corp/g' \
   gitops/application-plane/production/tenants/advanced/acme-corp.yaml

# 3. Add to kustomization
echo "  - acme-corp.yaml" >> \
   gitops/application-plane/production/tenants/advanced/kustomization.yaml

# 4. Commit → ArgoCD auto-syncs
git add . && git commit -m "feat: onboard acme-corp as advanced tenant"
git push
```

Or use the automated Argo Workflow:
```bash
argo submit -n argo-workflows --from workflowtemplate/tenant-onboarding \
  -p tenant-name=acme-corp \
  -p tier=advanced \
  -p environment=production \
  --serviceaccount gitops-workflow-sa
```

### Adding a New Infrastructure Service to GitOps

1. Add a Helm wrapper chart under `gitops/helm-charts/{service}/`
2. Create an Application YAML in `gitops/application-plane/{env}/infrastructure/{service}.yaml`
3. Set appropriate `argocd.argoproj.io/sync-wave` annotation
4. Add to `gitops/application-plane/{env}/infrastructure/kustomization.yaml`
5. ArgoCD's `app-of-apps-infrastructure.yaml` auto-discovers it

---

## 10. Testing Architecture

### Infrastructure Testing

| Layer | Tool | Trigger |
|---|---|---|
| Terraform syntax | `terraform validate` | PR (terraform-validation.yml) |
| Terraform formatting | `terraform fmt -check` | PR (terraform-validation.yml) |
| Terraform linting | `tflint` with AWS + Terraform plugins | PR |
| Security scanning | `tfsec` / `checkov` (configured inline) | PR |
| Dry-run planning | `terraform plan -var-file=env.tfvars` | PR (terraform-plan.yml) |
| Plan comment | Posted to PR by GitHub Actions | PR |

### GitOps Validation

| Layer | Tool | Trigger |
|---|---|---|
| Kubernetes schema | `kubeconform` (recommended, not yet wired) | Manual |
| ArgoCD dry-run | `argocd app diff` | Manual |
| Kustomize build | `kubectl kustomize` | Manual |

### Application Testing

- No automated test suite for the static website
- Browser validation is manual
- S3 sync logs uploaded as workflow artifacts for audit

---

## 11. Deployment Architecture

### Environments

| Environment | Website S3 | EKS | Cluster Autoscaler | NAT Gateway |
|---|---|---|---|---|
| Local | — | minikube/kind | — | — |
| Staging | `s3-nghuy-link` | EKS (single NAT) | Enabled | 1 gateway |
| Production | `s3.nghuy.link` | EKS (per-AZ NAT) | Enabled | 1 per AZ |

### Deployment Triggers

```
Source Change               Trigger                   Deployment
──────────────────────────────────────────────────────────────────
src/aws-s3-web/** + push:main     → GitHub Actions → S3 prod sync
src/aws-s3-web/** + push:feature/* → GitHub Actions → S3 staging sync
inf/terraform/**  + PR              → TF plan (no deploy)
inf/terraform/**  + PR merge        → TF apply (deploy)
gitops/**         + git push        → ArgoCD reconcile (auto-sync enabled)
```

### Containerization

- No custom Dockerfiles in this repository
- Jenkins, Prometheus, Elasticsearch, Kibana, Fluent Bit are all deployed as upstream Helm charts
- ECR is available for tenant workloads (ArgoCD IRSA grants read access)

### Cloud Infrastructure (AWS ap-southeast-1)

```
VPC (10.0.0.0/16)
├── Public Subnets  (tagged kubernetes.io/role/elb)
│   └── NAT Gateway(s) → Internet
├── Private Subnets (tagged kubernetes.io/role/internal-elb)
│   └── EKS Node Groups
│       ├── addon: coredns, kube-proxy, vpc-cni, aws-ebs-csi-driver
│       ├── cluster-autoscaler (IRSA)
│       ├── metrics-server
│       └── ArgoCD → gitops workloads
└── CloudWatch Log Group (control plane logs, 7d default retention)

S3 Buckets
├── s3.nghuy.link      (public static website, production)
├── s3-nghuy-link      (staging static website)
└── resume bucket      (private, CloudFront OAC access only)

CloudFront Distribution
└── OAC → private S3 resume bucket (TLSv1.2+, redirect-to-https)
```

---

## 12. Extension and Evolution Patterns

### Feature Addition Patterns

**New AWS infrastructure:**
- Add a new Terraform root module under `inf/terraform/`
- Follow the 5-file standard structure
- Workflow auto-discovers it; no workflow changes needed

**New GitOps application:**
- Create a Helm wrapper chart if upstream chart needs customization
- Add an Application YAML to the appropriate `application-plane/{env}/` directory
- Register in `kustomization.yaml`

**New tenant tier:**
- Create tier templates in `tier-templates/`
- Create `tenants/{new-tier}/kustomization.yaml`
- Update `tenants/kustomization.yaml` to include new tier directory
- Update `jenkins-appset.yaml` generators to watch new tier directories

**New CI/CD workflow:**
- Add `.github/workflows/{name}.yml`
- Use `permissions: id-token: write` + `aws-actions/configure-aws-credentials` for AWS access
- Use `concurrency` group to prevent parallel runs

### Modification Patterns

- **Kubernetes version bump**: update `cluster_version` variable default in `aws-eks/variables.tf`
- **Helm chart version bump**: update `version:` in wrapper `Chart.yaml`
- **Environment-specific overrides**: modify `environments/{env}.tfvars` or ArgoCD Application `helm.values`
- **Add a new Terraform variable**: add to `variables.tf` with type + description + validation, then reference in `.tfvars` files

### Integration Patterns

**New external service integration:**
1. Add Terraform resources to an existing or new module (IAM, service endpoints)
2. Create Kubernetes secrets via sealed secrets or External Secrets Operator
3. Reference secrets in Helm values via Application manifest
4. Add monitoring via ServiceMonitor CRD for Prometheus scraping

---

## 13. Architectural Pattern Examples

### Pattern: OIDC-Based AWS Authentication

```yaml
# .github/workflows/aws-s3-web-sync-prod.yml
permissions:
  id-token: write  # Required for OIDC

steps:
  - name: Configure AWS Credentials
    uses: aws-actions/configure-aws-credentials@main
    with:
      role-to-assume: arn:aws:iam::010382427026:role/github-actions-s3-sync-role
      aws-region: ap-southeast-1
```

```hcl
# inf/terraform/aws-github-oidc/main.tf
resource "aws_iam_role" "github_actions_oidc" {
  assume_role_policy = jsonencode({
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.github_oidc_provider_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = "repo:${var.github_owner}/${var.github_repository}:*" }
      }
    }]
  })
}
```

### Pattern: Terraform Variable Validation

```hcl
# inf/terraform/aws-eks/variables.tf
variable "cluster_endpoint_public_access_cidrs" {
  type = list(string)

  validation {
    condition = alltrue([
      for cidr in var.cluster_endpoint_public_access_cidrs :
      cidr != "0.0.0.0/0" && cidr != "::/0"
    ])
    error_message = "Must not contain '0.0.0.0/0' — restrict to your organisation's IP ranges."
  }
}
```

### Pattern: App-of-Apps Bootstrap

```yaml
# gitops/bootstrap/app-of-apps-infrastructure.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-of-apps-infrastructure
  namespace: argocd
spec:
  source:
    path: gitops/application-plane/production/infrastructure  # Watches this directory
    directory:
      recurse: false
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Pattern: Sync Wave Dependency Ordering

```yaml
# gitops/application-plane/production/infrastructure/eck-operator.yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"  # Must deploy before eck-stack

# gitops/application-plane/production/infrastructure/eck-stack.yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"  # Depends on ECK CRDs from wave -1
```

### Pattern: Conditional Resource Creation (Terraform)

```hcl
# Optional: only create KMS key if secret encryption is enabled
resource "aws_kms_key" "eks_secrets" {
  count = var.enable_secret_encryption ? 1 : 0
  # ...
}

module "ebs_csi_irsa" {
  count = var.enable_ebs_csi_driver ? 1 : 0
  # ...
}
```

### Pattern: Dynamic Terraform Plan Matrix

```yaml
# .github/workflows/terraform-plan.yml
- name: Set up planning matrix
  run: |
    # Auto-discover all Terraform project directories
    while IFS= read -r dir; do
      project_name="$(basename "$dir")"
      TERRAFORM_DIRS+=("$project_name")
    done < <(find inf/terraform -mindepth 1 -maxdepth 1 -type d | sort -u)

    # Build matrix: changed_dir × available_envs
    for dir in "${TERRAFORM_DIRS[@]}"; do
      if echo "$CHANGED_FILES" | grep -q "^inf/terraform/$dir/"; then
        for tfvars in inf/terraform/$dir/environments/*.tfvars; do
          env_name=$(basename "$tfvars" .tfvars)
          MATRIX=$(echo $MATRIX | jq -c --arg dir "$dir" --arg env "$env_name" \
            '. + [{"environment":$env,"directory":$dir}]')
        done
      fi
    done
```

---

## 14. Architectural Decision Records

### ADR-001: GitOps over Push-Based Deployment

**Context:** Needed a deployment model for multi-tenant workloads on EKS that scales without tight CI/CD coupling.

**Decision:** ArgoCD pull-based GitOps. Git is the single source of truth; ArgoCD continuously reconciles desired vs. live state.

**Consequences:**
- ✅ Automatic drift detection and self-healing
- ✅ Full audit trail via Git history
- ✅ Decoupled CI (builds) from CD (deployments)
- ❌ Adds ArgoCD as a required platform component
- ❌ Slightly slower initial change propagation vs. direct `kubectl apply`

---

### ADR-002: OIDC over Static AWS Credentials

**Context:** GitHub Actions needed AWS access. Storing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub Secrets is a security liability.

**Decision:** AWS IAM OIDC federation. GitHub Actions exchanges a short-lived JWT for temporary AWS credentials.

**Consequences:**
- ✅ No long-lived credentials stored anywhere
- ✅ Credentials expire with the workflow run
- ✅ Scoped per-repository via OIDC `sub` claim conditions
- ❌ Requires one-time Terraform apply of `aws-github-oidc/` module

---

### ADR-003: Three-Tier Tenant Model (Basic/Advanced/Premium)

**Context:** A SaaS platform must balance resource sharing (cost) against isolation (security/noisy-neighbor).

**Decision:** Three tiers — pooled namespace (basic), dedicated controller (advanced), full silo (premium) — with templates for each.

**Consequences:**
- ✅ Progressive isolation matched to tenant criticality
- ✅ Clear upgrade path between tiers
- ✅ Cost optimization by pooling non-critical tenants
- ❌ Operational complexity of managing three tier configurations
- ❌ Premium tier requires manual sync approval, slowing deployments

---

### ADR-004: Wrapper Helm Charts for Upstream Dependencies

**Context:** Deploying upstream Helm charts directly makes version management difficult across environments.

**Decision:** Wrapper charts in `gitops/helm-charts/` that pin upstream versions and set secure defaults in `values.yaml`.

**Consequences:**
- ✅ Single place to pin upstream chart version
- ✅ Security defaults (PSS, non-root) applied once, inherited everywhere
- ✅ ArgoCD path stays stable; only `Chart.yaml` version changes trigger upgrades
- ❌ Requires maintaining wrapper chart `Chart.yaml` when upgrading upstream

---

### ADR-005: Monorepo Structure

**Context:** Related DevOps components could be split into separate repositories.

**Decision:** Single monorepo containing `src/`, `inf/`, `gitops/`, `ops/`, and `.github/`.

**Consequences:**
- ✅ Atomic commits across infrastructure + application code
- ✅ Unified CI/CD with path-based workflow triggers
- ✅ Simpler cross-component refactoring
- ❌ `terraform-plan.yml` must discover changed modules dynamically
- ❌ Copilot instructions cover multiple technology domains

---

### ADR-006: KMS Envelope Encryption for EKS Secrets

**Context:** Kubernetes Secrets are base64-encoded in etcd by default — not encrypted.

**Decision:** Customer-managed KMS key with `enable_key_rotation = true` for envelope encryption of all EKS Secrets.

**Consequences:**
- ✅ Secrets encrypted at rest with customer-controlled key
- ✅ Full key rotation and audit trail in CloudTrail
- ✅ Key deletion window (7 days) prevents accidental loss
- ❌ KMS API calls add slight latency to Secret operations

---

## 15. Architecture Governance

### Automated Compliance

| Check | Tool | Enforcement |
|---|---|---|
| Terraform formatting | `terraform fmt -check` | CI blocks PR merge |
| Terraform linting | `tflint` (aws + terraform plugins) | CI |
| Required tags | `tflint` `aws_resource_missing_tags` | CI |
| Security misconfigurations | `tfsec` / `checkov` | CI |
| Variable documentation | `tflint` `terraform_documented_variables` | CI |
| Typed variables | `tflint` `terraform_typed_variables` | CI |
| Standard module structure | `tflint` `terraform_standard_module_structure` | CI |
| Kubernetes schema validation | `kubeconform` (recommended addition) | — |
| Pod Security Standards | Namespace admission controller | Runtime |

### Copilot Instructions (`.github/instructions/`)

Domain-specific coding instructions enforced via GitHub Copilot:
- `terraform-sap-btp.instructions.md` — Terraform conventions
- `kubernetes-manifests.instructions.md` — K8s manifest standards
- `github-actions-ci-cd-best-practices.instructions.md` — CI/CD patterns
- `devops-core-principles.instructions.md` — CALMS + DORA framing
- `containerization-docker-best-practices.instructions.md` — Docker standards
- `ansible.instructions.md` — Ansible conventions
- `python.instructions.md` — Python coding standards
- `markdown.instructions.md` — Documentation formatting

### Branch Protection (Implied)

- Terraform apply only runs after PR merge to `main`
- Staging workflows trigger on `feature/*` branches
- Production workflows trigger on `main`
- GitOps manifest changes are protected by ArgoCD's reconcile loop (unintended deletions trigger alerts)

---

## 16. Blueprint for New Development

### Development Workflow by Feature Type

#### A. Static Website Change (`src/aws-s3-web/`)

```
1. Create feature branch: git checkout -b feature/my-change
2. Edit HTML/CSS/JS in src/aws-s3-web/
3. Push → aws-s3-web-sync-staging.yml auto-deploys to s3-nghuy-link
4. Preview at staging URL
5. Open PR → staging still live for review
6. Merge PR → aws-s3-web-sync-prod.yml deploys to s3.nghuy.link
```

#### B. Infrastructure Change (`inf/terraform/`)

```
1. Create feature branch
2. Edit Terraform in inf/terraform/{module}/
3. Add/update environments/{env}.tfvars if needed
4. Push → CI runs validation + plan (auto-matrix per changed module)
5. Review plan output in PR comment
6. Merge → terraform-apply.yml applies changes
```

#### C. New GitOps Tenant

```
1. Choose tier (basic/advanced/premium) based on requirements
2. Copy tier template from application-plane/{env}/tier-templates/
3. Fill TENANT_NAME placeholder
4. Add to kustomization.yaml
5. Commit → ArgoCD auto-syncs (basic/advanced) or waits for manual sync (premium)
```

#### D. New GitOps Infrastructure Component

```
1. Create Helm wrapper chart in gitops/helm-charts/{service}/
2. Create Application YAML in application-plane/{env}/infrastructure/{service}.yaml
3. Set sync-wave annotation appropriate to dependencies
4. Add to kustomization.yaml
5. Commit → ArgoCD auto-discovers and deploys
```

### Implementation Templates

#### New Terraform Variable (Standard)

```hcl
variable "my_feature_enabled" {
  description = "Enable my feature. Set to false to skip creation."
  type        = bool
  default     = true
}
```

#### New ArgoCD Application (Infrastructure)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-service-production
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "1"
  labels:
    environment: production
    app.kubernetes.io/part-of: gitops-platform
spec:
  project: infrastructure
  source:
    repoURL: https://github.com/HuyNguyen260398/devops-engineer-profile.git
    targetRevision: main
    path: gitops/helm-charts/my-service
    helm:
      releaseName: my-service
      values: |
        replicaCount: 1
  destination:
    server: https://kubernetes.default.svc
    namespace: my-service
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

#### New GitHub Actions Workflow (AWS-integrated)

```yaml
name: My New Workflow

on:
  push:
    branches: [main]
    paths: ["my-path/**"]

permissions:
  id-token: write
  contents: read

concurrency:
  group: my-workflow-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@main
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: ap-southeast-1

      - name: Deploy
        run: |
          # Your deployment commands here
```

### Common Pitfalls

| Pitfall | Prevention |
|---|---|
| Committing `.tfstate` files | `.gitignore` includes `*.tfstate*`; use remote backend |
| Using `0.0.0.0/0` in EKS public endpoint CIDRs | Variable validation blocks it at `terraform plan` |
| Forgetting sync-wave on new infra components | ECK stack will fail to deploy if CRDs aren't ready |
| Applying both ApplicationSet and App-of-Apps for same Apps | Choose one per set of Application names; docs warn of conflict |
| Deploying premium tier tenants without manual approval | `syncPolicy.automated` is intentionally absent on premium tier |
| Missing `Environment`, `Project`, `ManagedBy` tags | `tflint` enforces these; CI will fail |
| Hardcoding AWS account IDs | Use `data.aws_caller_identity.current.account_id` |
| Skipping `checkov` suppressions justification | All skips have inline comments explaining the exception |

---

> **Maintenance Note:** This blueprint was generated from the repository state as of 2026-03-21.
> Update this document when:
> - New Terraform modules are added to `inf/terraform/`
> - New tenant tiers are introduced in `gitops/`
> - GitHub Actions workflow trigger patterns change
> - New security mechanisms (e.g., Sealed Secrets, External Secrets Operator) are adopted
> - The Kubernetes version or major Helm chart versions are upgraded
