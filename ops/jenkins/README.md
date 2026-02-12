# Jenkins Deployment on Kubernetes

Production-ready Jenkins CI/CD server deployment for three environments: Local, Staging (EKS), and Production (EKS). This setup follows GitOps best practices and is designed for deployment via Helm charts and ArgoCD.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Directory Structure](#directory-structure)
- [Environment Configurations](#environment-configurations)
- [Deployment Guide](#deployment-guide)
  - [Local Development](#local-development)
  - [Staging Environment](#staging-environment)
  - [Production Environment](#production-environment)
- [GitOps with ArgoCD](#gitops-with-argocd)
- [Configuration Management](#configuration-management)
- [Security Best Practices](#security-best-practices)
- [Monitoring and Observability](#monitoring-and-observability)
- [Backup and Disaster Recovery](#backup-and-disaster-recovery)
- [Troubleshooting](#troubleshooting)
- [Maintenance and Operations](#maintenance-and-operations)

---

## Overview

This repository provides a complete Jenkins deployment solution with:

- **Three-tier environment strategy**: Local (dev), Staging (EKS), Production (EKS)
- **Helm-based deployments**: Using official Jenkins Helm chart with custom values
- **GitOps ready**: ArgoCD application manifests for automated deployments
- **Security hardened**: RBAC, network policies, pod security standards
- **High availability**: Production configuration with HA setup
- **Infrastructure as Code**: Fully declarative configuration

### Key Features

✅ **Official Jenkins Helm Chart**: Version 5.1.27 with Jenkins 2.440-jdk17  
✅ **Configuration as Code (JCasC)**: Automated Jenkins configuration  
✅ **Kubernetes Native**: Dynamic agent provisioning via Kubernetes plugin  
✅ **AWS EKS Optimized**: IRSA, EBS CSI driver, NLB integration  
✅ **Production Grade**: Resource limits, health checks, monitoring  
✅ **GitOps Compatible**: ArgoCD application manifests included  

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Jenkins Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐         ┌──────────────────────┐          │
│  │   Ingress/  │────────▶│  Jenkins Controller  │          │
│  │     NLB     │         │   (StatefulSet)      │          │
│  └─────────────┘         └──────────────────────┘          │
│                                    │                         │
│                                    │                         │
│                    ┌───────────────┼───────────────┐        │
│                    │               │               │         │
│           ┌────────▼──────┐  ┌────▼──────┐  ┌────▼──────┐ │
│           │ Jenkins Agent │  │   Agent   │  │   Agent   │ │
│           │   (Pod 1)     │  │  (Pod 2)  │  │  (Pod N)  │ │
│           └───────────────┘  └───────────┘  └───────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Persistent Volume (EBS/gp3)               │  │
│  │         Jenkins Home & Configuration Storage         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### General Requirements

- **Kubernetes Cluster**:
  - Local: Minikube, Kind, Docker Desktop (v1.24+)
  - EKS: AWS EKS cluster (v1.27+)
- **Helm**: v3.12 or later
- **kubectl**: v1.27 or later
- **Git**: For cloning repository

### For EKS Deployments

- **AWS CLI**: v2.x configured with appropriate credentials
- **IAM Permissions**: Ability to create IAM roles for IRSA
- **EBS CSI Driver**: Installed on EKS cluster (required for persistence)
- **VPC**: Network connectivity to EKS cluster

### For GitOps (ArgoCD)

- **ArgoCD**: v2.9+ installed on cluster
- **Git Repository**: Access to this repository from ArgoCD

---

## Directory Structure

```
ops/jenkins/
├── helm/
│   ├── Chart.yaml                    # Umbrella Helm chart referencing official Jenkins chart
│   └── values/
│       ├── values-local.yaml         # Local development configuration
│       ├── values-staging.yaml       # Staging (EKS) configuration
│       └── values-production.yaml    # Production (EKS) configuration
├── k8s/
│   ├── namespace-local.yaml          # Local namespace definition
│   ├── namespace-staging.yaml        # Staging namespace definition
│   ├── namespace-production.yaml     # Production namespace definition
│   ├── secret-staging.yaml           # Staging admin credentials (template)
│   └── secret-production.yaml        # Production admin credentials (template)
├── argocd/
│   ├── jenkins-local.yaml            # ArgoCD app for local (reference)
│   ├── jenkins-staging.yaml          # ArgoCD app for staging
│   └── jenkins-production.yaml       # ArgoCD app for production
└── README.md                         # This file
```

---

## Environment Configurations

### Local Development

**Purpose**: Developer testing and experimentation  
**Access**: NodePort (32000)  
**Resources**: Minimal (1Gi RAM, 500m CPU)  
**Storage**: 8Gi local storage  
**Security**: Basic (admin/admin123 - change immediately)  
**Agents**: Max 10 concurrent  

### Staging (EKS)

**Purpose**: Integration testing, UAT  
**Access**: Internal NLB or Ingress  
**Resources**: Moderate (2-4Gi RAM, 1-4 CPU)  
**Storage**: 50Gi EBS gp3  
**Security**: RBAC, network policies, secrets management  
**Agents**: Max 20 concurrent  
**Monitoring**: Prometheus metrics enabled  

### Production (EKS)

**Purpose**: Live CI/CD workloads  
**Access**: Internal NLB + Ingress with TLS  
**Resources**: High (4-8Gi RAM, 2-8 CPU)  
**Storage**: 100Gi EBS gp3 with snapshots  
**Security**: Hardened (IRSA, audit logs, WAF, rate limiting)  
**Agents**: Max 50 concurrent  
**HA**: Pod anti-affinity, PDB  
**Monitoring**: Comprehensive (Prometheus, alerts)  
**Backup**: Daily automated backups  

---

## Deployment Guide

### Local Development

#### 1. Prerequisites

Ensure you have a local Kubernetes cluster running:

```powershell
# For Minikube
minikube start --cpus=4 --memory=8192 --kubernetes-version=v1.28.0

# For Docker Desktop - Enable Kubernetes in Settings
```

#### 2. Add Helm Repository

```powershell
helm repo add jenkins https://charts.jenkins.io
helm repo update
```

#### 3. Create Namespace

```powershell
kubectl apply -f k8s/namespace-local.yaml
```

#### 4. Update Helm Dependencies

```powershell
cd helm
helm dependency update
cd ..
```

#### 5. Install Jenkins

```powershell
helm install jenkins ./helm `
  --values ./helm/values/values-local.yaml `
  --namespace jenkins `
  --create-namespace
```

#### 6. Access Jenkins

```powershell
# Get the NodePort
kubectl get svc jenkins -n jenkins

# Access via browser
# http://localhost:32000
```

#### 7. Get Admin Password

```powershell
# Default is admin/admin123 (change immediately)
# Or retrieve from secret:
kubectl get secret jenkins -n jenkins -o jsonpath="{.data.jenkins-admin-password}" | base64 --decode
```

---

### Staging Environment

#### 1. Prerequisites Checklist

- [ ] EKS cluster running and accessible
- [ ] EBS CSI driver installed: `kubectl get pods -n kube-system | grep ebs-csi`
- [ ] StorageClass `gp3` available: `kubectl get storageclass`
- [ ] AWS credentials configured
- [ ] Network connectivity to EKS cluster

#### 2. Configure AWS CLI

```powershell
# Update kubeconfig for EKS
aws eks update-kubeconfig --name <your-staging-cluster-name> --region <region>

# Verify connection
kubectl cluster-info
```

#### 3. Create Namespace

```powershell
kubectl apply -f k8s/namespace-staging.yaml
```

#### 4. Create Admin Credentials Secret

**Important**: Never commit real passwords to Git!

```powershell
# Generate strong password
$password = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Create secret
kubectl create secret generic jenkins-admin-credentials `
  --from-literal=jenkins-admin-user=admin `
  --from-literal=jenkins-admin-password=$password `
  -n jenkins-staging

# Save password securely (e.g., AWS Secrets Manager, 1Password)
Write-Host "Admin Password: $password"
```

#### 5. Update Values (Optional)

Edit [helm/values/values-staging.yaml](helm/values/values-staging.yaml):
- Update `jenkinsUrl` with actual LoadBalancer DNS or Ingress hostname
- Configure IRSA role ARN if using AWS services
- Adjust resource limits based on workload

#### 6. Install Jenkins with Helm

```powershell
# Add Jenkins Helm repository
helm repo add jenkins https://charts.jenkins.io
helm repo update

# Update dependencies
cd helm
helm dependency update
cd ..

# Install Jenkins
helm install jenkins ./helm `
  --values ./helm/values/values-staging.yaml `
  --namespace jenkins-staging `
  --timeout 10m
```

#### 7. Verify Installation

```powershell
# Check pods
kubectl get pods -n jenkins-staging

# Check services
kubectl get svc -n jenkins-staging

# Check persistent volumes
kubectl get pvc -n jenkins-staging

# View Jenkins controller logs
kubectl logs -n jenkins-staging -l app.kubernetes.io/component=jenkins-controller --tail=100
```

#### 8. Access Jenkins

```powershell
# If using LoadBalancer
kubectl get svc jenkins -n jenkins-staging -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# If using Ingress
kubectl get ingress -n jenkins-staging

# Port-forward for testing
kubectl port-forward svc/jenkins -n jenkins-staging 8080:8080
# Then access: http://localhost:8080
```

---

### Production Environment

#### 1. Prerequisites Checklist

- [ ] EKS production cluster running
- [ ] EBS CSI driver with snapshot controller
- [ ] IRSA roles created for Jenkins controller and agents
- [ ] Ingress controller installed (e.g., NGINX Ingress)
- [ ] Certificate Manager installed (e.g., cert-manager)
- [ ] Monitoring stack deployed (Prometheus/Grafana)
- [ ] Backup solution configured (e.g., Velero)
- [ ] Network policies reviewed
- [ ] Security groups configured

#### 2. Configure Cluster Access

```powershell
aws eks update-kubeconfig --name <your-production-cluster-name> --region <region>
kubectl cluster-info
```

#### 3. Create Namespace

```powershell
kubectl apply -f k8s/namespace-production.yaml
```

#### 4. Set Up AWS IRSA (IAM Roles for Service Accounts)

**Create IAM Policy for Jenkins**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": "*"
    }
  ]
}
```

**Create IAM Role and Associate with Service Account**:

```powershell
# Replace ACCOUNT_ID, CLUSTER_NAME, REGION
$ACCOUNT_ID = "<your-aws-account-id>"
$CLUSTER_NAME = "<your-production-cluster-name>"
$REGION = "<your-region>"

# Create IRSA for Jenkins controller
eksctl create iamserviceaccount `
  --name jenkins `
  --namespace jenkins-production `
  --cluster $CLUSTER_NAME `
  --region $REGION `
  --attach-policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/JenkinsControllerPolicy `
  --approve

# Create IRSA for Jenkins agents
eksctl create iamserviceaccount `
  --name jenkins-agent `
  --namespace jenkins-production `
  --cluster $CLUSTER_NAME `
  --region $REGION `
  --attach-policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/JenkinsAgentPolicy `
  --approve
```

#### 5. Create Admin Credentials Secret

**Best Practice**: Use AWS Secrets Manager + External Secrets Operator

```powershell
# For immediate deployment, create manually:
$password = -join ((65..90) + (97..122) + (48..57) + (33..38) | Get-Random -Count 40 | ForEach-Object {[char]$_})

kubectl create secret generic jenkins-admin-credentials `
  --from-literal=jenkins-admin-user=admin `
  --from-literal=jenkins-admin-password=$password `
  -n jenkins-production

# Store password in AWS Secrets Manager
aws secretsmanager create-secret `
  --name jenkins-production-admin-password `
  --secret-string $password `
  --region $REGION
```

#### 6. Update Production Values

Edit [helm/values/values-production.yaml](helm/values/values-production.yaml):

- **Line 71**: Update `jenkinsUrl` with production domain
- **Line 443-444**: Update IRSA role ARNs
- **Line 72**: Update admin email
- **Ingress hosts**: Update with actual domain names
- **StorageClass**: Verify `gp3` is available

#### 7. Install Jenkins (Production)

```powershell
# Update Helm dependencies
cd helm
helm dependency update
cd ..

# Dry-run first to validate
helm install jenkins ./helm `
  --values ./helm/values/values-production.yaml `
  --namespace jenkins-production `
  --dry-run --debug

# If dry-run passes, install for real
helm install jenkins ./helm `
  --values ./helm/values/values-production.yaml `
  --namespace jenkins-production `
  --timeout 15m `
  --wait
```

#### 8. Verify Production Deployment

```powershell
# Check all resources
kubectl get all -n jenkins-production

# Check PVC and PV
kubectl get pvc,pv -n jenkins-production

# Check Ingress
kubectl get ingress -n jenkins-production

# View controller logs
kubectl logs -n jenkins-production -l app.kubernetes.io/component=jenkins-controller --tail=200 -f

# Check health
kubectl get pods -n jenkins-production -w
```

#### 9. Configure DNS (if using Ingress)

```powershell
# Get Ingress LoadBalancer hostname
$LB_HOSTNAME = kubectl get ingress jenkins -n jenkins-production -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

Write-Host "Create DNS CNAME record:"
Write-Host "jenkins.example.com -> $LB_HOSTNAME"
```

#### 10. Post-Deployment Security Checklist

- [ ] Verify admin password is strong and stored in Secrets Manager
- [ ] Test authentication and authorization (RBAC)
- [ ] Verify TLS certificate is valid (if using Ingress with cert-manager)
- [ ] Test network policies (agents can communicate with controller)
- [ ] Verify monitoring and alerting are working
- [ ] Run security scan on Jenkins instance
- [ ] Document any deviations from standard configuration

---

## GitOps with ArgoCD

### Benefits

- **Declarative Configuration**: All infrastructure as code in Git
- **Automated Deployments**: ArgoCD continuously syncs cluster state
- **Audit Trail**: Git history provides complete change log
- **Rollback**: Easy revert via Git
- **Multi-Cluster**: Manage multiple environments from single ArgoCD instance

### Prerequisites

1. **ArgoCD installed** on your Kubernetes cluster:
   ```powershell
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   ```

2. **Configure Git Repository** in ArgoCD:
   ```powershell
   argocd repo add https://github.com/your-org/devops-engineer-profile.git `
     --username <username> `
     --password <token>
   ```

### Deploy Jenkins via ArgoCD

#### Staging Environment

```powershell
# Update repository URL in argocd/jenkins-staging.yaml first!
# Edit: spec.source.repoURL

# Apply ArgoCD application
kubectl apply -f argocd/jenkins-staging.yaml

# Monitor sync status
argocd app get jenkins-staging --refresh

# Sync manually if needed
argocd app sync jenkins-staging
```

#### Production Environment

**Production requires manual approval** (syncPolicy.automated is null).

```powershell
# Update repository URL in argocd/jenkins-production.yaml
# Edit: spec.source.repoURL

# Apply ArgoCD application
kubectl apply -f argocd/jenkins-production.yaml

# Review changes in ArgoCD UI or CLI
argocd app diff jenkins-production

# Manually sync when ready
argocd app sync jenkins-production --prune
```

### ArgoCD Application Structure

| Environment | Sync Mode    | Prune | Self-Heal | Sync Window           |
|-------------|--------------|-------|-----------|------------------------|
| Local       | Automated    | Yes   | Yes       | Always                 |
| Staging     | Automated    | Yes   | Yes       | Mon-Fri 8 AM-6 PM      |
| Production  | **Manual**   | Yes   | No        | Sat 8-10 PM (maint.)   |

### ArgoCD Best Practices

1. **Use Git Tags for Production**: Instead of `main` branch, use versioned tags
   ```yaml
   source:
     targetRevision: v1.0.0  # Instead of main
   ```

2. **Separate ArgoCD Projects**: Create dedicated projects for staging and production with appropriate RBAC

3. **Enable Notifications**: Configure Slack/email notifications for deployment events

4. **Implement Approval Process**: Use Git pull requests for production changes

---

## Configuration Management

### Jenkins Configuration as Code (JCasC)

All Jenkins configuration is managed via JCasC YAML in the Helm values.

**Key Configuration Areas**:

1. **Security Realm** (authentication)
2. **Authorization Strategy** (RBAC)
3. **Kubernetes Cloud** (agent provisioning)
4. **System Settings** (URL, admin email)
5. **Global Libraries** (shared pipeline libraries)

### Customizing JCasC

Edit the `JCasC.configScripts` section in values files:

```yaml
JCasC:
  configScripts:
    custom-config: |
      jenkins:
        customSetting: value
```

### Managing Plugins

**Add plugins** to `installPlugins` or `additionalPlugins`:

```yaml
controller:
  installPlugins:
    - <plugin-name>:<version>
  additionalPlugins:
    - <another-plugin>:<version>
```

**Plugin recommendations by environment**:
- **Local**: Minimal set for development
- **Staging**: Full feature set for testing
- **Production**: Only tested and approved plugins

### Secrets Management

**Local**: Kubernetes secrets (basic)  
**Staging**: Kubernetes secrets + External Secrets Operator (optional)  
**Production**: **AWS Secrets Manager** via External Secrets Operator

**External Secrets Operator Setup**:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: jenkins-production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: jenkins
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: jenkins-admin-credentials
  namespace: jenkins-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: jenkins-admin-credentials
  data:
    - secretKey: jenkins-admin-user
      remoteRef:
        key: jenkins-production-admin
        property: username
    - secretKey: jenkins-admin-password
      remoteRef:
        key: jenkins-production-admin
        property: password
```

---

## Security Best Practices

### 1. Authentication and Authorization

- **Use OIDC/SAML** for production (integrate with AWS SSO, Okta, etc.)
- **Implement RBAC** with role-strategy plugin
- **Disable anonymous access**
- **Enforce strong password policies**

### 2. Network Security

- **Enable Network Policies**: Restrict pod-to-pod communication
- **Use Private Load Balancers**: Internal NLB for EKS
- **Implement Ingress WAF**: OWASP ModSecurity rules
- **Rate Limiting**: Prevent brute-force attacks

### 3. Pod Security

- **Run as non-root**: `runAsUser: 1000`
- **Drop all capabilities**: `capabilities.drop: [ALL]`
- **Read-only root filesystem** (where possible)
- **Seccomp profile**: `type: RuntimeDefault`
- **Pod Security Standards**: `baseline` for staging, `restricted` for production

### 4. Secrets Management

- **Never commit secrets to Git**
- **Use AWS Secrets Manager** for production credentials
- **Rotate credentials regularly** (every 90 days)
- **Audit secret access** via CloudTrail

### 5. Container Image Security

- **Use official Jenkins images only**
- **Scan images for vulnerabilities**: Trivy, Clair, Snyk
- **Pin image versions**: Avoid `:latest` tag
- **Implement image signing**: Cosign, Notary

### 6. Audit and Compliance

- **Enable audit trail plugin**: Log all user actions
- **CloudWatch logging**: Send Jenkins logs to CloudWatch
- **Compliance scanning**: OpenSCAP, InSpec

---

## Monitoring and Observability

### Prometheus Metrics

Jenkins exposes Prometheus metrics via the prometheus plugin.

**ServiceMonitor for Prometheus Operator**:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: jenkins
  namespace: jenkins-production
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: jenkins
  endpoints:
    - port: http
      path: /prometheus
      interval: 30s
```

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `jenkins_node_online_count` | Number of online agents | < 50% capacity |
| `jenkins_executor_count_in_use` | Active executors | > 80% |
| `jenkins_job_duration_seconds` | Job execution time | > 1800s (30min) |
| `jenkins_job_failure_total` | Failed jobs | > 10/hour |
| `http_requests_total` | Request count | Rate spike |
| `vm_memory_heap_used` | Java heap usage | > 85% |

### Grafana Dashboards

Import Jenkins dashboard from Grafana.com:
- Dashboard ID: **9524** (Jenkins: Performance and Health Overview)
- Dashboard ID: **12708** (Jenkins Overview)

### Logging

**Centralized Logging Stack**:
- **Fluentd/Fluent Bit**: Log collection from pods
- **CloudWatch Logs**: AWS-native log storage
- **Grafana Loki**: Alternative log aggregation
- **Kibana/Elasticsearch**: Full-text search

**Log Retention**:
- **Local**: 7 days
- **Staging**: 30 days
- **Production**: 90 days (compliance requirement)

### Alerting

**Configure Prometheus AlertManager rules**:

```yaml
groups:
  - name: jenkins
    interval: 30s
    rules:
      - alert: JenkinsDown
        expr: up{job="jenkins"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Jenkins is down"
      
      - alert: JenkinsHighMemory
        expr: jenkins_vm_memory_heap_used / jenkins_vm_memory_heap_max > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Jenkins heap memory usage > 85%"
```

---

## Backup and Disaster Recovery

### Backup Strategy

#### Local Environment
- **Backup**: Manual export (not critical)
- **Frequency**: On-demand

#### Staging Environment
- **Backup**: Velero + EBS snapshots
- **Frequency**: Daily at 2 AM UTC
- **Retention**: 7 days

#### Production Environment
- **Backup**: Velero + EBS snapshots + offsite S3
- **Frequency**: Every 6 hours
- **Retention**: 30 days

### Velero Backup Configuration

**Install Velero**:

```powershell
# Install Velero CLI
# Download from: https://github.com/vmware-tanzu/velero/releases

# Install Velero on cluster
velero install `
  --provider aws `
  --plugins velero/velero-plugin-for-aws:v1.8.0 `
  --bucket jenkins-backups-prod `
  --backup-location-config region=us-east-1 `
  --snapshot-location-config region=us-east-1 `
  --secret-file ./velero-credentials
```

**Schedule Backup**:

```yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: jenkins-production-backup
  namespace: velero
spec:
  schedule: "0 */6 * * *"  # Every 6 hours
  template:
    includedNamespaces:
      - jenkins-production
    includedResources:
      - persistentvolumeclaims
      - persistentvolumes
      - secrets
      - configmaps
    storageLocation: default
    volumeSnapshotLocations:
      - default
    ttl: 720h  # 30 days
```

### Restore Procedure

```powershell
# List backups
velero backup get

# Restore from backup
velero restore create --from-backup jenkins-production-backup-20260212

# Monitor restore
velero restore describe <restore-name>
velero restore logs <restore-name>
```

### Disaster Recovery Testing

**Quarterly DR Drills**:
1. Restore Jenkins to temporary namespace from backup
2. Verify configuration integrity
3. Run test pipeline
4. Document any issues
5. Clean up test environment

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Jenkins Pod Not Starting

**Symptoms**: Pod stuck in `Pending`, `CrashLoopBackOff`, or `ImagePullBackOff`

**Diagnosis**:
```powershell
kubectl describe pod <jenkins-pod-name> -n <namespace>
kubectl logs <jenkins-pod-name> -n <namespace>
```

**Common Causes**:
- Insufficient cluster resources → Increase node capacity
- PVC not binding → Check StorageClass and EBS CSI driver
- Image pull errors → Verify image name and registry access
- Security context issues → Review PSP/PSS constraints

#### 2. Jenkins Controller Out of Memory

**Symptoms**: Pod restarts frequently, slow UI, `OutOfMemoryError` in logs

**Solution**:
```yaml
# Increase memory limits in values file
resources:
  limits:
    memory: "8Gi"  # Increase from 4Gi

javaOpts: >-
  -Xmx6144m  # Adjust heap size
```

#### 3. Agents Failing to Connect

**Symptoms**: Agents stuck in "Connecting..." or timeout errors

**Diagnosis**:
```powershell
# Check controller logs
kubectl logs -n <namespace> -l app.kubernetes.io/component=jenkins-controller

# Check agent pod logs
kubectl logs <agent-pod> -n <namespace>

# Test network connectivity
kubectl exec -n <namespace> <agent-pod> -- nc -zv jenkins 50000
```

**Common Causes**:
- Network policies blocking traffic → Review NetworkPolicy rules
- JNLP port mismatch → Verify `jenkinsTunnel` configuration
- Service account permissions → Check RBAC

#### 4. Persistent Volume Not Attaching

**Symptoms**: Pod stuck in `ContainerCreating`, PVC in `Pending`

**Diagnosis**:
```powershell
kubectl get pvc -n <namespace>
kubectl describe pvc <pvc-name> -n <namespace>
kubectl get volumeattachment
```

**Solutions**:
- Verify EBS CSI driver is running: `kubectl get pods -n kube-system | grep ebs-csi`
- Check StorageClass exists: `kubectl get storageclass`
- Ensure IAM permissions for CSI driver
- Verify volume is not already attached to another node

#### 5. Ingress Not Accessible

**Symptoms**: Cannot access Jenkins via browser, 502/503 errors

**Diagnosis**:
```powershell
kubectl get ingress -n <namespace>
kubectl describe ingress jenkins -n <namespace>
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

**Common Causes**:
- DNS not configured → Create CNAME to LoadBalancer hostname
- Certificate not ready → Check cert-manager logs
- Backend service not healthy → Verify pods are ready
- Security group rules → Allow traffic on port 80/443

### Debug Mode

Enable debug logging in Jenkins:

```yaml
controller:
  javaOpts: >-
    -Djava.util.logging.config.file=/var/jenkins_home/log.properties
    -Djenkins.model.Jenkins.logStartupPerformance=true
```

### Useful Commands

```powershell
# Get all resources in namespace
kubectl get all -n <namespace>

# Describe Jenkins pod
kubectl describe pod -n <namespace> -l app.kubernetes.io/component=jenkins-controller

# View recent events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Port-forward for local access
kubectl port-forward svc/jenkins -n <namespace> 8080:8080

# Exec into controller pod
kubectl exec -it <jenkins-pod> -n <namespace> -- /bin/bash

# Check PVC usage
kubectl exec <jenkins-pod> -n <namespace> -- df -h /var/jenkins_home

# View Helm release history
helm history jenkins -n <namespace>

# Rollback to previous release
helm rollback jenkins -n <namespace>
```

---

## Maintenance and Operations

### Upgrade Procedure

#### 1. Upgrade Jenkins Version

```powershell
# Update image tag in values file
controller:
  image:
    tag: "2.450-jdk17"  # New version

# Upgrade via Helm
helm upgrade jenkins ./helm `
  --values ./helm/values/values-<env>.yaml `
  --namespace <namespace> `
  --timeout 15m
```

#### 2. Upgrade Helm Chart

```powershell
# Update Chart.yaml with new chart version
dependencies:
  - name: jenkins
    version: "5.2.0"  # New chart version

# Update dependencies
helm dependency update ./helm

# Upgrade
helm upgrade jenkins ./helm --values ./helm/values/values-<env>.yaml -n <namespace>
```

#### 3. Plugin Updates

**Via JCasC** (Recommended):
Update plugin versions in `installPlugins` list and redeploy.

**Via UI** (Not recommended for GitOps):
Jenkins UI → Manage Jenkins → Manage Plugins

### Scaling

#### Horizontal Scaling (More Agents)

Adjust `containerCapStr` in JCasC:

```yaml
kubernetes:
  containerCapStr: "100"  # Max concurrent agents
```

#### Vertical Scaling (More Resources)

Update resources in values file:

```yaml
controller:
  resources:
    requests:
      memory: "8Gi"
      cpu: "4"
    limits:
      memory: "16Gi"
      cpu: "8"
```

### Regular Maintenance Tasks

| Task | Frequency | Environment |
|------|-----------|-------------|
| Review and update plugins | Monthly | All |
| Security patching (Jenkins version) | As released | All |
| Backup testing | Quarterly | Prod |
| Credential rotation | Every 90 days | Prod |
| Clean old job artifacts | Weekly | All |
| Review and optimize pipelines | Monthly | All |
| Capacity planning review | Quarterly | Staging/Prod |
| Disaster recovery drill | Quarterly | Prod |

### Jenkins Job Configuration Backup

**Use Job DSL or Pipeline libraries** to version-control job definitions:

```groovy
// Example Job DSL seed job
pipelineJob('example-pipeline') {
  definition {
    cpsScm {
      scm {
        git {
          remote {
            url('https://github.com/your-org/jenkins-pipelines.git')
            credentials('github-token')
          }
          branch('*/main')
        }
      }
      scriptPath('Jenkinsfile')
    }
  }
}
```

### Cost Optimization (AWS EKS)

1. **Right-size resources**: Monitor actual usage and adjust limits
2. **Use Spot instances for agents**: Configure node groups with spot instances
3. **Implement auto-scaling**: Use Cluster Autoscaler
4. **Optimize storage**: Use lifecycle policies for EBS snapshots
5. **Review idle resources**: Shut down non-production during off-hours

---

## Additional Resources

### Official Documentation

- [Jenkins Official Site](https://www.jenkins.io/)
- [Jenkins Helm Chart](https://github.com/jenkinsci/helm-charts)
- [Jenkins Configuration as Code](https://github.com/jenkinsci/configuration-as-code-plugin)
- [Kubernetes Plugin](https://plugins.jenkins.io/kubernetes/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)

### Best Practices Guides

- [Jenkins Best Practices](https://www.jenkins.io/doc/book/using/best-practices/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)

### Community

- [Jenkins Community Forums](https://community.jenkins.io/)
- [Kubernetes Slack](https://kubernetes.slack.com/)
- [ArgoCD Slack](https://argoproj.github.io/community/join-slack/)

---

## Support and Contributions

For issues, questions, or contributions:

1. Open an issue in the repository
2. Submit pull requests for improvements
3. Follow GitOps workflow for changes

---

## License

This configuration is provided as-is for educational and operational purposes. Refer to the official Jenkins license and chart license for details.

---

**Last Updated**: February 2026  
**Maintained By**: DevOps Team  
**Version**: 1.0.0  
