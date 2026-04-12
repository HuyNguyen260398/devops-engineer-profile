---
goal: Add AWS CodeArtifact (npm proxy cache) and AWS CodeDeploy (S3+CloudFront deploy stage) to the vuejs-admin-dashboard CI/CD Terraform module
version: 1.0
date_created: 2026-04-12
last_updated: 2026-04-12
owner: DevOps Engineer
status: 'Planned'
tags: [feature, infrastructure, cicd, terraform, codeartifact, codedeploy, aws]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan extends the `inf/terraform/vuejs-admin-dashboard/` Terraform module with two new AWS developer-tools services:

1. **AWS CodeArtifact** — A private npm proxy/cache repository backed by the public npm upstream. CodeBuild will fetch packages from CodeArtifact instead of npm directly, improving build reliability, security, and speed. Enabled unconditionally for all environments.

2. **AWS CodeDeploy** — A CodeDeploy application and deployment group that deploys the built Vue.js SPA artifact to a dedicated S3 static-website bucket fronted by a CloudFront distribution. This replaces the Lambda-based Amplify deploy trigger when the feature flag `enable_codedeploy_deploy = true`. Amplify resources are preserved and the Lambda deploy path remains active when the flag is `false`, ensuring zero disruption to existing environments.

The existing pipeline flow becomes:

```
CodeCommit → EventBridge → CodePipeline
  Stage 1 — Source   : CodeCommit
  Stage 2 — Build    : CodeBuild (npm via CodeArtifact proxy)
  Stage 3 — Deploy   : CodeDeploy → S3 + CloudFront  (when enable_codedeploy_deploy = true)
                      : Lambda → Amplify              (when enable_codedeploy_deploy = false)
```

---

## 1. Requirements & Constraints

- **REQ-001**: Add `aws_codeartifact_domain` resource named `${local.name_prefix}` in `codeartifact.tf`.
- **REQ-002**: Add `aws_codeartifact_repository` named `${local.name_prefix}-npm` with an upstream connection to the public npm registry (`public:npmjs`).
- **REQ-003**: Update CodeBuild IAM role policy to allow `codeartifact:GetAuthorizationToken`, `codeartifact:GetRepositoryEndpoint`, `codeartifact:ReadFromRepository`, and `sts:GetServiceBearerToken`.
- **REQ-004**: Inject three CodeBuild environment variables: `CODEARTIFACT_DOMAIN`, `CODEARTIFACT_DOMAIN_OWNER` (account ID), `CODEARTIFACT_REPO` so `buildspec.yml` can configure npm.
- **REQ-005**: Add `aws_codedeploy_app` resource named `${local.name_prefix}` with `compute_platform = "Server"` (S3 deployment target) in `codedeploy.tf`.
- **REQ-006**: Add `aws_codedeploy_deployment_group` resource targeting the S3 static-hosting bucket via an in-place deployment configuration.
- **REQ-007**: Add S3 static-website bucket (`${local.name_prefix}-web`) and CloudFront distribution as the CodeDeploy deployment target when `enable_codedeploy_deploy = true`.
- **REQ-008**: Modify `pipeline.tf` to conditionally swap the Deploy stage between Lambda (Amplify) and CodeDeploy (S3+CloudFront) based on the `enable_codedeploy_deploy` variable. Use `dynamic` blocks or separate `aws_codepipeline` resources with `count`.
- **REQ-009**: Add new input variables: `enable_codedeploy_deploy`, `cloudfront_price_class` to `variables.tf`.
- **REQ-010**: Add new outputs: `codeartifact_repository_endpoint`, `web_bucket_name`, `cloudfront_distribution_domain`, `codedeploy_app_name` to `outputs.tf`.
- **SEC-001**: CodeArtifact domain must have an `aws_codeartifact_domain_permissions_policy` restricting access to the current account only.
- **SEC-002**: S3 web bucket must have `block_public_acls = true`, `restrict_public_buckets = true`; content served only via CloudFront OAC.
- **SEC-003**: CloudFront must use `https_only` viewer protocol policy; TLS 1.2 minimum.
- **SEC-004**: CodeDeploy service role must follow least-privilege — only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the web bucket, plus `cloudfront:CreateInvalidation` on the specific distribution.
- **SEC-005**: IAM role for CodePipeline must be extended with `codedeploy:CreateDeployment`, `codedeploy:GetDeployment`, `codedeploy:GetDeploymentConfig`, `codedeploy:RegisterApplicationRevision` scoped to the new CodeDeploy app ARN.
- **CON-001**: Terraform >= 1.6, AWS provider ~> 5.0.
- **CON-002**: All resources in region `ap-southeast-1`.
- **CON-003**: All new resources must carry `Name` tag using `local.name_prefix` pattern.
- **CON-004**: tflint compliance: snake_case names, typed variables with descriptions, no version-unpinned modules.
- **CON-005**: Backward compatibility: setting `enable_codedeploy_deploy = false` (the default) must leave all existing resources untouched and keep the Lambda→Amplify deploy path active.
- **CON-006**: CodeArtifact domain is per-environment (not shared) to avoid cross-state ownership conflicts — consistent with the existing per-env isolation pattern.
- **GUD-001**: Use `checkov:skip` + `tfsec:ignore` suppression comments where CMK encryption or access logging is disproportionate for CI/CD resources — consistent with existing `main.tf` pattern.
- **GUD-002**: CloudFront OAC (Origin Access Control) must be used instead of the legacy OAI pattern.
- **PAT-001**: Conditional resource creation uses `count = var.enable_codedeploy_deploy ? 1 : 0` — consistent with `create_codecommit_repo` pattern in `main.tf`.
- **PAT-002**: CodePipeline conditional stage uses two separate `aws_codepipeline` resources with `count` (one Amplify path, one CodeDeploy path) to avoid unsupported dynamic stage blocks.

