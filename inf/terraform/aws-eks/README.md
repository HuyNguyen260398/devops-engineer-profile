# AWS EKS Cluster Terraform Configuration

## Overview

This Terraform configuration deploys a production-ready Amazon Elastic Kubernetes Service (EKS) cluster on AWS with comprehensive monitoring and observability capabilities. The setup is designed to be cost-effective while maintaining high availability and scalability.

## Architecture

### Infrastructure Components

- **VPC**: Custom VPC with public and private subnets across multiple Availability Zones
- **EKS Cluster**: Managed Kubernetes control plane with version 1.28
- **Node Groups**: Auto-scaling managed node groups with configurable instance types
- **NAT Gateway**: For private subnet internet access (single NAT in staging, multi-AZ in production)
- **Security Groups**: Configured for secure cluster and node communication

### High Availability Features

- **Multi-AZ Deployment**: Resources distributed across 2 AZs (staging) or 3 AZs (production)
- **Auto-scaling**: Cluster Autoscaler automatically adjusts node count based on workload
- **Managed Node Groups**: AWS-managed node lifecycle with automated updates
- **Load Balancing**: Integrated with AWS ELB for service exposure

### GitOps with ArgoCD

- **ArgoCD**: Declarative, GitOps continuous delivery tool for Kubernetes
- **App-of-Apps Pattern**: Bootstrap application that manages all other applications
- **IRSA Integration**: Secure AWS access for ArgoCD via IAM Roles for Service Accounts
- **RBAC**: Role-based access for `devops-team` and `dev-team` groups
- **ArgoCD Projects**: Separate projects for `infrastructure` and `applications` workloads

### Monitoring & Observability

#### AWS CloudWatch
- **Control Plane Logs**: API server, audit, authenticator, controller manager, and scheduler logs
- **Container Insights**: Cluster and pod-level metrics
- **VPC Flow Logs**: Network traffic monitoring
- **Log Retention**: Configurable (7 days for staging, 30 days for production)

#### Prometheus Stack (kube-prometheus-stack)
- **Prometheus**: Time-series metrics collection and storage
- **Grafana**: Pre-configured dashboards for Kubernetes and EKS monitoring
- **Alertmanager**: Alert routing and notification management
- **Node Exporter**: Host-level metrics collection
- **Kube State Metrics**: Kubernetes object state metrics
- **Metrics Server**: Resource metrics for HPA (Horizontal Pod Autoscaler)

#### Key Monitoring Capabilities
- Cluster resource utilization (CPU, memory, network, disk)
- Pod and container performance metrics
- Node health and capacity monitoring
- Application-level observability
- Custom alerts and notifications
- Historical data for capacity planning

## Infrastructure Resources Summary

This section provides a comprehensive overview of all AWS and Kubernetes resources created by this Terraform configuration and their interconnections.

### Core Infrastructure Layer

#### 1. VPC Module (`module.vpc`)
Creates the network foundation:
- **1 VPC** with CIDR block (default: 10.0.0.0/16)
- **3 Public Subnets** (one per AZ) with Internet Gateway
- **3 Private Subnets** (one per AZ) for EKS nodes
- **NAT Gateway(s)** (single for staging, one per AZ for production)
- **VPC Flow Logs** → CloudWatch Log Group
- **Route Tables** for public and private subnets

**Tags applied**: Kubernetes discovery tags for subnet auto-detection by load balancers

---

### GitOps Layer

#### ArgoCD (`argocd.tf`)
Deploys ArgoCD for GitOps-based continuous delivery:
- **Kubernetes Namespace** (`argocd`) with standard labels
- **IRSA IAM Role** with ECR read-only access for ArgoCD service accounts
- **Helm Release** (`argo-cd` chart) with production-grade values from `ops/argocd/argocd-values.yaml`
- **App-of-Apps Bootstrap** application (points to a Git repository for application definitions)
- **ArgoCD Project: Infrastructure** — scoped to `kube-system`, `monitoring`, `ingress-nginx`, `cert-manager`, `external-secrets`, `argocd` namespaces
- **ArgoCD Project: Applications** — scoped to `default`, `apps-*`, `staging`, `production` namespaces

**Connects to**: EKS OIDC provider, Helm values in `ops/argocd/`

---

### Kubernetes Cluster Layer

#### 2. EKS Cluster Module (`module.eks`)
Creates the managed Kubernetes control plane:
- **EKS Cluster** (named: `dep-{environment}-eks`)
- **OIDC Identity Provider** (for IRSA - IAM Roles for Service Accounts)
- **Cluster Security Group** with ingress rules for node communication
- **Node Security Group** with rules for inter-node and cluster-to-node traffic
- **CloudWatch Log Groups** for control plane logs (API, audit, authenticator, controller manager, scheduler)

