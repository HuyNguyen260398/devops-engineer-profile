# aws-eks-argocd – Terraform Module

Manages **AWS-specific infrastructure** for ArgoCD running on EKS. ArgoCD itself is
deployed via Helm/kubectl — see [`ops/argocd/`](../../../ops/argocd/) for manifests
and the deployment script.

## What This Module Manages

| Resource | Purpose |
|----------|---------|
| IAM Role (IRSA) | Grants ArgoCD pods ECR read access via IRSA |
| OIDC trust policy | Scoped to `argocd-server`, `argocd-application-controller`, `argocd-repo-server` |

> The **ALB** (Application Load Balancer) for ArgoCD is **not** managed by this
> module. It is provisioned automatically by the AWS Load Balancer Controller
> (deployed in `aws-eks`) when you apply `ops/argocd/manifests/ingress.yaml`.

## Prerequisites

- An existing EKS cluster (provisioned by `inf/terraform/aws-eks/`)
- AWS Load Balancer Controller running on the cluster
- `terraform` >= 1.5.0
- `aws` CLI configured with appropriate permissions

## Directory Structure

```
aws-eks-argocd/
├── main.tf                   # IRSA role for ArgoCD
├── locals.tf                 # Derived values (OIDC provider ARN, common tags)
├── variables.tf              # Input variables
├── outputs.tf                # argocd_irsa_role_arn, argocd_irsa_role_name
├── provider.tf               # AWS provider
└── environments/
    ├── staging.tfvars
    └── production.tfvars.example
```

## Usage

### 1 — Apply the Terraform Module

```bash
cd inf/terraform/aws-eks-argocd

terraform init
terraform plan -var-file environments/staging.tfvars
terraform apply -var-file environments/staging.tfvars
```

### 2 — Retrieve the IRSA Role ARN

```bash
terraform output -raw argocd_irsa_role_arn
```

### 3 — Deploy ArgoCD

Pass the role ARN to the ArgoCD deployment script:

```bash
cd ops/argocd

export ARGOCD_IRSA_ROLE_ARN=$(cd ../../inf/terraform/aws-eks-argocd && terraform output -raw argocd_irsa_role_arn)
export ENVIRONMENT=staging
export CLUSTER_NAME=dep-staging-eks

bash deploy-aws.sh install
```

## Inputs

| Variable | Description | Default |
|----------|-------------|---------|
| `environment` | `staging` or `production` | required |
| `project_name` | Resource naming prefix | `devops-engineer-profile` |
| `aws_region` | AWS region | `ap-southeast-1` |
| `cluster_name` | EKS cluster name (used to look up OIDC provider) | required |
| `argocd_namespace` | Kubernetes namespace for ArgoCD service accounts | `argocd` |
| `additional_tags` | Extra tags on all resources | `{}` |

## Outputs

| Output | Description |
|--------|-------------|
| `argocd_irsa_role_arn` | Role ARN to annotate on ArgoCD service accounts |
| `argocd_irsa_role_name` | IAM role name |
| `argocd_namespace` | Kubernetes namespace |
| `cluster_name` | EKS cluster name |

## How IRSA Works

The IRSA role trust policy allows the three ArgoCD service accounts
(`argocd-server`, `argocd-application-controller`, `argocd-repo-server`)
to assume the role through the cluster's OIDC provider.

The role ARN must be present as an annotation on each service account:

```yaml
annotations:
  eks.amazonaws.com/role-arn: "<argocd_irsa_role_arn output>"
```

This is handled automatically by `ops/argocd/argocd-values-aws.yaml` when
you set `ARGOCD_IRSA_ROLE_ARN` before running `deploy-aws.sh`.

## Destroy

```bash
terraform destroy -var-file environments/staging.tfvars
```

> Destroying this module only removes the IAM role. ArgoCD pods and the ALB
> remain until you run `bash ops/argocd/deploy-aws.sh uninstall`.
