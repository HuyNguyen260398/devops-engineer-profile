# ArgoCD Deployment Guide

This directory contains all Helm values, Kubernetes manifests, and scripts
required to deploy [ArgoCD](https://argo-cd.readthedocs.io/) to both a
**local Kubernetes cluster** (for testing) and **AWS EKS** (via Helm + kubectl).

## Directory Structure

```
ops/argocd/
 argocd-values.yaml          Base Helm values (security, RBAC, configs, metrics)
 argocd-values-local.yaml    Overrides for local clusters (scale-down, NodePort)
 argocd-values-aws.yaml      Overrides for AWS EKS (IRSA annotations, ingress off)
 deploy-aws.sh               Deployment script for AWS EKS
 manifests/
    namespace.yaml          ArgoCD Kubernetes namespace
    ingress.yaml            Standalone ALB Ingress (AWS only)
    app-of-apps.yaml        App-of-Apps bootstrap (envsubst template)
    projects/
        infrastructure.yaml ArgoCD Project for infrastructure workloads
        applications.yaml   ArgoCD Project for application workloads
 README.md
```

### Values File Layering

Helm merges values left-to-right (last file wins):

| Deployment | Command |
|------------|---------|
| **Local** | `-f argocd-values.yaml -f argocd-values-local.yaml` |
| **AWS EKS** | `-f argocd-values.yaml -f argocd-values-aws.yaml` (via `deploy-aws.sh`) |

---

## AWS EKS Deployment

### Prerequisites

- EKS cluster running (provisioned by `inf/terraform/aws-eks/`)
- AWS Load Balancer Controller running on the cluster
- `kubectl` configured for the target cluster
- `helm` >= 3 and `envsubst` installed
- ArgoCD IRSA role provisioned:
  ```bash
  cd inf/terraform/aws-eks-argocd
  terraform apply -var-file environments/staging.tfvars
  ```

### Full Install

```bash
# 1. Get IRSA role ARN from Terraform
export ARGOCD_IRSA_ROLE_ARN=$(
  cd inf/terraform/aws-eks-argocd && terraform output -raw argocd_irsa_role_arn
)

# 2. Set environment
export ENVIRONMENT=staging

# 3. Install
cd ops/argocd
bash deploy-aws.sh install
```

`deploy-aws.sh install` performs in order:

1. Creates the `argocd` namespace
2. Installs ArgoCD via Helm (substituting the IRSA role ARN into service account annotations)
3. Applies the standalone ALB Ingress (`manifests/ingress.yaml`)
4. Applies ArgoCD Projects (`manifests/projects/`)

### Upgrade

```bash
export ARGOCD_IRSA_ROLE_ARN=<role-arn>
export ENVIRONMENT=staging
bash deploy-aws.sh upgrade
```

### Uninstall

```bash
bash deploy-aws.sh uninstall
```

> The script deletes the Ingress first (so the ALB Controller removes the ALB
> from AWS, freeing subnet/IGW dependencies), then uninstalls the Helm release.
> This avoids the `DependencyViolation` error when later running
> `terraform destroy` on the EKS/VPC infrastructure.

### Retrieve ALB URL

```bash
kubectl get ingress argocd-server -n argocd \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

The ALB may take 23 minutes to provision after `install`.

### Admin Password

```bash
bash deploy-aws.sh password
```

Default username: `admin`. Change the password after first login.

### Bootstrap App-of-Apps (GitOps)

After ArgoCD is running, apply the App-of-Apps manifest to enable full GitOps:

```bash
export ARGOCD_APPS_REPO_URL=https://github.com/your-org/your-repo
export ARGOCD_APPS_TARGET_REVISION=HEAD
export ARGOCD_APPS_PATH=ops/k8s/argocd-apps
export ENVIRONMENT=staging

bash deploy-aws.sh app-of-apps
```

---

## AWS Infrastructure (Terraform)

The AWS-specific infrastructure for ArgoCD (IAM/IRSA role) lives in a
**separate Terraform module** so it can be managed independently of the EKS cluster:

```
inf/terraform/aws-eks-argocd/
 main.tf           IRSA IAM role for ArgoCD service accounts
 locals.tf
 variables.tf
 outputs.tf         argocd_irsa_role_arn
 provider.tf
 README.md
 environments/
     staging.tfvars
     production.tfvars.example
```

> The **ALB** is **not** managed by Terraform. It is created automatically by
> the AWS Load Balancer Controller when `manifests/ingress.yaml` is applied,
> and destroyed when the Ingress is deleted (`deploy-aws.sh uninstall`).

### Why a Separate Module?

| Concern | Owner |
|---------|-------|
| EKS cluster, VPC, node groups | `inf/terraform/aws-eks/` |
| ArgoCD IRSA (IAM role) | `inf/terraform/aws-eks-argocd/` |
| ArgoCD install (Helm + manifests) | `ops/argocd/deploy-aws.sh` |
| ALB (lifecycle via Ingress) | `ops/argocd/manifests/ingress.yaml` |

This separation means you can destroy/recreate the IRSA role without touching
the EKS cluster, and you can redeploy ArgoCD without modifying Terraform state.

---

## Local Cluster Deployment

### Prerequisites

- `kubectl` connected to a local cluster (Docker Desktop, minikube, kind, k3s):

```bash
kubectl cluster-info && kubectl get nodes
```

### Add the Helm Repository

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update argo
```

### Install

```bash
kubectl create namespace argocd

helm install argocd argo/argo-cd \
  --namespace argocd \
  --version 9.4.2 \
  -f argocd-values.yaml \
  -f argocd-values-local.yaml \
  --wait --timeout 10m
```

### Upgrade

```bash
helm upgrade argocd argo/argo-cd \
  --namespace argocd \
  --version 9.4.2 \
  -f argocd-values.yaml \
  -f argocd-values-local.yaml \
  --wait --timeout 10m
```

### Uninstall

```bash
helm uninstall argocd --namespace argocd
kubectl delete namespace argocd
```

---

## Accessing the ArgoCD UI

### Port-Forward (local or AWS without Ingress)

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:80
```

Open <http://localhost:8080>.

### NodePort (local values only)

The local override exposes the server on NodePort `30443`:

```
https://localhost:30443
```

### ALB URL (AWS only)

```bash
kubectl get ingress argocd-server -n argocd \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

---

## Retrieving the Admin Password

```bash
# Linux/macOS
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 --decode && echo

# PowerShell
kubectl -n argocd get secret argocd-initial-admin-secret `
  -o jsonpath="{.data.password}" | ForEach-Object {
    [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_))
  }
