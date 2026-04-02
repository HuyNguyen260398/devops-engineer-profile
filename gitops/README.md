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
- [kube-prometheus-stack Deployment](#kube-prometheus-stack-deployment)
  - [Components Deployed](#components-deployed)
  - [Deployed Instances (Observability)](#deployed-instances-observability)
  - [Accessing Grafana](#accessing-grafana)
  - [CRD Notes](#crd-notes)
- [ELK Stack Deployment](#elk-stack-deployment)
  - [ELK Components Deployed](#elk-components-deployed)
  - [Deployed Instances (Logging)](#deployed-instances-logging)
  - [Accessing Kibana](#accessing-kibana)
  - [Log Pipeline](#log-pipeline)
  - [Retrieve the Elastic Password](#retrieve-the-elastic-password)
- [AWX Ansible Automation Platform Deployment](#awx-ansible-automation-platform-deployment)
  - [AWX Components Deployed](#awx-components-deployed)
  - [Deployed Instances (AWX)](#deployed-instances-awx)
  - [Accessing AWX](#accessing-awx)
  - [Retrieve the AWX Admin Password](#retrieve-the-awx-admin-password)
  - [AWX CRD Notes](#awx-crd-notes)
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
┌────────────────────────────────────────────────────────────────────────┐
│                        Git Repository                                  │
│  ┌──────────────────────────┐  ┌────────────────────────────────────┐  │
│  │        bootstrap/        │  │        application-plane/          │  │
│  │   ArgoCD + AppProjects   │  │  Infrastructure + Tenant manifests │  │
│  └────────────┬─────────────┘  └──────────────────┬─────────────────┘  │
│               │                                   │                    │
└───────────────┼───────────────────────────────────┼────────────────────┘
                │                                   │
                ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS EKS Cluster                             │
│                                                                     │
│  ┌─────────────────┐                                                │
│  │    ArgoCD       │◄── Reconciles desired state from Git           │
│  │  (GitOps Engine)│                                                │
│  └────────┬────────┘                                                │
│           │                                                         │
│  ┌────────┴──────────────────────────────────────────────────┐      │
│  │  Infrastructure Plane  (sync waves -1 … 1)                │      │
│  │  ┌──────────────────────────────────────────────────┐     │      │
│  │  │  namespace: monitoring                           │     │      │
│  │  │  Prometheus │ Grafana │ Alertmanager             │     │      │
│  │  │  node-exporter                                   │     │      │
│  │  └──────────────────────────────────────────────────┘     │      │
│  │  ┌──────────────────────────────────────────────────┐     │      │
│  │  │  namespace: elastic-system (wave -1)             │     │      │
│  │  │  ECK Operator (manages Elastic CRDs + lifecycle) │     │      │
│  │  └──────────────────────────────────────────────────┘     │      │
│  │  ┌──────────────────────────────────────────────────┐     │      │
│  │  │  namespace: logging (wave 0-1)                   │     │      │
│  │  │  Elasticsearch │ Kibana │ Fluent Bit (DaemonSet) │     │      │
│  │  └──────────────────────────────────────────────────┘     │      │
│  │  ┌──────────────────────────────────────────────────┐     │      │
│  │  │  namespace: awx (wave -1)                        │     │      │
│  │  │  AWX Operator + AWX instance (Web │ Task │ EE)   │     │      │
│  │  │  PostgreSQL │ Redis  (bundled, managed by op.)   │     │      │
│  │  └──────────────────────────────────────────────────┘     │      │
│  └────────┬──────────────────────────────────────────────────┘      │
│  ┌────────┴──────────────────────────────────────────────────┐      │
│  │       Application Plane  (sync waves 2–6)                 │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │      │
│  │  │ pool-1   │  │ tenant-A │  │ tenant-B │  │ tenant-C │   │      │
│  │  │ (basic)  │  │(advanced)│  │(advanced)│  │(premium) │   │      │
│  │  │ shared   │  │ hybrid   │  │ hybrid   │  │ dedicated│   │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
gitops/
├── README.md                              # This file
├── applicationsets/
│   ├── jenkins-appset.yaml                # ApplicationSet: auto-discovers Jenkins tenant YAMLs
│   └── kube-prometheus-stack-appset.yaml  # ApplicationSet: alt. to app-of-apps-infrastructure
├── helm-charts/
│   ├── jenkins/
│   │   ├── Chart.yaml                     # Wrapper chart (upstream jenkins/jenkins:5.8.139)
│   │   └── values.yaml                    # Secure base defaults shared across all tiers
│   ├── kube-prometheus-stack/
│   │   ├── Chart.yaml                     # Wrapper chart (upstream kube-prometheus-stack:67.9.0)
│   │   └── values.yaml                    # Secure base defaults (PSS restricted, EKS-tuned)
│   ├── eck-operator/
│   │   ├── Chart.yaml                     # Wrapper chart (upstream elastic/eck-operator:3.3.1)
│   │   └── values.yaml                    # ECK Operator secure defaults (telemetry off, PSS)
│   ├── eck-stack/
│   │   ├── Chart.yaml                     # Wrapper chart (upstream elastic/eck-stack:0.18.1)
│   │   └── values.yaml                    # Elasticsearch + Kibana base config
│   └── fluent-bit/
│       ├── Chart.yaml                     # Wrapper chart (upstream fluent/fluent-bit:0.49.1)
│       └── values.yaml                    # DaemonSet log pipeline → Elasticsearch
│   └── awx-operator/
│       ├── Chart.yaml                     # Wrapper chart (upstream awx-operator:3.2.1, app 2.19.1)
│       └── values.yaml                    # AWX Operator + AWX CR secure defaults
├── bootstrap/                             # ArgoCD installation and bootstrap
│   ├── argocd/
│   │   ├── namespace.yaml                 # ArgoCD namespace with pod security
│   │   ├── values-base.yaml               # Production-grade base config
│   │   ├── values-aws.yaml                # AWS EKS-specific overrides (IRSA)
│   │   └── values-local.yaml              # Local dev overrides (minikube/kind)
│   ├── app-of-apps.yaml                   # Root Application – watches tenants/ (entry point)
│   ├── app-of-apps-infrastructure.yaml    # Root Application – watches infrastructure/ (all envs)
│   └── projects/
│       ├── infrastructure.yaml            # AppProject for infra components (+ Prometheus CRDs)
│       ├── applications.yaml              # AppProject for app workloads
│       └── tenants.yaml                   # AppProject for tenant-scoped deploys
│
├── application-plane/                     # Tenant deployments by environment
│   ├── production/
│   │   ├── infrastructure/                # Cluster-wide infra components (waves -1 … 1)
│   │   │   ├── kustomization.yaml
│   │   │   ├── kube-prometheus-stack.yaml # Prometheus + Grafana + Alertmanager (30d, HA, gp3)
│   │   │   ├── eck-operator.yaml          # ECK Operator (wave -1, elastic-system namespace)
│   │   │   ├── eck-stack.yaml             # Elasticsearch 3-node HA + Kibana (wave 0, 100Gi)
│   │   │   ├── fluent-bit.yaml            # Fluent Bit DaemonSet → Elasticsearch (wave 1)
│   │   │   └── awx-operator.yaml          # AWX Operator + AWX CR (wave -1, 50Gi gp3)
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
│   │   ├── infrastructure/                # Cluster-wide infra components (waves -1 … 1)
│   │   │   ├── kustomization.yaml
│   │   │   ├── kube-prometheus-stack.yaml # Prometheus + Grafana + Alertmanager (7d, gp3)
│   │   │   ├── eck-operator.yaml          # ECK Operator (wave -1)
│   │   │   ├── eck-stack.yaml             # Elasticsearch 3-node + Kibana (wave 0, 30Gi)
│   │   │   ├── fluent-bit.yaml            # Fluent Bit DaemonSet → Elasticsearch (wave 1)
│   │   │   └── awx-operator.yaml          # AWX Operator + AWX CR (wave -1, 20Gi gp3)
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
│       ├── infrastructure/                # Cluster-wide infra components (waves -1 … 1)
│       │   ├── kustomization.yaml
│       │   ├── kube-prometheus-stack.yaml # Prometheus + Grafana (3d, standard, NodePort 32300)
│       │   ├── eck-operator.yaml          # ECK Operator (wave -1)
│       │   ├── eck-stack.yaml             # Elasticsearch 1-node + Kibana (wave 0, 5Gi standard)
│       │   ├── fluent-bit.yaml            # Fluent Bit DaemonSet → Elasticsearch (wave 1)
│       │   └── awx-operator.yaml          # AWX Operator + AWX CR (wave -1, 8Gi hostpath, NodePort 32080)
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

| Feature           | Basic (Pool)     | Advanced (Hybrid)    | Premium (Silo)                  |
| ----------------- | ---------------- | -------------------- | ------------------------------- |
| **Isolation**     | Shared namespace | Dedicated namespace  | Dedicated namespace + resources |
| **Controller**    | Shared           | Dedicated            | Dedicated HA                    |
| **Agents**        | Shared           | Shared               | Dedicated                       |
| **Resources**     | Minimal          | Moderate (500m-2CPU) | Full (2-8 CPU, 4-8Gi)           |
| **Storage**       | Pool PVC         | 20Gi gp3             | 100Gi gp3                       |
| **Ingress**       | None (via pool)  | ClusterIP            | NLB + TLS Ingress               |
| **Sync Policy**   | Auto             | Auto                 | Manual (safety)                 |
| **Environments**  | All              | Staging, Production  | Production only                 |
| **Notifications** | None             | On failure           | Full (deploy, degrade, fail)    |

**When to use each tier:**

- **Basic:** Development teams, testing workloads, cost-sensitive tenants that can share infrastructure
- **Advanced:** Teams needing a dedicated controller while sharing build agents. Good balance of isolation and cost
- **Premium:** Mission-critical workloads requiring full isolation, HA, custom configuration, and dedicated monitoring

### App-of-Apps Pattern

The bootstrap uses ArgoCD's [App-of-Apps pattern](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/):

```
app-of-apps.yaml (Root – Tenant workloads)      app-of-apps-infrastructure.yaml (Root – Infra)
  └── Watches: .../tenants/                        └── Watches: .../infrastructure/
      ├── basic/  → pool references                    ├── kube-prometheus-stack.yaml
      ├── advanced/ → dedicated controllers             ├── eck-operator.yaml
      └── premium/ → full silo deployments              ├── eck-stack.yaml
                                                        └── fluent-bit.yaml
```

Two root Applications bootstrap the platform:

- **`app-of-apps.yaml`** – Manages multi-tenant application workloads (Jenkins). Adding a new tenant is as simple as committing a YAML to the appropriate tier directory.
- **`app-of-apps-infrastructure.yaml`** – Manages cluster-wide infrastructure components (monitoring, ingress, etc.). Adding a new infrastructure service means adding a YAML to the `infrastructure/` directory.

**Sync wave ordering ensures dependencies are respected:**

| Wave  | Scope                    | Examples                                                                      |
| ----- | ------------------------ | ----------------------------------------------------------------------------- |
| `-1`  | Operator CRDs            | eck-operator (ECK CRDs must precede eck-stack), awx-operator (AWX CRDs)      |
| `0`   | Infrastructure stacks    | kube-prometheus-stack, eck-stack (Elasticsearch + Kibana)                     |
| `1`   | Log collection + pools   | fluent-bit, Jenkins pool-1                                                    |
| `2–4` | Basic / Advanced tenants | Jenkins basic, advanced                                                       |
| `5`   | Premium tenants          | Jenkins premium                                                               |

---

## Getting Started

### Prerequisites

| Tool       | Version | Purpose                      |
| ---------- | ------- | ---------------------------- |
| AWS CLI    | >= 2.x  | AWS authentication           |
| kubectl    | >= 1.29 | Kubernetes management        |
| Helm       | >= 3.14 | Chart management             |
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

4. **Apply the App-of-Apps (tenants and infrastructure):**

   ```bash
   # Substitute environment variables and apply both root Applications
   envsubst < gitops/bootstrap/app-of-apps.yaml | kubectl apply -f -
   envsubst < gitops/bootstrap/app-of-apps-infrastructure.yaml | kubectl apply -f -
   ```

5. **Apply ArgoCD projects:**

   ```bash
   kubectl apply -f gitops/bootstrap/projects/
   ```

6. **Verify ArgoCD Applications:**

   ```bash
   kubectl get applications -n argocd
   kubectl get pods -n argocd
   # Verify infrastructure (Prometheus / Grafana / Alertmanager become ready first – wave 0)
   kubectl get pods -n monitoring
   ```

7. **Bootstrap Jenkins shared pools** (pooled-envs are outside the app-of-apps watch path and must be applied once manually):

   ```bash
   kubectl apply -f gitops/application-plane/${ENVIRONMENT}/pooled-envs/pool-1.yaml
   ```

8. **(Optional) Deploy ApplicationSets** for Git file-based auto-discovery.
   > **Important:** Use EITHER the app-of-apps approach OR ApplicationSets — not both simultaneously, as they would create duplicate Application names.

   ```bash
   kubectl apply -f gitops/applicationsets/jenkins-appset.yaml
   kubectl apply -f gitops/applicationsets/kube-prometheus-stack-appset.yaml
   ```

9. **(Optional) Deploy Argo Workflows RBAC and WorkflowTemplates:**

   ```bash
   kubectl apply -f gitops/control-plane/rbac/workflow-rbac.yaml
   kubectl apply -f gitops/control-plane/workflows/
   ```

---

## Jenkins Deployment

Jenkins is the first application deployed on this platform, using the multi-tenant tier model. It is managed entirely through ArgoCD — no manual `helm install` required after bootstrap.

### Deployed Instances

| ArgoCD Application           | Tier     | Environment | Namespace               | Sync           | Storage      |
| ---------------------------- | -------- | ----------- | ----------------------- | -------------- | ------------ |
| `jenkins-pool-1-local`       | basic    | local       | `pool-1-local`          | Auto           | 8Gi standard |
| `jenkins-pool-1-staging`     | basic    | staging     | `pool-1-staging`        | Auto           | 20Gi gp3     |
| `jenkins-pool-1-production`  | basic    | production  | `pool-1-production`     | Auto           | 20Gi gp3     |
| `jenkins-basic-local`        | basic    | local       | `pool-1-local` (shared) | Auto           | —            |
| `jenkins-advanced-staging`   | advanced | staging     | `jenkins-staging`       | Auto (Mon–Fri) | 20Gi gp3     |
| `jenkins-premium-production` | premium  | production  | `jenkins-production`    | **Manual**     | 100Gi gp3    |

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

## kube-prometheus-stack Deployment

`kube-prometheus-stack` is the platform's cluster observability stack, deployed as shared infrastructure (not multi-tenant). It is managed by the `infrastructure` AppProject and runs in the dedicated `monitoring` namespace at **sync wave 0** — before any application workloads.

### Components Deployed

| Component               | Purpose                                       | Default Port |
| ----------------------- | --------------------------------------------- | ------------ |
| **Prometheus**          | Metrics scraping and alerting rule evaluation | 9090         |
| **Grafana**             | Dashboards and visualisation                  | 3000         |
| **Alertmanager**        | Alert routing (Slack / PagerDuty)             | 9093         |
| **node-exporter**       | Host hardware and OS metrics (DaemonSet)      | 9100         |
| **kube-state-metrics**  | Kubernetes object state metrics               | 8080         |
| **Prometheus Operator** | Manages Prometheus/Alertmanager CRDs          | —            |

### Deployed Instances (Observability)

| ArgoCD Application                 | Environment | Namespace    | Prometheus Retention | Storage      | Grafana Access      | Sync            |
| ---------------------------------- | ----------- | ------------ | -------------------- | ------------ | ------------------- | --------------- |
| `kube-prometheus-stack-local`      | local       | `monitoring` | 3d                   | 5Gi standard | NodePort 32300      | Auto            |
| `kube-prometheus-stack-staging`    | staging     | `monitoring` | 7d                   | 20Gi gp3     | ClusterIP / Ingress | Auto            |
| `kube-prometheus-stack-production` | production  | `monitoring` | 30d                  | 50Gi gp3     | ClusterIP / Ingress | Auto (no prune) |

Production Alertmanager runs 2 replicas for high availability. Production sync never auto-prunes (`prune: false`) to prevent accidental deletion of monitoring infrastructure.

### Accessing Grafana

**Local (NodePort):**
```bash
open http://localhost:32300
# username: admin  |  password: admin  (local dev only – change for staging/production)
```

**Staging / Production (port-forward):**
```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
open http://localhost:3000
```

### Adding a Custom ServiceMonitor

Prometheus discovers `ServiceMonitor` resources across all namespaces (no selector restriction). Commit a manifest to your application namespace:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-service
  namespace: my-app-namespace
spec:
  selector:
    matchLabels:
      app: my-service
  endpoints:
    - port: metrics
      path: /metrics
      interval: 30s
```

### Jenkins + Prometheus Integration

The Jenkins Helm chart includes the `prometheus:latest` plugin by default. Add a `ServiceMonitor` in the Jenkins namespace to enable scraping:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: jenkins
  namespace: pool-1-local   # Adjust per environment / tier
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: jenkins-controller
  endpoints:
    - port: http
      path: /prometheus
      interval: 30s
```

### CRD Notes

`kube-prometheus-stack` installs ~10 large CRDs. All Application manifests include:

```yaml
syncOptions:
  - ServerSideApply=true
  - Replace=true   # REQUIRED – CRD annotations exceed the 262 KiB kubectl annotation limit
```

Without `Replace=true`, ArgoCD sync will fail with:
`metadata.annotations: Too long: must have at most 262144 bytes`

---

## ELK Stack Deployment

The ELK stack provides cluster-wide log aggregation and search. It is managed by the `infrastructure` AppProject across three dedicated namespaces using the [Elastic Cloud on Kubernetes (ECK)](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html) operator.

> **Deploy order:** ECK Operator (wave -1) → Elasticsearch + Kibana (wave 0) → Fluent Bit (wave 1). This is enforced automatically by ArgoCD sync-wave annotations.

### ELK Components Deployed

| Component         | Chart                        | Purpose                                      | Namespace        |
| ----------------- | ---------------------------- | -------------------------------------------- | ---------------- |
| **ECK Operator**  | `elastic/eck-operator:3.3.1` | Manages all Elastic CRDs and stack lifecycle | `elastic-system` |
| **Elasticsearch** | `elastic/eck-stack:0.18.1`   | Distributed log index and search engine      | `logging`        |
| **Kibana**        | `elastic/eck-stack:0.18.1`   | Log search, dashboards, and Discover UI      | `logging`        |
| **Fluent Bit**    | `fluent/fluent-bit:0.49.1`   | DaemonSet log collection from all nodes      | `logging`        |

Logstash is **not used** — Fluent Bit ships logs directly to Elasticsearch with Kubernetes metadata enrichment, reducing resource overhead.

### Deployed Instances (Logging)

| ArgoCD Application        | Environment | ES Nodes | ES Storage    | Kibana Replicas | Kibana Access       | Sync            |
| ------------------------- | ----------- | -------- | ------------- | --------------- | ------------------- | --------------- |
| `eck-operator-local`      | local       | —        | —             | —               | —                   | Auto            |
| `eck-stack-local`         | local       | 1        | 5Gi standard  | 1               | NodePort 32601      | Auto            |
| `fluent-bit-local`        | local       | —        | —             | —               | —                   | Auto            |
| `eck-operator-staging`    | staging     | —        | —             | —               | —                   | Auto            |
| `eck-stack-staging`       | staging     | 3        | 30Gi gp3 × 3  | 2               | ClusterIP / Ingress | Auto            |
| `fluent-bit-staging`      | staging     | —        | —             | —               | —                   | Auto            |
| `eck-operator-production` | production  | —        | —             | —               | —                   | Auto (no prune) |
| `eck-stack-production`    | production  | 3        | 100Gi gp3 × 3 | 2               | ClusterIP / Ingress | Auto (no prune) |
| `fluent-bit-production`   | production  | —        | —             | —               | —                   | Auto (no prune) |

Production sync never auto-prunes (`prune: false`) to prevent accidental deletion of log data.

### Accessing Kibana

**Local (NodePort — HTTPS with self-signed cert):**
```bash
# Accept the self-signed certificate in your browser
open https://localhost:32601
# OR via minikube:
open https://$(minikube ip):32601
```

**Staging / Production (port-forward):**
```bash
kubectl port-forward -n logging svc/kibana-kb-http 5601:5601
open https://localhost:5601
```

### Retrieve the Elastic Password

ECK generates a random password for the `elastic` superuser and stores it in a Kubernetes Secret. Retrieve it with:

```bash
# Local
kubectl get secret elasticsearch-es-elastic-user -n logging \
  -o jsonpath='{.data.elastic}' | base64 -d && echo
```

Login with username `elastic` and the retrieved password.

> [!WARNING]
> For staging and production, rotate the `elastic` password and restrict access using [Elasticsearch native realm users](https://www.elastic.co/guide/en/elasticsearch/reference/current/native-realm.html). Never use the `elastic` superuser for application access.

### Log Pipeline

Fluent Bit collects logs from every node and enriches them with Kubernetes metadata before forwarding to Elasticsearch:

```
/var/log/pods/**/*.log
  → [INPUT: tail]              (multiline Docker/CRI format)
  → [FILTER: kubernetes]       (enriches: namespace, pod, labels, container)
  → [FILTER: modify]           (removes noisy annotation fields)
  → [OUTPUT: elasticsearch]    (index: kube.<namespace>.<date>, TLS enabled)
```

The Fluent Bit `ServiceMonitor` exposes metrics on port `2020/api/v1/metrics/prometheus`, auto-scraped by Prometheus from the `logging` namespace.

### Fluent Bit + Prometheus Integration

Fluent Bit metrics (input records, output retries, dropped records) are scraped by Prometheus automatically via the `ServiceMonitor` resource it deploys. Add a Grafana dashboard for Fluent Bit observability using the [Fluent Bit dashboard](https://grafana.com/grafana/dashboards/7752).

---

## AWX Ansible Automation Platform Deployment

AWX is the open-source upstream project of Red Hat Ansible Automation Platform. It provides a web-based UI, REST API, and task engine for managing Ansible playbooks and inventories at scale. It is managed by the `infrastructure` AppProject and runs in the dedicated `awx` namespace at **sync wave -1** — the same wave as the ECK operator, because it installs CRDs before the AWX Controller reconciles the AWX Custom Resource.

> **Deploy order:** AWX Operator installs CRDs + controller + AWX CR (all in wave -1). The operator reconciles the AWX CR to provision the full AWX stack (web, task, EE, PostgreSQL, Redis).

### AWX Components Deployed

| Component              | Purpose                                                        | Namespace |
| ---------------------- | -------------------------------------------------------------- | --------- |
| **AWX Operator**       | Manages AWX CRDs and full stack lifecycle                      | `awx`     |
| **AWX Web**            | Django + nginx web UI and REST API                             | `awx`     |
| **AWX Task Runner**    | Celery workers — runs playbooks and workflow jobs              | `awx`     |
| **AWX EE Container**   | Execution Environment — ansible-runner with bundled collections| `awx`     |
| **PostgreSQL**         | Bundled relational DB for AWX job history, credentials, etc.   | `awx`     |
| **Redis**              | Bundled session store and job queue message broker             | `awx`     |

### Deployed Instances (AWX)

| ArgoCD Application       | Environment | Namespace | Postgres Storage | AWX UI Access       | Sync            |
| ------------------------ | ----------- | --------- | ---------------- | ------------------- | --------------- |
| `awx-operator-local`     | local       | `awx`     | 8Gi hostpath     | NodePort 32080      | Auto            |
| `awx-operator-staging`   | staging     | `awx`     | 20Gi gp3         | ClusterIP / Ingress | Auto            |
| `awx-operator-production`| production  | `awx`     | 50Gi gp3         | ClusterIP / Ingress | Auto (no prune) |

Production sync never auto-prunes (`prune: false`) to prevent accidental deletion of AWX job history, credentials, and inventories.

### Accessing AWX

**Local (NodePort):**
```bash
open http://localhost:32080
# username: admin  |  retrieve password: see section below
```

**Staging / Production (port-forward):**
```bash
kubectl port-forward -n awx svc/awx-service 8080:80
open http://localhost:8080
```

> **Note:** The AWX Operator may take 3–5 minutes after ArgoCD sync to fully provision the AWX stack. Monitor progress with:
> ```bash
> kubectl get pods -n awx -w
> kubectl logs -n awx -l app.kubernetes.io/name=awx -f
> ```

### Retrieve the AWX Admin Password

The AWX Operator generates an admin password and stores it in a Kubernetes Secret. Retrieve it with:

```bash
# Local / Staging / Production
kubectl get secret awx-admin-password -n awx \
  -o jsonpath='{.data.password}' | base64 -d && echo
```

Login with username `admin` and the retrieved password.

> [!WARNING]
> For staging and production, rotate the admin password after first login and manage it via [External Secrets Operator](https://external-secrets.io/) with AWS Secrets Manager. Never use the default auto-generated password for long-lived production deployments.

### AWX CRD Notes

The AWX Operator chart installs three CRDs (`awx.ansible.com`, `awxbackups.ansible.com`, `awxrestores.ansible.com`). All AWX Application manifests include:

```yaml
syncOptions:
  - ServerSideApply=true
  - Replace=true   # Guards against annotation size limit errors on CRD updates
```

When upgrading AWX Operator across versions with CRD changes, manually refresh the CRDs first:

```bash
kubectl apply --server-side -k github.com/ansible/awx-operator/config/crd?ref=<VERSION>
# If conflict errors occur, add: --force-conflicts
```

---

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

| Environment    | Cluster           | Tiers Available          | Sync Policy | Notes                              |
| -------------- | ----------------- | ------------------------ | ----------- | ---------------------------------- |
| **local**      | minikube/kind/k3s | Basic only               | Auto        | Minimal resources, NodePort access |
| **staging**    | EKS (staging)     | Basic, Advanced          | Auto        | Pre-production validation          |
| **production** | EKS (production)  | Basic, Advanced, Premium | Mixed*      | Full isolation, HA, monitoring     |

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

### Deployed Observability Stack

`kube-prometheus-stack` provides full cluster observability and is deployed via GitOps (see [kube-prometheus-stack Deployment](#kube-prometheus-stack-deployment) above).

| Component          | Tool                                            | Status                         |
| ------------------ | ----------------------------------------------- | ------------------------------ |
| Metrics collection | Prometheus + kube-state-metrics + node-exporter | ✅ Deployed via GitOps          |
| Visualisation      | Grafana (pre-built Kubernetes dashboards)       | ✅ Deployed via GitOps          |
| Alerting           | Alertmanager + Slack + PagerDuty                | ✅ Deployed via GitOps          |
| Logging            | Fluent Bit → Elasticsearch + Kibana (ECK)       | ✅ Deployed via GitOps          |
| Automation         | AWX Ansible Automation Platform                 | ✅ Deployed via GitOps          |
| Tracing            | OpenTelemetry → Jaeger                          | Recommended (not yet deployed) |

### Built-in ArgoCD Metrics

- **ArgoCD metrics:** Exposed on `:8083/metrics` (Prometheus format) — auto-scraped by Prometheus via ServiceMonitor
- **Application health:** ArgoCD tracks sync status and health for every Application

### Key Alerts Configured

The following alerts are enabled via `defaultRules` in the base `values.yaml`:

- `KubePodCrashLooping` – Pod restart count elevated
- `KubePodNotReady` – Pod not ready for > 15 minutes
- `KubeDeploymentReplicasMismatch` – Deployment replicas below desired
- `KubePersistentVolumeFillingUp` – PVC > 85% full
- `NodeHighCPUUtilization` / `NodeHighMemoryUtilization` – Node resource pressure
- `TargetDown` – Scrape target unreachable

---

## Relationship to Existing ops/ Directory

This `gitops/` directory is the **recommended successor** to the existing `ops/` directory structure. Here is how the components map:

| Existing (`ops/`)                            | New (`gitops/`)                                                    | Notes                                              |
| -------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `ops/argocd/`                                | `gitops/bootstrap/argocd/`                                         | Enhanced with multi-env values and RBAC            |
| `ops/argocd/manifests/app-of-apps.yaml`      | `gitops/bootstrap/app-of-apps.yaml`                                | Parameterized with envsubst                        |
| `ops/argocd/manifests/projects/`             | `gitops/bootstrap/projects/`                                       | Added `tenants` project                            |
| `ops/jenkins/argocd/jenkins-local.yaml`      | `gitops/application-plane/local/tenants/basic/jenkins.yaml`        | Aligned to tier model, uses gitops Helm chart      |
| `ops/jenkins/argocd/jenkins-staging.yaml`    | `gitops/application-plane/staging/tenants/advanced/jenkins.yaml`   | Dedicated namespace, sync window enforced          |
| `ops/jenkins/argocd/jenkins-production.yaml` | `gitops/application-plane/production/tenants/premium/jenkins.yaml` | Manual sync, premium tier resources                |
| `ops/jenkins/helm/`                          | `gitops/helm-charts/jenkins/`                                      | Thin wrapper with secure base defaults             |
| *(not present)*                              | `gitops/helm-charts/kube-prometheus-stack/`                        | New: kube-prometheus-stack Helm wrapper            |
| *(not present)*                              | `gitops/application-plane/*/infrastructure/`                       | New: per-env infrastructure Application manifests  |
| *(not present)*                              | `gitops/bootstrap/app-of-apps-infrastructure.yaml`                 | New: root Application for infrastructure discovery |
| *(not present)*                              | `gitops/applicationsets/kube-prometheus-stack-appset.yaml`         | New: ApplicationSet alt. for infrastructure        |
| *(not present)*                              | `gitops/application-plane/*/pooled-envs/pool-1.yaml`               | New: shared pool Applications per environment      |
| *(not present)*                              | `gitops/applicationsets/jenkins-appset.yaml`                       | New: Git file-based auto-discovery                 |
| *(not present)*                              | `gitops/control-plane/workflows/`                                  | New: Argo WorkflowTemplates for tenant lifecycle   |
| *(not present)*                              | `gitops/helm-charts/awx-operator/`                                 | New: AWX Operator + AWX CR Helm wrapper            |
| *(not present)*                              | `gitops/application-plane/*/infrastructure/awx-operator.yaml`      | New: AWX Application manifests per environment     |

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
- [kube-prometheus-stack ArtifactHub](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack)
- [Prometheus Operator Documentation](https://prometheus-operator.dev/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Elastic Cloud on Kubernetes (ECK) Documentation](https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html)
- [ECK Operator ArtifactHub](https://artifacthub.io/packages/helm/elastic/eck-operator)
- [ECK Stack ArtifactHub](https://artifacthub.io/packages/helm/elastic/eck-stack)
- [Fluent Bit Documentation](https://docs.fluentbit.io/manual/)
- [Fluent Bit ArtifactHub](https://artifacthub.io/packages/helm/fluent/fluent-bit)
- [AWX Operator Documentation](https://github.com/ansible/awx-operator/blob/devel/README.md)
- [AWX Operator Helm Chart ArtifactHub](https://artifacthub.io/packages/helm/awx-operator-helm/awx-operator)
- [AWX Operator Helm Install Guide](https://docs.ansible.com/projects/awx-operator-helm/helm-install-on-existing-cluster.html)
- [AWX Operator Helm Chart GitHub](https://github.com/ansible-community/awx-operator-helm)

---

## License

This project is licensed under the same terms as the parent repository. See the root [LICENSE](../LICENSE) file.
