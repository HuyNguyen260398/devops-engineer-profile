## ArgoCD GitOps Deployment on AWS EKS

This document describes the ArgoCD deployment on the existing AWS EKS cluster
using Terraform, Helm, and the App-of-Apps GitOps pattern.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS EKS Cluster                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  ArgoCD Namespace                        │   │
│  │                                                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │   │
│  │  │  Server   │  │Controller│  │   Repo Server      │   │   │
│  │  │ (2 repl.) │  │(1 repl.) │  │   (2 repl.)        │   │   │
│  │  └──────────┘  └──────────┘  └────────────────────┘   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐   │   │
│  │  │  Redis   │  │  Notif.  │  │  ApplicationSet    │   │   │
│  │  │          │  │          │  │  (2 repl.)          │   │   │
│  │  └──────────┘  └──────────┘  └────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──── App-of-Apps Pattern ────────────────────────────────┐   │
│  │  Root App ──► Infrastructure Project                     │   │
│  │            ──► Applications Project                      │   │
│  │                  ├── ingress-nginx                       │   │
│  │                  ├── cert-manager                        │   │
│  │                  ├── monitoring                          │   │
│  │                  └── sample-app                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Terraform Resources (`inf/terraform/aws-eks/argocd.tf`)

| Resource | Purpose |
|---|---|
| `kubernetes_namespace.argocd` | Dedicated namespace with labels |
| `module.argocd_irsa` | IAM Roles for Service Accounts (ECR access) |
| `helm_release.argocd` | ArgoCD Helm chart deployment |
| `kubectl_manifest.argocd_app_of_apps` | Bootstrap App-of-Apps root application |
| `kubectl_manifest.argocd_project_*` | ArgoCD AppProject definitions |

### Helm Values (`inf/terraform/aws-eks/helm-values/argocd-values.yaml`)

- ArgoCD v2.13.3 with HA-ready configuration
- Server: 2 replicas with HPA (2-5), PodDisruptionBudget
- Controller: Single replica with 180s resync period
- Repo Server: 2 replicas with HPA (2-5)
- ApplicationSet: 2 replicas for GitOps generators
- Security: `runAsNonRoot`, `readOnlyRootFilesystem`, dropped capabilities
- Monitoring: Prometheus ServiceMonitor for all components
- RBAC: Role-based access (devops, developer, readonly)

### App-of-Apps Pattern (`k8s/argocd-apps/`)

The App-of-Apps pattern uses a root ArgoCD Application to manage child
applications declaratively:

```
k8s/
├── argocd-apps/                  # Root Helm chart
│   ├── Chart.yaml
│   ├── values.yaml               # Default values (all apps disabled)
│   ├── values-production.yaml    # Production overrides
│   ├── values-staging.yaml       # Staging overrides
│   └── templates/
│       └── applications.yaml     # Templated Application manifests
└── manifests/                    # Application manifests
    └── sample-app/
        └── deployment.yaml
```

## Prerequisites

- AWS EKS cluster deployed via `inf/terraform/aws-eks/`
- `kubectl`, `helm`, and `terraform` CLI tools installed
- `kubectl` provider plugin: `terraform init` will install `gavinbunney/kubectl`
- AWS credentials configured with EKS cluster access

## Deployment

### Step 1: Generate ArgoCD Admin Password Hash

```bash
# Generate bcrypt hash for ArgoCD admin password
htpasswd -nbBC 10 '' 'YOUR_SECURE_PASSWORD' | tr -d ':\n' | sed 's/$2y/$2a/'

# Set as environment variable (never commit to VCS)
export TF_VAR_argocd_admin_password_hash='$2a$10$...'
```

### Step 2: Update Configuration

Edit `inf/terraform/aws-eks/environments/production.tfvars`:

```hcl
enable_argocd                      = true
argocd_chart_version               = "7.7.10"
argocd_app_of_apps_repo_url        = "https://github.com/<org>/<repo>.git"
argocd_app_of_apps_target_revision = "main"
argocd_app_of_apps_path            = "k8s/argocd-apps"
```

### Step 3: Apply Terraform

```bash
cd inf/terraform/aws-eks

terraform init -upgrade
terraform plan -var-file="environments/production.tfvars"
terraform apply -var-file="environments/production.tfvars"
```

### Step 4: Access ArgoCD Dashboard

```bash
# Port-forward ArgoCD server
kubectl port-forward -n argocd svc/argocd-server 8080:443

# Open https://localhost:8080
# Username: admin
# Password: the password used to generate the hash in Step 1
```

### Step 5: Verify Deployment

```bash
# Check ArgoCD pods
kubectl get pods -n argocd

# Check ArgoCD applications
kubectl get applications -n argocd

# Check AppProjects
kubectl get appprojects -n argocd
```

## Adding New Applications

To add a new application to the GitOps pipeline:

1. Create manifests in `k8s/manifests/<app-name>/`
2. Add the app to `k8s/argocd-apps/values.yaml`:

```yaml
apps:
  my-new-app:
    enabled: false
    namespace: my-namespace
    path: k8s/manifests/my-new-app
```

3. Enable per environment in `values-production.yaml`:

```yaml
apps:
  my-new-app:
    enabled: true
```

4. Commit and push. ArgoCD auto-syncs the change.

## Security Features

- **IRSA**: ArgoCD service accounts use IAM Roles for AWS API access
- **RBAC**: Three-tier access model (devops/developer/readonly)
- **Pod Security**: Non-root containers, read-only filesystems, dropped
  capabilities
- **Network Isolation**: Dedicated namespace with controlled access
- **Secrets**: Admin password provided via environment variable, never stored in
  VCS
- **AppProjects**: Restrict which namespaces and resources each project can
  manage

## Monitoring Integration

All ArgoCD components expose Prometheus metrics via ServiceMonitor resources
targeting the existing `monitoring` namespace with `release: kube-prometheus-stack`
label selector. Metrics are available in Grafana after deploying the ArgoCD
dashboard (ID: 14584).

## Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `enable_argocd` | bool | `true` | Enable ArgoCD deployment |
| `argocd_namespace` | string | `argocd` | Kubernetes namespace |
| `argocd_chart_version` | string | `7.7.10` | Helm chart version |
| `argocd_admin_password_hash` | string | `""` | Bcrypt password hash (sensitive) |
| `argocd_app_of_apps_repo_url` | string | `""` | Git repo URL for App-of-Apps |
| `argocd_app_of_apps_target_revision` | string | `HEAD` | Git branch/tag/commit |
| `argocd_app_of_apps_path` | string | `k8s/argocd-apps` | Path in repo |