---

## 2. Implementation Steps

### Implementation Phase 1 — CodeArtifact Infrastructure

- GOAL-001: Provision CodeArtifact domain, npm repository with public upstream, and all supporting IAM in a new `codeartifact.tf` file. Update CodeBuild role to consume CodeArtifact tokens.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `inf/terraform/vuejs-admin-dashboard/codeartifact.tf`. Add `aws_codeartifact_domain` resource with name = `local.name_prefix`, encryption_key omitted (uses AWS-managed key for cost efficiency; add checkov:skip CKV_AWS_X for CMK). Add required `Name` tag. | | |
| TASK-002 | In `codeartifact.tf`, add `aws_codeartifact_repository` resource with repository = `"${local.name_prefix}-npm"`, domain = `aws_codeartifact_domain.app.domain`, and `external_connections { external_connection_name = "public:npmjs" }`. Add `Name` tag. | | |
| TASK-003 | In `codeartifact.tf`, add `aws_codeartifact_domain_permissions_policy` resource that sets a resource policy restricting `codeartifact:*` actions to `"AWS": "arn:aws:iam::${local.account_id}:root"` only, preventing cross-account access. | | |
| TASK-004 | In `iam.tf`, add a new `aws_iam_policy_document` data source `codebuild_codeartifact_policy` with two statements: (a) `sts:GetServiceBearerToken` on `arn:aws:sts::*:assumed-role/*` (required for CodeArtifact token), (b) `codeartifact:GetAuthorizationToken`, `codeartifact:GetRepositoryEndpoint`, `codeartifact:ReadFromRepository` scoped to `aws_codeartifact_domain.app.arn` and `aws_codeartifact_repository.npm.arn`. Attach as a second `aws_iam_role_policy` named `"${local.name_prefix}-codebuild-codeartifact-policy"` to `aws_iam_role.codebuild_role`. | | |
| TASK-005 | In `pipeline.tf`, add three `environment_variable` blocks to `aws_codebuild_project.app`: `CODEARTIFACT_DOMAIN` = `aws_codeartifact_domain.app.domain`, `CODEARTIFACT_DOMAIN_OWNER` = `local.account_id`, `CODEARTIFACT_REPO` = `aws_codeartifact_repository.npm.repository`. | | |
| TASK-006 | In `variables.tf`, no new variables needed for Phase 1. In `outputs.tf`, add output `codeartifact_repository_endpoint` with description `"CodeArtifact npm repository endpoint URL for use in buildspec.yml"`, value = `"https://${aws_codeartifact_domain.app.domain}-${local.account_id}.d.codeartifact.${local.region}.amazonaws.com/npm/${aws_codeartifact_repository.npm.repository}/"`. | | |

