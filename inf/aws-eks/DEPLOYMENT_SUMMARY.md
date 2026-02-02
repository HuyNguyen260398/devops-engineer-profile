# AWS EKS Deployment Summary - Staging Environment

## Deployment Status: ✅ SUCCESSFUL

**Deployment Date:** February 7, 2026  
**Cluster Name:** dep-staging-eks  
**Kubernetes Version:** 1.31  
**Region:** ap-southeast-1 (Singapore)  
**Environment:** Staging

---

## Infrastructure Components

### 1. **Networking (VPC)**
- **VPC CIDR:** 10.0.0.0/16
- **Public Subnets:** 2 (10.0.0.0/24, 10.0.1.0/24)
- **Private Subnets:** 2 (10.0.10.0/24, 10.0.11.0/24)
- **NAT Gateway:** 1 (cost-optimized for staging)
- **Internet Gateway:** 1
- **Availability Zones:** ap-southeast-1a, ap-southeast-1b

### 2. **EKS Cluster**
- **Cluster ARN:** arn:aws:eks:ap-southeast-1:010382427026:cluster/dep-staging-eks
- **Cluster Endpoint:** https://56E4D5FED63C43818814FC898315D18C.gr7.ap-southeast-1.eks.amazonaws.com
- **Authentication mode:** API_AND_CONFIG_MAP (supports both IAM and aws-auth ConfigMap)
- **IRSA Enabled:** Yes (for pod-level IAM permissions)
- **Control Plane Logging:** Enabled (API, Audit, Authenticator, Controller Manager, Scheduler)
- **CloudWatch Log Group:** /aws/eks/dep-staging-eks/cluster (7-day retention)

### 3. **Node Groups**
- **Name:** general
- **Instance Types:** t3.medium
- **Capacity Type:** SPOT (cost-optimized)
- **Desired Capacity:** 2 nodes
- **Min Capacity:** 1 node
- **Max Capacity:** 4 nodes
- **Current Status:** 2 nodes READY
- **Kubernetes Version:** v1.31.13-eks-ecaa3a6

### 4. **EKS Add-ons**
- **vpc-cni:** Latest version (Amazon VPC CNI for pod networking)
- **kube-proxy:** Latest version (network proxy)
- **coredns:** Latest version (DNS resolution)
- **aws-ebs-csi-driver:** Latest version (persistent volume support)

### 5. **IRSA (IAM Roles for Service Accounts)**
| Service Account | Purpose | Status |
|----------------|---------|--------|
| EBS CSI Driver | Manage EBS volumes for persistent storage | ✅ Active |
| Cluster Autoscaler | Auto-scale node groups based on demand | ✅ Active |

### 6. **Monitoring Stack (Prometheus)**
All pods running in `monitoring` namespace:
- **Prometheus Server:** 2/2 Running (metrics collection)
- **Grafana:** 3/3 Running (visualization dashboard)
- **Alertmanager:** 2/2 Running (alert management)
- **Kube-State-Metrics:** 1/1 Running (Kubernetes metrics)
- **Node Exporter:** 2/2 Running (host metrics from each node)

### 7. **Autoscaling Components**
- **Metrics Server:** 1/1 Running (HPA support)
- **Cluster Autoscaler:** 1/1 Running (node-level autoscaling)

### 8. **Security**
- **Encryption at Rest:** KMS with customer-managed key
- **Encryption in Transit:** TLS for all communications
- **Pod Security:** Ready for Pod Security Standards (PSS)
- **Network Policies:** Ready for implementation (Calico/Cilium can be added)

---

## Known Limitations (Staging)

### CloudWatch Container Insights
**Status:** ⚠️ DISABLED  
**Reason:** Broken Helm chart repository (aws-observability.github.io returns 404)  
**Alternative:** AWS Distro for OpenTelemetry (ADOT) recommended for production

**Control Plane Logs:** ✅ Available in CloudWatch Logs `/aws/eks/dep-staging-eks/cluster`

---

## Access Instructions

### 1. Configure kubectl
```bash
aws eks update-kubeconfig --region ap-southeast-1 --name dep-staging-eks
```

### 2. Verify Cluster Access
```bash
kubectl cluster-info
kubectl get nodes
kubectl get pods -A
```

### 3. Access Grafana Dashboard
```bash
# Forward Grafana service to local port 3000
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# Open browser to: http://localhost:3000
# Default credentials:
# Username: admin
# Password: Get from secret:
kubectl get secret -n monitoring kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 -d
```

