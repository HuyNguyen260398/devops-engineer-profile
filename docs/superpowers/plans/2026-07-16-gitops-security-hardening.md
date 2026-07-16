# GitOps Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 5 high-priority security findings plus secure-network requirements from `docs/superpowers/specs/2026-07-16-gitops-security-hardening-design.md`, delivered as three PRs.

**Architecture:** PR 1 hardens the ArgoCD trust boundaries (bootstrap AppProject, pinned sourceRepos), adds tenant namespace guardrails via the jenkins wrapper chart + `managedNamespaceMetadata`, and splits the Argo Workflows RBAC. PR 2 wires External Secrets Operator end-to-end (Terraform IRSA → ESO app → ClusterSecretStore → ExternalSecrets for Grafana/Alertmanager/git-credentials). PR 3 adds VPC endpoints to the EKS network and a TLS ALB ingress for ArgoCD.

**Tech Stack:** ArgoCD (app-of-apps + AppProjects), Helm wrapper charts, Kustomize, Terraform (AWS provider ~>5.0, terraform-aws-modules), External Secrets Operator, AWS Secrets Manager, kubeconform/tflint for validation, minikube for live verification.

## Global Constraints

- **Commit at the end of EVERY task** (user requirement). Each task's final step is a git commit. Never batch multiple tasks into one commit.
- Conventional commit messages; end every commit with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Repo URL everywhere: `https://github.com/HuyNguyen260398/devops-engineer-profile.git`.
- Never commit real credentials. Placeholders follow the repo's `# UPDATE THIS` convention.
- Terraform: snake_case names; every variable/output has `description` and `type`; all resources tagged via `local.common_tags` (`Environment`, `Project`, `ManagedBy`); modules pinned (registry: exact version; git: commit SHA).
- Wrapper-chart pattern: every Helm chart in `gitops/helm-charts/<name>/` pins its upstream dependency to an exact version in `Chart.yaml`; ArgoCD Applications inject env-specific values via `spec.source.helm.values`.
- YAML style: 2-space indent, `# ===` banner comments at file top explaining purpose (match existing files).
- Working branch for PR 1: `feat/gitops-security-hardening` (already exists, holds the spec + this plan). PR 2 branches from the PR 1 branch (`feat/gitops-eso`); PR 3 branches from `main` (`feat/network-hardening`).
- macOS/zsh. Available: `kubectl`, `terraform`, `tflint`, `gh`, `git`. Task 1 installs: `helm`, `kubeconform`, `yq`, `minikube`. Use `kubectl kustomize` (built-in) instead of a standalone kustomize binary.

---

# PR 1 — GitOps YAML hardening

### Task 1: Validation toolchain + ignore Helm dependency artifacts

**Files:**
- Modify: `.gitignore` (append at end)

**Interfaces:**
- Produces: `helm`, `kubeconform`, `yq`, `minikube` binaries on PATH; `.gitignore` entries so `helm dependency build` artifacts are never committed. All later validation steps depend on these.

- [ ] **Step 1: Install tools**

```bash
brew install helm kubeconform yq minikube
```

Expected: brew reports all four installed (or "already installed").

- [ ] **Step 2: Verify tool versions**

```bash
helm version --short && kubeconform -v && yq --version && minikube version --short
```

Expected: four version strings, no errors.

- [ ] **Step 3: Append Helm artifacts to .gitignore**

Append to `.gitignore`:

```gitignore

# Helm dependency build artifacts (wrapper charts fetch deps at validate/sync time)
gitops/helm-charts/*/charts/
gitops/helm-charts/*/Chart.lock
```

- [ ] **Step 4: Verify ignore works**

```bash
git check-ignore -v gitops/helm-charts/jenkins/charts/jenkins-5.8.139.tgz gitops/helm-charts/jenkins/Chart.lock
```

Expected: both paths print with the matching `.gitignore` rule.

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore helm dependency build artifacts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Bootstrap AppProject + move root apps off `default`

**Files:**
- Create: `gitops/bootstrap/projects/bootstrap.yaml`
- Modify: `gitops/bootstrap/app-of-apps.yaml:33`
- Modify: `gitops/bootstrap/app-of-apps-infrastructure.yaml:42,95,148`
- Modify: `gitops/bootstrap/local/app-of-apps-infrastructure.yaml:43`

**Interfaces:**
- Produces: AppProject named `bootstrap` in namespace `argocd`. Task 7 verifies root apps carry `spec.project: bootstrap`.

- [ ] **Step 1: Create the bootstrap AppProject**

Create `gitops/bootstrap/projects/bootstrap.yaml`:

```yaml
# ============================================================================
# ArgoCD AppProject – Bootstrap (Root App-of-Apps)
# ============================================================================
# Owns ONLY the root app-of-apps Applications. Root apps are the most
# privileged layer of the platform: they watch application-plane directories
# and create child Applications from whatever is merged there. Scoping them
# to this project (instead of the unrestricted built-in `default` project)
# means a merged YAML can only ever create ArgoCD Application resources in
# the argocd namespace — never arbitrary cluster resources.
#
# NOTE: If you run this platform from a fork, update sourceRepos to your
# fork's URL (same convention as the repoURL "UPDATE THIS" markers).
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: bootstrap
  namespace: argocd
  labels:
    app.kubernetes.io/name: bootstrap
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/managed-by: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  description: "Root app-of-apps Applications (bootstrap layer)"

  sourceRepos:
    - https://github.com/HuyNguyen260398/devops-engineer-profile.git

  destinations:
    - server: https://kubernetes.default.svc
      namespace: argocd

  # Root apps create no cluster-scoped resources.
  clusterResourceWhitelist: []

  # Root apps may only create other ArgoCD Applications.
  namespaceResourceWhitelist:
    - group: argoproj.io
      kind: Application
```

- [ ] **Step 2: Switch all five root apps to the bootstrap project**

In each of these files, replace the line `  project: default` with `  project: bootstrap`:

1. `gitops/bootstrap/app-of-apps.yaml` (1 occurrence, line 33)
2. `gitops/bootstrap/app-of-apps-infrastructure.yaml` (3 occurrences — local, staging, production documents)
3. `gitops/bootstrap/local/app-of-apps-infrastructure.yaml` (1 occurrence, line 43)

- [ ] **Step 3: Verify no root app references `default` and YAML parses**

```bash
grep -rn "project: default" gitops/bootstrap/ ; echo "grep-exit=$?"
yq eval-all 'true' gitops/bootstrap/projects/bootstrap.yaml gitops/bootstrap/app-of-apps.yaml gitops/bootstrap/app-of-apps-infrastructure.yaml gitops/bootstrap/local/app-of-apps-infrastructure.yaml > /dev/null && echo YAML-OK
```

Expected: `grep-exit=1` (no matches) and `YAML-OK`.

- [ ] **Step 4: Commit**

```bash
git add gitops/bootstrap/
git commit -m "feat(gitops): scope root app-of-apps to restricted bootstrap AppProject

Root apps previously ran in the unrestricted default project, allowing
any merged YAML under application-plane/ to deploy arbitrary cluster
resources. The bootstrap project pins source repo, destination, and
resource kind (argoproj.io/Application only).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Pin `sourceRepos` in all AppProjects

**Files:**
- Modify: `gitops/bootstrap/projects/infrastructure.yaml:21-22`
- Modify: `gitops/bootstrap/projects/applications.yaml:20-21`
- Modify: `gitops/bootstrap/projects/tenants.yaml:20-21`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: all AppProjects restrict `spec.sourceRepos` to the platform repo. Task 7 verifies.

- [ ] **Step 1: Replace the wildcard in each project**

In each of the three files, replace:

```yaml
  sourceRepos:
    - "*"
```

with:

```yaml
  # Pinned to the platform repository. sourceRepos constrains
  # Application.spec.source.repoURL only — Helm chart dependencies
  # (charts.jenkins.io etc.) are fetched by the repo-server during
  # rendering and are NOT checked against this list, so wrapper charts
  # keep working. If running from a fork, update the URL.
  sourceRepos:
    - https://github.com/HuyNguyen260398/devops-engineer-profile.git
