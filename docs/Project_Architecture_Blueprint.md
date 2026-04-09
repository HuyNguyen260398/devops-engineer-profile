# Project Architecture Blueprint

> **Generated:** 2026-04-09 | **Repository:** `devops-engineer-profile`
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

This repository is a **multi-layer DevOps showcase platform** built as a production-grade portfolio. It is not a single application but four cohesive subsystems demonstrating cloud infrastructure, GitOps, CI/CD automation, and observability on AWS EKS.

### Guiding Principles

| Principle | Expression in the Codebase |
|---|---|
| **GitOps as single source of truth** | All desired cluster state lives in Git (`gitops/`); ArgoCD reconciles continuously |
| **Infrastructure as Code everywhere** | Terraform manages all AWS resources; nothing is created via ClickOps |
| **Security-first, least privilege** | GitHub OIDC replaces static credentials; IRSA scopes IAM to individual pods; Pod Security Standards enforced |
| **Immutable delivery** | Container images are versioned; S3 deployments use `--delete` for idempotency |
| **Environment parity** | Local/staging/production share the same manifests, differing only in `tfvars` and kustomize overlays |
| **Progressive delivery** | ArgoCD sync waves prevent blast-radius across infrastructure layers and tenant tiers |
| **Observability by default** | Prometheus, Grafana, ELK Stack, and CloudWatch are platform-level concerns, not per-app afterthoughts |

### Subsystem Map

```
devops-engineer-profile/
├── src/        ← Portfolio Website  (HTML/CSS/JS — static site on S3/CloudFront)
├── inf/        ← Infrastructure as Code  (Terraform, 5 independent root modules)
├── gitops/     ← GitOps Platform  (ArgoCD App-of-Apps on EKS)
├── ops/        ← Operational Automation  (Python lifecycle scripts)
└── .github/    ← CI/CD Pipelines  (GitHub Actions workflows + Copilot instructions)
```

### Technology Stack Summary

| Layer | Technology |
|---|---|
| Cloud Provider | AWS (EKS, S3, CloudFront, IAM, CloudWatch) |
| IaC | Terraform HCL with TFLint enforcement |
| Container Orchestration | Kubernetes (EKS managed, k3s/kind for local) |
| GitOps Engine | ArgoCD (App-of-Apps pattern) |
| Package Manager | Helm + Kustomize overlays |
| CI/CD | GitHub Actions with OIDC authentication |
| Monitoring | kube-prometheus-stack (Prometheus, Grafana, Alertmanager, node-exporter) |
| Logging | ECK (Elasticsearch, Kibana) + Fluent Bit |
| Automation | AWX (Ansible Automation Platform) |
| Scripting | Python 3 (boto3, requests, rich) |
| Static Hosting | S3 + CloudFront with OAC |

---

## 2. Architecture Visualization

### C4 Level 1 — System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DevOps Platform Ecosystem                      │
│                                                                     │
│  ┌───────────┐     Git push      ┌──────────────────────────────┐  │
│  │ Developer │ ──────────────→  │    GitHub Repository          │  │
│  └───────────┘                  │  (Source of Truth)            │  │
│        │                        └──────────────┬───────────────┘  │
│        │ terraform apply                        │ webhook / poll   │
│        ↓                                        ↓                  │
│  ┌─────────────┐              ┌─────────────────────────────────┐  │
│  │  Terraform  │ provisions → │       AWS EKS Cluster          │  │
│  │  (inf/)     │              │  ┌──────────────────────────┐   │  │
│  └─────────────┘              │  │  ArgoCD (GitOps Engine)  │   │  │
│                               │  │  ┌────────┐ ┌─────────┐ │   │  │
│  ┌──────────────┐             │  │  │Monitor │ │Logging  │ │   │  │
│  │ GitHub       │ ─ OIDC ──→ │  │  │ing     │ │ELK+     │ │   │  │
│  │ Actions      │             │  │  │Prometh │ │FluentBit│ │   │  │
│  │ (CI/CD)      │             │  │  │us+Graf │ └─────────┘ │   │  │
│  └──────────────┘             │  │  └────────┘             │   │  │
│                               │  │  ┌────────┐ ┌─────────┐ │   │  │
│  ┌──────────────┐             │  │  │AWX     │ │Jenkins  │ │   │  │
│  │ ops/         │ ─ kubectl → │  │  │Ansible │ │Tenants  │ │   │  │
│  │ Python CLI   │             │  │  └────────┘ └─────────┘ │   │  │
│  └──────────────┘             │  └──────────────────────────┘   │  │
│                               └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### C4 Level 2 — GitOps Platform Internals

