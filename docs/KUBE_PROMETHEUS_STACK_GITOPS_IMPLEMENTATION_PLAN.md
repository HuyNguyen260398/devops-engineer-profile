# kube-prometheus-stack GitOps Implementation Plan

**Created:** March 10, 2026
**Status:** Planning
**Author:** DevOps Platform Team

---

## Overview

This document outlines the step-by-step implementation plan to add `kube-prometheus-stack` as the second service in the GitOps platform, following the same architectural patterns established for Jenkins.

### Why kube-prometheus-stack is Different from Jenkins

| Aspect | Jenkins | kube-prometheus-stack |
|---|---|---|
| ArgoCD Project | `applications` | `infrastructure` |
| Deployment Model | Multi-tenant (basic/advanced/premium tiers) | Single instance per cluster/environment |
| Namespace | `pool-*` / dedicated per tenant | `monitoring` (cluster-wide) |
| Instance Count | Many (one per tenant) | One (per environment) |
| Application Plane Path | `tenants/{tier}/` | `infrastructure/` |
| Discovery via App-of-Apps | `tenants/kustomization.yaml` | New `infrastructure/kustomization.yaml` |

Since `kube-prometheus-stack` is **cluster-level infrastructure** (observability platform), it:
- Belongs to the `infrastructure` AppProject (already has `monitoring` namespace destination)
- Is deployed **once per environment**, not per-tenant
- Requires CRD lifecycle management (`ServerSideApply`, `Replace` policy)
- Introduces a new `infrastructure/` sub-directory pattern under each environment

---

## Architecture: New Directory Structure After Implementation

```
gitops/
├── applicationsets/
│   ├── jenkins-appset.yaml                   ✅ (existing)
│   └── kube-prometheus-stack-appset.yaml     🆕 Task 5.1
│
├── bootstrap/
│   ├── app-of-apps.yaml                      ✅ (existing – watches tenants/)
│   ├── app-of-apps-infrastructure.yaml       🆕 Task 4.1
│   └── projects/
│       ├── applications.yaml                 ✅ (existing)
│       └── infrastructure.yaml              ✏️  Task 2.1 (add Prometheus CRDs)
│
├── helm-charts/
│   ├── jenkins/                              ✅ (existing)
│   └── kube-prometheus-stack/               🆕 Phase 1
│       ├── Chart.yaml
│       └── values.yaml
│
└── application-plane/
    ├── local/
    │   ├── infrastructure/                   🆕 Phase 3
    │   │   ├── kube-prometheus-stack.yaml
    │   │   └── kustomization.yaml
    │   ├── pooled-envs/                      ✅ (existing)
    │   ├── tenants/                          ✅ (existing)
    │   └── tier-templates/                   ✅ (existing)
    ├── staging/
    │   └── infrastructure/                   🆕 Phase 3
    │       ├── kube-prometheus-stack.yaml
    │       └── kustomization.yaml
    └── production/
        └── infrastructure/                   🆕 Phase 3
            ├── kube-prometheus-stack.yaml
            └── kustomization.yaml
```

---

## Implementation Phases

---

### Phase 1 – Helm Chart Wrapper

**Goal:** Create a thin wrapper Helm chart around the upstream `prometheus-community/kube-prometheus-stack` chart, establishing secure base defaults shared across all environments.

**Reference:** [ArtifactHub – kube-prometheus-stack](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack)

#### Task 1.1 – Create `gitops/helm-charts/kube-prometheus-stack/Chart.yaml`

- [ ] Create the `Chart.yaml` with:
  - `apiVersion: v2`
  - `name: kube-prometheus-stack`
  - `type: application`
  - `version: 1.0.0` (wrapper version)
  - `appVersion` matching the upstream Prometheus Operator version
  - `dependencies` block pointing to `prometheus-community/kube-prometheus-stack`
  - `repository: https://prometheus-community.github.io/helm-charts`

**Key decisions:**
- Pin a specific upstream chart version (e.g., `70.x.x`) to avoid surprise upgrades
- Include the upstream repository URL so `helm dependency update` works in CI

#### Task 1.2 – Create `gitops/helm-charts/kube-prometheus-stack/values.yaml`