```

- [ ] **Step 2: Verify no wildcard remains**

```bash
grep -rn 'sourceRepos' -A2 gitops/bootstrap/projects/ | grep '"\*"' ; echo "grep-exit=$?"
yq eval-all 'true' gitops/bootstrap/projects/*.yaml > /dev/null && echo YAML-OK
```

Expected: `grep-exit=1` and `YAML-OK`.

- [ ] **Step 3: Commit**

```bash
git add gitops/bootstrap/projects/
git commit -m "feat(gitops): pin AppProject sourceRepos to the platform repository

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Tenant guardrails in the jenkins wrapper chart

**Files:**
- Modify: `gitops/helm-charts/jenkins/Chart.yaml` (version 1.0.0 → 1.1.0)
- Modify: `gitops/helm-charts/jenkins/values.yaml` (append `guardrails:` block)
- Create: `gitops/helm-charts/jenkins/templates/networkpolicy.yaml`
- Create: `gitops/helm-charts/jenkins/templates/resourcequota.yaml`
- Create: `gitops/helm-charts/jenkins/templates/limitrange.yaml`

**Interfaces:**
- Produces: chart values schema `guardrails.networkPolicy.{enabled,controllerPorts,ingressControllerNamespace,allowLoadBalancerCidrs,extraIngress,extraEgress}`, `guardrails.quota.{enabled,hard}`, `guardrails.limitRange.{enabled,containerDefault,containerDefaultRequest}`. Task 5 overrides `guardrails.quota.hard` per tier; Task 7 verifies rendered objects.

- [ ] **Step 1: Bump the chart version**

In `gitops/helm-charts/jenkins/Chart.yaml` replace `version: 1.0.0` with `version: 1.1.0` and replace the header line `# Chart version:  1.0.0` with `# Chart version:  1.1.0`.

- [ ] **Step 2: Append the guardrails values block**

Append to `gitops/helm-charts/jenkins/values.yaml` (top level, after the `agent:` block):

```yaml

  # ── Tenant Namespace Guardrails ──────────────────────────────────────────
  # Rendered by this wrapper chart (not the upstream jenkins chart).
  # Defaults are sized for the BASIC tier; advanced/premium tiers override
  # guardrails.quota.hard in their ArgoCD Application helm.values block.
guardrails:
  networkPolicy:
    enabled: true
    # Ports tenants' agents / ingress reach on the controller
    controllerPorts:
      - 8080
      - 50000
    # Namespace running the ingress controller (nginx or ALB controller pods)
    ingressControllerNamespace: ingress-nginx
    # AWS ALB target-type=ip sends traffic from ALB ENI IPs, not pods.
    # Set to the VPC CIDR on AWS environments, e.g. ["10.0.0.0/16"].
    allowLoadBalancerCidrs: []
    # Extra raw NetworkPolicy ingress/egress rule lists appended per tier
    extraIngress: []
    extraEgress: []
  quota:
    enabled: true
    hard:
      requests.cpu: "2"
      requests.memory: 4Gi
      limits.cpu: "4"
      limits.memory: 8Gi
      persistentvolumeclaims: "5"
      requests.storage: 50Gi
      pods: "30"
  limitRange:
    enabled: true
    containerDefault:
      cpu: 500m
      memory: 512Mi
    containerDefaultRequest:
      cpu: 100m
      memory: 128Mi
```

**Important:** the two comment lines above `guardrails:` are indented as shown, but `guardrails:` itself is a TOP-LEVEL key (column 0), a sibling of the existing `jenkins:` key.

- [ ] **Step 3: Create the NetworkPolicy template**

Create `gitops/helm-charts/jenkins/templates/networkpolicy.yaml`:

```yaml
{{- /*
Tenant namespace network isolation:
  1. default-deny            – blocks all ingress + egress
  2. allow-dns               – DNS to kube-system
  3. allow-intra-namespace   – agents <-> controller inside the namespace
  4. allow-ingress-controller– controller ports from the ingress controller
                               namespace and (on AWS) ALB ENI CIDRs
  5. allow-egress-https      – git clones, plugin downloads, k8s API
  6. extra                   – per-tier additions from values
*/ -}}
{{- if .Values.guardrails.networkPolicy.enabled }}
{{- $np := .Values.guardrails.networkPolicy }}
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-default-deny
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-allow-dns
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-allow-intra-namespace
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector: {}
  egress:
    - to:
        - podSelector: {}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-allow-ingress-controller
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/component: jenkins-controller
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: {{ $np.ingressControllerNamespace }}
      ports:
        {{- range $np.controllerPorts }}
        - protocol: TCP
          port: {{ . }}
        {{- end }}
    {{- if $np.allowLoadBalancerCidrs }}
    - from:
        {{- range $np.allowLoadBalancerCidrs }}
        - ipBlock:
            cidr: {{ . }}
        {{- end }}
      ports:
        {{- range $np.controllerPorts }}
        - protocol: TCP
          port: {{ . }}
        {{- end }}
    {{- end }}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-allow-egress-https
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - protocol: TCP
          port: 443
{{- if $np.extraIngress }}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-extra-ingress
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    {{- toYaml $np.extraIngress | nindent 4 }}
{{- end }}
{{- if $np.extraEgress }}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-extra-egress
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    {{- toYaml $np.extraEgress | nindent 4 }}
{{- end }}
{{- end }}
```

- [ ] **Step 4: Create the ResourceQuota template**

Create `gitops/helm-charts/jenkins/templates/resourcequota.yaml`:

```yaml
{{- if .Values.guardrails.quota.enabled }}
apiVersion: v1
kind: ResourceQuota
metadata:
  name: {{ .Release.Name }}-quota
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  hard:
    {{- toYaml .Values.guardrails.quota.hard | nindent 4 }}
{{- end }}
```

- [ ] **Step 5: Create the LimitRange template**

Create `gitops/helm-charts/jenkins/templates/limitrange.yaml`:

```yaml
{{- /*
With a ResourceQuota active, pods without explicit requests/limits are
rejected at admission. This LimitRange injects defaults so ad-hoc pods
(e.g. dynamically provisioned Jenkins agents) still schedule.
*/ -}}
{{- if .Values.guardrails.limitRange.enabled }}
apiVersion: v1
kind: LimitRange
metadata:
  name: {{ .Release.Name }}-defaults
  labels:
    app.kubernetes.io/name: {{ .Release.Name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: tenant-guardrails
spec:
  limits:
    - type: Container
      default:
        cpu: {{ .Values.guardrails.limitRange.containerDefault.cpu }}
        memory: {{ .Values.guardrails.limitRange.containerDefault.memory }}
      defaultRequest:
        cpu: {{ .Values.guardrails.limitRange.containerDefaultRequest.cpu }}
        memory: {{ .Values.guardrails.limitRange.containerDefaultRequest.memory }}
{{- end }}
```

- [ ] **Step 6: Render and validate**

```bash
helm repo add jenkins https://charts.jenkins.io 2>/dev/null; helm repo update jenkins
helm dependency build gitops/helm-charts/jenkins
helm template guardrails-test gitops/helm-charts/jenkins --namespace jenkins-test \
  | kubeconform -strict -ignore-missing-schemas -summary
```

Expected: kubeconform summary with 0 invalid, 0 errors. Then confirm the guardrail objects render:

```bash
helm template guardrails-test gitops/helm-charts/jenkins --namespace jenkins-test \
  | grep -E "^kind: (NetworkPolicy|ResourceQuota|LimitRange)" | sort | uniq -c
```

Expected: `1 kind: LimitRange`, `5 kind: NetworkPolicy` (no extras by default), `1 kind: ResourceQuota`.

- [ ] **Step 7: Verify per-tier override renders**

```bash
helm template guardrails-test gitops/helm-charts/jenkins --namespace jenkins-test \
  --set-string 'guardrails.quota.hard.requests\.cpu=4' \
  | yq 'select(.kind == "ResourceQuota") | .spec.hard."requests.cpu"'
```

Expected output: `4`

- [ ] **Step 8: Commit**

```bash
git add gitops/helm-charts/jenkins/
git commit -m "feat(gitops): add tenant guardrails to jenkins chart (netpol, quota, limits)

Default-deny NetworkPolicies with DNS/intra-namespace/ingress/HTTPS
allows, tier-sized ResourceQuota, and LimitRange defaults. Chart 1.1.0.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: PSS labels via managedNamespaceMetadata + tier quota overrides

**Files (12 modified):**
- `gitops/application-plane/local/tenants/basic/jenkins.yaml`
- `gitops/application-plane/local/pooled-envs/pool-1.yaml`
- `gitops/application-plane/local/tier-templates/basic_tenant_template.yaml`
- `gitops/application-plane/staging/tenants/advanced/jenkins.yaml`
- `gitops/application-plane/staging/pooled-envs/pool-1.yaml`
- `gitops/application-plane/staging/tier-templates/basic_tenant_template.yaml`
- `gitops/application-plane/staging/tier-templates/advanced_tenant_template.yaml`
- `gitops/application-plane/production/tenants/premium/jenkins.yaml`
- `gitops/application-plane/production/pooled-envs/pool-1.yaml`
- `gitops/application-plane/production/tier-templates/basic_tenant_template.yaml`
- `gitops/application-plane/production/tier-templates/advanced_tenant_template.yaml`
- `gitops/application-plane/production/tier-templates/premium_tenant_template.yaml`
- `gitops/applicationsets/jenkins-appset.yaml`

**Interfaces:**
- Consumes: `guardrails.quota.hard` values schema from Task 4.
- Produces: every tenant-facing Application stamps PSS labels on its namespace. Task 7 verifies labels on a live namespace.

- [ ] **Step 1: Add managedNamespaceMetadata to all 12 Application files**

In each file listed above, insert this block as the FIRST key directly under `syncPolicy:` (before `automated:` / `automated: null` / `syncOptions:` — whichever comes first). Indentation: `managedNamespaceMetadata:` at the same level as `syncOptions:` (4 spaces in these files):

```yaml
    # PSS: enforce baseline now; warn+audit restricted to surface violations
    # in tenant agent podTemplates before tightening enforcement.
    managedNamespaceMetadata:
      labels:
        pod-security.kubernetes.io/enforce: baseline
        pod-security.kubernetes.io/warn: restricted
        pod-security.kubernetes.io/audit: restricted
        app.kubernetes.io/part-of: gitops-platform
```

For `gitops/applicationsets/jenkins-appset.yaml` the block goes under `template.spec.syncPolicy:` (8-space base indent — indent the block 4 more spaces than shown, keeping relative structure).

- [ ] **Step 2: Add tier quota overrides to advanced/premium templates and files**

In the `helm.values: |` block of these files, append a top-level `guardrails:` key AFTER the existing `jenkins:` tree (same indentation level as `jenkins:` inside the values string).

Advanced tier — `staging/tier-templates/advanced_tenant_template.yaml`, `production/tier-templates/advanced_tenant_template.yaml`, `staging/tenants/advanced/jenkins.yaml`:

```yaml
        guardrails:
          quota:
            hard:
              requests.cpu: "2"
              requests.memory: 4Gi
              limits.cpu: "6"
              limits.memory: 8Gi
              persistentvolumeclaims: "5"
              requests.storage: 100Gi
              pods: "30"
```

Premium tier — `production/tier-templates/premium_tenant_template.yaml`, `production/tenants/premium/jenkins.yaml`:

```yaml
        guardrails:
          quota:
            hard:
              requests.cpu: "4"
              requests.memory: 8Gi
              limits.cpu: "16"
              limits.memory: 16Gi
              persistentvolumeclaims: "10"
              requests.storage: 200Gi
              pods: "50"
```

(Basic tier and pool-1 files keep the chart defaults — no override needed.)

- [ ] **Step 3: Validate YAML and kustomize builds**

```bash
yq eval-all 'true' \
  gitops/applicationsets/jenkins-appset.yaml \
  gitops/application-plane/*/tier-templates/*.yaml \
  gitops/application-plane/*/pooled-envs/pool-1.yaml > /dev/null && echo YAML-OK
for d in $(find gitops -name kustomization.yaml -exec dirname {} \;); do
  kubectl kustomize "$d" > /dev/null && echo "OK $d" || echo "FAIL $d"
done
```

Expected: `YAML-OK` and `OK` for every directory. (Tier-template files contain `TENANT_NAME` placeholders by design — they are not in any kustomization, so they only need to parse.)

- [ ] **Step 4: Verify every tenant Application now has the labels**

```bash
grep -rL "pod-security.kubernetes.io/enforce" \
  gitops/application-plane/*/tenants/*/jenkins.yaml \
  gitops/application-plane/*/pooled-envs/pool-1.yaml \
  gitops/application-plane/*/tier-templates/*.yaml \
  gitops/applicationsets/jenkins-appset.yaml
```

Expected: no output (no file is missing the label).

- [ ] **Step 5: Commit**

```bash
git add gitops/application-plane/ gitops/applicationsets/
git commit -m "feat(gitops): stamp PSS labels on tenant namespaces + tier quota overrides

managedNamespaceMetadata applies enforce=baseline, warn/audit=restricted
to every tenant namespace; advanced/premium tiers get sized quotas.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Split Argo Workflows RBAC

**Files:**
- Modify: `gitops/control-plane/rbac/workflow-rbac.yaml`

**Interfaces:**
- Produces: ClusterRole `gitops-workflow-role` (cluster-wide read + namespace lifecycle only), Role `gitops-workflow-ns-role` + RoleBinding `gitops-workflow-ns-rolebinding` in `argo-workflows`. Task 7 verifies with `kubectl auth can-i`.

- [ ] **Step 1: Remove the namespaced rules from the ClusterRole**

In `gitops/control-plane/rbac/workflow-rbac.yaml`, delete these two rule blocks from the ClusterRole (lines 68–76):

```yaml
  # Read/write ConfigMaps in argo-workflows namespace for workflow coordination
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]

  # Argo Workflows engine permissions
  - apiGroups: ["argoproj.io"]
    resources: ["workflows", "workflowtemplates", "workflowartifactgctasks"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

Also update the header comment block (lines 7–12) to:

```yaml
# Permissions granted (least-privilege):
#   • ClusterRole  – read ArgoCD Applications, manage Namespaces,
#                    read workload health (cluster-wide by necessity)
#   • Role         – ConfigMap read/write + Workflow engine CRUD,
#                    scoped to the argo-workflows namespace only
```

- [ ] **Step 2: Append the namespaced Role and RoleBinding**

Append to the end of `gitops/control-plane/rbac/workflow-rbac.yaml`:

```yaml
---
# Namespaced permissions: workflow coordination ConfigMaps and the Argo
# Workflows engine resources live only in argo-workflows. Granting these
# via a Role (not the ClusterRole) prevents the workflow ServiceAccount
# from writing ConfigMaps or Workflows in any other namespace.
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: gitops-workflow-ns-role
  namespace: argo-workflows
  labels:
    app.kubernetes.io/name: gitops-workflow-ns-role
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: control-plane
    app.kubernetes.io/managed-by: argocd
rules:
  # Read/write ConfigMaps for workflow coordination
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]

  # Argo Workflows engine permissions
  - apiGroups: ["argoproj.io"]
    resources: ["workflows", "workflowtemplates", "workflowartifactgctasks"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: gitops-workflow-ns-rolebinding
  namespace: argo-workflows
  labels:
    app.kubernetes.io/name: gitops-workflow-ns-rolebinding
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: control-plane
    app.kubernetes.io/managed-by: argocd
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: gitops-workflow-ns-role
subjects:
  - kind: ServiceAccount
    name: gitops-workflow-sa
    namespace: argo-workflows
```

- [ ] **Step 3: Validate**

```bash
yq eval-all 'true' gitops/control-plane/rbac/workflow-rbac.yaml > /dev/null && echo YAML-OK
grep -c "kind: Role$" gitops/control-plane/rbac/workflow-rbac.yaml
grep -A3 "kind: ClusterRole$" -n gitops/control-plane/rbac/workflow-rbac.yaml | head -5
```

Expected: `YAML-OK`; `kind: Role` count = 1; ClusterRole still present. Also confirm the ClusterRole no longer mentions configmaps:

```bash
yq 'select(.kind == "ClusterRole") | .rules[].resources[]' gitops/control-plane/rbac/workflow-rbac.yaml | grep -c configmaps ; echo "exit=$?"
```

Expected: `0` matches, `exit=1`.

- [ ] **Step 4: Commit**

```bash
git add gitops/control-plane/rbac/workflow-rbac.yaml
git commit -m "fix(gitops): scope workflow ConfigMap/Workflow permissions to argo-workflows ns

The ClusterRole granted ConfigMap write and Workflow CRUD cluster-wide,
contradicting its documented least-privilege intent. Namespaced rules
move to a Role+RoleBinding in argo-workflows.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: PR 1 verification (static + minikube) and PR creation

**Files:**
- No new files. May produce small fixes (each fix gets its own commit).

**Interfaces:**
- Consumes: everything from Tasks 1–6.

- [ ] **Step 1: Full static validation sweep**

```bash
for d in $(find gitops -name kustomization.yaml -exec dirname {} \;); do
  kubectl kustomize "$d" > /dev/null && echo "OK $d" || echo "FAIL $d"
done
helm template t gitops/helm-charts/jenkins | kubeconform -strict -ignore-missing-schemas -summary
```

Expected: all `OK`, kubeconform 0 invalid/0 errors.

- [ ] **Step 2: Push the branch (required — local ArgoCD pulls from GitHub, not the working tree)**

```bash
git push -u origin feat/gitops-security-hardening
```

- [ ] **Step 3: Point the local tenant chain at the feature branch (temporary)**

Change `targetRevision: main` to `targetRevision: feat/gitops-security-hardening` in exactly two files (the local tenants kustomization has no centralized patch — unlike `local/infrastructure/kustomization.yaml`):

1. `gitops/bootstrap/app-of-apps.yaml` (the root app)
2. `gitops/application-plane/local/tenants/basic/jenkins.yaml` (the tenant app)

Commit and push:

```bash
git add gitops/application-plane/local/tenants/basic/jenkins.yaml gitops/bootstrap/app-of-apps.yaml
git commit -m "test(gitops): point local env at feature branch for live verification

REVERT BEFORE MERGE.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: Start minikube and install ArgoCD**

```bash
minikube start --cpus 4 --memory 6g
kubectl apply -f gitops/bootstrap/argocd/namespace.yaml
helm repo add argo https://argoproj.github.io/argo-helm 2>/dev/null; helm repo update argo
helm install argocd argo/argo-cd -n argocd \
  -f gitops/bootstrap/argocd/values-base.yaml \
  -f gitops/bootstrap/argocd/values-local.yaml \
  --wait --timeout 10m
```

Expected: release deployed, argocd pods Running.

- [ ] **Step 5: Apply projects and the tenants root app**

```bash
kubectl apply -f gitops/bootstrap/projects/
kubectl apply -f gitops/bootstrap/app-of-apps.yaml
```

Expected: 4 AppProjects created (`bootstrap`, `infrastructure`, `applications`, `tenants`) + Application `app-of-apps-local`.

- [ ] **Step 6: Verify sync under the bootstrap project**

```bash
kubectl -n argocd get application app-of-apps-local -o jsonpath='{.spec.project}{"\n"}'
sleep 90
kubectl -n argocd get applications
```

Expected: project prints `bootstrap`; `app-of-apps-local` and `jenkins-basic-local` reach `Synced` (jenkins may stay `Progressing` on Health while the controller boots — that is fine).

- [ ] **Step 7: Verify PSS labels and guardrail objects in the tenant namespace**

```bash
kubectl get ns pool-1-local -o jsonpath='{.metadata.labels}' | yq -P
kubectl -n pool-1-local get networkpolicy,resourcequota,limitrange
```

Expected: labels include `pod-security.kubernetes.io/enforce: baseline`, `warn: restricted`, `audit: restricted`; 5 NetworkPolicies, 1 ResourceQuota, 1 LimitRange listed.

- [ ] **Step 8: Verify workflow RBAC scoping**

```bash
kubectl apply -f gitops/control-plane/rbac/workflow-rbac.yaml
kubectl auth can-i create configmaps -n argo-workflows --as=system:serviceaccount:argo-workflows:gitops-workflow-sa
kubectl auth can-i create configmaps -n default --as=system:serviceaccount:argo-workflows:gitops-workflow-sa
kubectl auth can-i create namespaces --as=system:serviceaccount:argo-workflows:gitops-workflow-sa
```

Expected: `yes`, `no`, `yes` — in that order.

- [ ] **Step 9: Revert the temporary branch pointers**

Restore `value: main` / `targetRevision: main` in the three files from Step 3:

```bash
git revert --no-edit HEAD   # reverts the "REVERT BEFORE MERGE" commit
git push
```

- [ ] **Step 10: Tear down and open PR 1**

```bash
minikube delete
gh pr create --title "feat(gitops): security hardening — projects, tenant guardrails, RBAC" --body "$(cat <<'EOF'
## Summary
- Root app-of-apps moved from the unrestricted `default` AppProject to a new `bootstrap` project (repo/destination/kind pinned)
- All AppProjects pin `sourceRepos` to this repository
- Jenkins wrapper chart 1.1.0 adds tenant guardrails: default-deny NetworkPolicies, tier-sized ResourceQuota, LimitRange defaults
- Every tenant namespace gets PSS labels (enforce=baseline, warn/audit=restricted) via managedNamespaceMetadata
- Argo Workflows ConfigMap/Workflow permissions scoped to the argo-workflows namespace

Implements PR 1 of docs/superpowers/specs/2026-07-16-gitops-security-hardening-design.md

## Test plan
- [x] kustomize build on all kustomization dirs
- [x] helm template + kubeconform on jenkins chart
- [x] Live minikube: root app syncs under bootstrap project; PSS labels + netpol/quota/limitrange present in pool-1-local; kubectl auth can-i confirms RBAC scoping

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

# PR 2 — External Secrets Operator end-to-end

> Branch: `git checkout -b feat/gitops-eso` from `feat/gitops-security-hardening` (retarget the PR base to `main` after PR 1 merges).

### Task 8: ESO IRSA role in Terraform

**Files:**
- Create: `inf/terraform/aws-eks-argocd/external_secrets.tf`
- Modify: `inf/terraform/aws-eks-argocd/variables.tf` (append)
- Modify: `inf/terraform/aws-eks-argocd/outputs.tf` (append)

**Interfaces:**
- Produces: output `external_secrets_irsa_role_arn` — pasted into the ESO Application values (Task 10) after `terraform apply`.

- [ ] **Step 1: Create external_secrets.tf**

Create `inf/terraform/aws-eks-argocd/external_secrets.tf`:

```hcl
# ============================================================================
# IRSA – External Secrets Operator
# ============================================================================
# Grants the ESO controller (external-secrets/external-secrets service
# account) read-only access to AWS Secrets Manager entries under the
# gitops/<environment>/ prefix. ESO syncs these into Kubernetes Secrets
# declared as ExternalSecret resources in the GitOps repo.
#
# Secrets Manager naming convention: gitops/<environment>/<name>
#   e.g. gitops/production/grafana-admin
# Entries are created out-of-band (never in Terraform — keeps secret
# values out of state). See README for the create-secret commands.
# ============================================================================

resource "aws_iam_policy" "external_secrets" {
  count = var.enable_external_secrets ? 1 : 0

  name_prefix = "${var.cluster_name}-eso-"
  description = "Read-only Secrets Manager access for External Secrets Operator (gitops/${var.environment}/* prefix)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadGitopsSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:gitops/${var.environment}/*"
      }
    ]
  })

  tags = local.common_tags
}