```
gitops/
│
├── bootstrap/                        ← Layer 0: ArgoCD self-install
│   ├── app-of-apps.yaml              ArgoCD root Application
│   ├── app-of-apps-infrastructure.yaml
│   └── projects/                     AppProjects (RBAC boundaries)
│       ├── infrastructure.yaml       → controls infra namespaces
│       ├── applications.yaml         → controls tenant namespaces
│       └── tenants.yaml
│
├── control-plane/                    ← Layer 1: Cluster operations
│   ├── rbac/                         Git credentials, workflow RBAC
│   └── workflows/                    Argo Workflows: onboard/offboard/deploy
│
├── application-plane/                ← Layer 2: Deployed applications
│   ├── local/                        Environment overlay
│   │   ├── infrastructure/           Sync wave -1 to 0 (operators first)
│   │   ├── pooled-envs/              Shared namespace pools
│   │   └── tenants/                  Tier-stratified tenant apps
│   ├── staging/                      (same structure as local)
│   └── production/                   (same structure, more tiers)
│
├── applicationsets/                  ← Dynamic application generation
│   ├── jenkins-appset.yaml           Auto-discovers Jenkins configs by tier
│   └── kube-prometheus-stack-appset.yaml
│
└── helm-charts/                      ← Helm values overrides
    ├── kube-prometheus-stack/
    ├── eck-operator/
    ├── eck-stack/
    ├── fluent-bit/
    ├── jenkins/
    └── awx-operator/
```

### Sync Wave Dependency Graph

```
Wave -1   ┌──────────────────┐
          │  ECK Operator    │  (CRD prerequisites for Elasticsearch)
          └────────┬─────────┘
                   │
Wave  0   ┌────────┴───────────────────────────────────┐
          │  kube-prometheus-stack  │  eck-stack        │
          │  (Prometheus, Grafana,  │  (ES, Kibana)     │
          │   Alertmanager)         │                   │
          └────────────────────────┴──────────┬────────┘
                                              │
Wave  1   ┌───────────────────────────────────┴──────┐
          │  fluent-bit   │  awx-operator  │ jenkins  │
          └───────────────┴────────────────┴──────────┘
                                              │
Wave 2-6  ┌───────────────────────────────────┴──────┐
          │  Tenant Applications (by tier/namespace)  │
          └───────────────────────────────────────────┘
```

### Multi-Tenant Tier Architecture

```
┌────────────────────────────────────────────────────────┐
│                    EKS Cluster                         │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Infrastructure Plane (argocd, monitoring, etc.) │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ pool-1 (Basic Tier) — SHARED                     │ │
│  │  → Jenkins controller + shared workloads         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │ tenant-A     │ │ tenant-B     │ │ tenant-C      │  │
│  │ (Advanced)   │ │ (Advanced)   │ │ (Premium)     │  │
│  │ Dedicated    │ │ Dedicated    │ │ Full silo     │  │
│  │ controller   │ │ controller   │ │ + isolation   │  │
│  └──────────────┘ └──────────────┘ └───────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Components

### 3.1 GitOps Platform (`gitops/`)

**Purpose:** Declarative continuous delivery for all Kubernetes workloads using the App-of-Apps pattern.

| Sub-component | Responsibility |
|---|---|
| `bootstrap/` | Installs ArgoCD, creates AppProjects and the root Applications that own everything else |
| `control-plane/` | RBAC, Argo Workflows for tenant lifecycle operations |
| `application-plane/` | Organized environment/tier manifests consumed by ArgoCD |
| `applicationsets/` | Dynamic generation of Applications from Git directory structure |
| `helm-charts/` | Centralized Helm `values.yaml` overrides for all deployed charts |

**Key interactions:**
- ArgoCD polls Git; any merged change automatically reconciles cluster state
- AppProjects enforce namespace and resource-type scoping per project class
- Kustomize overlays compose base manifests with environment-specific patches

### 3.2 Infrastructure as Code (`inf/terraform/`)

Five independent Terraform root modules, each with isolated state:

| Module | Purpose |
|---|---|
| `aws-eks/` | EKS cluster, VPC, node groups, ArgoCD bootstrap, monitoring |
| `aws-eks-argocd/` | IRSA roles for ArgoCD pods to access AWS services (ECR read) |
| `aws-s3-web/` | S3 static website bucket (portfolio site) |
| `aws-github-oidc/` | OIDC provider + IAM role for keyless GitHub Actions auth |
| `aws-cloudfront-s3-oac-resume/` | CloudFront distribution with Origin Access Control for resume delivery |

**State isolation design:** Each module manages its own `terraform.tfstate`. Cross-module references use `terraform_remote_state` data sources or explicit variable passing, preventing blast-radius on plan/apply.

### 3.3 CI/CD Automation (`.github/workflows/`)

| Workflow | Trigger | Role |
|---|---|---|
| `terraform-plan.yml` | PR touching `inf/terraform/**` | Auto-discovers changed projects, fans out matrix plan, comments results on PR |
| `terraform-apply.yml` | Merge to `main` | Applies approved plans per environment |
| `terraform-validation.yml` | Every push | Syntax validation gate |
| `aws-s3-web-sync-staging.yml` | Push to main | Syncs `src/` to staging S3 bucket |
| `aws-s3-web-sync-prod.yml` | Push to main | Syncs `src/` to production S3 bucket |

All workflows authenticate to AWS via **GitHub OIDC** — no long-lived secrets stored in GitHub.

### 3.4 Operational Automation (`ops/`)

| Script | Role |
|---|---|
| `deploy_gitops_stacks_local.py` | Full GitOps platform lifecycle on local clusters (minikube/kind/k3s) — interactive menu or `--action deploy|status|cleanup` |
| `deploy-gitops-stacks-local.ps1` | PowerShell equivalent for Windows environments |
| `github_s3_sync.py` | Synchronizes GitHub repo content to S3 with MIME detection and integrity checks |
| `deploy_lambda.py` | Lambda function packaging and deployment |
| `resume_upload.py` | Resume PDF upload to S3 |

### 3.5 Portfolio Website (`src/`)

Static site hosted on S3 with optional CloudFront CDN. No build step — raw HTML/CSS/JS deployed via `aws s3 sync`. Vendor libraries (Bootstrap, AOS, Swiper, Typed.js) bundled locally.

---

## 4. Architectural Layers and Dependencies

```
┌──────────────────────────────────────────────────────────┐
│  Layer 4: Application Plane (tenant workloads)           │
│           gitops/application-plane/*/tenants/            │
└──────────────────┬───────────────────────────────────────┘
                   │ depends on
