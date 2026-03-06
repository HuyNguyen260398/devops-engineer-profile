## GitOps – Jenkins Service Removal Reference

> **Date removed:** 2026-03-06
> **Branch:** `feature/update-argocd-deployment`
> **Reason:** Simplify the initial GitOps bootstrap to deploy ArgoCD only.
> Jenkins (and other services) will be re-added incrementally once ArgoCD is
> running and verified in each environment.

---

## What Was Removed

### Files Deleted

| File / Directory | Description |
|---|---|
| `gitops/helm-charts/jenkins/` | Shared Jenkins Helm chart (wraps `jenkins/jenkins:5.8.139`) |
| `gitops/applicationsets/jenkins-appset.yaml` | ApplicationSet auto-discovering Jenkins tenant directories |
| `gitops/application-plane/local/tier-templates/basic_tenant_template.yaml` | Basic tier template for local Jenkins |
| `gitops/application-plane/staging/tier-templates/basic_tenant_template.yaml` | Basic tier template for staging Jenkins |
| `gitops/application-plane/staging/tier-templates/advanced_tenant_template.yaml` | Advanced tier template for staging Jenkins |
| `gitops/application-plane/production/tier-templates/basic_tenant_template.yaml` | Basic tier template for production Jenkins |
| `gitops/application-plane/production/tier-templates/advanced_tenant_template.yaml` | Advanced tier template for production Jenkins |
| `gitops/application-plane/production/tier-templates/premium_tenant_template.yaml` | Premium tier template for production Jenkins |
| `gitops/application-plane/local/pooled-envs/pool-1.yaml` | Shared Jenkins pool for local development |
| `gitops/application-plane/staging/pooled-envs/pool-1.yaml` | Shared Jenkins pool for staging |
| `gitops/application-plane/production/pooled-envs/pool-1.yaml` | Shared Jenkins pool for production |
| `gitops/application-plane/local/tenants/basic/jenkins.yaml` | Jenkins Application (basic tier, local) |
| `gitops/application-plane/staging/tenants/advanced/jenkins.yaml` | Jenkins Application (advanced tier, staging) |
| `gitops/application-plane/production/tenants/premium/jenkins.yaml` | Jenkins Application (premium tier, production) |
| `gitops/control-plane/workflows/onboarding-workflow.yaml` | Argo WorkflowTemplate – tenant onboarding |
| `gitops/control-plane/workflows/offboarding-workflow.yaml` | Argo WorkflowTemplate – tenant offboarding |
| `gitops/control-plane/workflows/deployment-workflow.yaml` | Argo WorkflowTemplate – staggered deployment |
| `gitops/control-plane/rbac/workflow-rbac.yaml` | Namespace + ServiceAccount + ClusterRole for Argo Workflows |

### Directories Deleted (became empty after content removal)

- `gitops/applicationsets/`
- `gitops/helm-charts/`
- `gitops/application-plane/local/tier-templates/`
- `gitops/application-plane/staging/tier-templates/`
- `gitops/application-plane/production/tier-templates/`
- `gitops/control-plane/workflows/`

---

## Files Modified

### `gitops/bootstrap/app-of-apps.yaml`

`allowEmpty` changed from `false` to `true` so ArgoCD does not report a sync
error while the application-plane directories contain no Application resources.

```yaml
# Before
syncPolicy:
  automated:
    prune: true
    selfHeal: true
    allowEmpty: false

# After
syncPolicy:
  automated:
    prune: true
    selfHeal: true
    allowEmpty: true  # Allow empty sync during initial ArgoCD-only bootstrap
```

### `kustomization.yaml` files — `resources` cleared

All `kustomization.yaml` files that previously listed Jenkins resources were
updated to `resources: []`.

| File | Old `resources` value |
|---|---|
| `application-plane/local/pooled-envs/kustomization.yaml` | `- pool-1.yaml` |
| `application-plane/local/tenants/basic/kustomization.yaml` | `- jenkins.yaml` |
| `application-plane/staging/pooled-envs/kustomization.yaml` | `- pool-1.yaml` |
| `application-plane/staging/tenants/advanced/kustomization.yaml` | `- jenkins.yaml` |
| `application-plane/production/pooled-envs/kustomization.yaml` | `- pool-1.yaml` |
| `application-plane/production/tenants/premium/kustomization.yaml` | `- jenkins.yaml` |

---

## Original Folder Structure (Before Removal)

