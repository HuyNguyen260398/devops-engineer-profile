---
post_title: "AWS ALB Ingress Implementation for ArgoCD on EKS"
author1: "DevOps Team"
post_slug: "alb-ingress-argocd-eks"
summary: "Documents the implementation of the AWS Load Balancer Controller and ALB Ingress to expose ArgoCD on the EKS staging cluster via a public URL."
post_date: "2026-02-19"
ai_note: "AI-assisted documentation"
---

## Overview

This document describes the implementation of the **AWS Application Load Balancer (ALB)**
to expose the ArgoCD dashboard on the `dep-staging-eks` EKS cluster via a public URL,
eliminating the need for `kubectl port-forward`.

**Deployment Date:** February 19, 2026
**Cluster:** `dep-staging-eks` (ap-southeast-1)
**ArgoCD ALB URL:** `http://k8s-argocd-35da8d9f77-1760397167.ap-southeast-1.elb.amazonaws.com`

---

## Architecture

```
Internet
   │
   ▼
┌─────────────────────────────────────────┐
│  AWS Application Load Balancer (ALB)    │
│  - Internet-facing, HTTP:80             │
│  - Target type: IP (pod-level routing)  │
│  - Health check: /healthz               │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Kubernetes Ingress (class: alb)        │
│  - Namespace: argocd                    │
│  - Resource: argocd-server              │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  ArgoCD Server Service (ClusterIP)      │
│  - Port 80 (HTTP, --insecure mode)      │
│  - TLS terminated at ALB level          │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  ArgoCD Server Pods (2 replicas)        │
│  - HPA: 2-5 replicas                   │
│  - PDB: minAvailable=1                 │
└─────────────────────────────────────────┘
```

---

## Components Deployed

### AWS Load Balancer Controller

