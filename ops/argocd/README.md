# ArgoCD Deployment Guide

This directory contains the Helm values and scripts required to deploy
[ArgoCD](https://argo-cd.readthedocs.io/) to both a **local Kubernetes
cluster** (for testing) and **AWS EKS** (production via Terraform).

## Directory Structure

| File | Description |
|------|-------------|
| `argocd-values.yaml` | Base Helm values shared across all environments |
| `argocd-values-local.yaml` | Lightweight overrides for local clusters |
| `deploy-argocd-local.sh` | Helper script for local install/upgrade/uninstall |

## Prerequisites

- [kubectl](https://kubernetes.io/docs/tasks/tools/) configured and connected
  to a cluster
- [Helm 3](https://helm.sh/docs/intro/install/) installed
- A running local Kubernetes cluster — any of the following:
  - [Docker Desktop](https://docs.docker.com/desktop/kubernetes/) (enable
    Kubernetes in settings)
  - [minikube](https://minikube.sigs.k8s.io/)
  - [kind](https://kind.sigs.k8s.io/)
  - [k3s / k3d](https://k3s.io/)

Verify your cluster is reachable:

```bash
kubectl cluster-info
kubectl get nodes
```

## Quick Start (Local Cluster)

The fastest way to get ArgoCD running locally:

```bash
cd ops/argocd
bash deploy-argocd-local.sh install
```

This runs all the steps below automatically (add repo, create namespace,
install chart, print credentials).

## Step-by-Step Helm Commands

### Add the ArgoCD Helm Repository

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update argo
```

### Create the Namespace

```bash
kubectl create namespace argocd
```

### Install ArgoCD

Install using the base values with local overrides layered on top:

```bash
helm install argocd argo/argo-cd \
  --namespace argocd \
  --version 7.7.12 \
  -f argocd-values.yaml \
  -f argocd-values-local.yaml \
  --wait --timeout 10m
```

> The local override file scales components to a single replica, reduces
> resource requests/limits, disables network policies and ServiceMonitors,
> and exposes the server via NodePort on port `30443`.

### Upgrade ArgoCD

After modifying values files, apply changes with:

```bash
helm upgrade argocd argo/argo-cd \
  --namespace argocd \
  --version 7.7.12 \
  -f argocd-values.yaml \
  -f argocd-values-local.yaml \
  --wait --timeout 10m
```

### Uninstall ArgoCD

```bash
helm uninstall argocd --namespace argocd
kubectl delete namespace argocd
```

## Accessing the ArgoCD UI

### Option 1 — Port Forward (recommended)

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Then open <https://localhost:8080> in your browser.

### Option 2 — NodePort (Docker Desktop)

The local values file exposes the server on NodePort `30443`:

```
https://localhost:30443
```

## Retrieving the Admin Password

ArgoCD generates a random admin password stored in a Kubernetes secret:

```powershell
kubectl -n argocd get secret argocd-initial-admin-secret `
  -o jsonpath="{.data.password}" | ForEach-Object {
    [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_))
  }
```

- **Username:** `admin`
- **Password:** *(output of the command above)*

Change the password after first login:

```bash
argocd login localhost:8080 --insecure
argocd account update-password
```

## Useful kubectl Commands

### Check Pod Status

```bash
kubectl get pods -n argocd -o wide
```

### View Logs

```bash
# Application controller
kubectl logs -n argocd -l app.kubernetes.io/component=application-controller -f

# Server
kubectl logs -n argocd -l app.kubernetes.io/component=server -f

# Repo server
kubectl logs -n argocd -l app.kubernetes.io/component=repo-server -f
```

### Describe a Pod (troubleshooting)

```bash
kubectl describe pod -n argocd -l app.kubernetes.io/component=server
```

### List Services and Endpoints

```bash
kubectl get svc -n argocd
kubectl get endpoints -n argocd
```

### Restart a Component

```bash
kubectl rollout restart deployment/argocd-server -n argocd
kubectl rollout restart deployment/argocd-repo-server -n argocd
kubectl rollout restart statefulset/argocd-application-controller -n argocd
```

### Check Helm Release

```bash
helm list -n argocd
helm status argocd -n argocd
helm get values argocd -n argocd
```

## Deploy Script Reference

The `deploy-argocd-local.sh` script wraps the commands above:

```
Usage: ./deploy-argocd-local.sh [install|upgrade|uninstall|status|password]
```

| Command | Description |
|---------|-------------|
| `install` | Add Helm repo, create namespace, install chart, print credentials |
| `upgrade` | Upgrade the existing release with current values |
| `uninstall` | Remove the Helm release and delete the namespace |
| `status` | Show pods, services, and access instructions |
| `password` | Retrieve the admin password from the cluster |

## Production Deployment (AWS EKS)

For production, ArgoCD is deployed via Terraform using the same base values
file. The Terraform configuration lives at:

```
inf/terraform/aws-eks/argocd.tf
```

Key differences from local:

| Aspect | Local | Production (EKS) |
|--------|-------|-------------------|
| Replicas | 1 per component | 2+ with autoscaling |
| Resources | Minimal requests/limits | Production-grade sizing |
| PDB | Disabled | Enabled (`minAvailable: 1`) |
| Network Policy | Disabled | Enabled |
| ServiceMonitor | Disabled | Enabled (Prometheus) |
| Service type | NodePort | ClusterIP (behind Ingress/LB) |
| IRSA | N/A | IAM role for ECR access |

## Values File Layering

Helm merges values files left-to-right (last wins):

```
argocd-values.yaml          <-- base configuration (security, RBAC, configs)
  └── argocd-values-local.yaml   <-- local overrides (scale down, NodePort)
```

To add a staging or custom environment, create another overlay file and
pass it as an additional `-f` flag:

```bash
helm install argocd argo/argo-cd \
  -n argocd \
  -f argocd-values.yaml \
  -f argocd-values-staging.yaml \
  --wait
```
