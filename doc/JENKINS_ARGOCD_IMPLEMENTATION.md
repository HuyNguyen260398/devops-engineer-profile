## Jenkins on ArgoCD – Implementation Reference

> **Implemented:** 2026-03-07
> **Branch:** `feature/update-argocd-deployment`
> **Status:** Active – Jenkins is fully managed via ArgoCD GitOps on all three environments.

This document describes the complete implementation of Jenkins as a GitOps-managed application
on the multi-tenant platform. It covers the Helm chart structure, tier configurations,
per-environment Application manifests, automated lifecycle workflows, and how to add new
Jenkins tenants.

---

## Overview

Jenkins is deployed using the platform's three-tier isolation model, managed entirely through
ArgoCD. No manual `helm install` commands are needed after the initial pool bootstrap.
Every configuration change flows through Git and is reconciled by ArgoCD automatically.

Architecture at a glance:

```
Git commit
    │
    ▼
ArgoCD reconciles
    │
    ├── pool-1-local      (basic tier, local)      ← bootstrapped manually once
    ├── pool-1-staging    (basic tier, staging)      ← bootstrapped manually once
    ├── pool-1-production (basic tier, production)   ← bootstrapped manually once
    │
    ├── jenkins-basic-local           → deploys into pool-1-local
    ├── jenkins-advanced-staging      → deploys into jenkins-staging (dedicated)
    └── jenkins-premium-production    → deploys into jenkins-production (dedicated, manual sync)
```

---

## Helm Chart

**Location:** `gitops/helm-charts/jenkins/`

The chart wraps the upstream `jenkins/jenkins:5.8.139` chart (`Chart.yaml`) and provides
opinionated secure defaults in `values.yaml`. Tier-specific overrides are injected inline
via each ArgoCD Application's `helm.values` block — keeping the chart generic and reusable.

### Security defaults (all tiers)

| Setting | Value |
|---|---|
| `runAsNonRoot` | `true` |
| `runAsUser` | `1000` |
| `fsGroup` | `1000` |
| `allowPrivilegeEscalation` | `false` |
| `capabilities.drop` | `[ALL]` |
| `seccompProfile` | `RuntimeDefault` |
| `numExecutors` | `0` (builds on agents only) |

---

## Tier Reference

### Basic tier (shared pool)

Tenants share a single Jenkins controller and agent pool within a shared namespace.
Suited for dev/test workloads where cost efficiency outweighs isolation.

| Property | Value |
|---|---|
| Namespace | `pool-1-{environment}` (shared) |
| CPU request / limit | `250m` / `1` |
| Memory request / limit | `512Mi` / `1Gi` |
| Storage | `8Gi` standard (local), `20Gi` gp3 (staging/production) |
| Sync | Automated |
| Sync window | None (always open) |
| Notifications | None |

### Advanced tier (dedicated controller)

Each tenant gets a dedicated Jenkins controller namespace while sharing the agent pool.
Balances isolation and cost for teams that need stable pipeline throughput.

| Property | Value |
|---|---|
| Namespace | `jenkins-{tenant}-{environment}` (dedicated) |
| CPU request / limit | `500m` / `2` |
| Memory request / limit | `1Gi` / `2Gi` |
| Storage | `20Gi` gp3 |
| Sync | Automated |
| Sync window | Mon–Fri 08:00–18:00 UTC |
| Notifications | On sync failure, on health degraded |

### Premium tier (full silo)

Full isolation: dedicated namespace, controller, agents, and storage. Designed for
mission-critical pipelines and production-only deployment. Requires manual ArgoCD sync
approval and is restricted to a Saturday maintenance window.

| Property | Value |
|---|---|
| Namespace | `jenkins-{tenant}` (dedicated) |
| CPU request / limit | `2` / `8` |
| Memory request / limit | `4Gi` / `8Gi` |
| Agent CPU request / limit | `500m` / `2` |
| Agent memory request / limit | `1Gi` / `2Gi` |
| Storage | `100Gi` gp3 |
| Sync | **Manual only** |
| Sync window | Deny 00:00–07:00 and 19:00–23:00 daily; allow Sat 20:00–22:00 |
| Notifications | On deploy, on sync failure, on health degraded |

---

## Deployed Application Manifest Index

### Pool Applications (bootstrap once with `kubectl apply`)

| File | ArgoCD App Name | Namespace |
|---|---|---|
| `application-plane/local/pooled-envs/pool-1.yaml` | `jenkins-pool-1-local` | `pool-1-local` |
| `application-plane/staging/pooled-envs/pool-1.yaml` | `jenkins-pool-1-staging` | `pool-1-staging` |
| `application-plane/production/pooled-envs/pool-1.yaml` | `jenkins-pool-1-production` | `pool-1-production` |

