---
post_title: "GitOps Local Deployment Guide"
author1: "DevOps Team"
post_slug: "gitops-local-deployment-guide"
microsoft_alias: ""
featured_image: ""
categories: []
tags: ["kubernetes", "monitoring", "prometheus", "grafana", "jenkins", "local-dev", "gitops", "argocd"]
ai_note: "Assisted"
summary: "Step-by-step guide to bootstrap the full GitOps platform locally — ArgoCD, kube-prometheus-stack, and Jenkins — using minikube, kind, or k3s."
post_date: "2026-03-12"
---

## GitOps Local Deployment Guide

This guide walks through the complete bootstrap sequence for the local development environment: ArgoCD, the observability stack (`kube-prometheus-stack`), and Jenkins. All services are managed via GitOps — no manual `helm install` required after the initial bootstrap.

> [!NOTE]
> All commands assume you are running from the **repository root** (`c:\Workspace\devops-engineer-profile` or equivalent).

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| `kubectl` | >= 1.29 | Configured against your local cluster |
| `helm` | >= 3.14 | Used to install ArgoCD |
| `envsubst` | any | Part of `gettext` (`brew install gettext` / `apt install gettext`) |
| Local cluster | minikube / kind / k3s | Storage class `standard` must be available |
| ArgoCD CLI | >= 2.10 | Optional — for status checks and manual syncs |

**Verify your cluster is reachable before starting:**

```bash
kubectl cluster-info
kubectl get nodes
```

---

## Deployment Order

The platform follows a strict sync-wave order. Always deploy in this sequence:

```
1. ArgoCD                  ← GitOps engine (manual Helm install)
2. AppProjects             ← RBAC scoping for argocd
3. App-of-Apps (infra)     ← bootstraps kube-prometheus-stack (wave 0)
4. App-of-Apps (tenants)   ← bootstraps Jenkins tenants (waves 2–4)
5. Jenkins Pool (manual)   ← shared pool bootstrap (wave 1, outside app-of-apps)
```

---

## Step 1 — Install ArgoCD

ArgoCD is the only component installed via `helm` directly. Everything else is managed by ArgoCD itself.

```bash
# 1a. Check whether the argocd namespace already exists or is stuck terminating
kubectl get namespace argocd
```

> [!IMPORTANT]
> If the output shows `STATUS: Terminating`, the namespace is stuck from a previous install. Run the recovery commands below before continuing — otherwise step 1d will fail.
> ```powershell
> # 1. Clear finalizers on any lingering ArgoCD ApplicationSets inside the namespace
> kubectl get applicationsets -n argocd -o name | ForEach-Object { kubectl patch $_ -n argocd --type=merge -p "{`"metadata`":{`"finalizers`":[]}}`" }
> # 2. Clear finalizers on any lingering ArgoCD Applications inside the namespace
> kubectl get applications -n argocd -o name | ForEach-Object { kubectl patch $_ -n argocd --type=merge -p "{`"metadata`":{`"finalizers`":[]}}`" }
> # 3. Wait for the namespace to fully disappear
> kubectl wait --for=delete namespace/argocd --timeout=60s
> ```

```bash
# 1b. Create the ArgoCD namespace with Pod Security labels
kubectl apply -f gitops/bootstrap/argocd/namespace.yaml

# 1c. Add the Argo Helm repository
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update argo

# 1d. Install ArgoCD with local resource-light overrides
helm upgrade --install argocd argo/argo-cd --namespace argocd --version 9.4.7 --values gitops/bootstrap/argocd/values-base.yaml --values gitops/bootstrap/argocd/values-local.yaml --wait --timeout 10m
```

**Verify ArgoCD is running:**

```bash
kubectl get pods -n argocd
```

Expected output (all pods `Running` or `Completed`):

```
argocd-application-controller-0           1/1   Running
argocd-argocd-application-set-controller  1/1   Running
argocd-argocd-repo-server                 1/1   Running
argocd-argocd-server                      1/1   Running
argocd-redis                              1/1   Running
```

**Access the ArgoCD UI (local NodePort 30080):**

```bash
# Get the initial admin password
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d && echo

open http://localhost:30080   # kind / k3s / Docker Desktop
# minikube: open http://$(minikube ip):30080
```

---

## Step 2 — Apply ArgoCD Projects

Projects define RBAC boundaries for each part of the platform.

```bash
kubectl apply -f gitops/bootstrap/projects/
```

This creates three AppProjects:

| Project | Manages |
|---|---|
| `infrastructure` | `monitoring` namespace — kube-prometheus-stack |
| `applications` | `pool-1-local` namespace — Jenkins pool and tenants |
| `tenants` | Tenant-scoped namespaces |

**Verify:**

```bash
kubectl get appprojects -n argocd
```

---

## Step 3 — Start kube-prometheus-stack (Observability)

