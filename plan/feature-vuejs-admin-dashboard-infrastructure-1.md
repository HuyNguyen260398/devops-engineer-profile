---
goal: "Provision AWS infrastructure for the Vue.js Admin Dashboard using Terraform, and configure AWS CodeCommit/CodeBuild/CodeDeploy CI/CD pipeline for automated deployment via AWS Amplify"
version: "1.0"
date_created: "2026-04-09"
last_updated: "2026-04-09"
owner: "DevOps Engineer"
status: "Planned"
tags: ["infrastructure", "terraform", "aws", "amplify", "codecommit", "codebuild", "codedeploy", "cicd", "vuejs"]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Provision all AWS infrastructure required to host and continuously deploy the Vue.js Admin Dashboard. All AWS resources are managed via **Terraform** with state stored in S3. The CI/CD pipeline uses **AWS CodeCommit** (source), **AWS CodeBuild** (build), and **AWS CodeDeploy** (deploy) to automate the `build → test → deploy` lifecycle. The frontend is hosted on **AWS Amplify Hosting** (static SPA mode) with custom domain support and environment branch separation.

All Terraform resources are stored under `inf/terraform/vuejs-admin-dashboard/`.

---

## 1. Requirements & Constraints

- **REQ-001**: All AWS resources must be created and managed by Terraform stored in `inf/terraform/vuejs-admin-dashboard/`.
- **REQ-002**: Terraform state must be stored in a dedicated **S3 backend** with **DynamoDB state locking**.
- **REQ-003**: CI/CD pipeline must use **AWS CodeCommit** as the Git source repository.
- **REQ-004**: **AWS CodeBuild** must build the Vue.js app (`npm install && npm run build`) and produce the `dist/` artifact.
- **REQ-005**: **AWS CodeDeploy** (via CodePipeline) must deploy the built artifact to **AWS Amplify Hosting**.
- **REQ-006**: **AWS Amplify** must serve the SPA with a rewrite rule directing all paths to `index.html` (required for Vue Router history mode).
- **REQ-007**: Two Amplify branches must be configured: `main` (production) and `develop` (staging).
- **REQ-008**: All Terraform resources must follow `snake_case` naming convention as enforced by `.tflint.hcl`.
- **REQ-009**: All AWS resources must include mandatory tags: `Environment`, `Project`, `ManagedBy`.
- **REQ-010**: All Terraform variables and outputs must include `description` and `type` fields.
- **REQ-011**: All Terraform modules must pin a version.
- **REQ-012**: IAM roles must follow least-privilege principle — CodeBuild and CodeDeploy roles must only have permissions required for their specific tasks.
- **REQ-013**: No long-lived AWS credentials may be hardcoded; CodeBuild and CodeDeploy authenticate via **IAM roles**.
- **REQ-014**: An **AWS CodePipeline** must orchestrate the full Source → Build → Deploy pipeline.
- **SEC-001**: S3 bucket for Terraform state must have versioning enabled, public access blocked, and server-side encryption (AES-256).
- **SEC-002**: DynamoDB table for state locking must have point-in-time recovery enabled.
- **SEC-003**: CodeBuild environment variables containing sensitive values must be stored in **AWS SSM Parameter Store** (SecureString) and referenced via `parameter-store` in the buildspec.
- **SEC-004**: Amplify app must have HTTPS enforced; HTTP must redirect to HTTPS.
- **CON-001**: Terraform root module at `inf/terraform/vuejs-admin-dashboard/` must be independently initializable (`terraform init`) without dependencies on other modules in the repo.
- **CON-002**: AWS region must be parameterised via `var.aws_region`; default `us-east-1`.
- **GUD-001**: Use `terraform fmt` and `tflint --recursive` before every plan/apply.
- **GUD-002**: Separate resource definitions into logical files: `main.tf`, `variables.tf`, `outputs.tf`, `iam.tf`, `amplify.tf`, `pipeline.tf`, `backend.tf`.
- **PAT-001**: Use a `terraform.tfvars` file for environment-specific values; never commit secrets to `terraform.tfvars`.

---

## 2. Implementation Steps

### Implementation Phase 1 — Terraform Backend Bootstrap