Pool Applications live in `pooled-envs/` which is outside the app-of-apps watch path
(`tenants/`), so they must be applied once manually during environment bootstrap:

```bash
kubectl apply -f gitops/application-plane/${ENVIRONMENT}/pooled-envs/pool-1.yaml
```

### Tenant Applications (auto-synced by app-of-apps)

| File | ArgoCD App Name | Tier | Sync |
|---|---|---|---|
| `application-plane/local/tenants/basic/jenkins.yaml` | `jenkins-basic-local` | basic | Auto |
| `application-plane/staging/tenants/advanced/jenkins.yaml` | `jenkins-advanced-staging` | advanced | Auto (window) |
| `application-plane/production/tenants/premium/jenkins.yaml` | `jenkins-premium-production` | premium | Manual |

---

## ApplicationSet

**Location:** `gitops/applicationsets/jenkins-appset.yaml`

An alternative/complementary discovery method. Uses six Git file generators to watch all
`tenants/{tier}/*.yaml` paths across every environment. When a new tenant YAML is committed,
ArgoCD generates the Application automatically without needing to touch `kustomization.yaml`.

Generators watched:

```
production/tenants/premium/*.yaml
production/tenants/advanced/*.yaml
production/tenants/basic/*.yaml
staging/tenants/advanced/*.yaml
staging/tenants/basic/*.yaml
local/tenants/basic/*.yaml
```

Apply during bootstrap:

```bash
kubectl apply -f gitops/applicationsets/jenkins-appset.yaml
```

> The two discovery mechanisms (app-of-apps directory mode + ApplicationSet) can coexist.
> Use the ApplicationSet when you prefer auto-discovery over explicit kustomization entries.

---

## Tier Templates

**Location:** `gitops/application-plane/{env}/tier-templates/`

Copy-and-fill blueprints for onboarding new tenants. Every template uses `TENANT_NAME`
as a placeholder throughout. Supported templates:

| Template | Environment | Tier |
|---|---|---|
| `local/tier-templates/basic_tenant_template.yaml` | local | basic |
| `staging/tier-templates/basic_tenant_template.yaml` | staging | basic |
| `staging/tier-templates/advanced_tenant_template.yaml` | staging | advanced |
| `production/tier-templates/basic_tenant_template.yaml` | production | basic |
| `production/tier-templates/advanced_tenant_template.yaml` | production | advanced |
| `production/tier-templates/premium_tenant_template.yaml` | production | premium |

---

## Automated Tenant Lifecycle (Argo Workflows)

**Location:** `gitops/control-plane/workflows/`

Three WorkflowTemplates automate the tenant lifecycle. Prerequisites:

```bash
# Deploy RBAC and WorkflowTemplates
kubectl apply -f gitops/control-plane/rbac/workflow-rbac.yaml
kubectl apply -f gitops/control-plane/workflows/
```

### Onboarding (`tenant-onboarding`)

Four sequential steps:

1. **Validate input** — checks naming rules and allowed tier/environment combinations
2. **Generate manifest** — clones the repo, reads the tier template, substitutes `TENANT_NAME`
3. **Commit to Git** — writes the manifest to `tenants/{tier}/{name}.yaml`, updates `kustomization.yaml`, pushes
4. **Wait for ArgoCD sync** — polls until the Application is `Synced + Healthy` (10-minute timeout)

```bash
argo submit -n argo-workflows \
  --from workflowtemplate/tenant-onboarding \
  -p tenant-name=acme-corp \
  -p tier=advanced \
  -p environment=staging \
  --serviceaccount gitops-workflow-sa
```

Allowed tier/environment combinations:

| Environment | Allowed tiers |
|---|---|
| local | basic |
| staging | basic, advanced |
| production | basic, advanced, premium |

### Offboarding (`tenant-offboarding`)

Four sequential steps:

1. **Verify tenant exists** — confirms the ArgoCD Application is present before proceeding
2. **Backup data** (skippable via `-p skip-backup=true`) — creates a `VolumeSnapshot` of `jenkins-home-jenkins-0`
3. **Remove from Git** — deletes the manifest file and removes the kustomization entry, pushes
4. **Verify deletion** — polls until ArgoCD confirms the Application no longer exists (5-minute timeout)

```bash
argo submit -n argo-workflows \
  --from workflowtemplate/tenant-offboarding \
  -p tenant-name=acme-corp \
  -p tier=advanced \
  -p environment=staging \
  -p skip-backup=false \
  --serviceaccount gitops-workflow-sa
```

### Staggered Deployment (`staggered-deployment`)

Promotes changes across four waves with health gates between each:

| Wave | Scope | Gate duration |
|---|---|---|
| 0 | Staging (all tiers) | 5 minutes |
| 1 | Production basic | 10 minutes |
| 2 | Production advanced | 10 minutes |
| 3 | Production premium | 5 minutes |