- [ ] Create the base `values.yaml` with the following security and operational defaults:

**Security defaults (Kubernetes Pod Security Standards `restricted`):**
```yaml
kube-prometheus-stack:
  prometheusOperator:
    securityContext:
      runAsNonRoot: true
      runAsUser: 65534  # nobody
      fsGroup: 65534
      seccompProfile:
        type: RuntimeDefault
    containerSecurityContext:
      runAsNonRoot: true
      runAsUser: 65534
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: [ALL]

  prometheus:
    prometheusSpec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65534
        fsGroup: 65534
      retention: "15d"           # base retention – overridden per env
      scrapeInterval: "30s"
      evaluationInterval: "30s"

  grafana:
    securityContext:
      runAsNonRoot: true
      runAsUser: 472
    containerSecurityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: false  # Grafana requires writable dirs
      capabilities:
        drop: [ALL]

  alertmanager:
    alertmanagerSpec:
      securityContext:
        runAsNonRoot: true
```

**Resource defaults (base tier – overridden per environment):**
- `prometheusOperator`: 100m–200m CPU, 128Mi–256Mi memory
- `prometheus`: 200m–500m CPU, 512Mi–1Gi memory
- `grafana`: 100m–200m CPU, 128Mi–256Mi memory
- `alertmanager`: 50m–100m CPU, 64Mi–128Mi memory

**Storage defaults:**
- `prometheus.prometheusSpec.storageSpec` – dynamic PVC (overridden per env with `storageClass`)
- Base size: `20Gi` (overridden per environment)

**ServiceMonitor defaults:**
- Enable self-monitoring: `prometheus.serviceMonitor.selfMonitor: true`
- ArgoCD ServiceMonitor: reference if ArgoCD metrics are already exposed

---

### Phase 2 – ArgoCD Infrastructure Project Update

**Goal:** Update the existing `infrastructure` AppProject to allow the additional Kubernetes resource types introduced by `kube-prometheus-stack` CRDs.

#### Task 2.1 – Update `gitops/bootstrap/projects/infrastructure.yaml`

- [ ] Add the following additional entries to `clusterResourceWhitelist`:
  ```yaml
  - group: monitoring.coreos.com
    kind: PrometheusRule
  - group: monitoring.coreos.com
    kind: ServiceMonitor
  - group: monitoring.coreos.com
    kind: PodMonitor
  - group: monitoring.coreos.com
    kind: Probe
  - group: monitoring.coreos.com
    kind: AlertmanagerConfig
  - group: monitoring.coreos.com
    kind: Prometheus
  - group: monitoring.coreos.com
    kind: Alertmanager
  - group: monitoring.coreos.com
    kind: PrometheusAgent
  - group: admissionregistration.k8s.io
    kind: ValidatingWebhookConfiguration
  - group: admissionregistration.k8s.io
    kind: MutatingWebhookConfiguration
  ```

- [ ] Verify the `monitoring` namespace is already listed under `destinations` (it is – confirmed in existing file)

**Why:** `kube-prometheus-stack` installs CRDs (`ServiceMonitor`, `PrometheusRule`, etc.) and creates webhook configurations. These must be explicitly allowed in the AppProject's resource whitelist for ArgoCD to manage them.

---

### Phase 3 – Application Plane: Per-Environment Application Definitions

**Goal:** Create ArgoCD `Application` manifests for each environment, wired to the `infrastructure` AppProject, deployed in the `monitoring` namespace, with environment-specific overrides.

**Pattern:** Each environment gets its own subdirectory `infrastructure/` alongside the existing `tenants/`, `pooled-envs/`, `tier-templates/` directories.

---

#### Task 3.1 – Create `gitops/application-plane/local/infrastructure/kube-prometheus-stack.yaml`