┌──────────────────▼───────────────────────────────────────┐
│  Layer 3: Control Plane (infrastructure services)        │
│           monitoring, logging, awx, eck-operator          │
└──────────────────┬───────────────────────────────────────┘
                   │ depends on
┌──────────────────▼───────────────────────────────────────┐
│  Layer 2: GitOps Engine (ArgoCD)                         │
│           gitops/bootstrap/ + helm-charts/               │
└──────────────────┬───────────────────────────────────────┘
                   │ depends on
┌──────────────────▼───────────────────────────────────────┐
│  Layer 1: Kubernetes Cluster                             │
│           inf/terraform/aws-eks/                         │
└──────────────────┬───────────────────────────────────────┘
                   │ depends on
┌──────────────────▼───────────────────────────────────────┐
│  Layer 0: AWS Infrastructure (VPC, IAM, ECR, S3)         │
│           inf/terraform/aws-github-oidc/ + aws-s3-web/   │
└──────────────────────────────────────────────────────────┘
```

**Dependency rules:**
- Upper layers MUST NOT have circular references into lower layers
- Terraform modules reference each other only via `terraform_remote_state` data sources (explicit wiring)
- ArgoCD Applications reference Helm charts and Git paths; they do not call back into Terraform
- The `ops/` scripts are **day-2 operations tools** — they orchestrate layers but do not own state

---

## 5. Data Architecture

### State Storage

| State Type | Location | Notes |
|---|---|---|
| Terraform state | S3 backend (per module) | DynamoDB lock table; never committed to Git |
| Kubernetes desired state | Git (`gitops/`) | ArgoCD reconciles live state to this |
| Kubernetes live state | etcd (EKS managed) | ArgoCD continuously reads to detect drift |
| Application data | PersistentVolumes (EBS) | Jenkins workspace, Elasticsearch indices, AWX database |
| Secrets | Kubernetes Secrets / AWS Secrets Manager | Never in Git plaintext |

### Configuration Data Flow

```
.tfvars files         → Terraform apply → AWS resources + EKS cluster
gitops/helm-charts/   → ArgoCD Helm release → Deployed Helm chart instances
gitops/application-plane/ → ArgoCD Application → Kubernetes manifests applied
```

### Helm Values Inheritance

```
Chart Default values.yaml
    ↓ overridden by
gitops/helm-charts/<chart>/values.yaml  (base org-level overrides)
    ↓ overridden by