### Implementation Phase 2 — CodeDeploy Target: S3 Static Website + CloudFront

- GOAL-002: Provision the S3 static-hosting bucket and CloudFront distribution that CodeDeploy will deploy the SPA artifact into. These resources are created conditionally when `enable_codedeploy_deploy = true`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | In `variables.tf`, add variable `enable_codedeploy_deploy` (type = bool, default = false, description = "When true, replaces the Lambda→Amplify deploy stage with a CodeDeploy→S3+CloudFront deploy stage. Amplify resources are preserved."). Add variable `cloudfront_price_class` (type = string, default = "PriceClass_100", description = "CloudFront price class. PriceClass_100 covers US/Europe/Asia; cheapest option."). Add validation block: `contains(["PriceClass_All","PriceClass_200","PriceClass_100"], var.cloudfront_price_class)`. | | |
| TASK-008 | Create `inf/terraform/vuejs-admin-dashboard/codedeploy.tf`. Add `aws_s3_bucket` resource named `web` with `count = var.enable_codedeploy_deploy ? 1 : 0`, bucket = `"${local.name_prefix}-web"`, Name tag. Add checkov:skip comments for CKV_AWS_18 (access logging), CKV_AWS_144 (cross-region replication), CKV2_AWS_62 (event notifications) — same pattern as `main.tf`. | | |
| TASK-009 | In `codedeploy.tf`, add `aws_s3_bucket_versioning` (status = Enabled), `aws_s3_bucket_server_side_encryption_configuration` (AES256, bucket_key_enabled = true, checkov:skip CKV_AWS_145), `aws_s3_bucket_public_access_block` (all four flags = true), all with `count = var.enable_codedeploy_deploy ? 1 : 0` and dependency on `aws_s3_bucket.web`. | | |
| TASK-010 | In `codedeploy.tf`, add `aws_cloudfront_origin_access_control` resource named `web` with `count = var.enable_codedeploy_deploy ? 1 : 0`, `origin_access_control_origin_type = "s3"`, `signing_behavior = "always"`, `signing_protocol = "sigv4"`. | | |
| TASK-011 | In `codedeploy.tf`, add `aws_cloudfront_distribution` resource named `web` with `count = var.enable_codedeploy_deploy ? 1 : 0`. Configure: origin pointing to `aws_s3_bucket.web[0].bucket_regional_domain_name` with OAC attachment; `default_cache_behavior` with `viewer_protocol_policy = "https-only"`, `allowed_methods = ["GET","HEAD"]`, `cached_methods = ["GET","HEAD"]`; `price_class = var.cloudfront_price_class`; `default_root_object = "index.html"`; `custom_error_response` for 403→`/index.html` (Vue Router SPA fallback, mirrors the Amplify custom rule); `restrictions { geo_restriction { restriction_type = "none" } }`; `viewer_certificate { cloudfront_default_certificate = true, minimum_protocol_version = "TLSv1.2_2021" }`; Name tag. | | |
| TASK-012 | In `codedeploy.tf`, add `aws_s3_bucket_policy` resource named `web_cloudfront_oac` with `count = var.enable_codedeploy_deploy ? 1 : 0`. Policy must allow `s3:GetObject` to `"Service": "cloudfront.amazonaws.com"` conditioned on `AWS:SourceArn = aws_cloudfront_distribution.web[0].arn`. | | |

### Implementation Phase 3 — CodeDeploy Application and Deployment Group