**Connects to**: VPC private subnets, IAM roles

#### 3. EKS Managed Node Groups (via `module.eks`)
Worker nodes defined in `var.node_groups`:
- **Auto Scaling Groups** for each node group
- **EC2 Instances** with specified instance types, disk size, capacity type
- **IAM Instance Profile** with necessary EKS node permissions

**Connects to**: Private subnets, EKS cluster, security groups

#### 4. Cluster Add-ons
Automatically installed add-ons:
- **CoreDNS** - DNS service for the cluster
- **kube-proxy** - Network proxy
- **VPC CNI** - Container networking interface
- **AWS EBS CSI Driver** (conditional) - For persistent volume support

---

### IAM & Security Layer

#### 5. EBS CSI Driver IRSA (`module.ebs_csi_driver_irsa`) - *Conditional*
- **IAM Role** with EBS CSI policy
- **OIDC Trust Relationship** linking Kubernetes ServiceAccount to IAM role
- **ServiceAccount**: `kube-system:ebs-csi-controller-sa`

**Enables**: EBS volumes as Kubernetes PersistentVolumes

#### 6. Cluster Autoscaler IRSA (`module.cluster_autoscaler_irsa`) - *Conditional*
- **IAM Role** with autoscaling permissions
- **OIDC Trust Relationship** for `kube-system:cluster-autoscaler` ServiceAccount

**Connects to**: EKS OIDC provider, Auto Scaling Groups

#### 7. CloudWatch Observability IRSA (`module.cloudwatch_observability_irsa`) - *Conditional*
- **IAM Role** with CloudWatchAgentServerPolicy
- **ServiceAccount**: `amazon-cloudwatch:cloudwatch-agent`

---

### Monitoring & Observability Layer

#### 8. CloudWatch Resources
- **CloudWatch Log Group** for EKS cluster logs (`/aws/eks/{cluster-name}/cluster`)
- **CloudWatch Log Group** for VPC Flow Logs (created by VPC module)

#### 9. Helm Release: CloudWatch Agent - *Conditional*
- **CloudWatch Agent DaemonSet** in `amazon-cloudwatch` namespace
- **ServiceAccount** linked to IRSA role

**Purpose**: Container Insights metrics and logs

#### 10. Kubernetes Namespace: Monitoring - *Conditional*
Created when Prometheus or Grafana is enabled

#### 11. Helm Release: Prometheus Stack - *Conditional*
Deploys comprehensive monitoring stack:
- **Prometheus** - Metrics collection and storage (7d retention)
- **Alertmanager** - Alert routing and management
- **Grafana** - Visualization dashboards (if enabled)
- **Node Exporter** - Node-level metrics
- **Kube State Metrics** - Kubernetes object metrics
- **Prometheus Operator** - Manages Prometheus CRDs

**All components**: CPU/memory limits set for cost optimization

#### 12. Helm Release: Metrics Server
- **Metrics Server** in `kube-system` namespace

**Purpose**: Enables Horizontal Pod Autoscaling (HPA), `kubectl top` commands

---

### Auto-scaling Layer

#### 13. Helm Release: Cluster Autoscaler - *Conditional*
- **Cluster Autoscaler Deployment** in `kube-system` namespace
- **ServiceAccount** linked to IRSA role

**Purpose**: Automatically scales node groups based on pod resource requirements

---

### Resource Dependency Flow

```
Data Sources (AZs, Account ID)
    ↓
VPC Module
    ├─→ Subnets (Public/Private)
    ├─→ NAT Gateway
    ├─→ Internet Gateway
    └─→ Flow Logs → CloudWatch
    ↓
EKS Cluster Module
    ├─→ Control Plane
    ├─→ OIDC Provider
    ├─→ Security Groups
    ├─→ Managed Node Groups → EC2 Instances
    └─→ Cluster Add-ons
    ↓
IRSA Modules (IAM Roles with OIDC Trust)
    ├─→ EBS CSI Driver Role
    ├─→ Cluster Autoscaler Role
    ├─→ CloudWatch Observability Role
    └─→ ArgoCD Role (ECR read-only)
    ↓
Helm Releases (Kubernetes Workloads)
    ├─→ CloudWatch Agent
    ├─→ Prometheus Stack
    ├─→ Metrics Server
    ├─→ Cluster Autoscaler
    └─→ ArgoCD (GitOps)
          ├─→ App-of-Apps Bootstrap
          ├─→ Project: Infrastructure
          └─→ Project: Applications
```

