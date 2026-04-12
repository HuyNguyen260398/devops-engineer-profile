# Vue.js Admin Dashboard — AWS Infrastructure

Provisions all AWS infrastructure required to host and continuously deploy the Vue.js Admin Dashboard SPA. The pipeline is built on **CodeCommit → CodeBuild → CodePipeline** and supports two mutually exclusive deploy targets:

- **Path A (default):** Lambda trigger → **AWS Amplify** hosting  
- **Path B (opt-in):** **AWS CodeDeploy** → S3 static-website bucket → **CloudFront CDN**

All resources are created and managed with **Terraform** (`>= 1.6`). State is stored in S3 with DynamoDB locking. Each environment (production, staging) has its own isolated Terraform state and its own set of AWS resources.

---

## Architecture

### Path A — Lambda → Amplify (default: `enable_codedeploy_deploy = false`)

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
  │          (npm via           │          (npm via             │  │
  │           CodeArtifact)     │           CodeArtifact)       │  │
  └── Deploy: Lambda trigger    └── Deploy: Lambda trigger      │  │
       │                                  │                     │  │
       ▼                                  ▼                     │  │
  Amplify (staging)              Amplify (production)           │  │
  └── develop branch             └── main branch <─────────────┘  │
                                                    <──────────────┘
```

### Path B — CodeDeploy → EC2 → S3 + CloudFront (opt-in: `enable_codedeploy_deploy = true`)

> **Important:** CodeDeploy deploys to **EC2 instances**, not directly to Amplify or S3.
> The EC2 instances act as deployment agents — the CodeDeploy agent on each instance
> downloads the build artifact and runs `appspec.yml` lifecycle hooks that sync `dist/`
> to the S3 web bucket and issue a CloudFront cache invalidation.
> Without EC2 instances tagged `CodeDeployTarget = vuejs-admin-dashboard-<env>`,
> every deployment will fail with "No instances found".

```
Git push (CodeCommit)
  │
  ▼  EventBridge (per-env rule)
  │
  CodePipeline
  ├── Source: CodeCommit branch
  ├── Build:  CodeBuild  (npm via CodeArtifact proxy)
  └── Deploy: CodeDeploy
                │
                ▼  finds EC2 instances tagged:
                │  CodeDeployTarget = vuejs-admin-dashboard-<env>
                │
                ▼  CodeDeploy agent on EC2 runs appspec.yml hooks
                │
                ├── AfterInstall: aws s3 sync dist/ → S3 Web Bucket
                └── ValidateService: CloudFront CreateInvalidation
                                           │
                                           ▼
                                   CloudFront CDN  (HTTPS, Vue Router SPA fallback)
                                           │
                                           ▼
                                   End users access the SPA
