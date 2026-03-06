# GitOps Platform - Multi-Tenant SaaS Deployment

> A production-grade GitOps structure for deploying and managing multi-tenant applications on AWS EKS using ArgoCD, Helm, Kustomize, and Argo Workflows. Inspired by the [AWS EKS SaaS GitOps Workshop](https://catalog.workshops.aws/eks-saas-gitops/en-US).

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Key Concepts](#key-concepts)
  - [Tier Strategy](#tier-strategy)
  - [App-of-Apps Pattern](#app-of-apps-pattern)
  - [ApplicationSet Auto-Discovery](#applicationset-auto-discovery)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Bootstrap ArgoCD](#bootstrap-argocd)
  - [Deploy Jenkins (First Service)](#deploy-jenkins-first-service)
- [Tenant Management](#tenant-management)
  - [Onboarding a New Tenant](#onboarding-a-new-tenant)
  - [Offboarding a Tenant](#offboarding-a-tenant)
  - [Staggered Deployment](#staggered-deployment)
- [Environments](#environments)
- [Security](#security)
- [Monitoring and Observability](#monitoring-and-observability)
- [Relationship to Existing ops/ Directory](#relationship-to-existing-ops-directory)
- [References](#references)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Git Repository                               │
│  ┌────────────┐  ┌──────────────────┐  ┌────────────────────────┐  │
│  │  bootstrap/ │  │ application-plane/│  │    control-plane/      │  │
│  │  ArgoCD     │  │ Tenant manifests  │  │ Argo Workflows         │  │
│  │  Projects   │  │ Tier templates    │  │ Onboard/Offboard/Deploy│  │
│  └──────┬─────┘  └────────┬─────────┘  └──────────┬─────────────┘  │
│         │                  │                        │                │
└─────────┼──────────────────┼────────────────────────┼────────────────┘
          │                  │                        │
          ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS EKS Cluster                             │
│                                                                     │
│  ┌─────────────────┐                                                │
│  │    ArgoCD        │◄── Reconciles desired state from Git          │
│  │  (GitOps Engine) │                                                │
│  └────────┬────────┘                                                │
│           │                                                          │
│  ┌────────┴──────────────────────────────────────────────────┐      │
│  │                  Application Plane                         │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │      │
│  │  │ pool-1   │  │ tenant-A │  │ tenant-B │  │ tenant-C │ │      │
│  │  │ (basic)  │  │(advanced)│  │(advanced)│  │(premium) │ │      │
│  │  │ shared   │  │ hybrid   │  │ hybrid   │  │ dedicated│ │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │                   Control Plane                            │      │
│  │  ┌────────────────┐  ┌───────────────┐  ┌──────────────┐ │      │
│  │  │  Onboarding    │  │  Offboarding  │  │  Deployment  │ │      │
│  │  │  Workflow       │  │  Workflow     │  │  Workflow    │ │      │
│  │  └────────────────┘  └───────────────┘  └──────────────┘ │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
gitops/
├── README.md                              # This file
├── bootstrap/                             # ArgoCD installation and bootstrap
│   ├── argocd/
│   │   ├── namespace.yaml                 # ArgoCD namespace with pod security
│   │   ├── values-base.yaml               # Production-grade base config
│   │   ├── values-aws.yaml                # AWS EKS-specific overrides (IRSA)
│   │   └── values-local.yaml              # Local dev overrides (minikube/kind)
│   ├── app-of-apps.yaml                   # Root Application (entry point)
│   └── projects/
│       ├── infrastructure.yaml            # AppProject for infra components
│       ├── applications.yaml              # AppProject for app workloads
│       └── tenants.yaml                   # AppProject for tenant-scoped deploys
│
├── helm-charts/                           # Umbrella Helm charts
│   └── jenkins/
│       ├── Chart.yaml                     # Wraps jenkins/jenkins 5.8.139
│       ├── values.yaml                    # Tier-agnostic default values
│       └── .helmignore
│
├── application-plane/                     # Tenant deployments by environment
│   ├── production/
│   │   ├── tier-templates/                # Templates for each tier
│   │   │   ├── basic_tenant_template.yaml
│   │   │   ├── advanced_tenant_template.yaml
│   │   │   └── premium_tenant_template.yaml
│   │   ├── pooled-envs/                   # Shared infrastructure
│   │   │   ├── kustomization.yaml
│   │   │   └── pool-1.yaml               # Shared Jenkins for basic tier
│   │   └── tenants/                       # Active tenant manifests
│   │       ├── kustomization.yaml
│   │       ├── basic/
│   │       │   └── kustomization.yaml     # Basic tier tenants (empty)
│   │       ├── advanced/
│   │       │   └── kustomization.yaml     # Advanced tier tenants (empty)
│   │       └── premium/
│   │           ├── kustomization.yaml
│   │           └── jenkins.yaml           # Jenkins as first premium tenant
│   ├── staging/
│   │   ├── tier-templates/
│   │   │   ├── basic_tenant_template.yaml
│   │   │   └── advanced_tenant_template.yaml
│   │   ├── pooled-envs/
│   │   │   ├── kustomization.yaml
│   │   │   └── pool-1.yaml
│   │   └── tenants/
│   │       ├── kustomization.yaml
│   │       ├── basic/
│   │       │   └── kustomization.yaml
│   │       └── advanced/
│   │           ├── kustomization.yaml
│   │           └── jenkins.yaml           # Jenkins as advanced tier in staging
│   └── local/
│       ├── tier-templates/
│       │   └── basic_tenant_template.yaml
│       ├── pooled-envs/
│       │   ├── kustomization.yaml
│       │   └── pool-1.yaml
│       └── tenants/
│           ├── kustomization.yaml
│           └── basic/
│               ├── kustomization.yaml
│               └── jenkins.yaml           # Jenkins as basic tier in local
│
├── applicationsets/                       # ApplicationSet definitions
│   └── jenkins-appset.yaml               # Auto-discovers Jenkins tenants
│
└── control-plane/                         # Automation workflows
    ├── rbac/
    │   ├── workflow-rbac.yaml             # ServiceAccount & RBAC for workflows
    │   └── git-credentials-template.yaml  # Git token template (never commit real creds)
    └── workflows/
        ├── onboarding-workflow.yaml       # Tenant onboarding automation
        ├── offboarding-workflow.yaml      # Tenant offboarding automation
        └── deployment-workflow.yaml       # Staggered deployment automation
```

---

## Key Concepts

### Tier Strategy

The platform implements three deployment tiers inspired by SaaS isolation patterns, each providing different levels of resource isolation and customization:

| Feature | Basic (Pool) | Advanced (Hybrid) | Premium (Silo) |
|---|---|---|---|
| **Isolation** | Shared namespace | Dedicated namespace | Dedicated namespace + resources |
| **Controller** | Shared | Dedicated | Dedicated HA |
| **Agents** | Shared | Shared | Dedicated |
| **Resources** | Minimal | Moderate (500m-2CPU) | Full (2-8 CPU, 4-8Gi) |
| **Storage** | Pool PVC | 20Gi gp3 | 100Gi gp3 |
| **Ingress** | None (via pool) | ClusterIP | NLB + TLS Ingress |
| **Sync Policy** | Auto | Auto | Manual (safety) |
| **Environments** | All | Staging, Production | Production only |
| **Notifications** | None | On failure | Full (deploy, degrade, fail) |

**When to use each tier:**

- **Basic:** Development teams, testing workloads, cost-sensitive tenants that can share infrastructure
- **Advanced:** Teams needing their own Jenkins controller but can share build agents. Good balance of isolation and cost
- **Premium:** Mission-critical CI/CD pipelines requiring full isolation, HA, custom plugins, and dedicated monitoring

### App-of-Apps Pattern

The bootstrap uses ArgoCD's [App-of-Apps pattern](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/):

```
app-of-apps.yaml (Root Application)
  └── Watches: gitops/application-plane/${ENVIRONMENT}/tenants/
      ├── basic/ → Pool references
      ├── advanced/ → Dedicated controllers
      └── premium/ → Full silo deployments
```

A single root Application bootstraps the entire platform. Adding a new tenant is as simple as committing a YAML file to the appropriate tier directory.

### ApplicationSet Auto-Discovery

The `jenkins-appset.yaml` uses ArgoCD's Git File generator to automatically discover tenant YAML files in the directory structure and create corresponding Applications. This provides a second, parallel mechanism for tenant discovery beyond the App-of-Apps pattern.

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| AWS CLI | >= 2.x | AWS authentication |
| kubectl | >= 1.29 | Kubernetes management |
| Helm | >= 3.14 | Chart management |
| ArgoCD CLI | >= 2.10 | (Optional) ArgoCD management |
| Argo CLI | >= 3.5 | (Optional) Workflow submission |

**Cluster requirements:**

- AWS EKS 1.29+ (or local: minikube/kind/k3s)
- RBAC enabled
- Pod Security Standards enforced
- Storage class `gp3` available (AWS) or default (local)

### Bootstrap ArgoCD

1. **Configure your environment:**

   ```bash
   export ENVIRONMENT=production    # or: staging, local
   export GIT_REPO_URL=https://github.com/your-org/devops-engineer-profile.git
   export AWS_ACCOUNT_ID=123456789012
   export EKS_CLUSTER_NAME=my-cluster
   ```

2. **Create the ArgoCD namespace:**

   ```bash
   kubectl apply -f gitops/bootstrap/argocd/namespace.yaml
   ```

3. **Add the Argo Helm repository and install ArgoCD:**

   ```bash
   helm repo add argo https://argoproj.github.io/argo-helm
   helm repo update argo
   ```

   **Local:**
   ```bash
   helm install argocd argo/argo-cd \
     --namespace argocd \
     --version 9.4.7 \
     --values gitops/bootstrap/argocd/values-base.yaml \
     --values gitops/bootstrap/argocd/values-local.yaml \
     --wait --timeout 10m
   ```

   **Staging / Production** (requires `ARGOCD_IRSA_ROLE_ARN` to be set):
   ```bash
   envsubst < gitops/bootstrap/argocd/values-aws.yaml > /tmp/values-aws-resolved.yaml
   helm install argocd argo/argo-cd \
     --namespace argocd \
     --version 9.4.7 \
     --values gitops/bootstrap/argocd/values-base.yaml \
     --values /tmp/values-aws-resolved.yaml \
     --wait --timeout 10m
   ```

4. **Apply the App-of-Apps:**

   ```bash
   # Substitute environment variables and apply
   envsubst < gitops/bootstrap/app-of-apps.yaml | kubectl apply -f -
   ```

5. **Apply ArgoCD projects:**

   ```bash
   kubectl apply -f gitops/bootstrap/projects/
   ```

6. **Verify:**

   ```bash
   kubectl get applications -n argocd
   kubectl get pods -n argocd
   ```

### Deploy Jenkins (First Service)

Jenkins is pre-configured as the first tenant across all environments:

| Environment | Tier | Namespace | Access |
|---|---|---|---|
| **Production** | Premium (silo) | `jenkins-production` | `https://jenkins.example.com` (Ingress + TLS) |
| **Staging** | Advanced (hybrid) | `jenkins-staging` | ClusterIP (port-forward) |
| **Local** | Basic (pool) | `pool-1-local` | NodePort 30080 |

**To deploy locally:**

```bash
# 1. Create namespace and install ArgoCD
kubectl apply -f gitops/bootstrap/argocd/namespace.yaml

helm repo add argo https://argoproj.github.io/argo-helm
helm repo update argo

helm install argocd argo/argo-cd \
  --namespace argocd \
  --version 9.4.7 \
  --values gitops/bootstrap/argocd/values-base.yaml \
  --values gitops/bootstrap/argocd/values-local.yaml \
  --wait --timeout 10m

# 2. Apply projects and app-of-apps
kubectl apply -f gitops/bootstrap/projects/

export ENVIRONMENT=local
export ARGOCD_APPS_REPO_URL=https://github.com/your-org/devops-engineer-profile.git
export ARGOCD_APPS_TARGET_REVISION=HEAD
envsubst < gitops/bootstrap/app-of-apps.yaml | kubectl apply -f -

# 3. Jenkins will auto-sync from pool-1-local
# Access via NodePort:
kubectl get svc -n pool-1-local
```

---

## Tenant Management

### Onboarding a New Tenant

**Method 1: Automated (Argo Workflows)**

```bash
# Ensure workflow prerequisites are deployed
kubectl apply -f gitops/control-plane/rbac/workflow-rbac.yaml
# Create git-credentials secret (do NOT use the template file directly)
kubectl create secret generic git-credentials \
  -n argo-workflows \
  --from-literal=username=git-bot \
  --from-literal=token=ghp_xxxxxxxxxxxx

# Submit onboarding workflow
argo submit gitops/control-plane/workflows/onboarding-workflow.yaml \
  -p tenant-id=acme-corp \
  -p tier=advanced \
  -p environment=production \
  -p release-version=1.0.0
```

**Method 2: Manual (Git commit)**

1. Copy the appropriate tier template:

   ```bash
   cp gitops/application-plane/production/tier-templates/advanced_tenant_template.yaml \
      gitops/application-plane/production/tenants/advanced/acme-corp.yaml
   ```

2. Replace placeholders:

   ```bash
   sed -i 's/{TENANT_ID}/acme-corp/g' \
     gitops/application-plane/production/tenants/advanced/acme-corp.yaml
   sed -i 's/{RELEASE_VERSION}/1.0.0/g' \
     gitops/application-plane/production/tenants/advanced/acme-corp.yaml
   ```

3. Add to kustomization:

   ```yaml
   # gitops/application-plane/production/tenants/advanced/kustomization.yaml
   resources:
     - acme-corp.yaml
   ```

4. Commit and push. ArgoCD auto-syncs the new tenant.

### Offboarding a Tenant

**Method 1: Automated**

```bash
argo submit gitops/control-plane/workflows/offboarding-workflow.yaml \
  -p tenant-id=acme-corp \
  -p tier=advanced \
  -p environment=production \
  -p create-backup=true
```

**Method 2: Manual**

1. Remove the tenant YAML file from the tenants directory
2. Remove the reference from `kustomization.yaml`
3. Commit and push — ArgoCD prunes the resources

### Staggered Deployment

Deploy new versions safely across all tenants using the wave-based strategy:

```bash
argo submit gitops/control-plane/workflows/deployment-workflow.yaml \
  -p release-version=1.1.0 \
  -p deploy-strategy=staggered
```

**Wave order:**

1. **Wave 0:** Staging (all tiers) — canary validation
2. **Wave 1:** Production basic (pool) — broad impact, low risk
3. **Wave 2:** Production advanced — medium impact
4. **Wave 3:** Production premium — highest value, deployed last

Each wave includes a health validation gate before proceeding.

---

## Environments

| Environment | Cluster | Tiers Available | Sync Policy | Notes |
|---|---|---|---|---|
| **local** | minikube/kind/k3s | Basic only | Auto | Minimal resources, NodePort access |
| **staging** | EKS (staging) | Basic, Advanced | Auto | Pre-production validation |
| **production** | EKS (production) | Basic, Advanced, Premium | Mixed* | Full isolation, HA, monitoring |

*Premium tier uses manual sync in production for safety.

---

## Security

### Implemented Security Controls

- **Pod Security Standards:** `baseline` enforced, `restricted` warned on all tenant namespaces
- **Non-root containers:** All Jenkins pods run as UID 1000 with `runAsNonRoot: true`
- **Read-only root filesystem:** Enabled on all controller containers
- **Privilege escalation:** Blocked via `allowPrivilegeEscalation: false`
- **Linux capabilities:** All dropped (`drop: [ALL]`)
- **Seccomp profile:** `RuntimeDefault` on all pods
- **ArgoCD RBAC:** Three roles (devops/developer/tenant-admin) with least-privilege
- **AppProject scoping:** Each project restricts which namespaces and resources can be managed
- **Resource finalizers:** Prevent accidental deletion of ArgoCD applications
- **Git credentials:** Template only — actual secrets must use External Secrets Operator or sealed-secrets

### Recommended Additional Hardening

- Enable [NetworkPolicies](https://kubernetes.io/docs/concepts/services-networking/network-policies/) per tenant namespace
- Configure [OPA Gatekeeper](https://open-policy-agent.github.io/gatekeeper/) or [Kyverno](https://kyverno.io/) for policy enforcement
- Use [External Secrets Operator](https://external-secrets.io/) with AWS Secrets Manager
- Enable [etcd encryption at rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/)
- Implement image scanning with Trivy in CI pipeline
- Use [IRSA](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html) for all service accounts

---

## Monitoring and Observability

### Built-in Metrics

- **ArgoCD metrics:** Exposed on `:8083/metrics` (Prometheus format)
- **Jenkins Prometheus plugin:** Installed on all tiers; exposes build metrics
- **Application health:** ArgoCD tracks sync status and health for every Application

### Recommended Stack

| Component | Tool | Purpose |
|---|---|---|
| Metrics | Prometheus + kube-state-metrics | Cluster and app metrics |
| Visualization | Grafana | Dashboards for DORA metrics |
| Logging | Fluentd → OpenSearch | Centralized log aggregation |
| Tracing | OpenTelemetry → Jaeger | Distributed trace analysis |
| Alerting | Alertmanager + Slack | Incident notifications |

### Key Alerts to Configure

- ArgoCD application out-of-sync > 5 minutes
- Pod restart count > 3 in 15 minutes
- Jenkins build queue > 10 items
- PVC usage > 80%
- Node CPU/memory > 85%

---

## Relationship to Existing ops/ Directory

This `gitops/` directory is the **recommended successor** to the existing `ops/` directory structure. Here is how the components map:

| Existing (`ops/`) | New (`gitops/`) | Notes |
|---|---|---|
| `ops/argocd/` | `gitops/bootstrap/argocd/` | Enhanced with multi-env values, RBAC, script |
| `ops/argocd/manifests/app-of-apps.yaml` | `gitops/bootstrap/app-of-apps.yaml` | Parameterized with envsubst |
| `ops/argocd/manifests/projects/` | `gitops/bootstrap/projects/` | Added `tenants` project |
| `ops/jenkins/helm/` | `gitops/helm-charts/jenkins/` | Same upstream chart, cleaner values |
| `ops/jenkins/argocd/` | `gitops/application-plane/*/tenants/` | Per-env, per-tier tenant manifests |
| `ops/jenkins/k8s/` | Embedded in tenant YAML | Namespace created alongside Application |
| `ops/k8s/argocd-apps/` | `gitops/applicationsets/` | ApplicationSet replaces manual template |
| *(not present)* | `gitops/control-plane/workflows/` | New: automated tenant lifecycle |
| *(not present)* | `gitops/application-plane/*/tier-templates/` | New: tier strategy templates |

### Migration Path

1. Deploy the new `gitops/` structure alongside existing `ops/`
2. Bootstrap ArgoCD using `gitops/bootstrap/`
3. Verify Jenkins deploys correctly from the new structure
4. Gradually transition existing ArgoCD Applications to point to `gitops/`
5. Decommission `ops/` ArgoCD and Jenkins manifests once fully migrated

---

## References

- [AWS EKS SaaS GitOps Workshop](https://catalog.workshops.aws/eks-saas-gitops/en-US)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [ArgoCD App-of-Apps](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/)
- [ArgoCD ApplicationSet](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/)
- [Argo Workflows](https://argo-workflows.readthedocs.io/)
- [Jenkins Helm Chart](https://github.com/jenkinsci/helm-charts)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [DORA Metrics](https://dora.dev/guides/dora-metrics-four-keys/)

---

## License

This project is licensed under the same terms as the parent repository. See the root [LICENSE](../LICENSE) file.