module "external_secrets_irsa" {
  count  = var.enable_external_secrets ? 1 : 0
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-iam.git//modules/iam-role-for-service-accounts-eks?ref=e803e25ce20a6ebd5579e0896f657fa739f6f03e"

  role_name_prefix = "${var.cluster_name}-eso-"

  role_policy_arns = {
    secrets_read = aws_iam_policy.external_secrets[0].arn
  }

  oidc_providers = {
    main = {
      provider_arn               = local.oidc_provider_arn
      namespace_service_accounts = ["external-secrets:external-secrets"]
    }
  }

  tags = local.common_tags
}
```

- [ ] **Step 2: Append the variable**

Append to `inf/terraform/aws-eks-argocd/variables.tf`:

```hcl

# ============================================================================
# External Secrets Operator
# ============================================================================

variable "enable_external_secrets" {
  description = "Create the IRSA role for External Secrets Operator (read-only Secrets Manager access under gitops/<environment>/*)"
  type        = bool
  default     = true
}
```

- [ ] **Step 3: Append the output**

Append to `inf/terraform/aws-eks-argocd/outputs.tf`:

```hcl

output "external_secrets_irsa_role_arn" {
  description = "IAM role ARN for the External Secrets Operator service account (annotate external-secrets/external-secrets with this)"
  value       = try(module.external_secrets_irsa[0].iam_role_arn, null)
}
```

- [ ] **Step 4: Validate**

```bash
cd inf/terraform/aws-eks-argocd
terraform init -backend=false
terraform validate
cd - && tflint --chdir inf/terraform/aws-eks-argocd
```

Expected: `Success! The configuration is valid.` and tflint exits clean.

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-eks-argocd/
git commit -m "feat(terraform): IRSA role for External Secrets Operator

Read-only Secrets Manager access scoped to gitops/<environment>/*.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: External Secrets wrapper chart

**Files:**
- Create: `gitops/helm-charts/external-secrets/Chart.yaml`
- Create: `gitops/helm-charts/external-secrets/values.yaml`
- Create: `gitops/helm-charts/external-secrets/templates/clustersecretstore.yaml`

**Interfaces:**
- Produces: values schema `external-secrets.serviceAccount.annotations."eks.amazonaws.com/role-arn"` and `clusterSecretStore.{enabled,name,region}`. Task 10's Applications set these. ClusterSecretStore name `aws-secrets-manager` is referenced by every ExternalSecret in Tasks 11–12.

- [ ] **Step 1: Look up the current upstream chart version**

```bash
helm repo add external-secrets https://charts.external-secrets.io 2>/dev/null
helm repo update external-secrets
helm search repo external-secrets/external-secrets --versions | head -3
```

Record the newest stable version (first row). Use it in Step 2 wherever `<ESO_CHART_VERSION>` appears, and the matching app version for `appVersion`. Also check which API version the CRDs serve (`external-secrets.io/v1` for ESO >= 0.17; `v1beta1` for older) — the ClusterSecretStore/ExternalSecret manifests in this plan use `external-secrets.io/v1`; adjust only if the looked-up chart is older than 0.17.

- [ ] **Step 2: Create Chart.yaml**

Create `gitops/helm-charts/external-secrets/Chart.yaml` (replace both `<...>` markers with the Step 1 values):

```yaml
# ============================================================================
# External Secrets Operator Wrapper Chart
# ============================================================================
# Thin wrapper around the upstream external-secrets chart providing secure
# defaults and the platform ClusterSecretStore (AWS Secrets Manager via IRSA).
# Deployed only to AWS environments (staging, production) — local clusters
# have no AWS credentials and keep manually created secrets.
apiVersion: v2
name: external-secrets
description: >-
  External Secrets Operator for the GitOps platform. Syncs AWS Secrets
  Manager entries (gitops/<environment>/*) into Kubernetes Secrets.
type: application
version: 1.0.0
appVersion: "<ESO_APP_VERSION>"
keywords:
  - secrets
  - external-secrets
  - gitops
maintainers:
  - name: devops-platform-team
dependencies:
  - name: external-secrets
    version: "<ESO_CHART_VERSION>"
    repository: https://charts.external-secrets.io
```

- [ ] **Step 3: Create values.yaml**

Create `gitops/helm-charts/external-secrets/values.yaml`:

```yaml
# ============================================================================
# External Secrets Operator – Secure Base Defaults
# ============================================================================
# The IRSA role ARN is environment-specific and injected via the ArgoCD
# Application helm.values block (see application-plane/<env>/infrastructure/
# external-secrets.yaml). It comes from:
#   terraform -chdir=inf/terraform/aws-eks-argocd output -raw external_secrets_irsa_role_arn
external-secrets:
  installCRDs: true

  serviceAccount:
    create: true
    name: external-secrets
    annotations:
      eks.amazonaws.com/role-arn: ""  # Set per environment — UPDATE THIS

  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 256Mi

  securityContext:
    runAsNonRoot: true
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    seccompProfile:
      type: RuntimeDefault
    capabilities:
      drop:
        - ALL

  webhook:
    resources:
      requests:
        cpu: 25m
        memory: 32Mi
      limits:
        cpu: 100m
        memory: 128Mi
    securityContext:
      runAsNonRoot: true
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      seccompProfile:
        type: RuntimeDefault
      capabilities:
        drop:
          - ALL

  certController:
    resources:
      requests:
        cpu: 25m
        memory: 32Mi
      limits:
        cpu: 100m
        memory: 128Mi
    securityContext:
      runAsNonRoot: true
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      seccompProfile:
        type: RuntimeDefault
      capabilities:
        drop:
          - ALL

# ── Platform ClusterSecretStore (rendered by this wrapper) ─────────────────
clusterSecretStore:
  enabled: false        # Enabled per environment via the ArgoCD Application
  name: aws-secrets-manager
  region: ap-southeast-1
```

- [ ] **Step 4: Create the ClusterSecretStore template**

Create `gitops/helm-charts/external-secrets/templates/clustersecretstore.yaml`:

```yaml
{{- /*
Platform-wide SecretStore backed by AWS Secrets Manager, authenticated via
IRSA (the external-secrets ServiceAccount's role-arn annotation).
sync-wave 1: applied after the ESO deployment in the same Application is
healthy, so the CRD webhook can admit it.
*/ -}}
{{- if .Values.clusterSecretStore.enabled }}
apiVersion: external-secrets.io/v1
kind: ClusterSecretStore
metadata:
  name: {{ .Values.clusterSecretStore.name }}
  labels:
    app.kubernetes.io/name: {{ .Values.clusterSecretStore.name }}
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: infrastructure
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  provider:
    aws:
      service: SecretsManager
      region: {{ .Values.clusterSecretStore.region }}
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets
{{- end }}
```

- [ ] **Step 5: Validate**

```bash
helm dependency build gitops/helm-charts/external-secrets
helm template eso gitops/helm-charts/external-secrets --namespace external-secrets \
  --set clusterSecretStore.enabled=true \
  | kubeconform -strict -ignore-missing-schemas -summary