- [ ] Create the ArgoCD `Application` for the **local** environment with:
  - `metadata.name: kube-prometheus-stack-local`
  - `spec.project: infrastructure`
  - `spec.source.path: gitops/helm-charts/kube-prometheus-stack`
  - `spec.destination.namespace: monitoring`
  - Sync options including `ServerSideApply=true` and `Replace=true` for CRD management
  - `argocd.argoproj.io/sync-wave: "0"` (deploy before tenant applications)
  - Local-specific overrides:
    - `storageClass: standard` (minikube/kind default)
    - Reduced resources (local dev sizing)
    - `grafana.service.type: NodePort` with a dedicated port
    - Disabled Alertmanager or minimal config
    - `prometheus.prometheusSpec.retention: 3d` (shorter for local)

**Sync policy for local:**
```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
    - CreateNamespace=true
    - ServerSideApply=true
    - Replace=true           # Required for CRD upgrades
    - ApplyOutOfSyncOnly=true
```

**Important:** `Replace=true` is required because kube-prometheus-stack CRDs are too large for `kubectl apply` (annotation size limit).

---

#### Task 3.2 – Create `gitops/application-plane/local/infrastructure/kustomization.yaml`

- [ ] Create:
  ```yaml
  apiVersion: kustomize.config.k8s.io/v1beta1
  kind: Kustomization
  resources:
    - kube-prometheus-stack.yaml
  ```
  This allows the app-of-apps (bootstrap) to discover infrastructure apps via Kustomize.

---

#### Task 3.3 – Create `gitops/application-plane/staging/infrastructure/kube-prometheus-stack.yaml`

- [ ] Create the ArgoCD `Application` for the **staging** environment with:
  - `metadata.name: kube-prometheus-stack-staging`
  - `spec.project: infrastructure`
  - Staging-specific overrides:
    - `storageClass: gp3` (AWS EKS)
    - Medium resources (balanced for staging workloads)
    - `grafana.service.type: ClusterIP` (exposed via Ingress/ALB)
    - `prometheus.prometheusSpec.retention: 7d`
    - Alertmanager with staging notification routes (e.g., non-critical Slack channel)

---

#### Task 3.4 – Create `gitops/application-plane/staging/infrastructure/kustomization.yaml`

- [ ] Same pattern as Task 3.2 with `resources: - kube-prometheus-stack.yaml`

---

#### Task 3.5 – Create `gitops/application-plane/production/infrastructure/kube-prometheus-stack.yaml`

- [ ] Create the ArgoCD `Application` for the **production** environment with:
  - `metadata.name: kube-prometheus-stack-production`
  - `spec.project: infrastructure`
  - `syncPolicy.automated.prune: false` (manual prune in production for safety)
  - Production-specific overrides:
    - `storageClass: gp3` (AWS EKS)
    - Large resources (production SLA sizing)
    - `prometheus.prometheusSpec.retention: 30d`
    - Alertmanager with PagerDuty/OpsGenie production routes
    - `grafana.persistence.size: 20Gi`
    - ArgoCD notifications annotations for sync failures:
      ```yaml
      annotations:
        notifications.argoproj.io/subscribe.on-sync-failed.slack: devops-alerts
        notifications.argoproj.io/subscribe.on-health-degraded.slack: devops-alerts
      ```

---

#### Task 3.6 – Create `gitops/application-plane/production/infrastructure/kustomization.yaml`

- [ ] Same pattern as Task 3.2.

---

### Phase 4 – Bootstrap: Infrastructure App-of-Apps

**Goal:** Enable ArgoCD to auto-discover and manage the new `infrastructure/` Application manifests, following the same App-of-Apps pattern used for tenant applications.

#### Task 4.1 – Create `gitops/bootstrap/app-of-apps-infrastructure.yaml`

- [ ] Create a new root bootstrap Application (one per environment, or parameterized with `envsubst`) that watches:
  ```
  path: gitops/application-plane/local/infrastructure
  ```
  - `metadata.name: app-of-apps-infrastructure-local`
  - `spec.project: default` (same as existing app-of-apps)
  - `spec.destination.namespace: argocd`
  - Automated sync with `selfHeal: true`
  - Mirrors the structure of the existing `app-of-apps.yaml` but points to `infrastructure/` path

**Why separate from existing app-of-apps:** The existing `app-of-apps.yaml` watches `gitops/application-plane/local/tenants` in Kustomize mode. Rather than modifying the existing bootstrap file (which could disrupt tenant discovery), a dedicated infrastructure app-of-apps keeps concerns separated and makes rollout order explicit.

