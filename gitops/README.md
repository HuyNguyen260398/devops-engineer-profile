# GitOps Platform - Multi-Tenant SaaS Deployment

> A production-grade GitOps structure for deploying and managing multi-tenant applications on AWS EKS using ArgoCD, Helm, and Kustomize. Inspired by the [AWS EKS SaaS GitOps Workshop](https://catalog.workshops.aws/eks-saas-gitops/en-US).

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Key Concepts](#key-concepts)
  - [Tier Strategy](#tier-strategy)
  - [App-of-Apps Pattern](#app-of-apps-pattern)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Bootstrap ArgoCD](#bootstrap-argocd)
- [Tenant Management](#tenant-management)
  - [Onboarding a New Tenant](#onboarding-a-new-tenant)
  - [Offboarding a Tenant](#offboarding-a-tenant)
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
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│  │        bootstrap/         │  │        application-plane/         │  │
│  │   ArgoCD + AppProjects    │  │  Tenant manifests (env / tier)    │  │
│  └────────────┬─────────────┘  └──────────────────┬────────────────┘  │
│               │                                   │                   │
└───────────────┼───────────────────────────────────┼───────────────────┘
                │                                   │
                ▼                                   ▼
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
├── application-plane/                     # Tenant deployments by environment
│   ├── production/
│   │   ├── pooled-envs/                   # Shared pool infrastructure (empty)
│   │   │   └── kustomization.yaml
│   │   └── tenants/                       # Active tenant manifests
│   │       ├── kustomization.yaml
│   │       ├── basic/
│   │       │   └── kustomization.yaml
│   │       ├── advanced/
│   │       │   └── kustomization.yaml
│   │       └── premium/
│   │           └── kustomization.yaml
│   ├── staging/
│   │   ├── pooled-envs/
│   │   │   └── kustomization.yaml
│   │   └── tenants/
│   │       ├── kustomization.yaml
│   │       ├── basic/
│   │       │   └── kustomization.yaml
│   │       └── advanced/
│   │           └── kustomization.yaml
│   └── local/
│       ├── pooled-envs/
│       │   └── kustomization.yaml
│       └── tenants/
│           ├── kustomization.yaml
│           └── basic/
│               └── kustomization.yaml
│
└── control-plane/                         # RBAC and credential templates
    └── rbac/
        └── git-credentials-template.yaml  # Git token template (never commit real creds)
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
- **Advanced:** Teams needing a dedicated controller while sharing build agents. Good balance of isolation and cost
- **Premium:** Mission-critical workloads requiring full isolation, HA, custom configuration, and dedicated monitoring

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

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| AWS CLI | >= 2.x | AWS authentication |
| kubectl | >= 1.29 | Kubernetes management |
| Helm | >= 3.14 | Chart management |
| ArgoCD CLI | >= 2.10 | (Optional) ArgoCD management |

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

---

## Tenant Management

### Onboarding a New Tenant

**Manual (Git commit)**

1. Create a tenant Application manifest in the appropriate tier directory:

   Create `gitops/application-plane/production/tenants/advanced/acme-corp.yaml` with the ArgoCD Application manifest for the tenant.

2. Add to kustomization:

   ```yaml
   # gitops/application-plane/production/tenants/advanced/kustomization.yaml
   resources:
     - acme-corp.yaml
   ```

4. Commit and push. ArgoCD auto-syncs the new tenant.

### Offboarding a Tenant

**Manual**

1. Remove the tenant YAML file from the tenants directory
2. Remove the reference from `kustomization.yaml`
3. Commit and push — ArgoCD prunes the resources

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
- **Non-root containers:** All pods run as UID 1000 with `runAsNonRoot: true`
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
- PVC usage > 80%
- Node CPU/memory > 85%

---

## Relationship to Existing ops/ Directory

This `gitops/` directory is the **recommended successor** to the existing `ops/` directory structure. Here is how the components map:

| Existing (`ops/`) | New (`gitops/`) | Notes |
|---|---|---|
| `ops/argocd/` | `gitops/bootstrap/argocd/` | Enhanced with multi-env values and RBAC |
| `ops/argocd/manifests/app-of-apps.yaml` | `gitops/bootstrap/app-of-apps.yaml` | Parameterized with envsubst |
| `ops/argocd/manifests/projects/` | `gitops/bootstrap/projects/` | Added `tenants` project |

### Migration Path

1. Deploy the new `gitops/` structure alongside existing `ops/`
2. Bootstrap ArgoCD using `gitops/bootstrap/`
3. Gradually transition existing ArgoCD Applications to point to `gitops/`
4. Decommission `ops/` ArgoCD manifests once fully migrated

---

## References

- [AWS EKS SaaS GitOps Workshop](https://catalog.workshops.aws/eks-saas-gitops/en-US)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [ArgoCD App-of-Apps](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/)
- [ArgoCD ApplicationSet](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [DORA Metrics](https://dora.dev/guides/dora-metrics-four-keys/)

---

## License

This project is licensed under the same terms as the parent repository. See the root [LICENSE](../LICENSE) file.