```
gitops/
├── README.md
├── applicationsets/
│   └── jenkins-appset.yaml                        # ← DELETED
├── application-plane/
│   ├── local/
│   │   ├── pooled-envs/
│   │   │   ├── kustomization.yaml
│   │   │   └── pool-1.yaml                        # ← DELETED
│   │   ├── tier-templates/
│   │   │   └── basic_tenant_template.yaml         # ← DELETED
│   │   └── tenants/
│   │       ├── kustomization.yaml
│   │       └── basic/
│   │           ├── kustomization.yaml
│   │           └── jenkins.yaml                   # ← DELETED
│   ├── staging/
│   │   ├── pooled-envs/
│   │   │   ├── kustomization.yaml
│   │   │   └── pool-1.yaml                        # ← DELETED
│   │   ├── tier-templates/
│   │   │   ├── basic_tenant_template.yaml         # ← DELETED
│   │   │   └── advanced_tenant_template.yaml      # ← DELETED
│   │   └── tenants/
│   │       ├── kustomization.yaml
│   │       ├── basic/
│   │       │   └── kustomization.yaml
│   │       └── advanced/
│   │           ├── kustomization.yaml
│   │           └── jenkins.yaml                   # ← DELETED
│   └── production/
│       ├── pooled-envs/
│       │   ├── kustomization.yaml
│       │   └── pool-1.yaml                        # ← DELETED
│       ├── tier-templates/
│       │   ├── basic_tenant_template.yaml         # ← DELETED
│       │   ├── advanced_tenant_template.yaml      # ← DELETED
│       │   └── premium_tenant_template.yaml       # ← DELETED
│       └── tenants/
│           ├── kustomization.yaml
│           ├── basic/
│           │   └── kustomization.yaml
│           ├── advanced/
│           │   └── kustomization.yaml
│           └── premium/
│               ├── kustomization.yaml
│               └── jenkins.yaml                   # ← DELETED
├── bootstrap/
│   ├── app-of-apps.yaml                           # ← MODIFIED (allowEmpty)
│   ├── argocd/
│   │   ├── install.sh
│   │   ├── namespace.yaml
│   │   ├── values-aws.yaml
│   │   ├── values-base.yaml
│   │   └── values-local.yaml
│   └── projects/
│       ├── applications.yaml
│       ├── infrastructure.yaml
│       └── tenants.yaml
├── control-plane/
│   └── rbac/
│       ├── git-credentials-template.yaml
│       └── workflow-rbac.yaml                     # ← DELETED
│   └── workflows/
│       ├── deployment-workflow.yaml               # ← DELETED
│       ├── offboarding-workflow.yaml              # ← DELETED
│       └── onboarding-workflow.yaml               # ← DELETED
└── helm-charts/
    └── jenkins/                                   # ← DELETED
        ├── Chart.yaml
        └── values.yaml
```

---

## Jenkins Architecture Overview (for Re-Adding Later)

### Tier Strategy

Jenkins was deployed using a **three-tier isolation model**:

| Tier | Environment | Namespace Pattern | Isolation | Replicas | CPU | Memory |
|---|---|---|---|---|---|---|
| Basic | local, staging, production | `pool-1-{env}` | Shared pool | 1 | 250m–1 | 512Mi–1Gi |
| Advanced | staging, production | `jenkins-{tenant}` | Dedicated NS | 1 | 500m–2 | 1–2Gi |
| Premium | production only | `jenkins-{tenant}` | Full silo | 1 (+HA) | 2–8 | 4–8Gi |

### Multi-Tenant Deployment Pattern

- **Local**: Basic tier only — one shared `pool-1-local` Jenkins instance
- **Staging**: Basic (pool) + Advanced (dedicated) — no Premium
- **Production**: Basic (pool) + Advanced + Premium

### Helm Chart Details (`helm-charts/jenkins/`)

- **Chart version**: `1.0.0`
- **Upstream dependency**: `jenkins/jenkins:5.8.139`
- **Key defaults** (from `values.yaml`):
  - `numExecutors: 0` (builds run on agents, not the controller)
  - `runAsNonRoot: true`, `runAsUser: 1000`
  - `readOnlyRootFilesystem: true`
  - `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`
  - JCasC (Jenkins Configuration as Code) enabled
  - Core plugins: `kubernetes`, `workflow-aggregator`, `git`, `configuration-as-code`, `credentials-binding`

### ApplicationSet (`applicationsets/jenkins-appset.yaml`)

Used Git file generators to auto-discover tenant YAML files:

```yaml
generators:
  - git: { files: ["gitops/application-plane/production/tenants/premium/*.yaml"] }
  - git: { files: ["gitops/application-plane/production/tenants/advanced/*.yaml"] }
  - git: { files: ["gitops/application-plane/production/tenants/basic/*.yaml"] }
  - git: { files: ["gitops/application-plane/staging/tenants/advanced/*.yaml"] }
  - git: { files: ["gitops/application-plane/staging/tenants/basic/*.yaml"] }
  - git: { files: ["gitops/application-plane/local/tenants/basic/*.yaml"] }
```

> **Note:** The `repoURL` was hardcoded as `https://github.com/your-org/devops-engineer-profile.git`
> and needs to be updated to the real repository URL when re-adding.

### Control Plane Automation (`control-plane/`)

Three Argo WorkflowTemplates automated the tenant lifecycle:

- **`onboarding-workflow.yaml`** – validates input, generates manifest from tier
  template, commits to Git, waits for ArgoCD sync
- **`offboarding-workflow.yaml`** – optionally backs up tenant data, removes
  manifest from Git, verifies deletion via ArgoCD
- **`deployment-workflow.yaml`** – staggered wave deployment:
  - Wave 0: Staging (all tiers) → 5 min gate
  - Wave 1: Production basic → 10 min gate
  - Wave 2: Production advanced → 10 min gate
  - Wave 3: Production premium → 5 min gate

The RBAC (`workflow-rbac.yaml`) created:
- Namespace: `argo-workflows`
- ServiceAccount: `gitops-workflow-sa`
- ClusterRole: read ArgoCD applications, manage namespaces, read pods/services/deployments

---

## Steps to Re-Add Jenkins

1. Recreate `gitops/helm-charts/jenkins/Chart.yaml` and `values.yaml`
2. Restore tier template files in `application-plane/{env}/tier-templates/`
3. Restore `pool-1.yaml` in each `pooled-envs/` directory and add back to
   `kustomization.yaml`
4. Add tenant Application YAML files to the appropriate
   `application-plane/{env}/tenants/{tier}/` directory and reference them in
   `kustomization.yaml`
5. Recreate `applicationsets/jenkins-appset.yaml` (update the `repoURL`)
6. Recreate `control-plane/workflows/` and `control-plane/rbac/workflow-rbac.yaml`
   if automated lifecycle management is needed
7. Revert `app-of-apps.yaml` `allowEmpty` back to `false` once applications
   are present