### Key Connections

- **VPC ↔ EKS**: Private subnets host worker nodes; public subnets for load balancers
- **OIDC ↔ IAM**: Enables pod-level AWS permissions without instance profiles
- **Helm Charts ↔ IRSA**: ServiceAccounts annotated with IAM role ARNs
- **Security Groups**: Control traffic between cluster, nodes, and external access
- **CloudWatch**: Centralized logging for control plane, VPC flows, and container insights
- **Prometheus**: Scrapes metrics from nodes, pods, and Kubernetes API
- **ArgoCD ↔ Git**: Syncs application state from Git repositories
- **ArgoCD ↔ IRSA**: Service accounts annotated with IAM role for ECR access

### Environment Differences

**Staging**:
- Single NAT Gateway (cost optimization)
- Potentially fewer node groups/smaller instances

**Production**:
- NAT Gateway per AZ (high availability)
- More robust node configurations
- Same monitoring/security baseline

## Prerequisites

### Required Tools

1. **Terraform** >= 1.5.0
   ```bash
   # Verify installation
   terraform version
   ```

2. **AWS CLI** >= 2.0
   ```bash
   # Verify installation
   aws --version
   
   # Configure AWS credentials
   aws configure
   ```

3. **kubectl** >= 1.28
   ```bash
   # Verify installation
   kubectl version --client
   ```

### AWS Permissions

Your AWS credentials must have permissions to create:
- VPC, Subnets, Internet Gateway, NAT Gateway, Route Tables
- EKS Cluster, Node Groups, and related IAM roles
- Security Groups and Network ACLs
- CloudWatch Log Groups
- IAM Roles and Policies for IRSA (IAM Roles for Service Accounts)

### Cost Considerations

#### Staging Environment (Minimal Cost)
- **EKS Control Plane**: ~$73/month
- **EC2 Instances**: 2x t3.medium SPOT (~$25/month)
- **NAT Gateway**: 1x single NAT (~$33/month)
- **Data Transfer**: Variable based on usage
- **Estimated Total**: ~$130-150/month

#### Production Environment (Minimal Cost)
- **EKS Control Plane**: ~$73/month
- **EC2 Instances**: 3x t3.small ON_DEMAND (~$38/month)
- **NAT Gateways**: 3x multi-AZ (~$99/month)
- **Data Transfer**: Variable based on usage
- **Estimated Total**: ~$210-240/month

> **Note**: These are estimates. Actual costs depend on data transfer, storage, and usage patterns.

## File Structure

```
inf/terraform/aws-eks/
├── main.tf                      # VPC, EKS cluster, node groups, and autoscaler
├── argocd.tf                    # ArgoCD Helm release, IRSA, projects, App-of-Apps
├── monitoring.tf                # CloudWatch, Prometheus, Grafana configurations
├── variables.tf                 # Input variable definitions
├── outputs.tf                   # Output value definitions
├── locals.tf                    # Local value computations
├── provider.tf                  # Provider configurations
├── environments/
│   ├── example.tfvars           # Example variable values
│   ├── staging.tfvars           # Staging environment values
│   └── production.tfvars        # Production environment values
└── manifests/
    ├── argocd-app-of-apps.yaml.tftpl            # App-of-Apps bootstrap template
    ├── argocd-project-infrastructure.yaml.tftpl # Infrastructure project template
    └── argocd-project-applications.yaml.tftpl   # Applications project template

ops/argocd/                      # Shared Helm values (used by Terraform and local testing)
├── argocd-values.yaml           # Base Helm values for all environments
├── argocd-values-local.yaml     # Lightweight overrides for local clusters
├── deploy-argocd-local.sh       # Helper script for local install/upgrade/uninstall
└── README.md                    # Local deployment guide with Helm/kubectl commands
```

## Usage

### 1. Initialize Terraform

```bash
cd inf/terraform/aws-eks
terraform init
```

### 2. Review Configuration

Edit environment-specific files in `environments/` to customize:
- VPC CIDR ranges
- Node group sizes and instance types
- Monitoring settings
- Resource tags

### 3. Set Sensitive Variables

```bash
# Linux/macOS
export TF_VAR_grafana_admin_password="your-secure-password"
export TF_VAR_argocd_admin_password_hash="<bcrypt-hash>"

# Windows PowerShell
$env:TF_VAR_grafana_admin_password="your-secure-password"
$env:TF_VAR_argocd_admin_password_hash="<bcrypt-hash>"
```