helm template eso gitops/helm-charts/external-secrets --namespace external-secrets \
  --set clusterSecretStore.enabled=true | grep -c "kind: ClusterSecretStore"
```

Expected: kubeconform 0 invalid/0 errors (ESO CRD kinds skipped as missing schemas); ClusterSecretStore count = 1.

- [ ] **Step 6: Commit**

```bash
git add gitops/helm-charts/external-secrets/
git commit -m "feat(gitops): external-secrets wrapper chart with AWS ClusterSecretStore

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: ESO Applications (staging, production) + AppProject whitelist

**Files:**
- Create: `gitops/application-plane/staging/infrastructure/external-secrets.yaml`
- Create: `gitops/application-plane/production/infrastructure/external-secrets.yaml`
- Modify: `gitops/application-plane/staging/infrastructure/kustomization.yaml`
- Modify: `gitops/application-plane/production/infrastructure/kustomization.yaml`
- Modify: `gitops/bootstrap/projects/infrastructure.yaml` (clusterResourceWhitelist)

**Interfaces:**
- Consumes: wrapper chart from Task 9; role ARN output name from Task 8.
- Produces: ESO running in `external-secrets` namespace at sync-wave -1 with ClusterSecretStore `aws-secrets-manager` — required by Tasks 11–12.