ArgoCD Application helm.values block    (environment/tier-level overrides)
```

### Tenant Data Boundaries

Each tenant tier operates in an isolated namespace:
- **Basic:** `pool-1` shared namespace — resource quotas enforced
- **Advanced:** Dedicated `tenant-{name}` namespace — dedicated controllers
- **Premium:** Full namespace silo with dedicated node selector labels and network policies

---

## 6. Cross-Cutting Concerns

### 6.1 Authentication and Authorization

| Concern | Implementation |
|---|---|
| CI/CD → AWS | GitHub OIDC (`aws-github-oidc` Terraform module) — temporary STS credentials per run |
| ArgoCD pods → AWS | IRSA (`aws-eks-argocd` module) — `eks.amazonaws.com/role-arn` annotation on service accounts |
| ArgoCD RBAC | AppProjects define allowed source repos, destination namespaces, and resource kinds |
| Kubernetes RBAC | `control-plane/rbac/workflow-rbac.yaml` for Argo Workflows service accounts |
| User → ArgoCD | ArgoCD local users or SSO (configurable in ArgoCD values) |

**Trust boundary model:**
```
GitHub Actions runner → assumes IAM role via OIDC (no static keys)
ArgoCD pod           → assumes IAM role via IRSA (no static keys)
kubectl users        → EKS auth via AWS IAM identity mapping
```

### 6.2 Secret Management

- Secrets are **never committed** to Git in plaintext
- Kubernetes Secrets referenced in ArgoCD Applications are created out-of-band or via `external-secrets-operator` (namespace reserved in AppProject)
- Git credentials for ArgoCD are mounted via `git-credentials-template.yaml` from a Kubernetes Secret
- Terraform sensitive outputs (e.g., kubeconfig, role ARNs) use `sensitive = true`

### 6.3 Logging

| Component | Destination |
|---|---|
| Kubernetes workloads | Fluent Bit → Elasticsearch (Kibana for query) |
| EKS control plane | CloudWatch Logs (API, audit, authenticator enabled in `aws-eks`) |
| VPC network | VPC Flow Logs → CloudWatch |
| GitHub Actions | GitHub Actions native log viewer |

Fluent Bit is deployed in Wave 1 (after Elasticsearch is ready in Wave 0) and configured via `gitops/helm-charts/fluent-bit/values.yaml`.

### 6.4 Monitoring and Alerting

```
kube-prometheus-stack (Wave 0):
  Prometheus      → scrapes all namespaces, stores metrics
  Alertmanager    → routes alerts (email/Slack/PagerDuty configurable)
  Grafana         → dashboards (kube-state-metrics, node-exporter)
  node-exporter   → host-level metrics per node
  kube-state-metrics → Kubernetes object metrics
```

Rules disabled for EKS-managed components (etcd, kube-controller-manager, kube-scheduler, kube-proxy) since these are managed by AWS and not scrape-accessible.

### 6.5 Configuration Management

| Scope | Mechanism |
|---|---|
| Terraform environment config | `environments/staging.tfvars`, `environments/production.tfvars` |
| Kubernetes environment config | Kustomize overlays in `application-plane/{env}/` |
| Helm chart config | Base `values.yaml` in `helm-charts/` + inline `helm.values` in ArgoCD Application |
| Application config | ConfigMaps per namespace (not stored centrally) |

### 6.6 Pod Security

All infrastructure Helm charts enforce **restricted Pod Security Standards**:
```yaml
securityContext:
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  seccompProfile:
    type: RuntimeDefault
```
Namespace labels `pod-security.kubernetes.io/enforce: restricted` applied where applicable.

### 6.7 Validation

- **Terraform:** `terraform validate` + `tflint --recursive` (enforces snake_case, required tags, module versioning, documented variables)
- **Kubernetes:** ArgoCD diff on PR; schema validation via kubeconform (CI-ready)
- **Python:** No formal linting enforced yet (see Governance section)
- **Helm:** `helm lint` applicable per chart in `helm-charts/`

---

## 7. Service Communication Patterns

### ArgoCD → Git

- **Protocol:** HTTPS or SSH Git polling (configurable in ArgoCD bootstrap values)
- **Frequency:** Default 3-minute polling interval
- **Credentials:** Stored in Kubernetes Secret, mounted via `git-credentials-template.yaml`
- **Pattern:** Pull-based (ArgoCD pulls from Git, never pushed to by CI directly)

### ArgoCD → Helm Registry / OCI

- ArgoCD fetches Helm charts from public Helm repositories or OCI registries
- IRSA enables ECR pull for private images without explicit credential configuration

### Fluent Bit → Elasticsearch

- **Protocol:** HTTP (port 9200) within cluster
- **Authentication:** Basic auth via Kubernetes Secret
- **Pattern:** Push-based log shipping, batched and buffered

### Prometheus → Scrape Targets

- **Protocol:** HTTP `/metrics` endpoints (pull-based scraping)
- **Discovery:** `ServiceMonitor` CRDs deployed alongside each stack
- **Pattern:** Prometheus-operator manages scrape configuration declaratively

### GitHub Actions → AWS

- **Protocol:** AWS STS AssumeRoleWithWebIdentity via OIDC token
- **Pattern:** Short-lived credential exchange at workflow start
- **Scope:** Role trust policy scoped to `repo:<org>/<repo>:ref:refs/heads/main`

---

## 8. Technology-Specific Patterns

### 8.1 Terraform Patterns

**Module structure (enforced by tflint):**
```
inf/terraform/<project>/
├── main.tf          # Primary resources
├── variables.tf     # Input variables (all typed + described)
├── outputs.tf       # Outputs (all described)
├── locals.tf        # Local value computations
├── provider.tf      # Provider versions + backend config
└── environments/
    ├── staging.tfvars
    └── production.tfvars