Generate the ArgoCD password hash:

```bash
# Linux/macOS
htpasswd -nbBC 10 '' 'your-password' | tr -d ':\n' | sed 's/$2y/$2a/'

# Or use Python
python -c "import bcrypt; print(bcrypt.hashpw(b'your-password', bcrypt.gensalt(rounds=10)).decode())"
```

### 4. Plan Deployment

#### Staging
```bash
cd inf/terraform/aws-eks
terraform plan -var-file="environments/staging.tfvars"
```

#### Production
```bash
cd inf/terraform/aws-eks
terraform plan -var-file="environments/production.tfvars"
```

### 5. Deploy Infrastructure

#### Staging
```bash
terraform apply -var-file="environments/staging.tfvars"
```

#### Production
```bash
terraform apply -var-file="environments/production.tfvars"
```

#### Log Output
Monitor the output for any errors and confirm successful resource creation.
```bash
$Env:TF_LOG="DEBUG"
$Env:TF_LOG_PATH="C:\Workspace\devops-engineer-profile\inf\terraform\aws-eks\terraform.log"
```

### 6. Configure kubectl

```bash
# After successful deployment, configure kubectl
aws eks update-kubeconfig --region ap-southeast-1 --name devops-engineer-profile-<environment>-eks
```

### 7. Verify Deployment

```bash
# Check cluster status
kubectl cluster-info

# Check nodes
kubectl get nodes

# Check system pods
kubectl get pods -A

# Check monitoring namespace
kubectl get pods -n monitoring

# Check ArgoCD namespace
kubectl get pods -n argocd
```

## ArgoCD (GitOps)

### Overview

ArgoCD is deployed via Terraform (`argocd.tf`) with the following components:

- **Helm Release**: Installs the `argo-cd` chart with production-grade values
- **IRSA**: IAM role granting ArgoCD ECR read-only access
- **App-of-Apps**: Bootstrap application that manages all other applications via Git
- **Projects**: `infrastructure` and `applications` projects with scoped namespace access

### Configuration Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `enable_argocd` | Enable ArgoCD deployment | `true` |
| `argocd_namespace` | Kubernetes namespace | `argocd` |
| `argocd_chart_version` | Helm chart version | `7.7.10` |
| `argocd_admin_password_hash` | Bcrypt hash of admin password | `""` |
| `argocd_app_of_apps_repo_url` | Git repo URL for App-of-Apps | `""` |
| `argocd_app_of_apps_target_revision` | Git branch/tag/commit | `HEAD` |
| `argocd_app_of_apps_path` | Path in repo for app definitions | `k8s/argocd-apps` |

### Helm Values

The base Helm values file is shared between Terraform (EKS) and local testing:

```
ops/argocd/argocd-values.yaml    <-- base configuration (used by argocd.tf)
ops/argocd/argocd-values-local.yaml  <-- local overrides (not used by Terraform)
```

Terraform references the values file via:

```hcl
values = [
  file("${path.root}/../../../ops/argocd/argocd-values.yaml")
]
```

IRSA annotations and the admin password hash are applied as Helm `set` overrides
in `argocd.tf`.

### RBAC Policies

Configured in the Helm values:

| Role | Permissions |
|------|-------------|
| `role:readonly` (default) | Read-only access to all resources |
| `role:devops` | Full access to applications, clusters, repositories, projects |
| `role:developer` | Get/sync applications, view logs |

Group mappings: `devops-team` → `role:devops`, `dev-team` → `role:developer`

### Accessing ArgoCD on EKS

```bash
# Port-forward to access the ArgoCD UI
kubectl port-forward -n argocd svc/argocd-server 8080:443

# Open in browser
# URL: https://localhost:8080
# Username: admin
```

Retrieve the admin password:

```powershell
kubectl -n argocd get secret argocd-initial-admin-secret `
  -o jsonpath="{.data.password}" | ForEach-Object {
    [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_))
  }
```

### Local Testing

Before deploying to EKS, test the ArgoCD chart on a local Kubernetes cluster.
See the full guide at `ops/argocd/README.md`.

```bash
cd ops/argocd
bash deploy-argocd-local.sh install
```

### ArgoCD Manifest Templates

The `manifests/` directory contains Terraform template files:

| Template | Purpose |
|----------|---------|
| `argocd-app-of-apps.yaml.tftpl` | Bootstrap App-of-Apps application with automated sync |
| `argocd-project-infrastructure.yaml.tftpl` | Project for infra components (monitoring, ingress, etc.) |
| `argocd-project-applications.yaml.tftpl` | Project for application workloads |

## Accessing Monitoring Tools

### Grafana Dashboard

```bash
# Port forward to access Grafana locally
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# Access in browser
# URL: http://localhost:3000
# Username: admin
# Password: <your-grafana-admin-password>
```

### Prometheus UI

```bash
# Port forward to access Prometheus
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090

