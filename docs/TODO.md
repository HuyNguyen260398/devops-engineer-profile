# DevOps Engineer Profile - Project TODO

**Last Updated:** April 12, 2026
**Project:** DevOps Engineer Profile

---

## ♾️ .github/ - GitHub Actions Workflows

### S3 Web Workflows
- ✅ **Create workflow for AWS S3 web sync**

### Terraform Workflows
- ✅ **Create workflow for Terraform validation and plan**
- ✅ **Create workflow for Terraform apply only run on workflow_dispatch**
- [ ] **Move aws account id to env / vars**

### Vue.js Admin Dashboard Workflows
- ✅ **Create CI workflow** (`vuejs-admin-dashboard-ci.yml`) — runs on feature branches: install → lint → type-check → build
- ✅ **Create quality gate workflow** (`vuejs-admin-dashboard-quality-gate.yml`) — PR merge gate, posts result table as PR comment
- ✅ **Create deploy workflow** (`vuejs-admin-dashboard-deploy.yml`) — syncs app subtree to AWS CodeCommit on merge to main, triggering CodePipeline → Amplify

---

## 📝 docs/ - Documentation

### GitHub Profile Enhancement
- [ ] **Create stunning and attractive README.md for GitHub profile**

### CLAUDE
- ✅ **Add CLAUDE.md**
- ✅ **Add .claude/skills**

---

## 🏗️ inf/ - Infrastructure as Code

### Terraform Configurations
- ✅ **Add Terraform configuration for AWS EKS deployment**
- ✅ **Add Terraform configuration for Jenkins deployment to AWS EKS**
- ✅ **Add Terraform configuration for ArgoCD deployment to AWS EKS**
- ✅ **Add Terraform configuration for Prometheus and Grafana monitoring AWS EKS**
- [ ] **Add HorizontalPodAutoscalers for AWS EKS**

### Vue.js Admin Dashboard Infrastructure
- ✅ **Add Terraform configuration for AWS Amplify hosting** (`inf/terraform/vuejs-admin-dashboard/amplify.tf`)
- ✅ **Add Terraform configuration for AWS CodePipeline CI/CD** (`inf/terraform/vuejs-admin-dashboard/pipeline.tf`) — CodeCommit → CodeBuild → Amplify
- ✅ **Add Terraform configuration for AWS CodeArtifact** (`inf/terraform/vuejs-admin-dashboard/codeartifact.tf`) — private npm registry for dependency caching
- ✅ **Add Terraform configuration for AWS CodeDeploy** (`inf/terraform/vuejs-admin-dashboard/codedeploy.tf`) — deployment group targeting Amplify
- ✅ **Add IAM roles and policies for Vue.js Admin Dashboard CI/CD** (`inf/terraform/vuejs-admin-dashboard/iam.tf`)

### AWS ETL Pipeline Infrastructure
- ✅ **Scaffold Terraform configuration for AWS ETL Pipeline** (`inf/terraform/aws-etl-pipeline/`) — VPC, S3, Lambda, Bedrock Agent, DynamoDB, Athena, EventBridge
- [ ] **Implement data extraction from public APIs** (Lambda functions)
- [ ] **Implement data transformation with AWS Glue**
- [ ] **Implement data loading into AWS Redshift**
- [ ] **Add Airflow DAGs for orchestration**
- [ ] **Add monitoring with CloudWatch and Prometheus**

---

## ⚙️ ops/ - Automation Scripts

### Deploy GitOps stacks local
- ✅ **Create script to deploy GitOps stacks to local Kubernetes cluster** (`ops/deploy-gitops-stacks-local.ps1`)
- ✅ **Create python version of the deploy GitOps script** (`ops/deploy-gitops-stacks-local.py`)

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

### ELK Stack (Service 3)
- ✅ **Create ECK Operator Helm chart wrapper** (`gitops/helm-charts/eck-operator/`)
  - Wrapper chart pinned to `elastic/eck-operator:3.3.1`
  - Telemetry disabled, PSS secure defaults
- ✅ **Create ECK Stack Helm chart wrapper** (`gitops/helm-charts/eck-stack/`)
  - Wrapper chart pinned to `elastic/eck-stack:0.18.1`
  - Elasticsearch + Kibana base config
- ✅ **Create Fluent Bit Helm chart wrapper** (`gitops/helm-charts/fluent-bit/`)
  - Wrapper chart pinned to `fluent/fluent-bit:0.49.1`
  - DaemonSet log pipeline → Elasticsearch with Kubernetes metadata enrichment
- ✅ **Create ELK Stack ArgoCD Applications for local / staging / production**
  - Local: 1-node ES (5Gi standard), Kibana NodePort 32601
  - Staging: 3-node ES (30Gi gp3 × 3), 2 Kibana replicas
  - Production: 3-node ES (100Gi gp3 × 3), 2 Kibana replicas, no-prune sync
- ✅ **Update gitops/README.md with ELK Stack documentation**

### AWX Ansible Automation Platform (Service 4)
- ✅ **Create AWX Operator Helm chart wrapper** (`gitops/helm-charts/awx-operator/`)
  - Wrapper chart pinned to `awx-operator:3.2.1` (AWX app `2.19.1`)
  - AWX Operator + AWX CR secure defaults
- ✅ **Create AWX ArgoCD Applications for local / staging / production**
  - Local: 8Gi hostpath storage, AWX UI NodePort 32080
  - Staging: 20Gi gp3, ClusterIP/Ingress
  - Production: 50Gi gp3, no-prune sync
- ✅ **Update gitops/README.md with AWX documentation**

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

### aws-etl-pipeline (Data Engineering Project)
- [ ] **Add data extraction from public APIs**
- [ ] **Add data transformation with AWS Glue**
- [ ] **Add data loading into AWS Redshift**
- [ ] **Add Airflow DAGs for orchestration**
- [ ] **Add monitoring with CloudWatch and Prometheus**

### vuejs-admin-dashboard (Vue.js Application)
- ✅ **Scaffold Vue.js admin dashboard application** (`src/vuejs-admin-dashboard/`) — Vite + Vue 3 + TypeScript + Tailwind CSS
- ✅ **Configure build spec for AWS CodeBuild** (`src/vuejs-admin-dashboard/buildspec.yml`)
- [ ] **Update UI with GitHub Themes**
- [ ] **Add Blog Page**
- [ ] **Update Markdown file as blog content**
- [ ] **Save blog content in S3 and pull dynamically into website**

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