```

**Shared resources** (created once by production):
- AWS CodeCommit repository

**Per-environment resources — always provisioned** (isolated state per env):
- CodeArtifact domain + npm repository (`vuejs-admin-dashboard-<env>` / `...-npm`)
- S3 artifact bucket (`vuejs-admin-dashboard-<env>-artifacts`)
- CodeBuild project (`vuejs-admin-dashboard-<env>`)
- CodePipeline (`vuejs-admin-dashboard-<env>-pipeline`)
- Lambda deploy trigger (`vuejs-admin-dashboard-<env>-amplify-deploy`)
- Amplify app (`vuejs-admin-dashboard-<env>`)
- IAM roles (all scoped with `<env>` suffix)
- EventBridge rule (watches the env's branch)

**Per-environment resources — only when `enable_codedeploy_deploy = true`**:
- S3 web bucket (`vuejs-admin-dashboard-<env>-web`)
- CloudFront distribution (OAC-backed, HTTPS-only)
- CodeDeploy application + deployment group (`vuejs-admin-dashboard-<env>`)

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

> **CI / Static analysis note:** The `backend.tf` declares a partial S3 backend (`backend "s3" {}`). Without a `-backend-config` flag, `terraform init` will interactively prompt for the S3 bucket name and block any non-interactive pipeline. All validation and security-scanning steps in CI (tfsec, `terraform validate`) must therefore pass `-backend=false -input=false` to skip backend initialisation:
> ```
> terraform init -backend=false -input=false
> ```

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

## CodeCommit Setup and Authentication

> **Automated mirror (default flow):** the GitHub Actions workflow
> `.github/workflows/vuejs-admin-dashboard-codecommit-sync.yml` mirrors
> the `src/vuejs-admin-dashboard/` subtree of the monorepo into this
> CodeCommit repository on every PR merge to `main`. It assumes an IAM
> role via GitHub OIDC (`codecommit_sync_role_arn` output of this module)
> and force-pushes an orphan snapshot — CodeCommit is therefore a
> **read-only mirror**, with GitHub as the source of truth.
>
> The push triggers the existing EventBridge → CodePipeline → CodeBuild →
> Amplify deployment chain automatically. The manual steps below are
> retained as a **break-glass procedure** only (e.g. first-time bootstrap
> before the workflow runs, or when OIDC/role access is unavailable).

### One-Time Setup for the Automated Mirror

1. Apply the production Terraform workspace with
   `create_codecommit_sync_role = true` so the IAM role is created.
2. Copy the value of the Terraform output
   `codecommit_sync_role_arn` into a new GitHub repository secret named
   `VUEJS_ADMIN_DASHBOARD_CODECOMMIT_SYNC_ROLE_ARN`.
3. Merge any PR touching `src/vuejs-admin-dashboard/**` — the workflow
   runs automatically.

### Initial Commit (break-glass)

The `src/vuejs-admin-dashboard/` directory contains its own git repository. Before pushing to CodeCommit you must create an initial commit if one does not exist yet:

```bash
cd src/vuejs-admin-dashboard

# Create .gitignore if it does not exist
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
EOF

# Stage and commit
git add .
git commit -m "feat: initial vuejs admin dashboard source"
```

### Add the CodeCommit Remote

```bash
cd src/vuejs-admin-dashboard

git remote add codecommit https://git-codecommit.ap-southeast-1.amazonaws.com/v1/repos/vuejs-admin-dashboard
```

Verify the remote was added:

```bash
git remote -v
```

### Authentication Options

#### Option 1 — AWS CLI Credential Helper (Recommended)

Requires AWS CLI configured with valid credentials (`aws configure` or an assumed role).

```bash
git config --global credential.helper '!aws codecommit credential-helper $@'
git config --global credential.UseHttpPath true

# Verify your AWS identity before pushing
aws sts get-caller-identity
```

#### Option 2 — IAM User HTTPS Git Credentials

Generate CodeCommit-specific credentials for an IAM user.

Via AWS Console:
> IAM → Users → `<your-user>` → Security credentials → **HTTPS Git credentials for AWS CodeCommit** → Generate credentials

Via AWS CLI:

```bash
aws iam create-service-specific-credential \
  --user-name <your-iam-username> \
  --service-name codecommit.amazonaws.com
```

Use the returned `ServiceUserName` and `ServicePassword` when git prompts for credentials, or embed them in the remote URL:

```bash
git remote set-url codecommit \
  https://<GIT_USERNAME>:<GIT_PASSWORD>@git-codecommit.ap-southeast-1.amazonaws.com/v1/repos/vuejs-admin-dashboard
```

#### Option 3 — SSH Key

```bash
# Upload your public key to IAM
aws iam upload-ssh-public-key \
  --user-name <your-iam-username> \
  --ssh-public-key-body file://~/.ssh/id_rsa.pub
```

Add to `~/.ssh/config` (replace `<SSH_KEY_ID>` with the `SSHPublicKeyId` from the output above):

```
Host git-codecommit.ap-southeast-1.amazonaws.com
  User <SSH_KEY_ID>
  IdentityFile ~/.ssh/id_rsa
```

Switch the remote to SSH:

```bash
git remote set-url codecommit \
  ssh://git-codecommit.ap-southeast-1.amazonaws.com/v1/repos/vuejs-admin-dashboard
```

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

## Cost Estimate

> **Region:** `ap-southeast-1` (Singapore) — all prices in USD.
> **Assumptions:** low-cadence portfolio usage (~20–30 git pushes per environment per month), compiled SPA ~1 MB, low public traffic (~1 GB/month), builds average **3 minutes** on `BUILD_GENERAL1_SMALL`.

### Resource Inventory

| Resource | Scope | Config |
|----------|-------|--------|
| CodeCommit repository | Shared (created once) | 1 repo |
| **CodeArtifact domain** | Per environment | AWS-managed KMS key |
| **CodeArtifact npm repository** | Per environment | Upstream: `public:npmjs` |
| S3 artifact bucket | Per environment | Versioned, 30-day expiry |
| CodeBuild project | Per environment | `BUILD_GENERAL1_SMALL`, 10 min timeout |
| Lambda deploy trigger | Per environment | Python 3.12, 128 MB, 120 s timeout, X-Ray active |
| CodePipeline | Per environment | V1, 3 stages (Source → Build → Deploy) |
| Amplify app + branch | Per environment | Hosting only (builds handled by CodeBuild) |
| EventBridge rule | Per environment | 1 rule watching branch push |
| CloudWatch Log Groups | Per environment | 2 groups (CodeBuild + Lambda), 14-day retention |
| IAM roles | Per environment | 7 roles (no cost) |
| Terraform state (S3 + DynamoDB) | Shared bootstrap | < 1 MB state file |
| **S3 web bucket** *(opt-in)* | Per environment | Versioned, OAC-backed, SSE-S3 |
| **CloudFront distribution** *(opt-in)* | Per environment | HTTPS-only, Vue Router SPA fallback |
| **CodeDeploy app + deployment group** *(opt-in)* | Per environment | In-place, EC2 tag filter |

### Monthly Cost per Environment

#### Path A — Lambda → Amplify (default)

| Service | Usage | Unit Price | Monthly Cost |
|---------|-------|-----------|-------------|
| **CodeCommit** | < 5 active users, < 1 GB | Free tier covers it | **$0.00** |
| **CodeArtifact** | < 2 GB storage, ~75 req/month | First 2 GB/month free | **$0.00** ² |
| **S3 artifact bucket** | ~50 MB peak (30-day lifecycle) | $0.025/GB | **< $0.01** |
| **CodeBuild** `BUILD_GENERAL1_SMALL` | ~25 builds × 3 min = 75 min | 100 min/month free, then $0.005/min | **$0.00** ¹ |
| **Lambda** deploy trigger | ~25 invocations × 60 s × 128 MB | 400,000 GB-s/month free | **$0.00** |
| **CodePipeline** V1 | 1 active pipeline | $1.00/pipeline/month | **$1.00** |
| **Amplify** hosting | ~1 MB SPA, ~1 GB traffic | 15 GB storage + 15 GB transfer free | **$0.00** |
| **CloudWatch Logs** | ~3 MB/month ingested | $0.76/GB ingested | **< $0.01** |
| **EventBridge** | ~25 events/month | $1.00/million events | **$0.00** |
| **X-Ray traces** (Lambda) | ~25 traces/month | $0.05/10,000 traces | **$0.00** |
| **Terraform state** (shared) | < 1 MB S3 + ~10 DynamoDB ops | Negligible | **~$0.00** |
| **Environment total** | | | **~$1.00** |

#### Path B — CodeDeploy → S3 + CloudFront (opt-in, additional costs)

| Service | Usage | Unit Price | Additional Monthly Cost |
|---------|-------|-----------|------------------------|
| **CodeDeploy** | EC2 on-prem deployments | Free for EC2/on-prem | **$0.00** |
| **S3 web bucket** | ~1 MB SPA, versioned | $0.025/GB | **< $0.01** |
| **CloudFront** (`PriceClass_100`) | ~1 GB transfer, ~1,000 req | 1 TB + 10M req/month free (12 months) | **$0.00** ³ |
| **Additional total** | | | **< $0.01** |

> ¹ CodeBuild free tier: **100 build minutes/month** on `BUILD_GENERAL1_SMALL` Linux (account-wide). Both environments share this quota. If combined builds exceed 100 min/month, each additional minute costs $0.005.
> ² CodeArtifact free tier: **2 GB storage + 100,000 requests/month** per account. Data transfer to CodeBuild in the same region is free.
> ³ CloudFront free tier (12 months): 1 TB data transfer + 10 million HTTP requests. After free tier: $0.009–$0.012/GB depending on region.

### Combined Monthly Estimate (Production + Staging)

| Scenario | Monthly Cost |
|----------|-------------|
| **Typical — Path A** (within all free tiers) | **~$2.00** |
| **Typical — Path B** (CodeDeploy enabled, within free tiers) | **~$2.01** |
| **Heavy usage** (200+ builds/month, exhausting CodeBuild free tier) | **~$2.50–$3.00** |
| **High traffic** (> 15 GB Amplify or > 1 TB CloudFront transfer) | **~$2.00 + overage** |

### Key Cost Drivers

1. **CodePipeline V1** — the dominant cost at **$1.00/pipeline/month**, fixed regardless of usage. Running both environments continuously = $2.00/month minimum.
2. **CodeBuild minutes** — free tier covers typical portfolio usage. The 10-minute build timeout is a safety ceiling; actual Vite builds are ~3 minutes.
3. **Amplify data transfer** — negligible at portfolio scale; becomes the main variable cost if the app goes public with significant traffic ($0.15/GB beyond 15 GB free).
4. **CodeArtifact** — essentially free at portfolio scale (< 2 GB/month, same-region transfer free).
5. **CloudFront** (Path B) — free tier is generous; no meaningful cost at portfolio traffic volumes.

### Cost Optimisation Options

| Option | Saving | Trade-off |
|--------|--------|-----------|
| Destroy staging when idle | Save ~$1.00/month | Must re-apply before testing |
| Switch CodePipeline to V2 | $0.002/action-min instead of flat $1.00 — cheaper at < ~500 action-min/month | V2 pricing varies with execution volume |
| Reduce CodeBuild timeout from 10 to 5 min | No direct cost saving (billed on actual usage) | Fails faster on runaway builds |

---

## CodeArtifact Setup

CodeArtifact is provisioned automatically for every environment. To use it in `buildspec.yml`, add a pre-build phase that configures npm to pull packages from the private proxy:

```yaml
phases:
  pre_build:
    commands:
      # Obtain a short-lived CodeArtifact auth token (12 hours)
      - export CODEARTIFACT_AUTH_TOKEN=$(aws codeartifact get-authorization-token \
          --domain $CODEARTIFACT_DOMAIN \
          --domain-owner $CODEARTIFACT_DOMAIN_OWNER \
          --region $AWS_DEFAULT_REGION \
          --query authorizationToken \
          --output text)
      # Point npm at the CodeArtifact npm endpoint
      - npm config set registry https://${CODEARTIFACT_DOMAIN}-${CODEARTIFACT_DOMAIN_OWNER}.d.codeartifact.${AWS_DEFAULT_REGION}.amazonaws.com/npm/${CODEARTIFACT_REPO}/
      - npm config set //${CODEARTIFACT_DOMAIN}-${CODEARTIFACT_DOMAIN_OWNER}.d.codeartifact.${AWS_DEFAULT_REGION}.amazonaws.com/npm/${CODEARTIFACT_REPO}/:_authToken $CODEARTIFACT_AUTH_TOKEN
      - npm install
```

The three `CODEARTIFACT_*` environment variables are injected automatically by Terraform into the CodeBuild project.

---

## Enabling the CodeDeploy Deploy Path

Set `enable_codedeploy_deploy = true` in the environment's `terraform.tfvars` and re-apply. Terraform will:

1. Provision the S3 web bucket, CloudFront distribution, CodeDeploy app, and deployment group.
2. Swap the CodePipeline Deploy stage from Lambda (Amplify) to CodeDeploy.

### How CodeDeploy deploys the SPA

CodeDeploy does **not** deploy directly to Amplify or S3. It deploys to **EC2 instances** that act as deployment agents:

1. CodeDeploy locates EC2 instances tagged `CodeDeployTarget = vuejs-admin-dashboard-<env>`.
2. The CodeDeploy agent on each instance downloads the build artifact (zip) from the S3 artifact bucket.
3. The agent executes the `appspec.yml` lifecycle hooks bundled in the artifact.
4. The hooks run shell scripts that:
   - Sync `dist/` to the S3 web bucket (`aws s3 sync`)
   - Issue a CloudFront cache invalidation (`aws cloudfront create-invalidation`)
5. End users access the SPA via the CloudFront distribution URL.

### Deployment target options

| Option | Deploy target | EC2 required | Cost |
|--------|--------------|--------------|------|
| **Path A** (default) | Amplify | No | $0 extra |
| **Path B** (CodeDeploy) | EC2 → S3 + CloudFront | **Yes** | ~$8–15/month (t3.micro) |
| **Path C** (alternative) | S3 directly via CodePipeline S3 provider | No | $0 extra |

> **Path C** is the most practical for a static SPA: replace the CodeDeploy pipeline stage
> with CodePipeline's native `S3` deploy provider to sync artifacts directly to the web
> bucket — no EC2 agents needed. The CodeDeploy application resource can remain registered
> to demonstrate the skill without requiring running instances.

### Prerequisites before applying with `enable_codedeploy_deploy = true`

- Run `terraform state mv aws_codepipeline.app aws_codepipeline.amplify[0]` to rename the existing state entry (avoids destroy/recreate of the pipeline).
- Provision EC2 instances tagged `CodeDeployTarget = vuejs-admin-dashboard-<env>` with the CodeDeploy agent installed and running.
- Attach an IAM instance profile to those instances with:
  - `s3:GetObject` on the artifact bucket (to download the build artifact)
  - `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the S3 web bucket
  - `cloudfront:CreateInvalidation` on the CloudFront distribution
- Include an `appspec.yml` at the root of the build artifact in the SPA repository.

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
| `codeartifact.tf` | CodeArtifact domain, npm repository, domain permissions policy |
| `codedeploy.tf` | S3 web bucket, CloudFront OAC + distribution, CodeDeploy app + deployment group (all conditional) |
| `pipeline.tf` | CodeBuild, Lambda, conditional CodePipeline (amplify or codedeploy path), EventBridge |
| `lambda/amplify_deploy.py` | Lambda handler for Amplify deployment trigger |
| `environments/production/backend.hcl` | Production S3 backend config |
| `environments/production/terraform.tfvars` | Production variable values |
| `environments/staging/backend.hcl` | Staging S3 backend config |
| `environments/staging/terraform.tfvars` | Staging variable values |
| `terraform.tfvars.example` | Variable template (committed, no secrets) |