The infrastructure App-of-Apps watches `gitops/application-plane/local/infrastructure/` and auto-deploys `kube-prometheus-stack-local` at **sync wave 0** — before any application workloads.

```bash
# Set your forked repository URL
export GIT_REPO_URL=https://github.com/your-org/devops-engineer-profile.git

# Apply the infrastructure root Application
envsubst < gitops/bootstrap/app-of-apps-infrastructure.yaml | kubectl apply -f -
```

> [!IMPORTANT]
> The `repoURL` in the Application manifests is a placeholder. `GIT_REPO_URL` must point to your fork or the sync will fail with a repository not found error.

**Watch the rollout** (CRD installation takes 1–2 minutes on first sync):

```bash
# ArgoCD Application status
kubectl get application kube-prometheus-stack-local -n argocd -w

# Pod rollout in the monitoring namespace
kubectl get pods -n monitoring -w
```

Expected pods when healthy:

```
kube-prometheus-stack-grafana-xxx                      3/3   Running
kube-prometheus-stack-kube-state-metrics-xxx           1/1   Running
kube-prometheus-stack-operator-xxx                     1/1   Running
kube-prometheus-stack-prometheus-node-exporter-xxx     1/1   Running
prometheus-kube-prometheus-stack-prometheus-0          2/2   Running
```

> [!NOTE]
> Alertmanager is **disabled** in the local environment. No `alertmanager` pod will appear — this is expected.

**Access Grafana (NodePort 32300):**

```bash
open http://localhost:32300          # kind / k3s / Docker Desktop
open http://$(minikube ip):32300     # minikube
```

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin` |

> [!WARNING]
> These credentials are for local development only. Never reuse them in staging or production.

**Access Prometheus (port-forward):**

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
open http://localhost:9090
```

---

## Step 4 — Start Jenkins Tenants (App-of-Apps)

The tenant App-of-Apps watches `gitops/application-plane/local/tenants/` and auto-deploys all Jenkins tenant Applications at **sync waves 2–4**.

```bash
# Apply the tenant root Application
envsubst < gitops/bootstrap/app-of-apps.yaml | kubectl apply -f -
```

ArgoCD will discover `gitops/application-plane/local/tenants/basic/jenkins.yaml` via `kustomization.yaml` and create the `jenkins-basic-local` Application.

**Watch tenant Applications appear:**

```bash
kubectl get applications -n argocd -w
```

---

## Step 5 — Start the Jenkins Shared Pool

The pool Application lives in `pooled-envs/` — **outside** the app-of-apps watch path — and must be applied once manually. It provisions the `pool-1-local` namespace and shared pool infrastructure that basic-tier tenants rely on.

```bash
kubectl apply -f gitops/application-plane/local/pooled-envs/pool-1.yaml
```

**Watch the pool and tenant pods come up:**

```bash
kubectl get pods -n pool-1-local -w
```

Expected pods when healthy:

```
jenkins-pool-1-0        2/2   Running
jenkins-basic-local-0   2/2   Running
```

**Access Jenkins instances:**

| Instance | NodePort | URL (kind/k3s) | URL (minikube) |
|---|---|---|---|
| Pool-1 (shared) | `32000` | `http://localhost:32000` | `http://$(minikube ip):32000` |
| Basic tenant | `32001` | `http://localhost:32001` | `http://$(minikube ip):32001` |

**Retrieve the Jenkins admin password:**

```bash
# For the pool instance
kubectl exec -n pool-1-local $(kubectl get pod -n pool-1-local -l app.kubernetes.io/component=jenkins-controller -o jsonpath='{.items[0].metadata.name}') -- cat /run/secrets/additional/chart-admin-password && echo

# For the basic tenant instance
kubectl exec -n pool-1-local $(kubectl get pod -n pool-1-local -l app.kubernetes.io/instance=jenkins-basic-local -o jsonpath='{.items[0].metadata.name}') -- cat /run/secrets/additional/chart-admin-password && echo
```

---

## Full Platform Status Check

Once all steps are complete, verify the entire platform:

```bash
# All ArgoCD Applications should be Synced + Healthy
kubectl get applications -n argocd

# Namespaces created
kubectl get namespaces | grep -E 'argocd|monitoring|pool-1-local'

# Pods across all platform namespaces
kubectl get pods -n argocd
kubectl get pods -n monitoring
kubectl get pods -n pool-1-local
```

---

## Local Service Reference

| Service | URL | Credentials | Notes |
|---|---|---|---|
| ArgoCD UI | `http://localhost:30080` | `admin` / see Step 1 | NodePort |
| Grafana | `http://localhost:32300` | `admin` / `admin` | NodePort |
| Prometheus | `http://localhost:9090` | — | Port-forward only |
| Jenkins Pool-1 | `http://localhost:32000` | `admin` / see Step 5 | NodePort |
| Jenkins Basic | `http://localhost:32001` | `admin` / see Step 5 | NodePort |