- [ ] **Step 1: Create the staging Application**

Create `gitops/application-plane/staging/infrastructure/external-secrets.yaml`:

```yaml
# ============================================================================
# External Secrets Operator – Staging Environment
# ============================================================================
# Syncs AWS Secrets Manager entries (gitops/staging/*) into Kubernetes
# Secrets. Deploys BEFORE the monitoring stack (sync-wave -1 vs 0) so
# consumer Secrets exist when Grafana/Alertmanager start.
#
# Namespace:  external-secrets
# Project:    infrastructure
# Sync:       Automated
# Sync Wave:  -1
#
# Post terraform apply: paste the role ARN from
#   terraform -chdir=inf/terraform/aws-eks-argocd output -raw external_secrets_irsa_role_arn
# ============================================================================
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: external-secrets-staging
  namespace: argocd
  labels:
    app.kubernetes.io/name: external-secrets
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/managed-by: argocd
    app.kubernetes.io/component: infrastructure
    environment: staging
  annotations:
    argocd.argoproj.io/sync-wave: "-1"
    notifications.argoproj.io/subscribe.on-sync-failed.slack: devops-alerts
    description: "External Secrets Operator – staging environment"
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: infrastructure
  source:
    repoURL: https://github.com/HuyNguyen260398/devops-engineer-profile.git  # UPDATE THIS
    targetRevision: main
    path: gitops/helm-charts/external-secrets
    helm:
      releaseName: external-secrets
      values: |
        external-secrets:
          serviceAccount:
            annotations:
              eks.amazonaws.com/role-arn: "REPLACE_WITH_ESO_IRSA_ROLE_ARN"  # UPDATE THIS after terraform apply
        clusterSecretStore:
          enabled: true
          region: ap-southeast-1
  destination:
    server: https://kubernetes.default.svc
    namespace: external-secrets
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 10s
        factor: 2
        maxDuration: 5m
```

- [ ] **Step 2: Create the production Application**

Create `gitops/application-plane/production/infrastructure/external-secrets.yaml` — identical to Step 1 except:
- `name: external-secrets-production`
- `environment: production` label, plus `critical: "true"` label
- annotations: `notifications.argoproj.io/subscribe.on-sync-failed.slack: devops-critical-alerts` and `notifications.argoproj.io/subscribe.on-health-degraded.slack: devops-critical-alerts`
- description lines say `production`
- `syncPolicy.automated.prune: false` with comment `# Never auto-prune the secrets pipeline in production` (matches the production infrastructure convention)

Full file (write it out, do not copy-edit blindly):

```yaml
# ============================================================================
# External Secrets Operator – Production Environment
# ============================================================================
# Syncs AWS Secrets Manager entries (gitops/production/*) into Kubernetes
# Secrets. Deploys BEFORE the monitoring stack (sync-wave -1 vs 0) so
# consumer Secrets exist when Grafana/Alertmanager start.
#
# Namespace:  external-secrets
# Project:    infrastructure
# Sync:       Automated heal, manual prune (production safety)
# Sync Wave:  -1
#
# Post terraform apply: paste the role ARN from
#   terraform -chdir=inf/terraform/aws-eks-argocd output -raw external_secrets_irsa_role_arn
# ============================================================================
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: external-secrets-production
  namespace: argocd
  labels:
    app.kubernetes.io/name: external-secrets
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/managed-by: argocd
    app.kubernetes.io/component: infrastructure
    environment: production
    critical: "true"
  annotations:
    argocd.argoproj.io/sync-wave: "-1"
    notifications.argoproj.io/subscribe.on-sync-failed.slack: devops-critical-alerts
    notifications.argoproj.io/subscribe.on-health-degraded.slack: devops-critical-alerts
    description: "External Secrets Operator – production environment"
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: infrastructure
  source:
    repoURL: https://github.com/HuyNguyen260398/devops-engineer-profile.git  # UPDATE THIS
    targetRevision: main
    path: gitops/helm-charts/external-secrets
    helm:
      releaseName: external-secrets
      values: |
        external-secrets:
          serviceAccount:
            annotations:
              eks.amazonaws.com/role-arn: "REPLACE_WITH_ESO_IRSA_ROLE_ARN"  # UPDATE THIS after terraform apply
        clusterSecretStore:
          enabled: true
          region: ap-southeast-1
  destination:
    server: https://kubernetes.default.svc
    namespace: external-secrets
  syncPolicy:
    automated:
      prune: false     # Never auto-prune the secrets pipeline in production
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 10s
        factor: 2
        maxDuration: 5m
```

- [ ] **Step 3: Register both files in their kustomizations**

In `gitops/application-plane/staging/infrastructure/kustomization.yaml` and `gitops/application-plane/production/infrastructure/kustomization.yaml`, add to the `resources:` list (first entry, before `kube-prometheus-stack.yaml`):

```yaml
  # ── Secrets pipeline (wave -1: before every consumer) ──────────────────
  - external-secrets.yaml
```

- [ ] **Step 4: Whitelist ClusterSecretStore in the infrastructure AppProject**

In `gitops/bootstrap/projects/infrastructure.yaml`, append to `clusterResourceWhitelist` (after the AWX Operator CRDs block):

```yaml
    # ── External Secrets Operator ────────────────────────────────────────
    - group: external-secrets.io
      kind: ClusterSecretStore
```

- [ ] **Step 5: Validate**

```bash
kubectl kustomize gitops/application-plane/staging/infrastructure > /dev/null && echo OK-staging
kubectl kustomize gitops/application-plane/production/infrastructure > /dev/null && echo OK-production
yq eval-all 'true' gitops/bootstrap/projects/infrastructure.yaml > /dev/null && echo YAML-OK
```

Expected: `OK-staging`, `OK-production`, `YAML-OK`.

- [ ] **Step 6: Commit**

