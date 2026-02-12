# Quick Start Guide

Get Jenkins running in 5 minutes or less!

## Prerequisites

- Kubernetes cluster (local or EKS)
- Helm 3 installed
- kubectl configured

## Local Development (Fastest)

```powershell
# 1. Navigate to Jenkins directory
cd ops/jenkins

# 2. Install using helper script
.\deploy.ps1 -Environment local -Action install

# 3. Access Jenkins
# Open browser: http://localhost:32000
# Username: admin
# Password: admin123  # CHANGE IMMEDIATELY!
```

**Or using Helm directly:**

```powershell
# Add Jenkins Helm repo
helm repo add jenkins https://charts.jenkins.io
helm repo update

# Create namespace
kubectl create namespace jenkins

# Update dependencies
cd helm
helm dependency update
cd ..

# Install
helm install jenkins ./helm `
  --values ./helm/values/values-local.yaml `
  --namespace jenkins `
  --wait
```

## EKS Staging

```powershell
# 1. Configure AWS CLI for EKS
aws eks update-kubeconfig --name <cluster-name> --region <region>

# 2. Create namespace
kubectl apply -f k8s/namespace-staging.yaml

# 3. Create admin secret
$password = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
kubectl create secret generic jenkins-admin-credentials `
  --from-literal=jenkins-admin-user=admin `
  --from-literal=jenkins-admin-password=$password `
  -n jenkins-staging
Write-Host "Save this password: $password"

# 4. Update jenkinsUrl in values-staging.yaml (line 71)
# Edit: helm/values/values-staging.yaml

# 5. Install
.\deploy.ps1 -Environment staging -Action install

# 6. Get LoadBalancer URL
kubectl get svc jenkins -n jenkins-staging
```

## EKS Production

⚠️ **Important**: Follow full production checklist before deployment!

```powershell
# See README.md → Production Environment section
# Key steps:
# 1. Create IRSA roles
# 2. Configure secrets via AWS Secrets Manager
# 3. Update all production-specific values
# 4. Set up monitoring and backups
# 5. Deploy with manual approval
```

## Verify Installation

```powershell
# Check status
.\deploy.ps1 -Environment <local|staging|production> -Action status

# View logs
kubectl logs -n <namespace> -l app.kubernetes.io/component=jenkins-controller --tail=100 -f

# Port-forward (if needed)
.\deploy.ps1 -Environment <env> -Action port-forward
```

## Common Issues

### Pod Not Starting
```powershell
kubectl describe pod -n <namespace> -l app.kubernetes.io/component=jenkins-controller
```

### PVC Not Binding
```powershell
# Check StorageClass
kubectl get storageclass

# For EKS: Verify EBS CSI driver
kubectl get pods -n kube-system | grep ebs-csi
```

### Can't Access Jenkins
```powershell
# Local: Check NodePort
kubectl get svc jenkins -n jenkins

# EKS: Check LoadBalancer
kubectl get svc jenkins -n <namespace>
```

## Next Steps

1. ✅ Jenkins installed
2. 📝 Configure initial jobs
3. 🔐 Set up credentials
4. 🔧 Install additional plugins
5. 📊 Configure monitoring
6. 🔄 Set up GitOps with ArgoCD

**Full documentation**: [README.md](README.md)

---

Need help? Check the [Troubleshooting](README.md#troubleshooting) section.