> [!NOTE]
> For minikube, replace `localhost` with `$(minikube ip)` in all URLs above.

---

## Troubleshooting

### ArgoCD sync fails with `metadata.annotations: Too long`

This is the known 262 KiB CRD annotation size limit. The Application manifest already includes the required fix — verify both options are present in `gitops/application-plane/local/infrastructure/kube-prometheus-stack.yaml`:

```yaml
syncOptions:
  - ServerSideApply=true
  - Replace=true   # Required for kube-prometheus-stack CRDs
```

Then trigger a manual sync:

```bash
argocd app sync kube-prometheus-stack-local
```

### NodePort not reachable on kind

kind does not expose NodePorts on `localhost` by default. Use port-forward as a fallback:

```bash
# Grafana
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 32300:80

# Jenkins Pool-1
kubectl port-forward -n pool-1-local svc/jenkins-pool-1 32000:8080

# Jenkins Basic tenant
kubectl port-forward -n pool-1-local svc/jenkins-basic-local 32001:8080
```

### Pods stuck in `Pending` — storage class missing

```bash
kubectl get storageclass
```

If `standard` is missing:

```bash
# minikube
minikube addons enable default-storageclass

# kind
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/master/deploy/local-path-storage.yaml
```

### ArgoCD namespace stuck in `Terminating` (Helm install fails)

This happens when ArgoCD custom resources (Applications, ApplicationSets) inside the namespace still have finalizers set. Kubernetes cannot delete the namespace until all resources inside it are fully removed, but the finalizers block removal because the ArgoCD controller that processes them no longer exists. The `helm upgrade --install` command fails with:

```
secrets "sh.helm.release.v1.argocd.v1" is forbidden: unable to create new content in namespace argocd because it is being terminated
```

> [!NOTE]
> Patching the namespace's own finalizers (`kubectl patch namespace argocd ...`) will report "no change" and will **not** fix this — the block is on the resources inside the namespace, not on the namespace itself.

Fix — identify and clear finalizers on all lingering ArgoCD resources, then wait for the namespace to disappear and re-create it:

```powershell
# 1. Clear finalizers on any lingering ApplicationSets
kubectl get applicationsets -n argocd -o name | ForEach-Object { kubectl patch $_ -n argocd --type=merge -p "{`"metadata`":{`"finalizers`":[]}}`" }
# 2. Clear finalizers on any lingering Applications
kubectl get applications -n argocd -o name | ForEach-Object { kubectl patch $_ -n argocd --type=merge -p "{`"metadata`":{`"finalizers`":[]}}`" }
# 3. Wait for full deletion
kubectl wait --for=delete namespace/argocd --timeout=60s
# 4. Re-create the namespace and re-install ArgoCD
kubectl apply -f gitops/bootstrap/argocd/namespace.yaml
helm upgrade --install argocd argo/argo-cd --namespace argocd --version 9.4.7 --values gitops/bootstrap/argocd/values-base.yaml --values gitops/bootstrap/argocd/values-local.yaml --wait --timeout 10m
```

### Application stuck in `OutOfSync` after bootstrap

```bash
# Force a hard refresh and re-sync
argocd app get <app-name> --hard-refresh
argocd app sync <app-name>
```

---

## Teardown and Cleanup

Remove all local platform resources in the **reverse** of the deployment order. Each step waits for its resources to fully terminate before the next one starts.

> [!CAUTION]
> This is a destructive operation. All workloads, persistent data (Prometheus metrics, Jenkins jobs/configs), and namespaces will be permanently deleted. There is no rollback.

### Cleanup Order

```
5. Jenkins Pool Application    ← delete first (wave 1 resources)
4. Tenants App-of-Apps         ← removes Jenkins tenant Applications
3. Infrastructure App-of-Apps  ← removes kube-prometheus-stack Application
2. AppProjects                 ← remove RBAC scoping
1. ArgoCD                      ← uninstall Helm release last
0. Namespaces and PVCs         ← final manual sweep
```

---

### Step C1 — Delete the Jenkins Shared Pool Application

The pool Application was applied manually and must be deleted manually. Enable cascade deletion to remove the `pool-1-local` namespace and all Jenkins workloads.

```bash
kubectl patch application jenkins-pool-1-local -n argocd --type=merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'

kubectl delete application jenkins-pool-1-local -n argocd
```

Wait for the namespace to terminate:

```bash
kubectl wait --for=delete namespace/pool-1-local --timeout=120s
```

> [!NOTE]
> Jenkins `PersistentVolumeClaims` (PVCs) are not removed automatically by cascade delete. Clean them up after the namespace is gone:
> ```bash
> kubectl get pvc -n pool-1-local
> kubectl delete pvc --all -n pool-1-local
> ```
> If the namespace is already gone, any orphaned PVs will move to `Released` state — delete them with `kubectl delete pv <pv-name>`.