The health gate polls all Applications matching the wave's label selector. If any Application
enters `Degraded`, `Missing`, or `Unknown` health, the pipeline aborts immediately — serving
as an automated change failure rate guard (DORA CFR).

```bash
argo submit -n argo-workflows \
  --from workflowtemplate/staggered-deployment \
  -p image-tag=2.504 \
  --serviceaccount gitops-workflow-sa
```

---

## RBAC (`workflow-rbac.yaml`)

Creates in the `argo-workflows` namespace:

- **Namespace** `argo-workflows` — `pod-security.kubernetes.io/enforce: restricted`
- **ServiceAccount** `gitops-workflow-sa`
- **ClusterRole** `gitops-workflow-role` — least-privilege grants:
  - Read ArgoCD `Applications` and `ApplicationSets`
  - Create/delete `Namespaces`
  - Read `Pods`, `Services`, `Deployments`, `StatefulSets` (health verification)
  - Read/write `ConfigMaps` in `argo-workflows` (workflow coordination)
  - Manage Argo Workflows engine resources
- **ClusterRoleBinding** linking the SA to the role

---

## Adding a New Jenkins Tenant (Quick Reference)

```bash
# 1. Choose env (local|staging|production) and tier (basic|advanced|premium)
ENV=staging
TIER=advanced
TENANT=my-team

# 2. Copy the tier template
cp gitops/application-plane/${ENV}/tier-templates/${TIER}_tenant_template.yaml \
   gitops/application-plane/${ENV}/tenants/${TIER}/${TENANT}.yaml

# 3. Fill the TENANT_NAME placeholder
sed -i "s/TENANT_NAME/${TENANT}/g" \
   gitops/application-plane/${ENV}/tenants/${TIER}/${TENANT}.yaml

# 4. Register in kustomization
echo "  - ${TENANT}.yaml" >> \
   gitops/application-plane/${ENV}/tenants/${TIER}/kustomization.yaml

# 5. Commit and push — ArgoCD picks it up automatically
git add gitops/application-plane/${ENV}/tenants/${TIER}/
git commit -m "feat(gitops): onboard ${TENANT} (${TIER}/${ENV})"
git push
```

---

## Configuration Reference

### Updating the `repoURL`

All Application manifests and the ApplicationSet contain:

```yaml
repoURL: https://github.com/your-org/devops-engineer-profile.git  # UPDATE THIS
```

Replace with the actual repository URL before deploying. Files to update:

- `gitops/applicationsets/jenkins-appset.yaml` (6 generator entries)
- `gitops/application-plane/*/pooled-envs/pool-1.yaml` (3 files)
- `gitops/application-plane/*/tenants/*/jenkins.yaml` (3 files)
- `gitops/application-plane/*/tier-templates/*.yaml` (6 files)
- `gitops/control-plane/workflows/*.yaml` (parameter defaults in 3 files)

A one-liner to replace all at once from the repo root:

```bash
find gitops/ -name "*.yaml" \
  -exec sed -i 's|https://github.com/your-org/devops-engineer-profile.git|https://github.com/YOUR_ORG/YOUR_REPO.git|g' {} +
```

### Updating the Helm chart version

The upstream chart version is pinned in `gitops/helm-charts/jenkins/Chart.yaml`:

```yaml
dependencies:
  - name: jenkins
    version: "5.8.139"
    repository: https://charts.jenkins.io
```

To upgrade, change the version and run `helm dependency update gitops/helm-charts/jenkins/`
before pushing. ArgoCD will detect the chart change and prompt/auto-sync per tier policy.

---

## Relationship to Legacy `ops/jenkins/`

| Legacy file | GitOps equivalent | Status |
|---|---|---|
| `ops/jenkins/argocd/jenkins-local.yaml` | `application-plane/local/tenants/basic/jenkins.yaml` | Superseded |
| `ops/jenkins/argocd/jenkins-staging.yaml` | `application-plane/staging/tenants/advanced/jenkins.yaml` | Superseded |
| `ops/jenkins/argocd/jenkins-production.yaml` | `application-plane/production/tenants/premium/jenkins.yaml` | Superseded |
| `ops/jenkins/helm/` | `gitops/helm-charts/jenkins/` | Superseded |

The `ops/jenkins/` files remain in place for reference. Decommission them once Jenkins
is confirmed healthy via the `gitops/` Applications.

---

## References

- [Argo CD App-of-Apps](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/)
- [Argo CD ApplicationSet](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/)
- [Argo Workflows](https://argoproj.github.io/argo-workflows/)
- [Jenkins Helm Chart](https://artifacthub.io/packages/helm/jenkinsci/jenkins)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [AWS EKS SaaS GitOps Workshop](https://catalog.workshops.aws/eks-saas-gitops/en-US)
- [DORA Metrics](https://dora.dev/guides/dora-metrics-four-keys/)