- **GOAL-001**: Create the S3 + DynamoDB remote state backend resources. These are bootstrapped once manually (or via a separate bootstrap module) before the main Terraform module is initialized.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `inf/terraform/vuejs-admin-dashboard/bootstrap/` directory with a standalone `main.tf` that provisions: S3 bucket `vuejs-admin-dashboard-tf-state` (versioning enabled, AES-256 SSE, public access blocked) and DynamoDB table `vuejs-admin-dashboard-tf-lock` (PITR enabled, `LockID` as hash key) | | |
| TASK-002 | Apply bootstrap module manually once: `cd inf/terraform/vuejs-admin-dashboard/bootstrap && terraform init && terraform apply` | | |
| TASK-003 | Create `inf/terraform/vuejs-admin-dashboard/backend.tf` configuring the S3 backend with the bucket and DynamoDB table created in TASK-001; set `key = "vuejs-admin-dashboard/terraform.tfstate"` | | |

### Implementation Phase 2 — Terraform Variables & Outputs

- **GOAL-002**: Define all input variables and output values for the Terraform module.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Create `inf/terraform/vuejs-admin-dashboard/variables.tf` with the following variables: `aws_region` (string, default `us-east-1`), `project_name` (string, default `vuejs-admin-dashboard`), `environment` (string), `codecommit_repo_name` (string), `codecommit_branch_main` (string, default `main`), `codecommit_branch_develop` (string, default `develop`), `amplify_app_name` (string), `codebuild_compute_type` (string, default `BUILD_GENERAL1_SMALL`), `codebuild_image` (string, default `aws/codebuild/standard:7.0`) | | |
| TASK-005 | Create `inf/terraform/vuejs-admin-dashboard/outputs.tf` with outputs: `codecommit_clone_url_http`, `codecommit_clone_url_ssh`, `amplify_app_id`, `amplify_default_domain`, `codepipeline_name`, `codebuild_project_name` | | |
| TASK-006 | Create `inf/terraform/vuejs-admin-dashboard/terraform.tfvars` (gitignored) with concrete values for all required variables; create `terraform.tfvars.example` committed to the repo showing the expected structure with placeholder values | | |

### Implementation Phase 3 — CodeCommit Repository

- **GOAL-003**: Provision the AWS CodeCommit repository that stores the Vue.js app source code.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Create `inf/terraform/vuejs-admin-dashboard/main.tf`: add `aws_codecommit_repository` resource named `var.codecommit_repo_name` with description and required tags (`Environment`, `Project`, `ManagedBy`) | | |
| TASK-008 | Add `aws_codecommit_approval_rule_template` (optional but recommended): require 1 approval for PRs targeting `main` branch | | |

### Implementation Phase 4 — IAM Roles & Policies

- **GOAL-004**: Create least-privilege IAM roles for CodeBuild, CodeDeploy, and CodePipeline.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Create `inf/terraform/vuejs-admin-dashboard/iam.tf`: define `aws_iam_role` for CodeBuild (`codebuild_role`) with trust policy allowing `codebuild.amazonaws.com` to assume the role | | |
| TASK-010 | Attach inline policy to `codebuild_role`: permissions for `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`, `s3:GetObject`, `s3:PutObject`, `s3:GetObjectVersion` (for artifact bucket), `ssm:GetParameters` (for secure env vars), `codecommit:GitPull` | | |
| TASK-011 | Define `aws_iam_role` for CodePipeline (`codepipeline_role`) with trust policy for `codepipeline.amazonaws.com`; attach policy allowing `codecommit:*`, `codebuild:*`, `s3:*` (scoped to artifact bucket), `amplify:*` (scoped to app) | | |
| TASK-012 | Define `aws_iam_role` for Amplify (`amplify_service_role`) with trust policy for `amplify.amazonaws.com`; attach policy allowing `amplify:*`, `s3:GetObject` (artifact bucket) | | |

### Implementation Phase 5 — CodeBuild Project

