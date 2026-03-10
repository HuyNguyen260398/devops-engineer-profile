# DevOps Engineer Profile - Project TODO

**Last Updated:** February 8, 2026
**Project:** DevOps Engineer Profile

---

## ♾️ .github/ - GitHub Actions Workflows

### Workflows
- ✅ **Create workflow for AWS S3 web sync**

- ✅ **Create workflow for Terraform validation and plan**

- ✅ **Create workflow for Terraform apply only run on workflow_dispatch**

- [ ] **Move aws account id to env / vars**

---

## 📝 doc/ - Documentation

### GitHub Profile Enhancement
- [ ] **Create stunning and attractive README.md for GitHub profile**

---

## 🏗️ inf/ - Infrastructure as Code

### Terraform Configurations
- ✅ **Add Terraform configuration for AWS EKS deployment**

- ✅ **Add Terraform configuration for Jenkins deployment to AWS EKS**

- ✅ **Add Terraform configuration for ArgoCD deployment to AWS EKS**

- [ ] **Add Terraform configuration for Prometheus and Grafana monitoring AWS EKS**
  > Note: GitOps deployment (ArgoCD + Helm) is complete. This item tracks Terraform provisioning of supporting AWS infra (e.g., IRSA roles, EBS storage class, Ingress ALB for Grafana).

- [ ] **Add HorizontalPodAutoscalers for AWS EKS**

---

## ⚙️ ops/ - Automation Scripts

---

## 🔄 gitops/ - GitOps Platform

### Jenkins (Service 1)
- ✅ **Create Jenkins Helm chart wrapper** (`gitops/helm-charts/jenkins/`)
- ✅ **Create Jenkins ArgoCD Applications for local / staging / production**
- ✅ **Create Jenkins pool Applications** (`pooled-envs/pool-1.yaml`)
- ✅ **Create Jenkins ApplicationSet** (`applicationsets/jenkins-appset.yaml`)
- ✅ **Bootstrap ArgoCD app-of-apps** (`bootstrap/app-of-apps.yaml`)
- ✅ **Define AppProjects** (`bootstrap/projects/`)
- ✅ **Define Argo Workflows control-plane** (`control-plane/workflows/`)

### kube-prometheus-stack (Service 2)
- ✅ **Create kube-prometheus-stack Helm chart wrapper** (`gitops/helm-charts/kube-prometheus-stack/`)
  - Wrapper chart pinned to `prometheus-community/kube-prometheus-stack:67.9.0`
  - PSS restricted security contexts for all 6 components
  - EKS-tuned defaultRules (etcd/controllerManager/scheduler/kubeProxy disabled)
- ✅ **Update infrastructure AppProject with Prometheus CRD whitelist** (`bootstrap/projects/infrastructure.yaml`)
  - Added `monitoring.coreos.com` group + webhook + scheduling CRD types
- ✅ **Create kube-prometheus-stack Applications for local / staging / production**
  - Local: NodePort 32300, 3d retention, standard storageClass, alertmanager disabled
  - Staging: ClusterIP, 7d retention, gp3, Slack alerts to `#devops-staging-alerts`
  - Production: ClusterIP, 30d retention, gp3, HA Alertmanager (2 replicas), PagerDuty + Slack
- ✅ **Create app-of-apps-infrastructure bootstrap** (`bootstrap/app-of-apps-infrastructure.yaml`)
- ✅ **Create kube-prometheus-stack ApplicationSet** (`applicationsets/kube-prometheus-stack-appset.yaml`)
- ✅ **Update gitops/README.md documentation**

### Next Infrastructure Services (Roadmap)
- [ ] **Add AWS Load Balancer Controller** (`gitops/application-plane/*/infrastructure/alb-controller.yaml`)
- [ ] **Add External Secrets Operator** for AWS Secrets Manager integration
- [ ] **Add cert-manager** for automatic TLS certificate management
- [ ] **Add Grafana Ingress** (once ALB Controller is deployed)
- [ ] **Configure Prometheus IRSA** for cross-account CloudWatch metrics scraping

---

## 💻 src/ - Source Code & Applications

### aws-s3-web (Portfolio Website)

#### New Features
- ✅ **Add News/Feeds Section**

- ✅ **Add GitHub Activities/Projects Showcase**

- ✅ **Add downloadable PDF CV option**

---

## 📌 Notes & References

### Key Resources
- **AWS OIDC Setup:** https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
- **GitHub Terraform Provider:** https://registry.terraform.io/providers/integrations/github/latest/docs/resources/actions_secret
- **CloudFront Invalidation:** https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html

---

## 🎯 Quick Reference

### Project Structure Alignment
This TODO list is organized to match the project's directory structure:

- **♾️ .github/** - GitHub Actions workflows, CI/CD pipelines
- **📝 doc/** - Documentation, guides, and knowledge base
- **🏗️ inf/** - Infrastructure as Code (Terraform, CloudFormation)
- **⚙️ ops/** - Automation scripts, operational tools
- **💻 src/** - Application source code (websites, APIs, services)

### Task Management
- Use `- [ ]` for pending tasks
- Use `- ✅` for completed tasks