```

**Naming:** All identifiers must use `snake_case`.

**Required resource tags:**
```hcl
tags = {
  Environment = var.environment
  Project     = var.project_name
  ManagedBy   = "terraform"
}
```

**IRSA pattern (used in `aws-eks-argocd`):**
```hcl
resource "aws_iam_role" "argocd" {
  assume_role_policy = data.aws_iam_policy_document.argocd_oidc_trust.json
}

data "aws_iam_policy_document" "argocd_oidc_trust" {
  statement {
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.eks.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_issuer}:sub"
      values   = ["system:serviceaccount:argocd:argocd-application-controller"]
    }
  }
}
```

### 8.2 Kubernetes / ArgoCD Patterns

**AppProject scoping:**
```yaml
spec:
  sourceRepos:
    - 'https://github.com/<org>/<repo>.git'
  destinations:
    - namespace: 'monitoring'
      server: 'https://kubernetes.default.svc'
  clusterResourceWhitelist:
    - group: 'monitoring.coreos.com'
      kind: 'PrometheusRule'
```

**Sync wave annotation:**
```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"   # ECK Operator
    argocd.argoproj.io/sync-wave: "0"    # kube-prometheus-stack
    argocd.argoproj.io/sync-wave: "1"    # fluent-bit
```

**ApplicationSet git-file generator (auto-discovery):**
```yaml
generators:
  - git:
      repoURL: https://github.com/<org>/<repo>.git
      revision: HEAD
      files:
        - path: "gitops/helm-charts/jenkins/*/config.json"
```

**Kustomize overlay composition:**
```
gitops/application-plane/
├── base/                    # (if present) shared base
└── {env}/
    └── infrastructure/
        ├── kustomization.yaml   # lists resources + patches
        └── eck-operator.yaml    # env-specific patch/override
```

### 8.3 GitHub Actions Patterns

**OIDC authentication block (reused across all AWS workflows):**
```yaml
permissions:
  id-token: write
  contents: read

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ vars.AWS_ROLE_ARN }}
      aws-region: ${{ vars.AWS_REGION }}
```

**Matrix fan-out for Terraform (auto-discovery):**
```yaml
strategy:
  matrix:
    include: ${{ fromJson(needs.setup.outputs.matrix) }}