---

### Step C2 — Delete the Tenant App-of-Apps

Deleting the root tenant Application causes ArgoCD to cascade-delete all child tenant Applications (e.g., `jenkins-basic-local`).

```bash
kubectl patch application app-of-apps -n argocd --type=merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'

kubectl delete application app-of-apps -n argocd

# Verify all tenant child Applications are gone
kubectl get applications -n argocd
```

---

### Step C3 — Delete the Infrastructure App-of-Apps

Deleting the root infrastructure Application cascade-deletes `kube-prometheus-stack-local` and all monitoring resources.

> [!NOTE]
> The Application name includes the environment suffix (e.g., `app-of-apps-infrastructure-local`). Adjust if your environment uses a different suffix.

```bash
kubectl patch application app-of-apps-infrastructure-local -n argocd --type=merge -p '{"metadata":{"finalizers":["resources-finalizer.argocd.argoproj.io"]}}'

kubectl delete application app-of-apps-infrastructure-local -n argocd
```

ArgoCD cascade-deletes all workloads inside the namespace but does **not** delete the namespace itself. After the delete command returns, confirm the namespace is empty then remove it manually:

```bash
# Confirm no resources remain inside monitoring
kubectl get all -n monitoring

# Delete the now-empty namespace
kubectl delete namespace monitoring
kubectl wait --for=delete namespace/monitoring --timeout=60s
```

> [!NOTE]
> Prometheus `PersistentVolumeClaims` are not removed by cascade delete. If any remain after the namespace is gone, delete them:
> ```bash
> kubectl get pvc -n monitoring
> kubectl delete pvc --all -n monitoring
> ```

---

### Step C4 — Delete AppProjects

```bash
kubectl delete -f gitops/bootstrap/projects/

# Confirm all three projects are gone
kubectl get appprojects -n argocd
```

---

### Step C5 — Uninstall ArgoCD

```bash
helm uninstall argocd --namespace argocd

# Wait for all ArgoCD pods to terminate
kubectl wait --for=delete pod --all -n argocd --timeout=120s
```

If any ArgoCD resources have lingering finalizers, clear them before deleting the namespace:

```powershell
kubectl get applicationsets -n argocd -o name | ForEach-Object { kubectl patch $_ -n argocd --type=merge -p "{`"metadata`":{`"finalizers`":[]}}`" }
kubectl get applications -n argocd -o name | ForEach-Object { kubectl patch $_ -n argocd --type=merge -p "{`"metadata`":{`"finalizers`":[]}}`" }
```

Then delete the namespace:

```bash
kubectl delete namespace argocd
kubectl wait --for=delete namespace/argocd --timeout=60s
```

---

### Step C6 — Final Sweep (PVs and CRDs)

After all namespaces are gone, check for and remove any orphaned PersistentVolumes and ArgoCD CRDs:

```bash
# Check for Released / Failed PVs left behind by Prometheus or Jenkins
kubectl get pv | grep -E 'Released|Failed'
# Delete individually as needed
# kubectl delete pv <pv-name>

# Remove ArgoCD CRDs (optional — safe to leave if you plan to reinstall soon)
kubectl get crd | grep argoproj.io
kubectl delete crd applications.argoproj.io applicationsets.argoproj.io appprojects.argoproj.io
```

> [!TIP]
> Removing the ArgoCD CRDs is optional. If you leave them, the next `helm upgrade --install` will reuse them. If you delete them, the install is fully clean but takes slightly longer as CRDs are re-created.

---

### Full Cleanup Verification

```bash
# No platform namespaces should remain
kubectl get namespaces | grep -E 'argocd|monitoring|pool-1-local'

# No orphaned PVCs or PVs
kubectl get pvc --all-namespaces
kubectl get pv

# No ArgoCD Applications or Projects remain
kubectl get applications --all-namespaces 2>/dev/null || echo "CRD removed"
kubectl get appprojects --all-namespaces 2>/dev/null  || echo "CRD removed"
```

Expected output: all commands return empty or the "CRD removed" message.

---

## Next Steps

- Add a custom `ServiceMonitor` to scrape your application metrics — see the [Jenkins + Prometheus Integration](../gitops/README.md#jenkins--prometheus-integration) section in the GitOps README.
- Onboard a new Jenkins tenant — see [Tenant Management](../gitops/README.md#tenant-management) in the GitOps README.
- For staging/production deployment, refer to the [kube-prometheus-stack GitOps Implementation Plan](KUBE_PROMETHEUS_STACK_GITOPS_IMPLEMENTATION_PLAN.md) and [Jenkins ArgoCD Implementation](JENKINS_ARGOCD_IMPLEMENTATION.md).