# Access in browser
# URL: http://localhost:9090
```

### CloudWatch Logs

```bash
# View logs in AWS Console
# Navigate to: CloudWatch > Log groups > /aws/eks/<cluster-name>/cluster

# Or use AWS CLI
aws logs tail /aws/eks/devops-engineer-profile-staging-eks/cluster --follow
```

## Scaling

### Manual Scaling

```bash
# Scale node group manually
aws eks update-nodegroup-config \
  --cluster-name devops-engineer-profile-staging-eks \
  --nodegroup-name general-<timestamp> \
  --scaling-config minSize=2,maxSize=6,desiredSize=4
```

### Horizontal Pod Autoscaler (HPA)

```yaml
# Example HPA for your application
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Monitoring Best Practices

### 1. CloudWatch Alarms

Create alarms for:
- Cluster CPU and memory utilization
- Node count and health
- API server latency
- Failed pod deployments

### 2. Prometheus Alerts

The kube-prometheus-stack includes pre-configured alerts for:
- Node down
- High memory/CPU usage
- Pod crash loops
- Persistent volume issues

### 3. Grafana Dashboards

Pre-installed dashboards include:
- Kubernetes / Compute Resources / Cluster
- Kubernetes / Compute Resources / Namespace (Pods)
- Kubernetes / Networking / Cluster
- Node Exporter / Nodes

### 4. Custom Metrics

Add custom application metrics:
```yaml
# ServiceMonitor example
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 30s
```

## Security Best Practices

1. **Restrict API Endpoint Access**: Update `cluster_endpoint_public_access_cidrs` to your organization's IP ranges
2. **Enable IRSA**: Already enabled for secure pod-to-AWS service authentication
3. **Network Policies**: Implement Kubernetes Network Policies for pod-to-pod communication
4. **Secrets Management**: Use AWS Secrets Manager or Parameter Store with External Secrets Operator
5. **Image Scanning**: Integrate container image scanning in CI/CD pipeline
6. **Pod Security Standards**: Apply Pod Security Standards to namespaces

## Maintenance

### Update Cluster Version

```bash
# 1. Update cluster control plane
terraform apply -var="cluster_version=1.29" -var-file="environments/staging.tfvars"

# 2. Update node groups (automatic with managed node groups)
# AWS will roll out updates with zero downtime
```

### Update Add-ons

```bash
# List available add-on versions
aws eks describe-addon-versions --addon-name vpc-cni

# Update via Terraform (automatic with most_recent = true)
terraform apply -var-file="environments/staging.tfvars"
```

### Backup and Disaster Recovery

```bash
# Install Velero for cluster backups
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
helm install velero vmware-tanzu/velero --namespace velero --create-namespace
```

## Troubleshooting

### Nodes Not Joining Cluster

```bash
# Check node group status
aws eks describe-nodegroup --cluster-name <cluster-name> --nodegroup-name <nodegroup-name>

# Check CloudWatch logs
aws logs tail /aws/eks/<cluster-name>/cluster --follow
```

### Pods Not Scheduling

```bash
# Check node capacity
kubectl describe nodes

# Check pod events
kubectl describe pod <pod-name> -n <namespace>

# Check cluster autoscaler logs
kubectl logs -n kube-system deployment/cluster-autoscaler
```

### Monitoring Issues

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
# Navigate to: http://localhost:9090/targets

# Check Prometheus Operator logs
kubectl logs -n monitoring deployment/kube-prometheus-stack-operator
```

## Cleanup

### Destroy Staging Environment

```bash
terraform destroy -var-file="environments/staging.tfvars"
```

### Destroy Production Environment

```bash
# CAUTION: This will delete all production resources
terraform destroy -var-file="environments/production.tfvars"
```

## Additional Resources

- [EKS Best Practices Guide](https://aws.github.io/aws-eks-best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Prometheus Operator Documentation](https://prometheus-operator.dev/)
- [Grafana Documentation](https://grafana.com/docs/)
- [AWS EKS Workshop](https://www.eksworkshop.com/)

## Support and Contribution

For issues, questions, or contributions, please refer to the project repository.

## License

See LICENSE file in the repository root.