```
The `setup` job scans `inf/terraform/*/environments/*.tfvars` and builds the matrix JSON dynamically.

**Concurrency control:**
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 8.4 Python Patterns

**CLI interface pattern (`deploy_gitops_stacks_local.py`):**
```python
import argparse
from rich.console import Console
from rich.table import Table

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gitops-path", required=True)
    parser.add_argument("--repo-url", required=True)
    parser.add_argument("--action", choices=["deploy", "status", "cleanup", "menu"],
                        default="menu")
    return parser.parse_args()
```

**Dependencies:** `boto3>=1.26.0`, `requests>=2.28.0`, `rich` (CLI UI).

**Script responsibilities are cleanly separated** — no script does both AWS state management and cluster lifecycle.

---

## 9. Implementation Patterns

### 9.1 Adding a New Infrastructure Service

Follow the sync-wave pattern: operators and CRDs in Wave -1 or 0; their operands and dependent services in Wave 0 or 1.

1. Add Helm values to `gitops/helm-charts/<service>/values.yaml`
2. Create ArgoCD Application YAML in `gitops/application-plane/<env>/infrastructure/<service>.yaml`
3. Set `argocd.argoproj.io/sync-wave` annotation based on dependencies
4. Add entry to `gitops/application-plane/<env>/infrastructure/kustomization.yaml`
5. Ensure the service's namespace is listed in the `infrastructure` AppProject

### 9.2 Adding a New Tenant

1. Create tenant configuration at `gitops/helm-charts/jenkins/<tier>/<tenant-name>/`
2. Create Application YAML at `gitops/application-plane/<env>/tenants/<tier>/<tenant-name>.yaml`
3. Add to `gitops/application-plane/<env>/tenants/<tier>/kustomization.yaml`
4. Tenant's namespace must match AppProject `applications` or `tenants` allow-list

### 9.3 Adding a New Terraform Module

1. Create `inf/terraform/<module-name>/` with the standard file set: `main.tf`, `variables.tf`, `outputs.tf`, `locals.tf`, `provider.tf`
2. Add `environments/staging.tfvars` and `environments/production.tfvars`
3. Confirm all variables are typed and described (tflint enforces this)
4. Apply required tags to all resources
5. Pin all module and provider versions
6. The CI `terraform-plan.yml` auto-discovers new directories — no workflow changes needed

### 9.4 Adding a New GitHub Actions Workflow

1. Use OIDC authentication pattern — never `aws-access-key-id` + `aws-secret-access-key`
2. Include `concurrency` block to prevent parallel runs on the same branch
3. Follow the existing workflow naming convention: `<cloud>-<service>-<action>-<env>.yml`
4. Reference `.github/instructions/github-actions-ci-cd-best-practices.instructions.md`

---

## 10. Testing Architecture

### Infrastructure Testing

| Level | Tool | When |
|---|---|---|
| Syntax validation | `terraform validate` | Every push (CI) |
| Lint/convention check | `tflint --recursive` | Every push (CI) |
| Plan review | `terraform plan` in CI | Every PR |
| Integration | Manual `terraform apply` to staging | Pre-production |

### GitOps/Kubernetes Testing

| Level | Approach |
|---|---|
| Local cluster smoke test | `deploy_gitops_stacks_local.py --action deploy` on minikube/kind/k3s |
| ArgoCD diff | View `OutOfSync` diff before syncing |
| Schema validation | `kubeconform` (can be added to CI) |
| Manual acceptance | ArgoCD UI — all Applications show `Healthy` + `Synced` |

### Python Script Testing

No formal automated tests currently. Scripts use `boto3` dry-run modes and `--dry-run` flags where possible. Future: pytest with mocked `boto3` via `moto`.

### Test Strategy by Layer

```
Layer 0 (AWS Infra)    → tflint + terraform validate + plan in CI
Layer 1 (EKS Cluster)  → manual staging apply + node readiness check
Layer 2 (ArgoCD)       → local cluster bootstrap via deploy_gitops_stacks_local.py
Layer 3 (Control Plane)→ ArgoCD Healthy/Synced status per Application
Layer 4 (Tenants)      → Pod running + service endpoint reachable
```

---

## 11. Deployment Architecture

### AWS Environment Topology

| Environment | EKS Nodes | Networking | Notes |
|---|---|---|---|
| staging | 2x t3.medium SPOT | Single NAT Gateway | Cost-optimized |
| production | 3x t3.small ON_DEMAND | Multi-AZ NAT Gateways | HA, higher availability |

### Deployment Sequence (New Cluster)

```
1. terraform apply (aws-github-oidc)     → OIDC trust + IAM role
2. terraform apply (aws-s3-web)          → S3 bucket for website
3. terraform apply (aws-eks)             → EKS cluster + VPC + ArgoCD bootstrap
4. terraform apply (aws-eks-argocd)      → IRSA for ArgoCD
5. kubectl apply -k gitops/bootstrap/    → ArgoCD self-manages everything else
   └→ ArgoCD syncs infrastructure plane  (waves -1, 0, 1)
   └→ ArgoCD syncs tenant plane          (waves 2-6)
```

### Static Site Deployment

```
Push to main
  → GitHub Actions: aws-s3-web-sync-{staging,prod}.yml
  → aws s3 sync src/aws-s3-web/ s3://<bucket>/ --delete
  → CloudFront invalidation (if CloudFront module deployed)
```

### Local Development Deployment

```
python ops/deploy_gitops_stacks_local.py \
  --gitops-path . \
  --repo-url https://github.com/<org>/<repo>.git \
  --action deploy
```

Deploys the full stack to a local cluster in the correct wave order with status polling.

### Environment-Specific Configuration Strategy

Kubernetes — Kustomize overlays per environment directory:
```
gitops/application-plane/
├── local/       ← lightweight (reduced replicas, NodePort, minimal storage)
├── staging/     ← intermediate (adds advanced/premium tiers)
└── production/  ← full production (all tiers, persistent storage, HA)
```

Terraform — tfvars only; no separate branches:
```
environments/
├── staging.tfvars     ← spot instances, single NAT, smaller EBS
└── production.tfvars  ← on-demand, multi-AZ NAT, larger EBS
```

---

## 12. Extension and Evolution Patterns

### Adding a New Monitoring Integration

1. Define `ServiceMonitor` CRD for the target service in the appropriate namespace
2. Ensure the namespace is in the `infrastructure` AppProject destination list
3. Add alert rules via `PrometheusRule` CRD (YAML in the service's Application)
4. Import Grafana dashboard via ConfigMap with label `grafana_dashboard: "1"`

### Adding a New Tenant Tier

1. Create tier template at `gitops/application-plane/<env>/tier-templates/<tier>_tenant_template.yaml`
2. Define a new AppProject in `gitops/bootstrap/projects/<tier>.yaml` with namespace scope
3. Add ApplicationSet generator entry in `gitops/applicationsets/` to auto-discover tier configs
4. Create Helm values template in `gitops/helm-charts/jenkins/<tier>/`

### Migrating to a New Cloud Region

1. Add new tfvars files: `environments/<region>-staging.tfvars`
2. Update provider region in `provider.tf` or pass as variable
3. Create environment overlay in `gitops/application-plane/<region>-<env>/`
4. No Helm chart changes needed (region-agnostic by design)

### Upgrading a Helm Chart Version

1. Update the chart version in the ArgoCD Application YAML (`helm.chart` + `targetRevision`)
2. Review release notes for breaking changes
3. Update `helm-charts/<chart>/values.yaml` if new keys are required
4. Test on local cluster first via `deploy_gitops_stacks_local.py`
5. Merge to trigger staging sync, then production after validation

---

## 13. Architectural Pattern Examples

### App-of-Apps Bootstrap

```yaml
# gitops/bootstrap/app-of-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: app-of-apps
  namespace: argocd
spec:
  project: infrastructure
  source:
    repoURL: https://github.com/<org>/<repo>.git
    targetRevision: HEAD
    path: gitops/application-plane/production/tenants
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

This single Application, applied manually once, causes ArgoCD to recursively discover and manage every other Application in the repository.

### Sync Wave Ordering

```yaml
# ECK Operator — must be ready before Elasticsearch
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"

# kube-prometheus-stack — infrastructure observability
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"

# Fluent Bit — log shipping requires ES to be up
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "1"
```

### ApplicationSet Git-File Generator

```yaml
# gitops/applicationsets/jenkins-appset.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: jenkins
spec:
  generators:
    - git:
        repoURL: https://github.com/<org>/<repo>.git
        revision: HEAD
        files:
          - path: "gitops/helm-charts/jenkins/*/config.json"
  template:
    metadata:
      name: 'jenkins-{{path.basename}}'
      annotations:
        argocd.argoproj.io/sync-wave: "2"
    spec:
      source:
        repoURL: https://charts.jenkins.io
        chart: jenkins
        targetRevision: 5.x.x
        helm:
          valueFiles:
            - '{{path}}/values.yaml'