**Apply order during cluster bootstrap:**
```
# Wave 0: Bootstrap ArgoCD projects and infrastructure apps-of-apps FIRST
kubectl apply -f gitops/bootstrap/projects/
kubectl apply -f gitops/bootstrap/app-of-apps.yaml
kubectl apply -f gitops/bootstrap/app-of-apps-infrastructure.yaml
```

---

### Phase 5 – ApplicationSet

**Goal:** Create an ApplicationSet for `kube-prometheus-stack` following the same Git file generator pattern as `jenkins-appset.yaml`. This is a complementary/alternative discovery mechanism to the app-of-apps approach.

#### Task 5.1 – Create `gitops/applicationsets/kube-prometheus-stack-appset.yaml`

- [ ] Create the ApplicationSet with:
  - `metadata.name: kube-prometheus-stack-appset`
  - `spec.project: infrastructure`
  - Git file generators watching:
    - `gitops/application-plane/production/infrastructure/*.yaml`
    - `gitops/application-plane/staging/infrastructure/*.yaml`
    - `gitops/application-plane/local/infrastructure/*.yaml`
  - Template generating Applications from discovered YAML files
  - Sync-wave annotation support from template metadata

**Difference from Jenkins ApplicationSet:**
- Jenkins AppSet watches `tenants/{tier}/*.yaml` (many files per env, one per tenant)
- kube-prometheus-stack AppSet watches `infrastructure/*.yaml` (typically one file per env)
- No tier-based matrix – single deployment per environment

**Generator path pattern:**
```yaml
generators:
  - git:
      repoURL: https://github.com/HuyNguyen260398/devops-engineer-profile.git
      revision: main
      files:
        - path: gitops/application-plane/production/infrastructure/*.yaml
  - git:
      ...
      files:
        - path: gitops/application-plane/staging/infrastructure/*.yaml
  - git:
      ...
      files:
        - path: gitops/application-plane/local/infrastructure/*.yaml
```

---

### Phase 6 – Documentation

#### Task 6.1 – Update `gitops/README.md`

- [ ] Add a new **kube-prometheus-stack Deployment** section covering:
  - Purpose and what components are deployed (Prometheus, Grafana, Alertmanager, node-exporter, kube-state-metrics)
  - Namespace layout: all environments deploy to `monitoring`
  - Environment-specific differences (retention, resources, Alertmanager routes)
  - How to access Grafana per environment (NodePort local, Ingress staging/production)
  - How to add custom `ServiceMonitor` or `PrometheusRule` resources

- [ ] Update the **Directory Structure** section to include the new `infrastructure/` sub-directories

- [ ] Update the **Monitoring and Observability** section with deployment status

#### Task 6.2 – Update `doc/TODO.md`

- [ ] Mark the existing TODO as in-progress:
  ```
  🔄 Add Terraform configuration for Prometheus and Grafana monitoring AWS EKS
  ```
  (Note: This GitOps implementation deploys via ArgoCD/Helm. Terraform provisioning of the EKS cluster resources remains separate.)

- [ ] Add new completed items for the GitOps implementation

---

## Implementation Order and Dependencies

```
Phase 1  ──────────────────────────────────────────────────────┐
(Helm chart wrapper: Chart.yaml + values.yaml)                  │
          │                                                      │
          ▼                                                      │
Phase 2                                                          │
(Update infrastructure AppProject CRD whitelist)               │
          │                                                      │
          ▼                                                      ▼
Phase 3  (Application manifests per environment) ────────▶  Phase 5
(local + staging + production Application YAMLs)             (ApplicationSet)
          │
          ▼
Phase 4
(Infrastructure App-of-Apps bootstrap)
          │
          ▼
Phase 6
(Documentation updates)
```

**Phases 1 and 2** can be worked on in parallel.
**Phase 3** depends on Phase 1 (Chart path must exist) and Phase 2 (project must allow resources).
**Phase 4 and 5** can be worked on in parallel after Phase 3.
**Phase 6** should be the final step.

---

## Key Implementation Notes

### CRD Management

