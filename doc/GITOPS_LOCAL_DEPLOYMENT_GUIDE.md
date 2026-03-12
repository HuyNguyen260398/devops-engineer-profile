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
# 1a. Create the ArgoCD namespace with Pod Security labels
kubectl apply -f gitops/bootstrap/argocd/namespace.yaml

# 1b. Add the Argo Helm repository
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update argo

# 1c. Install ArgoCD with local resource-light overrides
helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --version 9.4.7 \
  --values gitops/bootstrap/argocd/values-base.yaml \
  --values gitops/bootstrap/argocd/values-local.yaml \
  --wait --timeout 10m
```

**Verify ArgoCD is running:**

```bash
kubectl get pods -n argocd
```

Expected output (all pods `Running` or `Completed`):

```
argocd-application-controller-0          1/1   Running
argocd-argocd-application-set-controller  1/1   Running
argocd-argocd-repo-server                1/1   Running
argocd-argocd-server                     1/1   Running
argocd-redis                             1/1   Running
```

**Access the ArgoCD UI (local NodePort 30080):**

```bash
# Get the initial admin password
kubectl get secret argocd-initial-admin-secret -n argocd \
  -o jsonpath='{.data.password}' | base64 -d && echo

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
kubectl exec -n pool-1-local \
  $(kubectl get pod -n pool-1-local -l app.kubernetes.io/component=jenkins-controller \
    -o jsonpath='{.items[0].metadata.name}') \
  -- cat /run/secrets/additional/chart-admin-password && echo

# For the basic tenant instance
kubectl exec -n pool-1-local \
  $(kubectl get pod -n pool-1-local -l app.kubernetes.io/instance=jenkins-basic-local \
    -o jsonpath='{.items[0].metadata.name}') \
  -- cat /run/secrets/additional/chart-admin-password && echo
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

### Application stuck in `OutOfSync` after bootstrap

```bash
# Force a hard refresh and re-sync
argocd app get <app-name> --hard-refresh
argocd app sync <app-name>
```

---

## Next Steps

- Add a custom `ServiceMonitor` to scrape your application metrics — see the [Jenkins + Prometheus Integration](../gitops/README.md#jenkins--prometheus-integration) section in the GitOps README.
- Onboard a new Jenkins tenant — see [Tenant Management](../gitops/README.md#tenant-management) in the GitOps README.
- For staging/production deployment, refer to the [kube-prometheus-stack GitOps Implementation Plan](KUBE_PROMETHEUS_STACK_GITOPS_IMPLEMENTATION_PLAN.md) and [Jenkins ArgoCD Implementation](JENKINS_ARGOCD_IMPLEMENTATION.md).