```bash
git add gitops/application-plane/ gitops/bootstrap/projects/infrastructure.yaml
git commit -m "feat(gitops): deploy External Secrets Operator to staging and production

Sync-wave -1 so ESO and the ClusterSecretStore exist before consumers.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: ExternalSecrets for Grafana + Alertmanager, remove credential placeholders

**Files:**
- Create: `gitops/helm-charts/kube-prometheus-stack/templates/externalsecrets.yaml`
- Modify: `gitops/helm-charts/kube-prometheus-stack/values.yaml` (grafana admin block, lines ~187–191; append `externalSecrets:` block)
- Modify: `gitops/helm-charts/kube-prometheus-stack/Chart.yaml` (wrapper version bump)
- Modify: `gitops/application-plane/staging/infrastructure/kube-prometheus-stack.yaml`
- Modify: `gitops/application-plane/production/infrastructure/kube-prometheus-stack.yaml`

**Interfaces:**
- Consumes: ClusterSecretStore `aws-secrets-manager` (Task 9/10).
- Produces: Secrets `grafana-admin-credentials` (keys `admin-user`, `admin-password`) and `alertmanager-receivers` (keys `pagerduty-service-key`, `slack-webhook-critical`, `slack-webhook-production`, `slack-webhook-staging` — whichever the env's Secrets Manager JSON contains) in `monitoring`.

- [ ] **Step 1: Bump the wrapper chart version**

In `gitops/helm-charts/kube-prometheus-stack/Chart.yaml`, increment the wrapper `version:` patch level (e.g. `1.0.0` → `1.1.0`; read the current value first and bump minor). Do NOT touch the pinned dependency version `67.9.0`.

- [ ] **Step 2: Create the ExternalSecrets template**

Create `gitops/helm-charts/kube-prometheus-stack/templates/externalsecrets.yaml`:

```yaml
{{- /*
Sync monitoring credentials from AWS Secrets Manager. Enabled only on AWS
environments (staging/production) via the ArgoCD Application helm.values.

Secrets Manager entries (JSON):
  gitops/<env>/grafana-admin           {"username": "...", "password": "..."}
  gitops/<env>/alertmanager-receivers  {"pagerduty-service-key": "...",
                                        "slack-webhook-critical": "...",
                                        "slack-webhook-production": "..."}
                                       (staging uses {"slack-webhook-staging": "..."})
*/ -}}
{{- if .Values.externalSecrets.enabled }}
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: grafana-admin-credentials
  labels:
    app.kubernetes.io/name: grafana-admin-credentials
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: infrastructure
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: {{ .Values.externalSecrets.storeName }}
  target:
    name: grafana-admin-credentials
    creationPolicy: Owner
  data:
    - secretKey: admin-user
      remoteRef:
        key: gitops/{{ .Values.externalSecrets.environment }}/grafana-admin
        property: username
    - secretKey: admin-password
      remoteRef:
        key: gitops/{{ .Values.externalSecrets.environment }}/grafana-admin
        property: password
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: alertmanager-receivers
  labels:
    app.kubernetes.io/name: alertmanager-receivers
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/component: infrastructure
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: {{ .Values.externalSecrets.storeName }}
  target:
    name: alertmanager-receivers
    creationPolicy: Owner
  dataFrom:
    - extract:
        key: gitops/{{ .Values.externalSecrets.environment }}/alertmanager-receivers
{{- end }}
```

- [ ] **Step 3: Replace the Grafana admin block and add externalSecrets values**

In `gitops/helm-charts/kube-prometheus-stack/values.yaml`, replace:

```yaml
    # Admin credentials – MUST be overridden per environment.
    # Production: use External Secrets Operator with AWS Secrets Manager.
    # Staging/local: set adminPassword in Application helm.values override.
    adminUser: admin
    adminPassword: "CHANGE_ME_PER_ENVIRONMENT"  # Never commit real credentials
```

with:

```yaml
    # Admin credentials:
    #   AWS (staging/production): sourced from AWS Secrets Manager via the
    #     grafana-admin-credentials ExternalSecret — set admin.existingSecret
    #     in the Application helm.values (see externalSecrets below).
    #   Local: chart default credentials (local-only, no override committed).
```

Then append at the very end of the file (top level, sibling of the `kube-prometheus-stack:` key):

```yaml

# ── External Secrets (wrapper-rendered, AWS environments only) ─────────────
externalSecrets:
  enabled: false
  environment: ""              # staging | production
  storeName: aws-secrets-manager
```

- [ ] **Step 4: Rewire the staging Application**

In `gitops/application-plane/staging/infrastructure/kube-prometheus-stack.yaml`:

(a) Replace line 69 `adminPassword: "staging-grafana-password"  # Replace with External Secrets ref` with:

```yaml
            admin:
              existingSecret: grafana-admin-credentials
              userKey: admin-user
              passwordKey: admin-password
```

(b) In the `alertmanager:` block, add `secrets` under `alertmanagerSpec:` (sibling of `replicas: 1`):

```yaml
              secrets:
                - alertmanager-receivers   # Mounted at /etc/alertmanager/secrets/alertmanager-receivers/
```

(c) Replace the slack receiver:

```yaml
                - name: "slack-staging"
                  slack_configs:
                    - api_url: "https://hooks.slack.com/services/REPLACE/WITH/WEBHOOK"  # UPDATE THIS
```

with:

```yaml
                - name: "slack-staging"
                  slack_configs:
                    - api_url_file: /etc/alertmanager/secrets/alertmanager-receivers/slack-webhook-staging
```

(keep `channel`, `title`, `text` lines unchanged).

(d) Append to the `helm.values: |` block, after the `prometheusOperator:` section, at the same indent level as `kube-prometheus-stack:`:

```yaml
        externalSecrets:
          enabled: true
          environment: staging
```

(e) Update the header comment line `#   • adminPassword:  set inline (staging – non-production credential)` to `#   • Grafana admin + Slack webhook: AWS Secrets Manager via ESO (gitops/staging/*)`.

- [ ] **Step 5: Rewire the production Application**

In `gitops/application-plane/production/infrastructure/kube-prometheus-stack.yaml`:

(a) Replace lines 72–77:

```yaml
          # adminPassword sourced from External Secrets Operator:
          #   externalSecret targeting AWS Secrets Manager key: grafana/admin-password
          # Replace adminPassword below with ESO-managed Secret reference once
          # External Secrets Operator is deployed to the cluster.
          grafana:
            adminPassword: "REPLACE_WITH_EXTERNAL_SECRET"
```

with:

```yaml
          # Grafana admin credentials sourced from AWS Secrets Manager
          # (gitops/production/grafana-admin) via the grafana-admin-credentials
          # ExternalSecret rendered by this wrapper chart.
          grafana:
            admin:
              existingSecret: grafana-admin-credentials
              userKey: admin-user
              passwordKey: admin-password
```

(b) Under `alertmanagerSpec:` add (sibling of `replicas: 2`):

```yaml
              secrets:
                - alertmanager-receivers   # Mounted at /etc/alertmanager/secrets/alertmanager-receivers/
```

(c) Replace the three secret-bearing receiver configs:

```yaml
                - name: "pagerduty-production"
                  pagerduty_configs:
                    - service_key: "REPLACE_WITH_PAGERDUTY_SERVICE_KEY"  # UPDATE THIS
```
→
```yaml
                - name: "pagerduty-production"
                  pagerduty_configs:
                    - service_key_file: /etc/alertmanager/secrets/alertmanager-receivers/pagerduty-service-key
```

```yaml
                - name: "slack-critical"
                  slack_configs:
                    - api_url: "https://hooks.slack.com/services/REPLACE/WITH/WEBHOOK"  # UPDATE THIS
```
→
```yaml
                - name: "slack-critical"
                  slack_configs:
                    - api_url_file: /etc/alertmanager/secrets/alertmanager-receivers/slack-webhook-critical
```

```yaml
                - name: "slack-production"
                  slack_configs:
                    - api_url: "https://hooks.slack.com/services/REPLACE/WITH/WEBHOOK"  # UPDATE THIS
```
→
```yaml
                - name: "slack-production"
                  slack_configs:
                    - api_url_file: /etc/alertmanager/secrets/alertmanager-receivers/slack-webhook-production
```

(keep `description`/`severity`/`channel`/`title`/`text` lines unchanged in each).

(d) Append to the `helm.values: |` block after `prometheusOperator:`:

```yaml
        externalSecrets:
          enabled: true
          environment: production
```

(e) Update the header comment `#   • adminPassword:      managed via External Secrets Operator (AWS Secrets Manager)` to `#   • Secrets:            Grafana admin, PagerDuty key, Slack webhooks via ESO (gitops/production/*)`.

- [ ] **Step 6: Validate**

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null; helm repo update prometheus-community
helm dependency build gitops/helm-charts/kube-prometheus-stack
helm template kps gitops/helm-charts/kube-prometheus-stack --namespace monitoring \
  --set externalSecrets.enabled=true --set externalSecrets.environment=production \
  | kubeconform -strict -ignore-missing-schemas -summary
helm template kps gitops/helm-charts/kube-prometheus-stack --namespace monitoring \
  --set externalSecrets.enabled=true --set externalSecrets.environment=production \
  | grep -c "kind: ExternalSecret"
grep -rn "REPLACE_WITH_EXTERNAL_SECRET\|REPLACE_WITH_PAGERDUTY\|CHANGE_ME_PER_ENVIRONMENT\|staging-grafana-password\|hooks.slack.com/services/REPLACE" gitops/ ; echo "grep-exit=$?"
kubectl kustomize gitops/application-plane/staging/infrastructure > /dev/null && echo OK-staging
kubectl kustomize gitops/application-plane/production/infrastructure > /dev/null && echo OK-production
```

Expected: kubeconform 0 invalid/0 errors; ExternalSecret count = 2; credential-placeholder grep exits 1 (none left anywhere in gitops/); both kustomize builds OK.

- [ ] **Step 7: Commit**

```bash
git add gitops/helm-charts/kube-prometheus-stack/ gitops/application-plane/
git commit -m "feat(gitops): source Grafana and Alertmanager credentials from Secrets Manager