```

### Terraform OIDC Authentication for CI

```hcl
# inf/terraform/aws-github-oidc/main.tf
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

resource "aws_iam_role" "github_actions_s3_sync" {
  name               = "github-actions-s3-sync-role"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_trust.json
}
```

---

## 14. Architectural Decision Records

### ADR-001: App-of-Apps Pattern for GitOps

**Context:** Need a scalable way to manage many Kubernetes Applications across multiple environments and tenants without manually applying each manifest.

**Decision:** Use ArgoCD's App-of-Apps pattern where a single root Application points to a directory containing other Application manifests.

**Consequences:**
- (+) Single `kubectl apply` bootstraps the entire platform
- (+) New environments added by creating a new directory — no Terraform changes
- (-) Debugging requires understanding recursive Application traversal
- (-) Initial bootstrap requires ArgoCD to already be running (chicken-and-egg solved by Terraform deploying ArgoCD first)

### ADR-002: Sync Waves for Dependency Ordering

**Context:** Infrastructure components have strict deployment ordering requirements (CRDs before CRs, Elasticsearch before Fluent Bit).

**Decision:** Use ArgoCD sync wave annotations rather than manual ordering or separate Applications with explicit dependencies.

**Consequences:**
- (+) Ordering enforced declaratively in Git without external orchestration
- (+) Waves visible in ArgoCD UI for debugging
- (-) Wave numbers must be managed carefully as new components are added
- (-) All components in the same sync attempt, increasing rollout time

### ADR-003: Independent Terraform State Per Module

**Context:** A single Terraform state for all AWS resources creates risk (full state lock, large blast radius).

**Decision:** Each Terraform project (`aws-eks`, `aws-s3-web`, etc.) has an independent state stored in its own S3 path.

**Consequences:**
- (+) Plan/apply one module without affecting others
- (+) Different teams/pipelines can manage different modules
- (-) Cross-module references require `terraform_remote_state` data sources
- (-) Bootstrap ordering must be documented (OIDC before EKS)

### ADR-004: GitHub OIDC Over Static Access Keys

**Context:** GitHub Actions needs AWS access for Terraform and S3 sync operations.

**Decision:** Use GitHub OIDC → AWS STS to exchange short-lived tokens rather than storing `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` in GitHub Secrets.

**Consequences:**
- (+) No long-lived credentials stored anywhere
- (+) Trust policy scoped to specific repo + branch
- (+) Credential rotation is automatic
- (-) Initial setup requires deploying the OIDC provider via Terraform first

### ADR-005: Multi-Environment via Directory Overlays, Not Branches

**Context:** Need to support local, staging, and production environments with minimal configuration divergence.

**Decision:** Single `main` branch; environment differences encoded in directory structure (`application-plane/<env>/`) and Terraform `environments/<env>.tfvars`.

**Consequences:**
- (+) Single PR review covers all environments simultaneously
- (+) No branch merge conflicts between environments
- (-) Environment-specific hotfixes must be applied through normal Git flow
- (-) Directory structure grows with each new environment

---

## 15. Architecture Governance

### Automated Enforcement

| Rule | Enforcement Mechanism |
|---|---|
| Terraform naming (snake_case) | `.tflint.hcl` — fails CI on violations |
| Required resource tags | `.tflint.hcl` AWS plugin — tag enforcement rules |
| Documented variables/outputs | `.tflint.hcl` — `terraform_documented_*` rules |
| Module version pinning | `.tflint.hcl` — `terraform_module_version` rule |
| No static AWS credentials in CI | GitHub Actions OIDC-only policy (enforced by IAM trust condition) |
| Pod security | AppProject resource whitelists + namespace Pod Security labels |

### Copilot Instructions (`.github/instructions/`)

Domain-specific guidelines for AI-assisted development:
- `terraform-sap-btp.instructions.md` — IaC conventions
- `kubernetes-manifests.instructions.md` — Manifest patterns
- `github-actions-ci-cd-best-practices.instructions.md` — Workflow standards
- `devops-core-principles.instructions.md` — Platform-wide principles
- `python.instructions.md` — Script quality standards

These files govern both human PRs and AI-generated code suggestions.

### Review Process

1. All changes via Pull Request — no direct pushes to `main`
2. Terraform plan output auto-commented on PR by CI
3. ArgoCD sync preview (`--dry-run`) available via `kubectl`
4. AppProject restrictions prevent ArgoCD from syncing outside authorized namespaces/resources

### Documentation Practices

- Architecture changes must update `docs/Project_Architecture_Blueprint.md` (this file)
- Implementation plans go in `plan/` before development begins
- Operational guides go in `docs/` after implementation
- All `docs/` files use the `update-docs-on-code-change.instructions.md` standard

---

## 16. Blueprint for New Development

### Development Workflow by Feature Type

#### New AWS Infrastructure

```
1. plan/   → create implementation plan document
2. inf/terraform/<new-module>/
   ├── main.tf (resources with required tags)
   ├── variables.tf (all typed + described)
   ├── outputs.tf (all described)
   ├── locals.tf
   ├── provider.tf (pinned versions)
   └── environments/staging.tfvars + production.tfvars