`kube-prometheus-stack` installs ~10 CRDs (`Prometheus`, `Alertmanager`, `ServiceMonitor`, `PodMonitor`, `PrometheusRule`, etc.). These require special handling:

- Add `Replace=true` to `syncOptions` – CRD annotations hit the 262,144 byte limit with `kubectl apply`
- CRDs are cluster-scoped, requiring `clusterResourceWhitelist` entries in the AppProject
- On **upgrades**, CRDs must be updated before operator deployment; use `argocd.argoproj.io/sync-wave: "-1"` for CRD-only Applications if needed

### Sync Wave Order

Following the existing wave convention used for Jenkins:

| Wave | What is deployed |
|---|---|
| `-1` | CRDs only (if managing separately) |
| `0` | `kube-prometheus-stack` (infrastructure) |
| `1` | Jenkins pool environments (pooled-envs) |
| `2` | Jenkins tenant applications |

### Storage Class per Environment

| Environment | storageClass | Reason |
|---|---|---|
| local | `standard` | minikube/kind default |
| staging | `gp3` | AWS EKS gp3 |
| production | `gp3` | AWS EKS gp3 with `volumeBindingMode: WaitForFirstConsumer` |

### Grafana Admin Password

The default Grafana admin password from the upstream chart is a random secret. Options:
1. **External Secrets Operator** – pull from AWS Secrets Manager (recommended for production)
2. **ArgoCD vault plugin** – inject at sync time
3. **Sealed Secrets** – commit encrypted secret to Git

For now, the base `values.yaml` should set `grafana.adminPassword` to a placeholder that triggers an override requirement per environment.

---

## Files Summary

| File | Action | Phase |
|---|---|---|
| `gitops/helm-charts/kube-prometheus-stack/Chart.yaml` | 🆕 Create | 1.1 |
| `gitops/helm-charts/kube-prometheus-stack/values.yaml` | 🆕 Create | 1.2 |
| `gitops/bootstrap/projects/infrastructure.yaml` | ✏️ Update (add CRDs) | 2.1 |
| `gitops/application-plane/local/infrastructure/kube-prometheus-stack.yaml` | 🆕 Create | 3.1 |
| `gitops/application-plane/local/infrastructure/kustomization.yaml` | 🆕 Create | 3.2 |
| `gitops/application-plane/staging/infrastructure/kube-prometheus-stack.yaml` | 🆕 Create | 3.3 |
| `gitops/application-plane/staging/infrastructure/kustomization.yaml` | 🆕 Create | 3.4 |
| `gitops/application-plane/production/infrastructure/kube-prometheus-stack.yaml` | 🆕 Create | 3.5 |
| `gitops/application-plane/production/infrastructure/kustomization.yaml` | 🆕 Create | 3.6 |
| `gitops/bootstrap/app-of-apps-infrastructure.yaml` | 🆕 Create | 4.1 |
| `gitops/applicationsets/kube-prometheus-stack-appset.yaml` | 🆕 Create | 5.1 |
| `gitops/README.md` | ✏️ Update | 6.1 |
| `doc/TODO.md` | ✏️ Update | 6.2 |

**Total:** 9 new files, 3 updated files = 12 file changes

---

## Acceptance Criteria

- [ ] `kube-prometheus-stack` deploys successfully in **local** environment (minikube/kind)
- [ ] Prometheus scrapes cluster metrics (nodes, pods, kube-state-metrics)
- [ ] Grafana is accessible and shows pre-built dashboards (Kubernetes cluster, Node Exporter)
- [ ] Alertmanager is running and routing rules are loaded
- [ ] ArgoCD shows the Application as `Synced` + `Healthy`
- [ ] Jenkins ServiceMonitor is discovered by Prometheus (Jenkins exposes `/prometheus` metrics endpoint via `prometheus:latest` plugin)
- [ ] No privileged containers; all containers pass Pod Security Standards `restricted`
- [ ] `infrastructure.yaml` AppProject diff shows new CRDs in whitelist
- [ ] `app-of-apps-infrastructure.yaml` is applied and shown as `Synced` in ArgoCD
- [ ] README.md updated with kube-prometheus-stack section