---

## Troubleshooting Commands

### Check Node Status
```bash
kubectl get nodes -o wide
kubectl top nodes  # Requires metrics-server
```

### Check Pod Status
```bash
kubectl get pods -A
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

### Check Cluster Autoscaler
```bash
kubectl logs -f deployment/cluster-autoscaler-aws-cluster-autoscaler -n kube-system
```

### Check EKS Add-ons
```bash
aws eks list-addons --cluster-name dep-staging-eks --region ap-southeast-1
aws eks describe-addon --cluster-name dep-staging-eks --addon-name aws-ebs-csi-driver --region ap-southeast-1
```

### Check CloudWatch Logs
```bash
aws logs tail /aws/eks/dep-staging-eks/cluster --follow --region ap-southeast-1
```

---

## Cost Optimization (Staging)

- ✅ SPOT instances for worker nodes (~70% cost savings)
- ✅ Single NAT Gateway (instead of one per AZ)
- ✅ 7-day CloudWatch log retention
- ✅ t3.medium instances (right-sized for staging)
- ✅ Min 1 node allows scaling to zero during off-hours (manual)

**Estimated Monthly Cost:** ~$80-120 USD  
(2 t3.medium SPOT nodes @ ~$0.0208/hr + NAT Gateway @ $0.045/hr + data transfer)

---

## Next Steps

### Immediate (Optional)
1. **Test Horizontal Pod Autoscaling (HPA)**
   ```bash
   kubectl autoscale deployment <app-name> --cpu-percent=50 --min=1 --max=10
   ```

2. **Configure ADOT for CloudWatch Container Insights**  
   Follow: https://aws-otel.github.io/docs/setup/eks

3. **Set up CI/CD Pipeline**  
   - Configure GitHub Actions with OIDC (already available in `../aws-github-oidc/`)
   - Deploy applications via ArgoCD or Flux

### Production Preparation
1. **Upgrade to ON_DEMAND instances** (change `capacity_type` in `staging.tfvars`)
2. **Enable multi-AZ NAT Gateways** (set `single_nat_gateway = false`)
3. **Increase CloudWatch retention** (from 7 to 30+ days)
4. **Implement Network Policies** (e.g., Calico, Cilium)
5. **Set up Velero for backups**
6. **Configure AWS WAF + ALB Ingress Controller**
7. **Enable GuardDuty for threat detection**

---

## Key Outputs (from Terraform)

```bash
cluster_name                  = "dep-staging-eks"
cluster_endpoint              = "https://56E4D5FED63C43818814FC898315D18C.gr7.ap-southeast-1.eks.amazonaws.com"
cluster_version               = "1.31"
region                        = "ap-southeast-1"
vpc_id                        = "vpc-048d2cce9dad40ec4"
cloudwatch_log_group_name     = "/aws/eks/dep-staging-eks/cluster"
cluster_autoscaler_role_arn   = "arn:aws:iam::010382427026:role/dep-staging-eks-cluster-autoscaler-20260207012959125600000001"
ebs_csi_driver_role_arn       = "arn:aws:iam::010382427026:role/dep-staging-eks-ebs-csi-20260207012959125600000002"
```

---

## Deployment Issues Resolved

1. **CloudWatch Log Group Duplicate Creation**  
   - Issue: EKS auto-creates log group when logging enabled  
   - Fix: Set `create_cloudwatch_log_group = false` in EKS module

2. **Kubernetes AMI Version 1.28 Deprecated**  
   - Issue: AMI not available in AWS  
   - Fix: Upgraded to Kubernetes 1.31

3. **CloudWatch Agent Helm Chart 404 Error**  
   - Issue: Repository URL https://aws-observability.github.io/aws-cloudwatch-metrics not found  
   - Fix: Disabled CloudWatch agent, recommended ADOT for production

---

## Support & Documentation

- **EKS Module Docs:** https://registry.terraform.io/modules/terraform-aws-modules/eks/aws/latest
- **VPC Module Docs:** https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest
- **AWS EKS Best Practices:** https://aws.github.io/aws-eks-best-practices/
- **Prometheus Operator Docs:** https://github.com/prometheus-operator/kube-prometheus

--- 

**Last Updated:** February 7, 2026  
**Maintained by:** DevOps Team