3. Push PR → CI auto-discovers and runs terraform plan
4. Review plan comment on PR → merge → terraform apply runs
```

#### New Kubernetes Workload / Tool

```
1. gitops/helm-charts/<tool>/values.yaml   (base Helm overrides)
2. gitops/application-plane/local/infrastructure/<tool>.yaml
   (ArgoCD Application with sync-wave annotation)
3. gitops/application-plane/local/infrastructure/kustomization.yaml
   (add new resource entry)
4. Repeat for staging/ and production/ overlays
5. Test locally: python ops/deploy_gitops_stacks_local.py --action deploy
6. Merge → ArgoCD auto-syncs in correct wave order
```

#### New Tenant Onboarding

```
1. gitops/helm-charts/jenkins/<tier>/<tenant>/values.yaml
2. gitops/application-plane/<env>/tenants/<tier>/<tenant>.yaml
3. gitops/application-plane/<env>/tenants/<tier>/kustomization.yaml
4. (Optional) Trigger onboarding-workflow.yaml Argo Workflow for RBAC setup
```

#### New CI/CD Workflow

```
1. .github/workflows/<cloud>-<service>-<action>-<env>.yml
2. Must use OIDC auth pattern (id-token: write permission)
3. Include concurrency block
4. Follow .github/instructions/github-actions-ci-cd-best-practices.instructions.md
```

### Implementation Templates

**Terraform variable template:**
```hcl
variable "environment" {
  description = "Deployment environment (staging or production)"
  type        = string
}
```

**ArgoCD Application template:**
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: <service-name>
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "<wave-number>"
spec:
  project: infrastructure        # or applications / tenants
  source:
    repoURL: https://charts.example.com
    chart: <chart-name>
    targetRevision: X.Y.Z
    helm:
      valueFiles:
        - gitops/helm-charts/<service>/values.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: <service-namespace>
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Common Pitfalls

| Pitfall | Prevention |
|---|---|
| Deploying CRs before CRDs are established | Always assign operators a lower (earlier) sync wave than their operands |
| Hardcoding AWS account IDs or region | Use `data "aws_caller_identity"` and `data "aws_region"` |
| Committing secrets to Git | Use `external-secrets-operator` or create secrets out-of-band |
| Using `latest` Helm chart version | Pin `targetRevision` to a specific semver |
| Missing resource tags | tflint will catch this in CI — fix before merge |
| Cross-namespace secret access | Each namespace needs its own ExternalSecret or mounted Kubernetes Secret |
| Skipping sync-wave annotations | Results in race conditions (ECK CR applied before ECK Operator is ready) |

---

*This blueprint was last updated on 2026-04-09. Review and update when significant architectural changes are made — especially new Terraform modules, new GitOps layers, or changes to the multi-tenant tier model.*
