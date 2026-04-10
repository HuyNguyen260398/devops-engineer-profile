# Vue.js Admin Dashboard — AWS Infrastructure

Provisions all AWS infrastructure required to host and continuously deploy the Vue.js Admin Dashboard SPA on **AWS Amplify** via a **CodeCommit → CodeBuild → Amplify** pipeline managed by **AWS CodePipeline**.

All resources are created and managed with **Terraform** (`>= 1.6`). State is stored in S3 with DynamoDB locking. Each environment (production, staging) has its own isolated Terraform state and its own set of AWS resources.

---

## Architecture

```
Git push (CodeCommit)
  │
  │  main branch ──────────────────────────────────────────────────┐
  │  develop branch ────────────────────────────────────────────┐  │
  │                                                             │  │
  ▼  EventBridge (per-env rule)                                │  │
                                                               │  │
  CodePipeline (staging)        CodePipeline (production)      │  │
  ├── Source: develop branch    ├── Source: main branch         │  │
  ├── Build:  CodeBuild         ├── Build:  CodeBuild           │  │
  └── Deploy: Lambda trigger    └── Deploy: Lambda trigger      │  │
       │                                  │                     │  │
       ▼                                  ▼                     │  │
  Amplify (staging)              Amplify (production)           │  │
  └── develop branch             └── main branch <─────────────┘  │
                                                    <──────────────┘
```

**Shared resources** (created once by production):
- AWS CodeCommit repository

**Per-environment resources** (isolated state per env):
- S3 artifact bucket (`vuejs-admin-dashboard-<env>-artifacts`)
- CodeBuild project (`vuejs-admin-dashboard-<env>`)
- CodePipeline (`vuejs-admin-dashboard-<env>-pipeline`)
- Lambda deploy trigger (`vuejs-admin-dashboard-<env>-amplify-deploy`)
- Amplify app (`vuejs-admin-dashboard-<env>`)
- IAM roles (all scoped with `<env>` suffix)
- EventBridge rule (watches the env's branch)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Terraform CLI | `>= 1.6` |
| AWS CLI | any recent version |
| tflint | matching `.tflint.hcl` |

The IAM identity running Terraform must have permissions to create IAM roles, S3 buckets, CodeCommit repos, CodeBuild projects, CodePipeline pipelines, Lambda functions, and Amplify apps.

---

## One-Time Bootstrap

Run once before the first `terraform init`. This creates the shared S3 state bucket and DynamoDB lock table used by all environments.

```bash
cd inf/terraform/vuejs-admin-dashboard/bootstrap
terraform init
terraform apply
```

---

## Deploying Production

```bash
cd inf/terraform/vuejs-admin-dashboard

# Initialise with the production backend
terraform init -backend-config=environments/production/backend.hcl

terraform validate
tflint --recursive

terraform plan  -var-file=environments/production/terraform.tfvars
terraform apply -var-file=environments/production/terraform.tfvars
```

Production creates the shared CodeCommit repository and all production-scoped resources.

---

## Deploying Staging

> **Prerequisite:** production must be applied first so the CodeCommit repository exists.

```bash
cd inf/terraform/vuejs-admin-dashboard

# Re-initialise with the staging backend (reconfigure because the key changes)
terraform init -reconfigure -backend-config=environments/staging/backend.hcl

terraform plan  -var-file=environments/staging/terraform.tfvars
terraform apply -var-file=environments/staging/terraform.tfvars
```

Staging sets `create_codecommit_repo = false` so it reads the existing repository via a data source instead of trying to create a duplicate.

---

## Environment Variable Comparison

| Variable | Production | Staging |
|----------|-----------|---------|
| `environment` | `production` | `staging` |
| `pipeline_branch` | `main` | `develop` |
| `amplify_app_name` | `vuejs-admin-dashboard-production` | `vuejs-admin-dashboard-staging` |
| `amplify_branch_stage` | `PRODUCTION` | `DEVELOPMENT` |
| `create_codecommit_repo` | `true` | `false` |
| `codebuild_compute_type` | `BUILD_GENERAL1_SMALL` | `BUILD_GENERAL1_SMALL` |

---

## Triggering Deployments

After apply, push to the relevant branch to trigger the environment's pipeline:

```bash
# Production — push to main
git push codecommit main

# Staging — push to develop
git push codecommit develop
```

The EventBridge rule detects the push and starts the matching CodePipeline automatically.

---

## Verifying Deployments

```bash
# Check pipeline executions
aws codepipeline list-pipeline-executions \
  --pipeline-name vuejs-admin-dashboard-production-pipeline

aws codepipeline list-pipeline-executions \
  --pipeline-name vuejs-admin-dashboard-staging-pipeline

# Check Amplify deployment
aws amplify list-jobs \
  --app-id <amplify_app_id> \
  --branch-name main      # or develop for staging
```

Apps are accessible at `https://<pipeline_branch>.<amplify_default_domain>`.

---

## Switching Between Environments Locally

Terraform can only hold one backend configuration in memory at a time. Use `-reconfigure` when switching:

```bash
# Switch to production
terraform init -reconfigure -backend-config=environments/production/backend.hcl

# Switch to staging
terraform init -reconfigure -backend-config=environments/staging/backend.hcl
```

---

## Teardown

```bash
# Destroy staging first (it has no dependents)
terraform init -reconfigure -backend-config=environments/staging/backend.hcl
terraform destroy -var-file=environments/staging/terraform.tfvars

# Then destroy production (which owns the CodeCommit repo)
terraform init -reconfigure -backend-config=environments/production/backend.hcl
terraform destroy -var-file=environments/production/terraform.tfvars
```

> The bootstrap resources (S3 state bucket and DynamoDB lock table) are managed separately and must be removed manually if no longer needed.

---

## Files

| File / Directory | Purpose |
|------|---------|
| `bootstrap/main.tf` | One-time S3 + DynamoDB backend provisioning (shared) |
| `provider.tf` | Terraform and provider version constraints |
| `backend.tf` | Partial S3 backend — config supplied via `-backend-config` |
| `variables.tf` | All input variable definitions |
| `outputs.tf` | All output value definitions |
| `main.tf` | CodeCommit repository (conditional) + S3 artifact bucket |
| `iam.tf` | IAM roles and policies for all services (env-scoped names) |
| `amplify.tf` | Amplify app, branch, rewrite rules, optional domain |
| `pipeline.tf` | CodeBuild, Lambda, CodePipeline, EventBridge |
| `lambda/amplify_deploy.py` | Lambda handler for Amplify deployment trigger |
| `environments/production/backend.hcl` | Production S3 backend config |
| `environments/production/terraform.tfvars` | Production variable values |
| `environments/staging/backend.hcl` | Staging S3 backend config |
| `environments/staging/terraform.tfvars` | Staging variable values |
| `terraform.tfvars.example` | Variable template (committed, no secrets) |
