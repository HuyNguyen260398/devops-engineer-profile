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
- [Jenkins Deployment](#jenkins-deployment)
  - [Deployed Instances](#deployed-instances)
  - [Namespace Layout](#namespace-layout)
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
├── applicationsets/
│   └── jenkins-appset.yaml                # ApplicationSet: auto-discovers tenant YAMLs via Git
├── helm-charts/
│   └── jenkins/
│       ├── Chart.yaml                     # Wrapper chart (upstream jenkins/jenkins:5.8.139)
│       └── values.yaml                    # Secure base defaults shared across all tiers
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
│   │   ├── pooled-envs/
│   │   │   ├── kustomization.yaml
│   │   │   └── pool-1.yaml                # Jenkins shared pool (basic tier, production)
│   │   ├── tier-templates/                # Onboarding blueprints (copy + fill TENANT_NAME)
│   │   │   ├── basic_tenant_template.yaml
│   │   │   ├── advanced_tenant_template.yaml
│   │   │   └── premium_tenant_template.yaml
│   │   └── tenants/
│   │       ├── kustomization.yaml
│   │       ├── basic/
│   │       │   └── kustomization.yaml
│   │       ├── advanced/
│   │       │   └── kustomization.yaml
│   │       └── premium/
│   │           ├── kustomization.yaml
│   │           └── jenkins.yaml           # Jenkins premium tenant (manual sync, 100Gi)
│   ├── staging/
│   │   ├── pooled-envs/
│   │   │   ├── kustomization.yaml
│   │   │   └── pool-1.yaml                # Jenkins shared pool (basic tier, staging)
│   │   ├── tier-templates/
│   │   │   ├── basic_tenant_template.yaml
│   │   │   └── advanced_tenant_template.yaml
│   │   └── tenants/
│   │       ├── kustomization.yaml
│   │       ├── basic/
│   │       │   └── kustomization.yaml
│   │       └── advanced/
│   │           ├── kustomization.yaml
│   │           └── jenkins.yaml           # Jenkins advanced tenant (dedicated NS, 20Gi)
│   └── local/
│       ├── pooled-envs/
│       │   ├── kustomization.yaml
│       │   └── pool-1.yaml                # Jenkins shared pool (basic tier, local)
│       ├── tier-templates/
│       │   └── basic_tenant_template.yaml
│       └── tenants/
│           ├── kustomization.yaml
│           └── basic/
│               ├── kustomization.yaml
│               └── jenkins.yaml           # Jenkins basic tenant (NodePort 32001)
│
└── control-plane/                         # Lifecycle automation
    ├── rbac/
    │   ├── git-credentials-template.yaml  # Git token template (never commit real creds)
    │   └── workflow-rbac.yaml             # argo-workflows NS + SA + ClusterRole
    └── workflows/
        ├── onboarding-workflow.yaml        # 4-step WorkflowTemplate: validate → generate → commit → wait
        ├── offboarding-workflow.yaml       # 4-step WorkflowTemplate: verify → backup → remove → confirm
        └── deployment-workflow.yaml        # Staggered 4-wave deployment pipeline
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
   helm upgrade --install argocd argo/argo-cd \
     --namespace argocd \
     --version 9.4.7 \
     --values gitops/bootstrap/argocd/values-base.yaml \
     --values gitops/bootstrap/argocd/values-local.yaml \
     --wait --timeout 10m
   ```

   **Staging / Production** (requires `ARGOCD_IRSA_ROLE_ARN` to be set):
   ```bash
   envsubst < gitops/bootstrap/argocd/values-aws.yaml > /tmp/values-aws-resolved.yaml
   helm upgrade --install argocd argo/argo-cd \
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

6. **Verify ArgoCD and tenant Applications:**

   ```bash
   kubectl get applications -n argocd
   kubectl get pods -n argocd
   ```

7. **Bootstrap Jenkins shared pools** (pooled-envs are outside the app-of-apps watch path and must be applied once manually):

   ```bash
   kubectl apply -f gitops/application-plane/${ENVIRONMENT}/pooled-envs/pool-1.yaml
   ```

8. **(Optional) Deploy the ApplicationSet** for Git file-based auto-discovery of tenant YAMLs:

   ```bash
   kubectl apply -f gitops/applicationsets/jenkins-appset.yaml
   ```

9. **(Optional) Deploy Argo Workflows RBAC and WorkflowTemplates** Deploy Argo Workflows RBAC and WorkflowTemplates:

   ```bash
   kubectl apply -f gitops/control-plane/rbac/workflow-rbac.yaml
   kubectl apply -f gitops/control-plane/workflows/
   ```

---

## Jenkins Deployment

Jenkins is the first application deployed on this platform, using the multi-tenant tier model. It is managed entirely through ArgoCD — no manual `helm install` required after bootstrap.

### Deployed Instances

| ArgoCD Application | Tier | Environment | Namespace | Sync | Storage |
|---|---|---|---|---|---|
| `jenkins-pool-1-local` | basic | local | `pool-1-local` | Auto | 8Gi standard |
| `jenkins-pool-1-staging` | basic | staging | `pool-1-staging` | Auto | 20Gi gp3 |
| `jenkins-pool-1-production` | basic | production | `pool-1-production` | Auto | 20Gi gp3 |
| `jenkins-basic-local` | basic | local | `pool-1-local` (shared) | Auto | — |
| `jenkins-advanced-staging` | advanced | staging | `jenkins-staging` | Auto (Mon–Fri) | 20Gi gp3 |
| `jenkins-premium-production` | premium | production | `jenkins-production` | **Manual** | 100Gi gp3 |

> **Note:** Pool Applications (`pool-1-*.yaml`) must be bootstrapped with `kubectl apply` once (step 7 above). Tenant Applications (`jenkins.yaml`) are picked up automatically by the app-of-apps watcher.

### Why Two ArgoCD Applications per Environment?

Each environment runs two distinct ArgoCD Applications for Jenkins, and they serve separate roles in the architecture:

**`jenkins-pool-1-<env>` — The Pool (Infrastructure Layer)**

This is the shared pool bootstrap. It provisions the underlying namespace and base resources that all basic-tier tenants share. It is defined in `pooled-envs/` — deliberately outside the app-of-apps watch path (`tenants/`) — so it persists independently and must be applied once manually during bootstrap:

```bash
kubectl apply -f gitops/application-plane/${ENVIRONMENT}/pooled-envs/pool-1.yaml
```

Think of it as the "landlord": it sets up the shared infrastructure that tenants move into.

**`jenkins-<tier>-<env>` — The Tenant (Application Layer)**

This represents a specific team's Jenkins instance, managed by the app-of-apps. Each onboarded tenant gets its own ArgoCD Application, providing:

- **Independent lifecycle management** — sync, rollback, and health status tracked per tenant
- **Clean offboarding** — deleting the tenant YAML causes ArgoCD to prune only that tenant's resources
- **Per-tenant configuration** — each Application can carry its own JCasC, plugin list, or resource overrides via `helm.values`

**How this scales with multiple teams**

In production with several basic-tier tenants all sharing `pool-1-local`, the layout looks like this:

```
pool-1-local namespace
├── jenkins-pool-1        ← pool infrastructure  (managed by jenkins-pool-1-local)
├── jenkins-basic-local   ← tenant: jenkins team (managed by jenkins-basic-local)
├── acme-corp             ← tenant: acme-corp    (managed by jenkins-basic-acme-corp)
└── foo-team              ← tenant: foo-team     (managed by jenkins-basic-foo-team)
```

Each tenant has its own ArgoCD Application for visibility and lifecycle control, while all sharing the same namespace and pool infrastructure — keeping costs low without losing per-tenant management.

In local development with only one tenant the separation may feel redundant, but the design intentionally mirrors production so the same GitOps workflows (onboarding, offboarding, staggered deployment) operate identically across all environments.

### Namespace Layout

```
pool-1-local        ← all basic-tier local tenants share this namespace
pool-1-staging      ← all basic-tier staging tenants share this namespace
pool-1-production   ← all basic-tier production tenants share this namespace
jenkins-staging     ← dedicated namespace for jenkins advanced (staging)
jenkins-production  ← dedicated namespace for jenkins premium (production)
```

For full details on the Jenkins implementation — Helm chart overrides, per-tier resource sizing, sync windows, and how to add more Jenkins tenants — see [doc/JENKINS_ARGOCD_IMPLEMENTATION.md](../doc/JENKINS_ARGOCD_IMPLEMENTATION.md).

---

## Tenant Management

### Onboarding a New Tenant

**Option A — Manual (Git commit)**

1. Copy the appropriate tier template and substitute the tenant name:

   ```bash
   # Example: onboard acme-corp as advanced tier in staging
   cp gitops/application-plane/staging/tier-templates/advanced_tenant_template.yaml \
      gitops/application-plane/staging/tenants/advanced/acme-corp.yaml

   # Replace the TENANT_NAME placeholder throughout the file
   sed -i 's/TENANT_NAME/acme-corp/g' \
      gitops/application-plane/staging/tenants/advanced/acme-corp.yaml
   ```

2. Register it in kustomization:

   ```yaml
   # gitops/application-plane/staging/tenants/advanced/kustomization.yaml
   resources:
     - jenkins.yaml
     - acme-corp.yaml   # ← add this line
   ```

3. Commit and push — ArgoCD auto-syncs the new tenant within seconds.

**Option B — Automated (Argo WorkflowTemplate)**

Requires Argo Workflows and `workflow-rbac.yaml` deployed (bootstrap step 9).

```bash
argo submit -n argo-workflows \
  --from workflowtemplate/tenant-onboarding \
  -p tenant-name=acme-corp \
  -p tier=advanced \
  -p environment=staging \
  --serviceaccount gitops-workflow-sa
```

The workflow validates inputs, generates the manifest from the tier template, commits it to Git, and polls ArgoCD until the Application reaches `Synced + Healthy`.

### Offboarding a Tenant

**Option A — Manual**

1. Remove the tenant YAML file from the tenants directory
2. Remove the entry from `kustomization.yaml`
3. Commit and push — ArgoCD prunes the resources automatically

**Option B — Automated (Argo WorkflowTemplate)**

```bash
argo submit -n argo-workflows \
  --from workflowtemplate/tenant-offboarding \
  -p tenant-name=acme-corp \
  -p tier=advanced \
  -p environment=staging \
  -p skip-backup=false \
  --serviceaccount gitops-workflow-sa
```

The workflow optionally snapshots the tenant PVC before removing the manifest from Git and confirming deletion via ArgoCD.

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
| `ops/jenkins/argocd/jenkins-local.yaml` | `gitops/application-plane/local/tenants/basic/jenkins.yaml` | Aligned to tier model, uses gitops Helm chart |
| `ops/jenkins/argocd/jenkins-staging.yaml` | `gitops/application-plane/staging/tenants/advanced/jenkins.yaml` | Dedicated namespace, sync window enforced |
| `ops/jenkins/argocd/jenkins-production.yaml` | `gitops/application-plane/production/tenants/premium/jenkins.yaml` | Manual sync, premium tier resources |
| `ops/jenkins/helm/` | `gitops/helm-charts/jenkins/` | Thin wrapper with secure base defaults |
| *(not present)* | `gitops/application-plane/*/pooled-envs/pool-1.yaml` | New: shared pool Applications per environment |
| *(not present)* | `gitops/applicationsets/jenkins-appset.yaml` | New: Git file-based auto-discovery |
| *(not present)* | `gitops/control-plane/workflows/` | New: Argo WorkflowTemplates for tenant lifecycle |

### Migration Path

1. Deploy the new `gitops/` structure alongside existing `ops/`
2. Bootstrap ArgoCD using `gitops/bootstrap/`
3. Bootstrap Jenkins pools: `kubectl apply -f gitops/application-plane/${ENVIRONMENT}/pooled-envs/pool-1.yaml`
4. Gradually transition existing ArgoCD Applications to point to `gitops/`
5. Decommission `ops/jenkins/argocd/` manifests once Jenkins is confirmed healthy via `gitops/`
6. Decommission `ops/argocd/` manifests once fully migrated

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