The [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
runs in `kube-system` and watches for Kubernetes Ingress resources. When it detects an
Ingress with `ingressClassName: alb`, it automatically provisions an AWS ALB.

| Attribute | Value |
|-----------|-------|
| Namespace | `kube-system` |
| Replicas | 2 |
| App Version | 2.11.0 |
| Helm Chart | `aws-load-balancer-controller` v1.11.0 |
| Service Account | `aws-load-balancer-controller` |
| IAM Auth | IRSA (IAM Roles for Service Accounts) |

### ArgoCD ALB Ingress

| Attribute | Value |
|-----------|-------|
| Ingress Class | `alb` |
| Scheme | `internet-facing` |
| Target Type | `ip` (routes directly to pod IPs) |
| Listener | HTTP:80 |
| Health Check Path | `/healthz` |
| Ingress Group | `argocd` |
| Host Routing | Wildcard (`*`) — accepts any hostname |

---

## Terraform Resources

### New Files

- **`inf/terraform/aws-eks/alb_controller.tf`** — AWS Load Balancer Controller
  (IAM policy, IRSA role, Helm release)

### Modified Files

| File | Change |
|------|--------|
| `inf/terraform/aws-eks/variables.tf` | Added `enable_aws_lb_controller`, `aws_lb_controller_version`, `aws_lb_controller_chart_version` |
| `inf/terraform/aws-eks/provider.tf` | Added `hashicorp/http` provider for IAM policy download |
| `inf/terraform/aws-eks/outputs.tf` | Added `aws_lb_controller_role_arn`, `argocd_ingress_info` outputs |
| `inf/terraform/aws-eks/environments/staging.tfvars` | Enabled LB controller with version pins |
| `ops/argocd/argocd-values.yaml` | Enabled ALB Ingress with internet-facing annotations; set `global.domain: ""` for wildcard host routing |

### Resources Created

| Resource | Type | Purpose |
|----------|------|---------|
| `aws_iam_policy.lb_controller[0]` | IAM Policy | Permissions for ALB/NLB/target group management |
| `module.aws_lb_controller_irsa[0]` | IRSA Role | Binds IAM policy to K8s service account via OIDC |
| `helm_release.aws_lb_controller[0]` | Helm Release | Deploys the controller into `kube-system` |

---

## Configuration Variables

```hcl
# inf/terraform/aws-eks/environments/staging.tfvars

enable_aws_lb_controller        = true
aws_lb_controller_version       = "2.11.0"
aws_lb_controller_chart_version = "1.11.0"
```

---

## Access Instructions

### Via ALB URL (Primary)

Open in browser:

```
http://k8s-argocd-35da8d9f77-1760397167.ap-southeast-1.elb.amazonaws.com
```

- **Username:** `admin`
- **Password:** Retrieve with:

```powershell
kubectl get secret argocd-initial-admin-secret -n argocd `
  -o jsonpath="{.data.password}" |
  ForEach-Object { [System.Text.Encoding]::UTF8.GetString(
    [System.Convert]::FromBase64String($_)) }
```

### Via Port Forward (Fallback)

```powershell
kubectl port-forward svc/argocd-server -n argocd 8080:80
# Open http://localhost:8080
```

---

## Verification Commands

```bash
# Check LB controller pods
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Check ArgoCD Ingress and ALB address
kubectl get ingress -n argocd

# Check ArgoCD pods
kubectl get pods -n argocd

# Get ALB DNS name
kubectl get ingress -n argocd argocd-server \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

---

## Security Considerations

### Current State (Staging)

- ALB serves **HTTP only** (port 80) — acceptable for staging
- ArgoCD runs with `--insecure` flag (TLS termination at ALB/Ingress level)
- LB controller uses **IRSA** (least-privilege, no static credentials)
- WAF and Shield are **disabled** (cost optimization for staging)

### Production Hardening (Future)

When a custom domain and ACM certificate are available, enable HTTPS:

```yaml
# ops/argocd/argocd-values.yaml
global:
  domain: "argocd.your-domain.com"  # Set to your custom domain

server:
  ingress:
    enabled: true
    ingressClassName: alb
    annotations:
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/certificate-arn: "<ACM_CERTIFICATE_ARN>"
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
      alb.ingress.kubernetes.io/ssl-redirect: "443"
    tls:
      - secretName: argocd-tls
        hosts:
          - argocd.your-domain.com
```

> **Note:** The ArgoCD Helm chart (v9.4.2) uses `global.domain` as the primary source for
> Ingress host routing. Setting `global.domain` to your custom domain automatically
> configures host-based routing for all ArgoCD Ingress resources.

Additional production steps:

1. **ACM Certificate** — Request a public certificate for the domain
2. **Route53 DNS** — Create a CNAME record pointing to the ALB
3. **WAF v2** — Enable `enableWafv2: true` in the LB controller for DDoS/bot protection
4. **IP Allowlist** — Restrict ALB security group inbound rules
5. **CloudFront (Optional)** — Add CDN layer for caching and edge security

---

## Deployment Issues Resolved

### Webhook TLS Certificate Timing

- **Issue:** On initial `terraform apply`, the LB controller's webhook certificate
  was not yet valid when ArgoCD tried to create the Ingress resource
  (`x509: certificate has expired or is not yet valid`)
- **Root Cause:** Race condition — the LB controller webhook cert is
  self-signed with a start time slightly after the Ingress creation attempt
- **Resolution:** A second `terraform apply` succeeded after the certificate
  became valid (~1 minute delay)
- **Prevention:** This is a one-time issue during initial deployment only

### Host-Based Routing Preventing ALB Access

- **Issue:** After ALB was provisioned, accessing the ALB DNS URL returned no response.
  The Ingress resource showed `HOSTS: argocd.example.com` instead of wildcard (`*`),
  meaning the ALB only accepted requests with `Host: argocd.example.com` header
- **Root Cause:** The ArgoCD Helm chart (v9.4.2) defaults `global.domain` to
  `argocd.example.com`. This value propagates to all Ingress host rules regardless
  of `server.ingress.hosts` or `server.ingress.hostname` overrides
- **Resolution:** Set `global.domain: ""` in `ops/argocd/argocd-values.yaml` to
  disable host-based routing, allowing the ALB to accept traffic on any hostname
- **Verification:** `kubectl get ingress -n argocd` confirmed `HOSTS: *` after
  redeploying with `terraform apply`
- **Key Lesson:** When using the ArgoCD Helm chart without a custom domain,
  always explicitly set `global.domain: ""` to override the chart default

---

## Cost Impact

| Component | Estimated Monthly Cost |
|-----------|----------------------|
| ALB (1 instance) | ~$22 (fixed) + data processing |
| LB Controller Pods (2x) | Negligible (runs on existing nodes) |
| **Total Additional** | **~$22-30/month** |

---

## References

- [AWS Load Balancer Controller Docs](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [EKS Ingress with ALB](https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html)
- [ArgoCD Ingress Configuration](https://argo-cd.readthedocs.io/en/stable/operator-manual/ingress/)
- [IRSA Documentation](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

---

**Last Updated:** February 19, 2026
**Maintained by:** DevOps Team