```

**Username:** `admin`  
**Password:** *(output above)*

---

## Useful kubectl Commands

```bash
# Pod status
kubectl get pods -n argocd -o wide

# Logs
kubectl logs -n argocd -l app.kubernetes.io/component=server -f
kubectl logs -n argocd -l app.kubernetes.io/component=application-controller -f
kubectl logs -n argocd -l app.kubernetes.io/component=repo-server -f

# Describe (troubleshoot)
kubectl describe pod -n argocd -l app.kubernetes.io/component=server

# Services & Ingress
kubectl get svc     -n argocd
kubectl get ingress -n argocd

# Rolling restart
kubectl rollout restart deployment/argocd-server -n argocd

# Helm info
helm list        -n argocd
helm status argocd -n argocd
```

---

## deploy-aws.sh Reference

```
Usage: bash deploy-aws.sh <command> [environment]
```

| Command | Description |
|---------|-------------|
| `install` | Create namespace, install Helm, apply Ingress + Projects |
| `upgrade` | Upgrade Helm release and re-apply manifests |
| `uninstall` | Delete Ingress (removes ALB), uninstall Helm, delete namespace |
| `status` | Show pods, services, Ingress, and ALB URL |
| `password` | Retrieve initial admin password |
| `app-of-apps` | Apply the App-of-Apps bootstrap Application |

### Required Environment Variables

| Variable | Command(s) | Description |
|----------|-----------|-------------|
| `ARGOCD_IRSA_ROLE_ARN` | install, upgrade | IAM role ARN from `terraform output -raw argocd_irsa_role_arn` |
| `ENVIRONMENT` | all | `staging` or `production` (default: `staging`) |
| `ARGOCD_APPS_REPO_URL` | app-of-apps | Git repo URL for App-of-Apps |
| `ARGOCD_APPS_TARGET_REVISION` | app-of-apps | Branch/tag (default: `HEAD`) |
| `ARGOCD_APPS_PATH` | app-of-apps | Path in repo (default: `ops/k8s/argocd-apps`) |