Grafana uses admin.existingSecret; Alertmanager mounts the receivers
secret and references PagerDuty/Slack material via *_file paths. All
inline credential placeholders removed from the repo.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: git-credentials ExternalSecret + documentation

**Files:**
- Create: `gitops/control-plane/rbac/git-credentials-externalsecret.yaml`
- Modify: `gitops/control-plane/rbac/git-credentials-template.yaml` (header note)
- Modify: `gitops/README.md` (append secrets section)
- Modify: `inf/terraform/aws-eks-argocd/README.md` (append ESO section)

**Interfaces:**
- Consumes: ClusterSecretStore `aws-secrets-manager` (Task 9).
- Produces: documented Secrets Manager naming convention + create-secret commands used at rollout.

- [ ] **Step 1: Create the ExternalSecret**

Create `gitops/control-plane/rbac/git-credentials-externalsecret.yaml`:

```yaml
# ============================================================================
# Git Credentials – ExternalSecret (AWS environments)
# ============================================================================
# Replaces the manual git-credentials Secret (git-credentials-template.yaml)
# on AWS clusters. Requires External Secrets Operator + the
# aws-secrets-manager ClusterSecretStore (deployed at sync-wave -1).
#
# Secrets Manager entry (JSON):
#   gitops/<environment>/git-credentials  {"username": "git-bot", "token": "ghp_..."}
#
# Required environment variables (substituted via envsubst):
#   ENVIRONMENT   staging | production
#
# Apply:
#   export ENVIRONMENT=staging
#   envsubst < gitops/control-plane/rbac/git-credentials-externalsecret.yaml | kubectl apply -f -
# ============================================================================
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: git-credentials
  namespace: argo-workflows
  labels:
    app.kubernetes.io/name: git-credentials
    app.kubernetes.io/component: control-plane
    app.kubernetes.io/part-of: gitops-platform
    app.kubernetes.io/managed-by: argocd
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: git-credentials
    creationPolicy: Owner
  dataFrom:
    - extract:
        key: gitops/${ENVIRONMENT}/git-credentials
```

- [ ] **Step 2: Point the manual template at the ExternalSecret for AWS**

In `gitops/control-plane/rbac/git-credentials-template.yaml`, replace the header lines:

```yaml
# For AWS EKS with IRSA:
#   Use a GitHub App or fine-grained personal access token
#   stored in AWS Secrets Manager, fetched by External Secrets Operator.
```

with:

```yaml
# For AWS EKS (staging/production): DO NOT use this template — apply
# git-credentials-externalsecret.yaml instead (AWS Secrets Manager via ESO).
# This manual template is for LOCAL clusters only.
```

- [ ] **Step 3: Document the secrets pipeline in gitops/README.md**

Append to `gitops/README.md`:

```markdown

## Secrets Management (AWS environments)

Secrets never live in Git. External Secrets Operator (deployed at sync-wave -1
from `application-plane/<env>/infrastructure/external-secrets.yaml`) syncs
AWS Secrets Manager entries into Kubernetes Secrets.

**Naming convention:** `gitops/<environment>/<name>`

| Secrets Manager key | Kubernetes Secret (namespace) | Consumer |
|---|---|---|
| `gitops/<env>/grafana-admin` | `grafana-admin-credentials` (monitoring) | Grafana `admin.existingSecret` |
| `gitops/<env>/alertmanager-receivers` | `alertmanager-receivers` (monitoring) | Alertmanager `*_file` receiver refs |
| `gitops/<env>/git-credentials` | `git-credentials` (argo-workflows) | Lifecycle workflows |

**Creating the entries** (values shown are examples — use real ones):

```bash
aws secretsmanager create-secret --name gitops/production/grafana-admin \
  --secret-string '{"username":"admin","password":"<GENERATED>"}'
aws secretsmanager create-secret --name gitops/production/alertmanager-receivers \
  --secret-string '{"pagerduty-service-key":"<KEY>","slack-webhook-critical":"<URL>","slack-webhook-production":"<URL>"}'
aws secretsmanager create-secret --name gitops/staging/alertmanager-receivers \
  --secret-string '{"slack-webhook-staging":"<URL>"}'
aws secretsmanager create-secret --name gitops/production/git-credentials \
  --secret-string '{"username":"git-bot","token":"<FINE_GRAINED_PAT>"}'
```

**Rollout order:** create the Secrets Manager entries → `terraform apply` in
`inf/terraform/aws-eks-argocd` → paste the `external_secrets_irsa_role_arn`
output into `application-plane/<env>/infrastructure/external-secrets.yaml` →
commit and let ArgoCD sync. Local clusters do not run ESO; create local
secrets manually (see `control-plane/rbac/git-credentials-template.yaml`).
```

- [ ] **Step 4: Document the IRSA role in the Terraform README**

Append to `inf/terraform/aws-eks-argocd/README.md`:

```markdown

## External Secrets Operator IRSA

`external_secrets.tf` creates an IRSA role for the ESO controller
(`external-secrets/external-secrets` service account) with read-only access
to Secrets Manager entries under `gitops/<environment>/*`. Disable with
`enable_external_secrets = false`.

After `terraform apply`, feed the role ARN to the GitOps layer:

```bash
terraform output -raw external_secrets_irsa_role_arn
# → paste into gitops/application-plane/<env>/infrastructure/external-secrets.yaml
```

Secrets Manager entries are created out-of-band (never in Terraform) so
secret values stay out of state — see `gitops/README.md` for the commands.
```

- [ ] **Step 5: Validate**

```bash
ENVIRONMENT=staging envsubst < gitops/control-plane/rbac/git-credentials-externalsecret.yaml | yq 'true' > /dev/null && echo YAML-OK
```

Expected: `YAML-OK`.

- [ ] **Step 6: Commit**

```bash
git add gitops/control-plane/rbac/ gitops/README.md inf/terraform/aws-eks-argocd/README.md
git commit -m "feat(gitops): ExternalSecret for workflow git credentials + secrets docs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: PR 2 verification and PR creation

- [ ] **Step 1: Full static sweep**

```bash
for d in $(find gitops -name kustomization.yaml -exec dirname {} \;); do
  kubectl kustomize "$d" > /dev/null && echo "OK $d" || echo "FAIL $d"
done
cd inf/terraform/aws-eks-argocd && terraform init -backend=false && terraform validate && cd -
tflint --chdir inf/terraform/aws-eks-argocd
grep -rn "ghp_\|hooks.slack.com/services/T\|AKIA" gitops/ inf/ ; echo "secret-scan-exit=$?"
```

Expected: all `OK`; terraform valid; tflint clean; secret scan exits 1 (nothing found).

- [ ] **Step 2: Push and open PR 2**

```bash
git push -u origin feat/gitops-eso
gh pr create --base feat/gitops-security-hardening \
  --title "feat(gitops): External Secrets Operator end-to-end" --body "$(cat <<'EOF'
## Summary
- Terraform IRSA role for ESO scoped to Secrets Manager `gitops/<env>/*` (read-only)
- external-secrets wrapper chart + ClusterSecretStore (AWS Secrets Manager via IRSA)
- ESO Application per env at sync-wave -1
- Grafana admin, Alertmanager PagerDuty/Slack, and workflow git credentials now sourced from Secrets Manager; all inline credential placeholders removed

Implements PR 2 of docs/superpowers/specs/2026-07-16-gitops-security-hardening-design.md
Stacked on #<PR1-number> — retarget base to main after it merges.

## Test plan
- [x] terraform validate + tflint
- [x] helm template + kubeconform on both wrapper charts
- [x] kustomize build on all environments
- [ ] Post-merge (AWS): create Secrets Manager entries → terraform apply → commit role ARN → verify ExternalSecrets reach SecretSynced

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Replace `<PR1-number>` with the actual PR 1 number before running.

---

# PR 3 — Network hardening (VPC endpoints + ArgoCD ALB)

> Branch: `git checkout main && git pull && git checkout -b feat/network-hardening` (no file overlap with PRs 1–2 except none — safe from main).

### Task 14: VPC endpoints for the EKS VPC

**Files:**
- Create: `inf/terraform/aws-eks/vpc_endpoints.tf`
- Modify: `inf/terraform/aws-eks/variables.tf` (append)

**Interfaces:**
- Consumes: `module.vpc` (`vpc_id`, `vpc_cidr_block`, `private_subnets`, `private_route_table_ids`, `public_route_table_ids`), `local.cluster_name`, `local.common_tags` — all already defined in `inf/terraform/aws-eks`.

- [ ] **Step 1: Append the variables**

Append to `inf/terraform/aws-eks/variables.tf`:

```hcl

# VPC Endpoints
variable "enable_vpc_endpoints" {
  description = "Create S3 gateway + interface VPC endpoints so node/pod AWS API traffic (image pulls, STS, logs) stays on the AWS backbone instead of traversing the NAT gateway"
  type        = bool
  default     = true
}

variable "vpc_interface_endpoint_services" {
  description = "AWS services to create interface VPC endpoints for (each costs ~USD 7/month + data — trim on staging if needed). The secretsmanager endpoint serves External Secrets Operator."
  type        = list(string)
  default = [
    "ecr.api",
    "ecr.dkr",
    "sts",
    "ec2",
    "elasticloadbalancing",
    "logs",
    "autoscaling",
    "eks",
    "secretsmanager",
  ]
}
```

- [ ] **Step 2: Create vpc_endpoints.tf**

Create `inf/terraform/aws-eks/vpc_endpoints.tf`:

```hcl
# ============================================================================
# VPC Endpoints – Private AWS API Connectivity
# ============================================================================
# Keeps AWS API traffic from nodes and pods (ECR image pulls, STS for IRSA,
# CloudWatch logs, Secrets Manager for ESO, etc.) inside the AWS backbone
# via PrivateLink instead of routing through the NAT gateway over the
# public internet. S3 uses a free gateway endpoint (ECR image layers).
#
# Ref: https://docs.aws.amazon.com/eks/latest/userguide/private-clusters.html
# ============================================================================

resource "aws_security_group" "vpc_endpoints" {
  count = var.enable_vpc_endpoints ? 1 : 0

  name_prefix = "${local.cluster_name}-vpce-"
  description = "Allow HTTPS to interface VPC endpoints from inside the VPC"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTPS from VPC CIDR"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [module.vpc.vpc_cidr_block]
  }

  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-vpc-endpoints"
  })

  lifecycle {
    create_before_destroy = true
  }
}

module "vpc_endpoints" {
  #checkov:skip=CKV_TF_1: Terraform Registry with exact version pin is the accepted supply-chain control for this project; git-URL + commit-hash migration is tracked separately.
  count   = var.enable_vpc_endpoints ? 1 : 0
  source  = "terraform-aws-modules/vpc/aws//modules/vpc-endpoints"
  version = "6.6.0"

  vpc_id             = module.vpc.vpc_id
  security_group_ids = [aws_security_group.vpc_endpoints[0].id]

  endpoints = merge(
    {
      s3 = {
        service         = "s3"
        service_type    = "Gateway"
        route_table_ids = concat(module.vpc.private_route_table_ids, module.vpc.public_route_table_ids)
        tags            = { Name = "${local.cluster_name}-s3-gateway" }
      }
    },
    {
      for svc in var.vpc_interface_endpoint_services :
      replace(svc, ".", "_") => {
        service             = svc
        service_type        = "Interface"
        subnet_ids          = module.vpc.private_subnets
        private_dns_enabled = true
        tags                = { Name = "${local.cluster_name}-${svc}" }
      }
    }
  )

  tags = local.common_tags
}
```

- [ ] **Step 3: Validate**

```bash
cd inf/terraform/aws-eks && terraform init -backend=false && terraform validate && cd -
tflint --chdir inf/terraform/aws-eks
```

Expected: `Success! The configuration is valid.`; tflint clean.

- [ ] **Step 4: Commit**

```bash
git add inf/terraform/aws-eks/
git commit -m "feat(terraform): VPC endpoints for private AWS API connectivity

S3 gateway + interface endpoints (ECR, STS, EC2, ELB, logs, autoscaling,
EKS, Secrets Manager) so cluster AWS API traffic stays off the public
internet. Gated by enable_vpc_endpoints.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 15: Secure ArgoCD endpoint (ALB ingress)

**Files:**
- Modify: `gitops/bootstrap/argocd/values-aws.yaml` (replace ingress block + header)

**Interfaces:**
- Consumes: AWS Load Balancer Controller (already deployed by `inf/terraform/aws-eks-argocd/alb_controller.tf`).
- Produces: envsubst contract `ARGOCD_HOSTNAME`, `ARGOCD_ALB_SCHEME`, `ARGOCD_CERT_ARN`, `ARGOCD_ALLOWED_CIDRS` used by the deploy flow.

- [ ] **Step 1: Rewrite values-aws.yaml**

Replace the entire contents of `gitops/bootstrap/argocd/values-aws.yaml` with:

```yaml
# ============================================================================
# ArgoCD Helm Values - AWS EKS Overrides
# ============================================================================
# Uses envsubst for environment-specific injection.
# Required env vars:
#   ARGOCD_IRSA_ROLE_ARN   IAM role for ArgoCD service accounts (ECR read)
#   ARGOCD_HOSTNAME        e.g. argocd.staging.example.com
#   ARGOCD_ALB_SCHEME      internal (default, VPN/private access) |
#                          internet-facing (pair with tight ALLOWED_CIDRS + WAF)
#   ARGOCD_CERT_ARN        ACM certificate ARN for ARGOCD_HOSTNAME
#   ARGOCD_ALLOWED_CIDRS   comma-separated CIDRs allowed to reach the ALB,
#                          e.g. 10.0.0.0/16 — never 0.0.0.0/0
#
# TLS is terminated at the ALB (ACM) and re-encrypted to argocd-server
# (backend-protocol HTTPS; server.insecure stays false in values-base.yaml).

server:
  serviceAccount:
    annotations:
      eks.amazonaws.com/role-arn: "${ARGOCD_IRSA_ROLE_ARN}"

  ingress:
    enabled: true
    ingressClassName: alb
    hostname: "${ARGOCD_HOSTNAME}"
    annotations:
      alb.ingress.kubernetes.io/scheme: "${ARGOCD_ALB_SCHEME}"
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
      alb.ingress.kubernetes.io/certificate-arn: "${ARGOCD_CERT_ARN}"
      alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS13-1-2-2021-06
      alb.ingress.kubernetes.io/inbound-cidrs: "${ARGOCD_ALLOWED_CIDRS}"
      alb.ingress.kubernetes.io/backend-protocol: HTTPS
      alb.ingress.kubernetes.io/healthcheck-path: /healthz
      alb.ingress.kubernetes.io/healthcheck-protocol: HTTPS

repoServer:
  serviceAccount:
    annotations:
      eks.amazonaws.com/role-arn: "${ARGOCD_IRSA_ROLE_ARN}"

controller:
  serviceAccount:
    annotations:
      eks.amazonaws.com/role-arn: "${ARGOCD_IRSA_ROLE_ARN}"
```

- [ ] **Step 2: Validate the rendered ingress**

```bash
export ARGOCD_IRSA_ROLE_ARN="arn:aws:iam::111111111111:role/test" \
       ARGOCD_HOSTNAME="argocd.staging.example.com" \
       ARGOCD_ALB_SCHEME="internal" \
       ARGOCD_CERT_ARN="arn:aws:acm:ap-southeast-1:111111111111:certificate/test" \
       ARGOCD_ALLOWED_CIDRS="10.0.0.0/16"
envsubst < gitops/bootstrap/argocd/values-aws.yaml > /tmp/values-aws-rendered.yaml
helm template argocd argo/argo-cd -n argocd \
  -f gitops/bootstrap/argocd/values-base.yaml \
  -f /tmp/values-aws-rendered.yaml \
  --show-only templates/argocd-server/ingress.yaml
```

Expected: an Ingress with `ingressClassName: alb`, host `argocd.staging.example.com`, and all seven ALB annotations. (If the argo repo is not added: `helm repo add argo https://argoproj.github.io/argo-helm && helm repo update argo`.)

- [ ] **Step 3: Commit**

```bash
git add gitops/bootstrap/argocd/values-aws.yaml
git commit -m "feat(gitops): TLS ALB ingress for ArgoCD (internal by default)

ACM-terminated TLS 1.2+/1.3, HTTPS-only listener, CIDR-restricted,
re-encrypted to argocd-server. Scheme/cert/CIDRs via envsubst.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 16: PR 3 verification and PR creation

- [ ] **Step 1: Static sweep**

```bash
cd inf/terraform/aws-eks && terraform init -backend=false && terraform validate && cd -
tflint --chdir inf/terraform/aws-eks
yq eval-all 'true' gitops/bootstrap/argocd/values-aws.yaml > /dev/null && echo YAML-OK
```

Expected: valid, clean, `YAML-OK`. (Note: raw `values-aws.yaml` contains `${VAR}` strings — yq still parses them as plain scalars.)

- [ ] **Step 2: Push and open PR 3**

```bash
git push -u origin feat/network-hardening
gh pr create --title "feat: network hardening — VPC endpoints + ArgoCD TLS ALB" --body "$(cat <<'EOF'
## Summary
- S3 gateway + 9 interface VPC endpoints keep cluster AWS API traffic (image pulls, STS/IRSA, logs, Secrets Manager) off the public internet; gated by `enable_vpc_endpoints`
- ArgoCD exposed via an internal ALB with ACM TLS (1.2+/1.3), HTTPS-only listener, CIDR allowlist, and re-encryption to argocd-server

Implements PR 3 of docs/superpowers/specs/2026-07-16-gitops-security-hardening-design.md

## Test plan
- [x] terraform validate + tflint on inf/terraform/aws-eks
- [x] helm template renders the ArgoCD Ingress with all ALB annotations
- [ ] Post-merge (AWS): terraform apply shows only endpoint/SG additions; ALB provisions and ArgoCD reachable at ARGOCD_HOSTNAME from allowed CIDRs only

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.