- **GOAL-005**: Provision the CodeBuild project that installs dependencies and builds the Vue.js app.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Create S3 bucket `vuejs-admin-dashboard-pipeline-artifacts` in `main.tf` for CodePipeline artifact storage (versioning enabled, AES-256 SSE, lifecycle rule to expire artifacts after 30 days) | | |
| TASK-014 | Create `inf/terraform/vuejs-admin-dashboard/pipeline.tf`: add `aws_codebuild_project` resource; configure `source.type = "CODEPIPELINE"`, `environment.compute_type = var.codebuild_compute_type`, `environment.image = var.codebuild_image`, `environment.type = "LINUX_CONTAINER"` | | |
| TASK-015 | Create `src/vuejs-admin-dashboard/buildspec.yml`: phases — `install` (`npm ci`), `build` (`npm run build`), `post_build` (echo done); artifacts — `base_directory: dist`, `files: ["**/*"]`; cache `node_modules` to speed up subsequent builds | | |
| TASK-016 | Add CloudWatch Logs configuration to CodeBuild project: log group `/codebuild/vuejs-admin-dashboard`, retention 14 days | | |

### Implementation Phase 6 — AWS Amplify App & Branches

- **GOAL-006**: Provision the Amplify Hosting app with production and staging branches, SPA rewrite rules, and HTTPS enforcement.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Create `inf/terraform/vuejs-admin-dashboard/amplify.tf`: add `aws_amplify_app` resource with `name = var.amplify_app_name`, `iam_service_role_arn = aws_iam_role.amplify_service_role.arn`, `enable_branch_auto_deletion = true` | | |
| TASK-018 | Add custom rewrite rule to `aws_amplify_app`: source `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|ttf\|map\|json\|webp)$)([^.]+$)/>`, target `/index.html`, status `200` — enables Vue Router history mode | | |
| TASK-019 | Add `aws_amplify_branch` resource for `main` branch: `stage = "PRODUCTION"`, `enable_auto_build = false` (build triggered by CodePipeline, not Amplify's built-in CI) | | |
| TASK-020 | Add `aws_amplify_branch` resource for `develop` branch: `stage = "DEVELOPMENT"`, `enable_auto_build = false` | | |
| TASK-021 | Add `aws_amplify_domain_association` resource (optional, parameterised): associates a custom domain if `var.custom_domain` is set; otherwise output the default Amplify domain | | |

### Implementation Phase 7 — AWS CodePipeline

- **GOAL-007**: Wire CodeCommit → CodeBuild → Amplify Deploy into a single CodePipeline.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | In `pipeline.tf`, add `aws_codepipeline` resource with three stages: `Source` (CodeCommit, branch `main`, output artifact `SourceArtifact`), `Build` (CodeBuild project, input `SourceArtifact`, output `BuildArtifact`), `Deploy` (Amplify deploy action, input `BuildArtifact`) | | |
| TASK-023 | Configure the Deploy stage using `aws_codepipeline` action type `Deploy` provider `ElasticBeanstalk` — **Note**: Amplify does not have a native CodePipeline action type. Use the `Manual` workaround: Deploy stage calls a **Lambda function** that invokes `amplify:StartDeployment` with the S3 artifact URL. Add `aws_lambda_function` resource `amplify_deploy_trigger` (Python 3.12 runtime, inline zip) | | |
| TASK-024 | Create `inf/terraform/vuejs-admin-dashboard/lambda/amplify_deploy.py`: Lambda handler that calls `amplify.create_deployment()` then `amplify.start_deployment()` with the artifact S3 URL; returns success/failure to CodePipeline via `codepipeline.put_job_success_result` / `codepipeline.put_job_failure_result` | | |
| TASK-025 | Add IAM role for Lambda (`amplify_deploy_lambda_role`) with permissions: `amplify:CreateDeployment`, `amplify:StartDeployment`, `s3:GetObject` (artifact bucket), `codepipeline:PutJobSuccessResult`, `codepipeline:PutJobFailureResult`, `logs:CreateLogGroup`, `logs:PutLogEvents` | | |
| TASK-026 | Add CloudWatch Event Rule (EventBridge) to trigger the pipeline on CodeCommit `main` branch push: `aws_cloudwatch_event_rule` + `aws_cloudwatch_event_target` pointing to the CodePipeline ARN | | |

### Implementation Phase 8 — Validation & Documentation

- **GOAL-008**: Validate the Terraform module, run a dry-run plan, and document the deployment workflow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-027 | Run `terraform fmt -recursive inf/terraform/vuejs-admin-dashboard/` and fix any formatting issues | | |
| TASK-028 | Run `tflint --recursive` from repo root against `inf/terraform/vuejs-admin-dashboard/`; fix all reported violations | | |
| TASK-029 | Run `terraform validate` inside `inf/terraform/vuejs-admin-dashboard/`; confirm zero errors | | |
| TASK-030 | Run `terraform plan -var-file="terraform.tfvars"` and review all planned resource creations; confirm no unintended destructive actions | | |
| TASK-031 | Document the end-to-end deployment workflow in `inf/terraform/vuejs-admin-dashboard/README.md`: prerequisites, bootstrap steps, `terraform apply` instructions, how to push to CodeCommit to trigger the pipeline, how to verify Amplify deployment | | |

---

## 3. Alternatives

- **ALT-001**: **GitHub Actions + S3/CloudFront instead of CodePipeline + Amplify** — The existing repo already uses GitHub Actions for other Terraform workflows. However, the requirement explicitly mandates CodeCommit, CodeBuild, and CodeDeploy, so this alternative was not chosen.
- **ALT-002**: **Amplify's built-in CI/CD (connected to CodeCommit)** — Amplify can natively connect to CodeCommit and run its own build. This was rejected because the requirement explicitly asks for CodeBuild and CodeDeploy as separate pipeline stages, giving more control over the build environment.
- **ALT-003**: **AWS Elastic Beanstalk or S3+CloudFront instead of Amplify** — Amplify provides SPA-specific features (rewrite rules, branch deployments, HTTPS) out of the box. S3+CloudFront requires additional manual configuration for the same functionality.
- **ALT-004**: **Terraform Cloud backend instead of S3+DynamoDB** — Adds cost and external dependency. S3+DynamoDB is the standard self-hosted backend for this repo's pattern.
- **ALT-005**: **AWS CDK instead of Terraform** — The entire repo uses Terraform for IaC; introducing CDK would create inconsistency.

---

## 4. Dependencies

- **DEP-001**: `hashicorp/aws` Terraform provider `~> 5.0`
- **DEP-002**: `hashicorp/archive` Terraform provider `~> 2.0` — for zipping the Lambda function code
- **DEP-003**: AWS CLI configured with sufficient permissions to bootstrap the S3/DynamoDB backend
- **DEP-004**: `tflint` installed locally (version matching `.tflint.hcl` config)
- **DEP-005**: `terraform` CLI `>= 1.6`
- **DEP-006**: The Vue.js frontend source must exist at `src/vuejs-admin-dashboard/` with a working `npm run build` command producing a `dist/` directory (see frontend implementation plan)
- **DEP-007**: `src/vuejs-admin-dashboard/buildspec.yml` must be committed to CodeCommit for CodeBuild to execute

---

## 5. Files

- **FILE-001**: `inf/terraform/vuejs-admin-dashboard/` — Terraform root module
- **FILE-002**: `inf/terraform/vuejs-admin-dashboard/backend.tf` — S3 remote state backend config
- **FILE-003**: `inf/terraform/vuejs-admin-dashboard/main.tf` — CodeCommit repo + S3 artifact bucket
- **FILE-004**: `inf/terraform/vuejs-admin-dashboard/variables.tf` — All input variable definitions
- **FILE-005**: `inf/terraform/vuejs-admin-dashboard/outputs.tf` — All output value definitions
- **FILE-006**: `inf/terraform/vuejs-admin-dashboard/iam.tf` — IAM roles and policies for CodeBuild, CodePipeline, Amplify, Lambda
- **FILE-007**: `inf/terraform/vuejs-admin-dashboard/amplify.tf` — Amplify app, branches, rewrite rules, domain association
- **FILE-008**: `inf/terraform/vuejs-admin-dashboard/pipeline.tf` — CodeBuild project, CodePipeline, EventBridge rule
- **FILE-009**: `inf/terraform/vuejs-admin-dashboard/lambda/amplify_deploy.py` — Lambda handler for Amplify deployment trigger
- **FILE-010**: `inf/terraform/vuejs-admin-dashboard/terraform.tfvars.example` — Example variables file (committed; no secrets)
- **FILE-011**: `inf/terraform/vuejs-admin-dashboard/bootstrap/main.tf` — One-time bootstrap for S3+DynamoDB backend
- **FILE-012**: `inf/terraform/vuejs-admin-dashboard/README.md` — Deployment documentation
- **FILE-013**: `src/vuejs-admin-dashboard/buildspec.yml` — CodeBuild build specification

---

## 6. Testing

- **TEST-001**: Run `terraform validate` — must exit 0 with no errors.
- **TEST-002**: Run `tflint --recursive` — must exit 0 with no violations.
- **TEST-003**: Run `terraform plan -var-file="terraform.tfvars"` — review plan output; confirm all resource names follow `snake_case`, all resources have required tags, no unintended destroys.
- **TEST-004**: After `terraform apply`, verify CodeCommit repo exists in AWS Console: `aws codecommit get-repository --repository-name <name>`.
- **TEST-005**: Push a commit to CodeCommit `main` branch; verify the EventBridge rule triggers the CodePipeline execution: `aws codepipeline get-pipeline-execution --pipeline-name <name> --pipeline-execution-id <id>`.
- **TEST-006**: Verify CodeBuild phase `npm run build` succeeds and the `dist/` artifact is uploaded to the S3 artifact bucket.
- **TEST-007**: Verify Amplify deployment completes and the app is accessible at the Amplify default domain URL; confirm Vue Router history mode works by navigating to `/blog` directly in the browser (should not return 404).
- **TEST-008**: Verify HTTPS is enforced — HTTP request to the Amplify domain should redirect to HTTPS with a 301 response.
- **TEST-009**: Verify S3 state bucket has versioning enabled and public access blocked: `aws s3api get-bucket-versioning --bucket vuejs-admin-dashboard-tf-state`.
- **TEST-010**: Run `terraform destroy -var-file="terraform.tfvars"` in a non-production environment; confirm all resources are cleanly removed with no orphaned IAM roles or S3 buckets.

---

## 7. Risks & Assumptions

- **RISK-001**: **Amplify lacks a native CodePipeline Deploy action** — The workaround uses a Lambda function to trigger `amplify:StartDeployment`. If the Lambda execution role permissions are misconfigured, deployments will fail silently. Mitigation: add detailed CloudWatch Logs to the Lambda and configure a CodePipeline failure notification via SNS.
- **RISK-002**: **CodeCommit regional availability** — AWS has announced CodeCommit is no longer accepting new customers in some regions. Verify the target AWS region supports new CodeCommit repository creation before applying. Mitigation: if CodeCommit is unavailable, use **CodeStar Connections** to connect GitHub as the CodePipeline source instead.
- **RISK-003**: **Amplify `StartDeployment` requires a pre-created deployment** — The Lambda must call `create_deployment()` first to get a `jobId`, then upload the artifact, then call `start_deployment()`. Incorrect sequencing will cause the deployment to hang. Mitigation: include error handling and retry logic in the Lambda handler.
- **RISK-004**: **Terraform state lock contention** — If a `terraform apply` is interrupted, the DynamoDB lock may not be released. Mitigation: use `terraform force-unlock <lock-id>` after confirming no other apply is running.
- **ASSUMPTION-001**: The AWS account has sufficient service quotas for CodeBuild (`BUILD_GENERAL1_SMALL` concurrent builds), CodePipeline (pipelines per region), and Amplify (apps per account).
- **ASSUMPTION-002**: The operator running `terraform apply` has sufficient AWS IAM permissions to create IAM roles, S3 buckets, CodeCommit repos, CodeBuild projects, CodePipeline pipelines, Lambda functions, and Amplify apps.
- **ASSUMPTION-003**: The `develop` branch deployment is for staging/preview only; it does not need a custom domain.
- **ASSUMPTION-004**: Vue.js app build output is always placed in `dist/` (Vite default); `buildspec.yml` artifact path is `dist/`.

---

## 8. Related Specifications / Further Reading

- [Frontend Plan: feature-vuejs-admin-dashboard-frontend-1.md](./feature-vuejs-admin-dashboard-frontend-1.md)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Amplify Terraform Resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/amplify_app)
- [AWS CodePipeline + Amplify Lambda Pattern](https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-Lambda.html)
- [AWS CodeBuild buildspec.yml Reference](https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html)
- [tflint Rules for AWS](https://github.com/terraform-linters/tflint-ruleset-aws)
- [Terraform S3 Backend Docs](https://developer.hashicorp.com/terraform/language/settings/backends/s3)
- [Existing Terraform Conventions — .tflint.hcl](../../.tflint.hcl)