- GOAL-003: Provision the CodeDeploy application, service role, and deployment group, and wire them into a new IAM policy for CodePipeline.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | In `codedeploy.tf`, add `aws_codedeploy_app` resource named `app` with `count = var.enable_codedeploy_deploy ? 1 : 0`, `name = local.name_prefix`, `compute_platform = "Server"`, Name tag. | | |
| TASK-014 | In `iam.tf`, add `aws_iam_policy_document.codedeploy_assume_role` (principal = `"codedeploy.amazonaws.com"`), `aws_iam_role.codedeploy_role` with `count = var.enable_codedeploy_deploy ? 1 : 0`, name = `"${local.name_prefix}-codedeploy-role"`. Attach AWS managed policy `AWSCodeDeployRole` via `aws_iam_role_policy_attachment`. Also add an inline policy for S3 web bucket access (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`) and CloudFront invalidation (`cloudfront:CreateInvalidation`) scoped to the specific resources. | | |
| TASK-015 | In `codedeploy.tf`, add `aws_codedeploy_deployment_group` resource named `app` with `count = var.enable_codedeploy_deploy ? 1 : 0`, `app_name = aws_codedeploy_app.app[0].name`, `deployment_group_name = local.name_prefix`, `service_role_arn = aws_iam_role.codedeploy_role[0].arn`, `deployment_config_name = "CodeDeployDefault.AllAtOnce"`, and `deployment_style { deployment_type = "IN_PLACE", deployment_option = "WITHOUT_TRAFFIC_CONTROL" }`. | | |
| TASK-016 | In `iam.tf`, add a new `aws_iam_policy_document` statement block `codepipeline_codedeploy_policy` (only added when `enable_codedeploy_deploy = true`) with actions `codedeploy:CreateDeployment`, `codedeploy:GetDeployment`, `codedeploy:GetDeploymentConfig`, `codedeploy:RegisterApplicationRevision`, `codedeploy:GetApplicationRevision` scoped to `arn:aws:codedeploy:${local.region}:${local.account_id}:deploymentgroup:${local.name_prefix}/${local.name_prefix}`. Use a separate `aws_iam_role_policy` with `count = var.enable_codedeploy_deploy ? 1 : 0`. | | |

### Implementation Phase 4 — CodePipeline Conditional Deploy Stage

- GOAL-004: Implement two separate `aws_codepipeline` resources — one for the existing Lambda/Amplify path and one for the new CodeDeploy path — selected via `count` based on `enable_codedeploy_deploy`.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | In `pipeline.tf`, rename the existing `aws_codepipeline.app` resource to `aws_codepipeline.amplify` and add `count = var.enable_codedeploy_deploy ? 0 : 1`. Update all downstream references (`aws_cloudwatch_event_target.pipeline_trigger`) to use `one(concat(aws_codepipeline.amplify[*].arn, aws_codepipeline.codedeploy[*].arn))`. | | |
| TASK-018 | In `pipeline.tf`, add `aws_codepipeline.codedeploy` with `count = var.enable_codedeploy_deploy ? 1 : 0`. Clone the structure of `aws_codepipeline.amplify` but replace the Deploy stage: `name = "Deploy"`, `action { name = "DeployToS3", category = "Deploy", owner = "AWS", provider = "CodeDeploy", version = "1", input_artifacts = ["BuildArtifact"], configuration = { ApplicationName = aws_codedeploy_app.app[0].name, DeploymentGroupName = aws_codedeploy_deployment_group.app[0].deployment_group_name } }`. | | |
| TASK-019 | In `iam.tf`, update `codepipeline_policy` document to also include `s3:PutObject` on the web bucket ARN when `enable_codedeploy_deploy = true`. Use a `dynamic` statement block or a conditional inline policy. Simplest approach: add a second `aws_iam_role_policy` named `"${local.name_prefix}-codepipeline-codedeploy-policy"` with `count = var.enable_codedeploy_deploy ? 1 : 0`. | | |
| TASK-020 | In `pipeline.tf`, update `aws_cloudwatch_event_target.pipeline_trigger` to use a unified pipeline ARN via a local: `locals { active_pipeline_arn = var.enable_codedeploy_deploy ? aws_codepipeline.codedeploy[0].arn : aws_codepipeline.amplify[0].arn }`. Update `arn = local.active_pipeline_arn`. | | |

### Implementation Phase 5 — Variables, Outputs, and Documentation

- GOAL-005: Finalize all new outputs and update the module README with the new resources, cost estimates, and usage instructions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | In `outputs.tf`, add output `codeartifact_repository_endpoint` (Phase 1 — already planned in TASK-006). Add output `web_bucket_name` (value = `var.enable_codedeploy_deploy ? aws_s3_bucket.web[0].bucket : null`, description = "S3 web bucket for CodeDeploy target. Null when enable_codedeploy_deploy = false."). Add output `cloudfront_distribution_domain` (value = `var.enable_codedeploy_deploy ? aws_cloudfront_distribution.web[0].domain_name : null`). Add output `codedeploy_app_name` (value = `var.enable_codedeploy_deploy ? aws_codedeploy_app.app[0].name : null`). | | |
| TASK-022 | In `environments/production/terraform.tfvars`, add `enable_codedeploy_deploy = false` (explicit default, backward-compatible). Add `cloudfront_price_class = "PriceClass_100"`. In `environments/staging/terraform.tfvars`, add the same two lines. | | |
| TASK-023 | Update `inf/terraform/vuejs-admin-dashboard/README.md`: (a) add CodeArtifact and CodeDeploy to the Architecture diagram and Resource Inventory table; (b) add a new section "CodeArtifact Setup" describing how buildspec.yml should call `aws codeartifact get-authorization-token` and configure `.npmrc`; (c) update the Monthly Cost per Environment table with CodeArtifact (~$0.05/GB storage, first 2 GB/month free) and CloudFront (15 GB/month free tier) entries; (d) update the Files table with `codeartifact.tf` and `codedeploy.tf`. | | |

---

## 3. Alternatives

- **ALT-001: Single shared CodeArtifact domain across environments** — Using one domain owned by production and shared with staging reduces cost and duplication. Rejected because it breaks the per-environment isolation pattern established by all other resources in this module, and introduces a cross-state dependency that complicates teardown ordering.
- **ALT-002: CodeDeploy with EC2 target instead of S3** — CodeDeploy is most commonly used with EC2/ECS targets. Using EC2 would require provisioning an Auto Scaling Group, load balancer, and EC2 instances — disproportionate cost ($15–50+/month) for a static SPA portfolio project. S3+CloudFront is the correct target for a pre-built SPA.
- **ALT-003: CodeDeploy with Lambda compute platform** — Lambda deployment platform is for function code, not static file deployments. Not applicable to a Vue.js SPA artifact.
- **ALT-004: Replace Amplify completely** — Removing Amplify and using only S3+CloudFront would simplify the architecture. Rejected because the task explicitly requires backward compatibility and preserving existing Amplify resources.
- **ALT-005: Dynamic stage blocks in a single aws_codepipeline resource** — Terraform `dynamic` blocks inside `stage` would allow a single pipeline resource. Rejected because CodePipeline requires at minimum two stages; dynamic removal of the only Deploy stage would produce an invalid pipeline configuration. Two separate resources with `count` is cleaner and statically analyzable.
- **ALT-006: Use CodeArtifact npm-login action instead of environment variables** — The npm login approach requires the `aws codeartifact login` CLI command in the buildspec. The environment-variable approach passes the repository URL and token separately, giving the buildspec author explicit control. Either works; the environment-variable approach was chosen for consistency with how `ENVIRONMENT` is currently injected.

---

## 4. Dependencies

- **DEP-001**: `aws_codeartifact_domain.app` must be created before `aws_codeartifact_repository.npm` (Terraform handles via reference).
- **DEP-002**: `aws_codeartifact_repository.npm` must exist before `aws_codebuild_project.app` environment variables reference its ARN.
- **DEP-003**: `aws_s3_bucket.web` must exist before `aws_cloudfront_distribution.web`, `aws_s3_bucket_policy.web_cloudfront_oac`, and `aws_codedeploy_deployment_group.app`.
- **DEP-004**: `aws_cloudfront_distribution.web` must exist before `aws_s3_bucket_policy.web_cloudfront_oac` (OAC policy references the distribution ARN).
- **DEP-005**: `aws_codedeploy_app.app` must exist before `aws_codedeploy_deployment_group.app`.
- **DEP-006**: `aws_iam_role.codedeploy_role` must exist before `aws_codedeploy_deployment_group.app`.
- **DEP-007**: `aws_codepipeline.codedeploy` depends on `aws_codedeploy_app.app[0]` and `aws_codedeploy_deployment_group.app[0]`.
- **DEP-008**: The GitHub OIDC provider (`inf/terraform/aws-github-oidc/`) must already be applied before this module is applied — pre-existing dependency, unchanged.

---

## 5. Files

- **FILE-001**: `inf/terraform/vuejs-admin-dashboard/codeartifact.tf` — **NEW** — CodeArtifact domain, npm repository, external upstream connection, domain permissions policy.
- **FILE-002**: `inf/terraform/vuejs-admin-dashboard/codedeploy.tf` — **NEW** — S3 web bucket (+ bucket policy, versioning, SSE, public-access block), CloudFront OAC, CloudFront distribution, CodeDeploy app, CodeDeploy deployment group. All resources gated on `count = var.enable_codedeploy_deploy ? 1 : 0`.
- **FILE-003**: `inf/terraform/vuejs-admin-dashboard/iam.tf` — **MODIFY** — Add CodeArtifact inline policy to CodeBuild role; add CodeDeploy service role + attachments; add conditional CodePipeline→CodeDeploy inline policy.
- **FILE-004**: `inf/terraform/vuejs-admin-dashboard/pipeline.tf` — **MODIFY** — Add `count` to existing `aws_codepipeline.app` (renamed to `amplify`); add new `aws_codepipeline.codedeploy`; add `local.active_pipeline_arn`; add three CodeBuild environment variables for CodeArtifact.
- **FILE-005**: `inf/terraform/vuejs-admin-dashboard/variables.tf` — **MODIFY** — Add `enable_codedeploy_deploy` (bool, default false) and `cloudfront_price_class` (string, default "PriceClass_100").
- **FILE-006**: `inf/terraform/vuejs-admin-dashboard/outputs.tf` — **MODIFY** — Add `codeartifact_repository_endpoint`, `web_bucket_name`, `cloudfront_distribution_domain`, `codedeploy_app_name`.
- **FILE-007**: `inf/terraform/vuejs-admin-dashboard/environments/production/terraform.tfvars` — **MODIFY** — Add `enable_codedeploy_deploy = false`, `cloudfront_price_class = "PriceClass_100"`.
- **FILE-008**: `inf/terraform/vuejs-admin-dashboard/environments/staging/terraform.tfvars` — **MODIFY** — Same two additions as production.
- **FILE-009**: `inf/terraform/vuejs-admin-dashboard/README.md` — **MODIFY** — Update architecture diagram, resource inventory, cost table, files table; add CodeArtifact buildspec guide.

---

## 6. Testing

- **TEST-001**: Run `terraform init -backend=false -input=false && terraform validate` — must exit 0 with no errors.
- **TEST-002**: Run `tflint --recursive` from the module root — must produce zero errors (snake_case, typed vars, descriptions present).
- **TEST-003**: Run `terraform plan -var-file=environments/production/terraform.tfvars` with `enable_codedeploy_deploy = false` — plan must show zero changes to existing resources; only `codeartifact_domain`, `codeartifact_repository`, and `codeartifact_domain_permissions_policy` are added.
- **TEST-004**: Run `terraform plan` with `enable_codedeploy_deploy = true` added to a test tfvars — plan must include `aws_s3_bucket.web`, `aws_cloudfront_distribution.web`, `aws_codedeploy_app.app`, `aws_codedeploy_deployment_group.app`, `aws_codepipeline.codedeploy`, and must show `aws_codepipeline.amplify` as destroyed (count = 0).
- **TEST-005**: Checkov scan (`checkov -d .`) — all new resources must either pass or carry an explicit `checkov:skip` comment with a justification string.
- **TEST-006**: After `terraform apply` with `enable_codedeploy_deploy = false`, trigger a CodePipeline execution manually and verify it succeeds end-to-end using the Amplify path (Lambda invoke → Amplify deployment visible in AWS Console).
- **TEST-007**: After enabling `enable_codedeploy_deploy = true` and applying, verify CodeBuild uses CodeArtifact by checking CloudWatch build logs for the npm registry URL pointing to the CodeArtifact endpoint (not `registry.npmjs.org`).
- **TEST-008**: After a CodeDeploy-path pipeline execution, verify the SPA is accessible at the CloudFront distribution URL and Vue Router history-mode routes (e.g., `/dashboard`) return `index.html` (200) not a 404.

---

## 7. Risks & Assumptions

- **RISK-001**: CodeArtifact `external_connections` to `public:npmjs` is limited to one external connection per repository. If a second upstream is needed in future (e.g., GitHub Packages), a separate repository must be created.
- **RISK-002**: CodeDeploy with `compute_platform = "Server"` and S3 deployment requires the artifact zip to contain an `appspec.yml` file. The buildspec.yml must be updated to produce the correct artifact structure (appspec.yml + `dist/` directory). If buildspec.yml is not updated, the CodeDeploy deployment will fail with "appspec.yml not found".
- **RISK-003**: CloudFront distributions take 10–20 minutes to deploy on creation. `terraform apply` will block until the distribution is `Deployed`. This is expected behavior, not a bug.
- **RISK-004**: The `aws_cloudfront_distribution` resource with `count` creates a dependency on `aws_s3_bucket_policy.web_cloudfront_oac[0]` which itself depends on `aws_cloudfront_distribution.web[0].arn`. Terraform handles this correctly via reference; no circular dependency exists.
- **RISK-005**: Renaming `aws_codepipeline.app` to `aws_codepipeline.amplify` will cause Terraform to destroy and recreate the resource during the first apply after this change, briefly interrupting the existing pipeline. Mitigation: use `terraform state mv aws_codepipeline.app aws_codepipeline.amplify[0]` before applying.
- **ASSUMPTION-001**: The AWS account already has the GitHub OIDC provider configured at `https://token.actions.githubusercontent.com` (pre-existing dependency).
- **ASSUMPTION-002**: `buildspec.yml` in `src/vuejs-admin-dashboard/` will be updated separately to configure npm to use the CodeArtifact endpoint using the injected `CODEARTIFACT_*` environment variables. The buildspec update is out of scope for this Terraform plan but is required for CodeArtifact to be effective.
- **ASSUMPTION-003**: For CodeDeploy path, `buildspec.yml` will be updated to produce a zip artifact containing `appspec.yml` at the root alongside the `dist/` build output. This buildspec change is a separate task from this infrastructure plan.
- **ASSUMPTION-004**: Both environments (`production`, `staging`) will initially keep `enable_codedeploy_deploy = false`. Enabling it is a deliberate opt-in per environment.

---

## 8. Related Specifications / Further Reading

- [Current infrastructure README](../inf/terraform/vuejs-admin-dashboard/README.md)
- [AWS CodeArtifact — npm upstream connection docs](https://docs.aws.amazon.com/codeartifact/latest/ug/npm-upstream.html)
- [AWS CodeDeploy — Deploying to Amazon S3](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-create-console-s3.html)
- [CloudFront Origin Access Control (OAC)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Terraform aws_codeartifact_domain](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codeartifact_domain)
- [Terraform aws_codedeploy_app](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/codedeploy_app)
- [Terraform aws_cloudfront_distribution](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudfront_distribution)
- [Feature plan for existing infrastructure](feature-vuejs-admin-dashboard-infrastructure-1.md)
