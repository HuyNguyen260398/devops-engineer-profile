---
goal: AWS Agentic ETL Pipeline — Markdown Content Extraction, Transformation & Blog Loading
version: 1.2
date_created: 2026-04-10
last_updated: 2026-04-11
owner: devops-engineer-profile / data-engineer
status: 'Planned'
tags: [data, infrastructure, etl, aws, bedrock, lambda, s3, terraform, agentic-ai, blog, vpc, network-security]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan describes a serverless, cost-optimized AWS ETL pipeline that ingests raw Markdown files (produced by the **html-to-md** app in the Vue.js Admin Dashboard), uses **Amazon Bedrock Agents + Claude** to extract clean main content, stores the clean Markdown in S3, persists article metadata in DynamoDB, and exposes the results to the **Blog** app inside the Vue.js Admin Dashboard. All AWS infrastructure is managed by Terraform located at `inf/terraform/aws-etl-pipeline/`.

All Lambda compute runs inside a **dedicated VPC with private subnets**, communicating with AWS services exclusively through VPC Endpoints — no Lambda function ever traverses the public internet.

## Pipeline Flow

```
[html-to-md app]
      │  upload .md file
      ▼
[S3 raw-bucket]  ◄── bucket policy: sourceVpce only (raw writes)
      │  PutObject event
      ▼
[EventBridge Rule]
      │  triggers
      ▼
[Lambda — etl-orchestrator]  ◄── runs in VPC private subnet
      │  reads raw .md via S3 Gateway Endpoint
      │  calls Bedrock Agent via Interface Endpoint
      ▼
[Amazon Bedrock Agent (Claude Haiku 3.5)]
      │  extracts main content, strips noise
      ▼
[Lambda — etl-loader]  ◄── runs in VPC private subnet    ◄─────────────────────────────┐
      │                                                                                  │
      ├──► [S3 clean-bucket]  (clean .md file) via S3 Gateway Endpoint                  │
      │                                                                                  │
      └──► [DynamoDB — article-metadata] via DynamoDB Gateway Endpoint                  │
                 │                                                                       │
      [Athena]◄──┘  (serverless SQL analytics)                                          │
                                                                                        │
[Blog app] ─── list/search ──► [DynamoDB]                                               │
           ─── read content ──► [S3 clean-bucket] pre-signed URL ──────────────────────┘

VPC Network Layer:
  Private Subnet A (ap-southeast-1a) ─── Lambda execution
  Private Subnet B (ap-southeast-1b) ─── Lambda HA failover
  S3 Gateway Endpoint              ─── free, no AZ constraint
  DynamoDB Gateway Endpoint        ─── free, no AZ constraint
  Interface Endpoint: bedrock-agent-runtime
  Interface Endpoint: logs (CloudWatch)
  Interface Endpoint: lambda (orchestrator → loader invoke)
  VPC Flow Logs ──► CloudWatch Log Group (14-day retention)
```

---

## 1. Requirements & Constraints

- **REQ-001**: Pipeline must be fully event-driven — triggered automatically on S3 `PutObject` via EventBridge.
- **REQ-002**: The transformation stage **must** use Amazon Bedrock (Agentic AI) to filter and extract main content from raw Markdown.
- **REQ-003**: Clean Markdown must be written to a separate S3 clean bucket preserving the original filename.
- **REQ-004**: Article metadata (title, date, tags, word count, S3 key, status) must be stored in DynamoDB for the Blog app to list and search articles.
- **REQ-005**: All AWS resources must be provisioned with Terraform at `inf/terraform/aws-etl-pipeline/`.
- **REQ-006**: The Blog app in the Vue.js Admin Dashboard must be able to list articles via DynamoDB and fetch full Markdown via pre-signed S3 URLs.
- **REQ-007**: Pipeline compute and AI cost at < 100 documents/month must remain below **$5 USD/month**; VPC network isolation adds ~$22/month overhead (see Cost Analysis).
- **SEC-001**: All S3 buckets must block public access; content must be accessed via pre-signed URLs only.
- **SEC-002**: Lambda execution roles must follow the principle of least privilege.
- **SEC-003**: Bedrock Agent invocation must be authorized by a dedicated IAM role — never use overly broad permissions.
- **SEC-004**: DynamoDB must use AWS-managed encryption at rest.
- **SEC-005**: All Lambda functions must execute inside a dedicated ETL VPC in private subnets — no Lambda function may have a public IP or run in the default VPC.
- **SEC-006**: VPC Gateway Endpoints must be provisioned for S3 and DynamoDB to route all service traffic over the AWS private backbone at zero data-transfer cost.
- **SEC-007**: VPC Interface Endpoints must be provisioned for Bedrock Agent Runtime, CloudWatch Logs, and Lambda to avoid any internet egress from the private subnets. No NAT Gateway is required.
- **SEC-008**: Lambda Security Groups must permit egress TCP 443 to VPC Endpoint Security Groups only; all inbound and all other egress must be denied.
- **SEC-009**: The raw S3 bucket policy must include an `aws:sourceVpce` condition restricting direct PutObject/GetObject access to the designated S3 Gateway Endpoint ID. The clean S3 bucket remains accessible via pre-signed URLs from the browser (pre-signed URL auth is enforced via SigV4 signature, not VPC endpoint restriction).
- **SEC-010**: VPC Flow Logs must be enabled on the ETL VPC and delivered to a dedicated CloudWatch Log Group with 14-day retention for network audit and anomaly detection.
- **CON-001**: No managed Kafka, Kinesis streams, or EMR — pipeline volume does not justify streaming infrastructure.
- **CON-002**: OpenSearch Serverless is excluded due to minimum 2 OCU cost (~$350/month); DynamoDB + Athena serve analytics needs instead.
- **CON-003**: Terraform state must use a remote backend (existing S3 + DynamoDB lock table pattern from the repo).
- **CON-004**: No NAT Gateway — all outbound connectivity from Lambda must be handled exclusively through VPC Endpoints to avoid the ~$32/month NAT overhead.
- **GUD-001**: Follow Terraform snake_case naming convention enforced by `.tflint.hcl` across existing projects.
- **GUD-002**: All resources must carry `Environment`, `Project`, `ManagedBy` tags per repo convention.
- **GUD-003**: Lambda functions must be packaged as ZIP archives referenced by Terraform.
- **GUD-004**: VPC CIDR block (`10.10.0.0/24`) must not overlap with existing project VPCs in the AWS account. Private subnets are `/26`: Subnet A `10.10.0.0/26` (ap-southeast-1a), Subnet B `10.10.0.64/26` (ap-southeast-1b).
- **PAT-001**: Use EventBridge (not S3 event notifications directly) for decoupling and easier rule management.
- **PAT-002**: Bedrock Agent uses an **inline action group** — no Knowledge Base required for content extraction; this keeps cost near zero for agent infrastructure.

---

## 2. Implementation Steps

### Implementation Phase 1 — Terraform Foundation & S3 Buckets

- GOAL-001: Bootstrap the Terraform root module and provision the two S3 buckets (raw and clean) with all security best practices applied.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create directory `inf/terraform/aws-etl-pipeline/` | | |
| TASK-002 | Create `main.tf` — AWS provider `~> 5.0`, required_version `>= 1.7`, terraform backend block pointing to existing S3 state bucket | | |
| TASK-003 | Create `variables.tf` — declare: `aws_region` (default `ap-southeast-1`), `environment`, `project` (default `aws-etl-pipeline`), `raw_bucket_name`, `clean_bucket_name`, `bedrock_model_id` (default `anthropic.claude-haiku-3-5-v1:0`), `vpc_cidr` (default `10.10.0.0/24`), `private_subnet_cidrs` (default `["10.10.0.0/26","10.10.0.64/26"]`) | | |
| TASK-004 | Create `s3.tf` — `aws_s3_bucket.etl_raw`, `aws_s3_bucket.etl_clean`; both with `block_public_acls=true`, versioning enabled, SSE-S3 encryption, lifecycle rule to expire raw files after 90 days | | |
| TASK-005 | Add EventBridge notification config to raw bucket: enable `aws_s3_bucket_notification` with `eventbridge = true` so all `ObjectCreated` events are sent to the default EventBridge bus | | |
| TASK-006 | Create `outputs.tf` — export: raw bucket ARN/name, clean bucket ARN/name, Lambda ARN, DynamoDB table name, VPC ID, private subnet IDs, VPC endpoint IDs | | |

### Implementation Phase 2 — VPC & Network Security

- GOAL-002: Provision the dedicated ETL VPC, private subnets, VPC Endpoints, Security Groups, and Flow Logs. All Lambda functions will be attached to this VPC in subsequent phases.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-054 | Create `vpc.tf` — `aws_vpc.etl` with `cidr_block = var.vpc_cidr`, `enable_dns_support = true`, `enable_dns_hostnames = true` (required for Interface Endpoints) | | |
| TASK-055 | Create two `aws_subnet.etl_private` resources: Subnet A (`10.10.0.0/26`, `ap-southeast-1a`), Subnet B (`10.10.0.64/26`, `ap-southeast-1b`); tag `Tier = private` | | |
| TASK-056 | Create `aws_security_group.lambda_etl` (for Lambda functions): egress rule TCP 443 to `aws_security_group.vpc_endpoints`; deny all inbound. Create `aws_security_group.vpc_endpoints` (for Interface Endpoints): ingress TCP 443 from `aws_security_group.lambda_etl` | | |
| TASK-057 | Create S3 Gateway Endpoint: `aws_vpc_endpoint.s3` with `service_name = "com.amazonaws.${var.aws_region}.s3"`, `vpc_endpoint_type = "Gateway"`, associate with private subnet route tables — no cost | | |
| TASK-058 | Create DynamoDB Gateway Endpoint: `aws_vpc_endpoint.dynamodb` with `service_name = "com.amazonaws.${var.aws_region}.dynamodb"`, `vpc_endpoint_type = "Gateway"`, associate with private subnet route tables — no cost | | |
| TASK-059 | Create Bedrock Agent Runtime Interface Endpoint: `aws_vpc_endpoint.bedrock_agent_runtime` with `service_name = "com.amazonaws.${var.aws_region}.bedrock-agent-runtime"`, `vpc_endpoint_type = "Interface"`, `subnet_ids = [aws_subnet.etl_private_a.id]` (single AZ to minimize cost), `security_group_ids = [aws_security_group.vpc_endpoints.id]`, `private_dns_enabled = true` | | |
| TASK-060 | Create CloudWatch Logs Interface Endpoint: `aws_vpc_endpoint.logs` — required for VPC-attached Lambda to write to CloudWatch Logs without internet access; `private_dns_enabled = true`; single AZ | | |
| TASK-061 | Create Lambda Interface Endpoint: `aws_vpc_endpoint.lambda` — required for orchestrator Lambda to invoke loader Lambda without internet access; `private_dns_enabled = true`; single AZ | | |
| TASK-062 | Enable VPC Flow Logs: `aws_flow_log.etl_vpc` with `traffic_type = "ALL"`, `iam_role_arn = aws_iam_role.vpc_flow_log.arn`, `log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn`. Create `aws_cloudwatch_log_group.vpc_flow_logs` with 14-day retention | | |
| TASK-063 | Add raw S3 bucket policy with `aws:sourceVpce` condition: deny `s3:GetObject` and `s3:PutObject` on the raw bucket unless request originates from `aws_vpc_endpoint.s3.id`. This enforces that only VPC-internal Lambda traffic can read/write raw files | | |

### Implementation Phase 3 — IAM Roles & Policies

- GOAL-003: Define all IAM roles and inline/managed policies following least-privilege for Lambda, Bedrock Agent, EventBridge, and VPC Flow Logs.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Create `iam.tf` — `aws_iam_role.lambda_etl_orchestrator` with trust policy for `lambda.amazonaws.com` | | |
| TASK-008 | Attach inline policy to orchestrator role: `s3:GetObject` on raw bucket, `bedrock:InvokeAgent`, `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`, and `ec2:CreateNetworkInterface` + `ec2:DescribeNetworkInterfaces` + `ec2:DeleteNetworkInterface` (required for VPC attachment) | | |
| TASK-009 | Create `aws_iam_role.lambda_etl_loader` with trust policy for `lambda.amazonaws.com` | | |
| TASK-010 | Attach inline policy to loader role: `s3:PutObject` on clean bucket, `dynamodb:PutItem` + `dynamodb:UpdateItem` on article table, `logs:*`, and EC2 VPC network interface permissions (same as TASK-008) | | |
| TASK-011 | Create `aws_iam_role.bedrock_agent_execution` with trust policy for `bedrock.amazonaws.com`, attach `bedrock:InvokeModel` on model ARN, `lambda:InvokeFunction` on loader Lambda | | |
| TASK-064 | Create `aws_iam_role.vpc_flow_log` with trust policy for `vpc-flow-logs.amazonaws.com`; attach inline policy: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`, `logs:DescribeLogGroups`, `logs:DescribeLogStreams` | | |
| TASK-065 | Add VPC Endpoint resource policies: add `aws_vpc_endpoint_policy` on the S3 endpoint restricting allowed principals to `lambda_etl_orchestrator` and `lambda_etl_loader` ARNs; add endpoint policy on DynamoDB endpoint scoped to the loader role only | | |

### Implementation Phase 4 — DynamoDB Table (Analytics Store)

- GOAL-004: Provision a DynamoDB table in on-demand (PAY_PER_REQUEST) billing mode to store article metadata for the Blog app.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Create `dynamodb.tf` — `aws_dynamodb_table.article_metadata`: partition key `article_id` (String), sort key `created_at` (String) | | |
| TASK-013 | Add GSI `status-created_at-index` on `status` (hash) + `created_at` (range) so Blog app can query `status = PUBLISHED` | | |
| TASK-014 | Enable point-in-time recovery, SSE with AWS_OWNED_KMS, billing_mode `PAY_PER_REQUEST` | | |
| TASK-015 | Add TTL attribute `expires_at` (unused by default but present for future archival) | | |

### Implementation Phase 5 — Lambda Functions (Python 3.12)

- GOAL-005: Implement two Lambda functions: `etl-orchestrator` (reads raw MD, invokes Bedrock Agent) and `etl-loader` (receives clean content, writes to S3 + DynamoDB). Both functions must be VPC-attached.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Create `inf/terraform/aws-etl-pipeline/lambda_src/orchestrator/handler.py` — reads S3 object from event, calls `bedrock-agent-runtime:InvokeAgent`, passes raw markdown as session input | | |
| TASK-017 | In `orchestrator/handler.py`: parse Bedrock Agent response stream, concatenate completion chunks, invoke `etl-loader` Lambda asynchronously with `{clean_content, source_key, source_bucket}` | | |
| TASK-018 | Create `inf/terraform/aws-etl-pipeline/lambda_src/loader/handler.py` — writes clean markdown to `s3://etl-clean-bucket/{year}/{month}/{filename}`, builds metadata dict, calls `dynamodb.put_item` | | |
| TASK-019 | DynamoDB item schema in loader: `article_id` (UUID), `created_at` (ISO8601), `title` (extracted from first H1 in clean MD), `s3_key` (clean bucket path), `word_count` (int), `status` (`PUBLISHED`), `source_url` (from original filename convention) | | |
| TASK-020 | Create `requirements.txt` for each Lambda (orchestrator: `boto3>=1.34`; loader: `boto3>=1.34`) — both use Lambda Python 3.12 runtime which includes boto3, so requirements files are for local dev reference only | | |
| TASK-021 | Create `lambda.tf` — two `aws_lambda_function` resources; use `archive_file` data source to ZIP each `lambda_src/*/` directory; set memory 256MB, timeout 300s for orchestrator, 60s for loader; add `vpc_config` block to both functions: `subnet_ids = [aws_subnet.etl_private_a.id, aws_subnet.etl_private_b.id]`, `security_group_ids = [aws_security_group.lambda_etl.id]` | | |
| TASK-022 | Add `aws_lambda_function_event_invoke_config` for orchestrator: `maximum_retry_attempts = 0` to prevent double-processing on failure | | |
| TASK-023 | Add CloudWatch Log Groups with 7-day retention for both Lambda functions | | |

### Implementation Phase 6 — Amazon Bedrock Agent

- GOAL-006: Create a Bedrock Agent configured to extract main blog content from Markdown, backed by Claude Haiku 3.5 for cost efficiency.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Create `bedrock.tf` — `aws_bedrockagent_agent` resource: `agent_name = "etl-content-extractor"`, `foundation_model = var.bedrock_model_id`, `idle_session_ttl_in_seconds = 600` | | |
| TASK-025 | Set agent `instruction` prompt: *"You are a content extraction specialist. When given raw Markdown scraped from a website, extract ONLY the main article body. Remove: navigation menus, comment sections, author bios, avatar images, related posts links, advertisement blocks, social share buttons, footer content, sidebar widgets. Return the cleaned content as valid Markdown preserving headings, code blocks, lists, and inline formatting. Do not add any explanation — return only the clean Markdown."* | | |
| TASK-026 | Create `aws_bedrockagent_agent_alias` with `alias_name = "live"` pointing to the agent version | | |
| TASK-027 | Create `aws_bedrockagent_agent_action_group` named `content-extraction` with executor type `RETURN_CONTROL` (no Lambda executor needed — agent returns content directly to orchestrator) | | |
| TASK-028 | Add `depends_on` on agent alias to ensure agent is prepared before alias creation; add `aws_bedrockagent_agent_action_group_association` | | |

### Implementation Phase 7 — EventBridge Rule (Trigger)

- GOAL-007: Wire S3 raw bucket uploads to the orchestrator Lambda via EventBridge with a scoped event pattern.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-029 | Create `eventbridge.tf` — `aws_cloudwatch_event_rule.s3_raw_upload` with event pattern: `{"source":["aws.s3"],"detail-type":["Object Created"],"detail":{"bucket":{"name":[var.raw_bucket_name]},"object":{"key":[{"suffix":".md"}]}}}` | | |
| TASK-030 | Create `aws_cloudwatch_event_target` pointing to `aws_lambda_function.etl_orchestrator.arn` | | |
| TASK-031 | Create `aws_lambda_permission` allowing `events.amazonaws.com` to invoke the orchestrator Lambda | | |

### Implementation Phase 8 — Athena (Analytics)

- GOAL-008: Enable serverless SQL analytics over the clean S3 bucket using Athena + Glue Data Catalog.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-032 | Create `athena.tf` — `aws_glue_catalog_database.etl_articles` | | |
| TASK-033 | Create `aws_glue_catalog_table.clean_articles` with `table_type = "EXTERNAL_TABLE"`, location pointing to clean S3 bucket prefix, `input_format = "org.apache.hadoop.mapred.TextInputFormat"`, serde `org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe`, columns: `article_id string`, `title string`, `word_count int`, `created_at string` (sourced from DynamoDB export or a companion metadata JSON written alongside each `.md` file) | | |
| TASK-034 | Create `aws_athena_workgroup.etl` with S3 output location set to a `/athena-results/` prefix in clean bucket, enforce result encryption | | |

### Implementation Phase 9 — Blog App Integration (Vue.js Admin Dashboard)

- GOAL-009: Add a Blog section to the Vue.js Admin Dashboard that lists articles from DynamoDB and renders clean Markdown fetched via pre-signed S3 URLs.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-035 | Create Vue composable `src/composables/useBlogPosts.js` — calls API endpoint or AWS SDK (Amplify) to `query` DynamoDB GSI `status-created_at-index` with `status = PUBLISHED`, returns paginated list of article metadata | | |
| TASK-036 | Create `src/composables/useBlogPost.js` — given `article_id`, fetches `s3_key` from DynamoDB, then calls backend to generate a pre-signed S3 URL (TTL 15 minutes), fetches Markdown, renders via `marked.js` | | |
| TASK-037 | Create `src/views/blog/BlogListView.vue` — displays article cards (title, date, word count), pagination | | |
| TASK-038 | Create `src/views/blog/BlogPostView.vue` — renders full Markdown as HTML using `marked` + `DOMPurify` for XSS safety | | |
| TASK-039 | Create `src/components/blog/ArticleCard.vue` — reusable card component for article list | | |
| TASK-040 | Add `/blog` and `/blog/:id` routes to Vue Router | | |
| TASK-041 | Add "Blog" navigation entry to the dashboard sidebar | | |
| TASK-042 | Create Lambda function or API endpoint `etl-presign` that generates pre-signed S3 GET URLs for clean bucket objects (can reuse existing Amplify backend or add new Lambda + API Gateway) | | |

### Implementation Phase 10 — Terraform Variables & Environments

- GOAL-010: Finalize Terraform variable files for staging and production environments.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-043 | Create `inf/terraform/aws-etl-pipeline/environments/staging/terraform.tfvars` with staging bucket names, region, `vpc_cidr = "10.10.0.0/24"`, `private_subnet_cidrs = ["10.10.0.0/26","10.10.0.64/26"]` | | |
| TASK-044 | Create `inf/terraform/aws-etl-pipeline/environments/staging/backend.hcl` pointing to existing S3 state bucket | | |
| TASK-045 | Create `inf/terraform/aws-etl-pipeline/environments/production/terraform.tfvars` — use non-overlapping CIDR if production is a separate account/VPC | | |
| TASK-046 | Create `inf/terraform/aws-etl-pipeline/environments/production/backend.hcl` | | |
| TASK-047 | Add `.tflint.hcl` file at `inf/terraform/aws-etl-pipeline/` following the same rules as existing projects (snake_case, required tags, pinned module versions) | | |

### Implementation Phase 11 — Validation & Cost Verification

- GOAL-011: Validate the full pipeline end-to-end (including VPC isolation) and confirm monthly cost estimates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-048 | Run `terraform init && terraform validate && terraform plan` for staging environment — confirm zero errors | | |
| TASK-049 | Deploy to staging, upload a sample `.md` file, verify EventBridge fires, orchestrator Lambda executes, Bedrock Agent returns clean content | | |
| TASK-050 | Verify clean `.md` file appears in clean S3 bucket and DynamoDB record is created with correct metadata | | |
| TASK-051 | Open Blog app in Vue.js Dashboard, confirm article appears in list and full Markdown renders correctly | | |
| TASK-052 | Run Athena query `SELECT title, word_count, created_at FROM etl_articles.clean_articles LIMIT 10` — confirm results | | |
| TASK-053 | Document actual cost after 1 month in staging and compare to estimates below | | |
| TASK-066 | Verify VPC isolation: confirm Lambda ENIs are placed in private subnets with no public IP via `aws ec2 describe-network-interfaces --filters Name=description,Values="AWS Lambda VPC ENI*"` | | |
| TASK-067 | Verify traffic does NOT traverse internet: enable VPC Flow Logs, run a pipeline execution, check logs confirm `ACCEPT` flows only to VPC Endpoint ENIs (no flows to `0.0.0.0/0` route) | | |
| TASK-068 | Verify raw bucket deny-from-internet: attempt `aws s3 cp` to raw bucket from outside VPC using a principal that has `s3:PutObject` IAM permission — expect `403 Access Denied` due to `aws:sourceVpce` bucket policy condition | | |

---

## 3. Alternatives

- **ALT-001: OpenSearch Serverless for analytics** — Rejected. Minimum 2 OCU = ~$350/month. Vastly exceeds the $5/month target for < 100 documents.
- **ALT-002: Amazon Kendra for intelligent search** — Rejected. Developer Edition costs $810/month minimum. Grossly over-engineered for this volume.
- **ALT-003: Amazon S3 event notifications → SNS/SQS → Lambda** — Rejected in favor of EventBridge. EventBridge provides richer filtering (suffix `.md`), easier rule management, and native audit logging via CloudTrail.
- **ALT-004: Bedrock InvokeModel directly (no Agent)** — Valid but rejected in favor of Bedrock Agents per requirement. Agents provide conversation state, retry logic, and future extensibility (e.g., adding memory or multi-step reasoning). Cost difference is negligible.
- **ALT-005: AWS Glue for ETL transformation** — Rejected. Glue has a 10-minute minimum billing unit ($0.44/DPU-hour). For sub-second markdown processing, Lambda is 100× cheaper.
- **ALT-006: Amazon RDS (PostgreSQL) for metadata** — Rejected. Requires always-on instance ($15+/month minimum). DynamoDB on-demand is free at this volume (within free tier).
- **ALT-007: API Gateway + Lambda for pre-signed URL generation** — Valid alternative to direct SDK calls from the frontend. Preferred for production to avoid exposing AWS credentials to the browser.
- **ALT-008: NAT Gateway instead of VPC Interface Endpoints** — Rejected. NAT Gateway costs ~$32/month at minimum (idle) vs. ~$22/month for three Interface Endpoints. NAT also routes traffic to the public internet; Interface Endpoints keep traffic on the AWS backbone.
- **ALT-009: Lambda outside VPC (no network isolation)** — Rejected for production. Lambda without a VPC has no network perimeter; any credential exfiltration or supply-chain compromise can reach any internet host freely. VPC confinement limits the blast radius.
- **ALT-010: Multi-AZ Interface Endpoints** — Valid for production HA but costs 2× (~$14.40/endpoint/month). Single-AZ Interface Endpoints are acceptable for this low-volume, async pipeline where brief endpoint downtime causes at-most a delayed ETL run, not data loss.

---

## 4. Dependencies

- **DEP-001**: Amazon Bedrock must have **model access enabled** for `anthropic.claude-haiku-3-5-v1:0` in `ap-southeast-1`. This must be requested manually in the AWS Console → Bedrock → Model access before Terraform apply.
- **DEP-002**: Existing S3 Terraform state bucket and DynamoDB lock table (used by other projects in this repo) must be accessible for backend configuration.
- **DEP-003**: `marked` npm package (`^13.0.0`) must be added to `src/vuejs-admin-dashboard/package.json` for Markdown rendering in the Blog app.
- **DEP-004**: `dompurify` npm package must be added for XSS sanitization of rendered HTML.
- **DEP-005**: AWS CLI configured with credentials that have permissions to create Bedrock agents, Lambda functions, DynamoDB tables, S3 buckets, EventBridge rules, VPC resources, and VPC Endpoints.
- **DEP-006**: Python 3.12 runtime available in target AWS region for Lambda functions.
- **DEP-007**: Terraform `>= 1.7.0` installed locally (required for `archive_file` data source behavior).
- **DEP-008**: VPC Interface Endpoints for `bedrock-agent-runtime` must be **available in `ap-southeast-1`**. Verify with: `aws ec2 describe-vpc-endpoint-services --filters Name=service-name,Values=com.amazonaws.ap-southeast-1.bedrock-agent-runtime`. If unavailable, fall back to `us-east-1` with cross-region invocation.
- **DEP-009**: The IAM role used by Terraform apply must have `ec2:CreateVpc`, `ec2:CreateSubnet`, `ec2:CreateVpcEndpoint`, `ec2:CreateFlowLogs`, and related EC2 permissions in addition to Lambda/S3/DynamoDB permissions.

---

## 5. Files

### Terraform Files (`inf/terraform/aws-etl-pipeline/`)

- **FILE-001**: `main.tf` — Provider config (`hashicorp/aws ~> 5.0`), backend S3 config, required_version
- **FILE-002**: `variables.tf` — All input variable declarations with descriptions and defaults (includes VPC CIDR variables)
- **FILE-003**: `outputs.tf` — Raw bucket name/ARN, clean bucket name/ARN, orchestrator Lambda ARN, DynamoDB table name, Bedrock Agent ID/alias ARN, VPC ID, private subnet IDs, VPC endpoint IDs
- **FILE-004**: `s3.tf` — Raw bucket, clean bucket, bucket policies (including `aws:sourceVpce` condition on raw bucket), versioning, encryption, lifecycle, EventBridge notification
- **FILE-005**: `iam.tf` — Lambda orchestrator role, Lambda loader role, Bedrock agent execution role, VPC Flow Log role, all inline policies (includes EC2 VPC ENI permissions)
- **FILE-006**: `lambda.tf` — `etl-orchestrator` Lambda, `etl-loader` Lambda, CloudWatch log groups, archive_file data sources; both functions include `vpc_config` block
- **FILE-007**: `eventbridge.tf` — EventBridge rule, target, Lambda permission
- **FILE-008**: `bedrock.tf` — Bedrock Agent, Agent alias, Action Group
- **FILE-009**: `dynamodb.tf` — `article-metadata` table, GSI, TTL, PITR
- **FILE-010**: `athena.tf` — Glue database, Glue table, Athena workgroup
- **FILE-011**: `lambda_src/orchestrator/handler.py` — Orchestrator Lambda source code
- **FILE-012**: `lambda_src/loader/handler.py` — Loader Lambda source code
- **FILE-013**: `environments/staging/terraform.tfvars` — Staging environment variable values (includes VPC CIDR)
- **FILE-014**: `environments/staging/backend.hcl` — Staging state backend config
- **FILE-015**: `environments/production/terraform.tfvars` — Production variable values
- **FILE-016**: `environments/production/backend.hcl` — Production state backend config
- **FILE-017**: `.tflint.hcl` — TFLint rules matching existing repo conventions
- **FILE-018**: `vpc.tf` — ETL VPC, private subnets (two AZs), Security Groups (`sg_lambda_etl`, `sg_vpc_endpoints`), S3 Gateway Endpoint, DynamoDB Gateway Endpoint, Bedrock Agent Runtime Interface Endpoint, CloudWatch Logs Interface Endpoint, Lambda Interface Endpoint, VPC Flow Logs, CloudWatch Log Group for flow logs

### Vue.js Admin Dashboard Files (`src/vuejs-admin-dashboard/`)

- **FILE-019**: `src/composables/useBlogPosts.js` — DynamoDB article list composable
- **FILE-020**: `src/composables/useBlogPost.js` — Single article fetch composable (pre-signed URL)
- **FILE-021**: `src/views/blog/BlogListView.vue` — Blog list page
- **FILE-022**: `src/views/blog/BlogPostView.vue` — Blog post detail page
- **FILE-023**: `src/components/blog/ArticleCard.vue` — Article card component
- **FILE-024**: `src/router/index.js` — Updated with `/blog` and `/blog/:id` routes

---

## 6. Testing

- **TEST-001**: Upload a raw `.md` file to the raw S3 bucket via AWS CLI (`aws s3 cp test.md s3://<raw-bucket>/`) and verify within 30 seconds that a clean `.md` appears in the clean bucket.
- **TEST-002**: Verify DynamoDB record created: `aws dynamodb get-item --table-name article-metadata --key '{"article_id":{"S":"<uuid>"}}'`
- **TEST-003**: Check Lambda CloudWatch logs for both orchestrator and loader — no errors, Bedrock invocation latency < 30s.
- **TEST-004**: Verify Bedrock Agent strips navigation/comments: upload markdown with known noise elements, confirm output contains only main content.
- **TEST-005**: Blog list page renders at `/blog` — shows article with correct title and date.
- **TEST-006**: Blog post page renders at `/blog/<id>` — full Markdown rendered as HTML, images load, code blocks formatted.
- **TEST-007**: Pre-signed URL expires after 15 minutes — verify second access after TTL returns 403.
- **TEST-008**: Run `terraform validate` — zero errors.
- **TEST-009**: Run `tflint --recursive` from `inf/terraform/aws-etl-pipeline/` — zero warnings.
- **TEST-010**: Athena query returns expected results from Glue table.
- **TEST-011**: **VPC Isolation** — confirm Lambda ENIs have no public IP: `aws ec2 describe-network-interfaces --filters Name=description,Values="AWS Lambda VPC ENI*" Name=vpc-id,Values=<etl-vpc-id>` — `Association.PublicIp` must be null for all.
- **TEST-012**: **VPC Flow Logs** — trigger a pipeline run, query flow logs in CloudWatch Insights: `fields srcAddr, dstAddr, action | filter action = "ACCEPT"` — all accepted destination IPs must resolve to VPC Endpoint private IPs, not public IP ranges.
- **TEST-013**: **Raw bucket deny from internet** — using an IAM principal with `s3:PutObject` permission, attempt upload from outside the VPC: `aws s3 cp test.md s3://<raw-bucket>/` — must receive `403 Access Denied` (bucket policy `aws:sourceVpce` enforced).
- **TEST-014**: **Security Group egress** — from inside the VPC (via EC2 or AWS Session Manager), run `nc -zv <non-443-internet-host> 80` from Lambda subnet — must time out (Security Group blocks non-443 egress).
- **TEST-015**: **Interface Endpoint DNS** — from the orchestrator Lambda function, resolve `bedrock-agent-runtime.ap-southeast-1.amazonaws.com` — must return a private IP in the `10.10.0.0/24` range, confirming `private_dns_enabled` is working.

---

## 7. Cost Analysis (< 100 documents/month)

### Monthly Cost Breakdown — Pipeline Compute & AI

| Service | Usage Assumption | Estimated Cost |
|---------|-----------------|---------------|
| **S3 Raw Bucket** | 100 × 50KB = 5MB stored, 100 PUT + 100 GET | ~$0.001 |
| **S3 Clean Bucket** | 5MB stored, 100 PUT + 200 GET | ~$0.001 |
| **EventBridge** | 100 events × $1/million | ~$0.000 |
| **Lambda — Orchestrator** | 100 invocations × 30s × 256MB | ~$0.004 (free tier) |
| **Lambda — Loader** | 100 invocations × 5s × 256MB | ~$0.000 (free tier) |
| **Amazon Bedrock (Claude Haiku 3.5)** | 100 docs × 5K input tokens avg = 500K tokens ($0.80/M) = $0.40; 100 × 2K output tokens = 200K ($4/M) = $0.80 | ~$1.20 |
| **DynamoDB** | 100 writes, 500 reads, <1MB storage | $0.00 (free tier) |
| **Athena** | 10 queries × 10MB scanned = 100MB ($5/TB) | ~$0.001 |
| **Glue Data Catalog** | 1 table, 1 database | $0.00 (first million objects free) |
| **CloudWatch Logs** | ~10MB logs/month (free tier 5GB) | $0.00 |
| **Bedrock Agent** | No per-agent fee — charged per token via InvokeModel | $0.00 |
| **Pipeline Subtotal** | | **~$1.20 – $2.00/month** |

### Monthly Cost Breakdown — VPC Network Security Overhead

| Resource | Configuration | Estimated Cost |
|----------|--------------|---------------|
| **VPC + Subnets + Route Tables** | Base VPC resources | $0.00 |
| **S3 Gateway Endpoint** | Free — no hourly charge | $0.00 |
| **DynamoDB Gateway Endpoint** | Free — no hourly charge | $0.00 |
| **Interface Endpoint: bedrock-agent-runtime** | 1 AZ × $0.01/hr × 720hr | ~$7.20 |
| **Interface Endpoint: logs (CloudWatch)** | 1 AZ × $0.01/hr × 720hr | ~$7.20 |
| **Interface Endpoint: lambda** | 1 AZ × $0.01/hr × 720hr | ~$7.20 |
| **VPC Flow Logs data** | ~10MB logs/month | ~$0.00 |
| **VPC Subtotal** | | **~$21.60/month** |

### Total Monthly Cost

| Volume | Pipeline Cost | VPC Overhead | Total |
|--------|--------------|-------------|-------|
| < 100 docs/month | ~$1.20 – $2.00 | ~$21.60 | **~$23 – $24/month** |
| 500 docs/month | ~$6.00 – $10.00 | ~$21.60 | **~$28 – $32/month** |
| 1,000 docs/month | ~$12.00 – $20.00 | ~$21.60 | **~$34 – $42/month** |

> **Note on REQ-007**: The $5/month target covers pipeline compute and AI token costs only. VPC network isolation adds a fixed ~$21.60/month overhead that is volume-independent — this is the cost of production-grade network security. For development/staging environments where cost is more important than isolation, Interface Endpoints can be removed and the Lambda VPC attachment disabled by setting `vpc_config = []`.
>
> **Primary cost driver (pipeline)**: Amazon Bedrock token usage.
> **Primary cost driver (VPC)**: Three Interface Endpoints at $7.20/endpoint/month. Reducing to 1 AZ per endpoint is already the minimum; removing any endpoint would require a NAT Gateway (~$32/month) or removing VPC attachment entirely.

---

## 8. Risks & Assumptions

- **RISK-001**: Bedrock model access (`claude-haiku-3-5-v1:0`) may not be available in `ap-southeast-1`. **Mitigation**: Check availability first; fall back to `us-east-1` and configure VPC or cross-region invocation.
- **RISK-002**: Bedrock Agent cold start adds 5–15s latency. Acceptable for async pipeline; users are not blocked.
- **RISK-003**: Large Markdown files (>100KB) may hit Lambda timeout (300s) if Bedrock streaming is slow. **Mitigation**: Chunk large files before Agent invocation.
- **RISK-004**: Bedrock Agent Terraform resource (`aws_bedrockagent_agent`) requires AWS provider `>= 5.35.0`. Verify provider version before apply.
- **RISK-005**: Glue Crawler not used (manual table definition) — schema changes in metadata JSON require manual Glue table update.
- **RISK-006**: VPC Interface Endpoint for `bedrock-agent-runtime` may not be available in all regions, including `ap-southeast-1`. **Mitigation**: Run `aws ec2 describe-vpc-endpoint-services --filters Name=service-name,Values=com.amazonaws.ap-southeast-1.bedrock-agent-runtime` before apply. If unavailable, use NAT Gateway ($32/month) or switch to `us-east-1`.
- **RISK-007**: Lambda VPC attachment increases cold start latency by ~1–2s due to ENI provisioning. **Mitigation**: For low-volume async pipelines this is acceptable. If latency becomes a concern, enable Lambda Hyperplane ENI reuse (default in Lambda since 2019 — no action needed).
- **RISK-008**: Raw bucket policy with `aws:sourceVpce` condition will block all non-VPC access including Terraform `aws s3 cp` commands run from a developer laptop. **Mitigation**: Add an admin IAM role exception to the bucket policy, or use the VPC Endpoint from an EC2 bastion / AWS SSM for direct bucket access.
- **ASSUMPTION-001**: The html-to-md app produces `.md` files with a filename convention of `{sanitized-domain}_{timestamp}.md` which the loader uses to derive `source_url`.
- **ASSUMPTION-002**: The Vue.js Admin Dashboard frontend has access to DynamoDB (via Amplify SDK or backend API). If direct SDK access is not feasible, a Lambda + API Gateway endpoint will be added.
- **ASSUMPTION-003**: Terraform state bucket and DynamoDB lock table already exist (created by bootstrap as per other projects in the repo).
- **ASSUMPTION-004**: `ap-southeast-1` is the target region for all resources.
- **ASSUMPTION-005**: VPC CIDR `10.10.0.0/24` does not conflict with existing VPCs in the AWS account. Verify with `aws ec2 describe-vpcs` before apply.

---

## 9. Related Specifications / Further Reading

- [Amazon Bedrock Agents Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [AWS EventBridge S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html)
- [Terraform AWS Bedrock Agent Resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagent_agent)
- [DynamoDB On-Demand Pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/)
- [Amazon Athena Pricing](https://aws.amazon.com/athena/pricing/)
- [AWS VPC Endpoints — Interface vs Gateway](https://docs.aws.amazon.com/vpc/latest/privatelink/aws-services-privatelink-support.html)
- [Lambda in VPC — Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html)
- [VPC Endpoint Policies](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-access.html)
- [plan/feature-vuejs-html-to-markdown-1.md](feature-vuejs-html-to-markdown-1.md) — html-to-md app that produces the raw Markdown files ingested by this pipeline

---

## 10. Data Engineering Review Recommendations (v1.2 — 2026-04-11)

> Review conducted by the `data-engineer` skill against data-pipeline best practices: correctness, idempotency, reliability, data contracts, observability, cost guardrails, and data-model efficiency. Items are prioritised; items marked **CRITICAL** are correctness or silent-data-loss bugs and should be fixed before deployment.

### High Priority — Correctness & Reliability

- **REC-001 (CRITICAL): Deterministic `article_id` for idempotency.** Replace `uuid4()` in the loader (TASK-019) with a deterministic hash of the source key, e.g. `hashlib.sha256(f"{source_bucket}/{source_key}".encode()).hexdigest()[:16]`. EventBridge/Lambda retries and manual re-processing will otherwise create duplicate DynamoDB rows and orphan clean S3 objects under the same logical article. A deterministic PK turns `PutItem` into a natural upsert and makes replays safe.

- **REC-002 (CRITICAL): Dead-Letter Queues + failure alarms.** Combined with TASK-022's `maximum_retry_attempts = 0`, any transient Bedrock throttle or downstream hiccup silently discards the event. Add:
  - `aws_sqs_queue.etl_dlq` with 14-day retention
  - `dead_letter_config { target_arn = ... }` on both Lambda functions
  - `DeadLetterConfig` on the EventBridge rule target
  - CloudWatch alarm on `ApproximateNumberOfMessagesVisible > 0` → SNS

- **REC-003 (CRITICAL): Fix Glue table serde (TASK-033).** `org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe` parses delimited text (CSV/TSV), not JSON. If the metadata source is sidecar JSON, use `org.openx.data.jsonserde.JsonSerDe` with `input_format = "org.apache.hadoop.mapred.TextInputFormat"`. Otherwise TEST-010 will fail at query time.

- **REC-004 (CRITICAL): Close the "companion metadata JSON" gap.** TASK-033 references a metadata JSON written alongside each `.md`, but TASK-018 doesn't produce one. Two options:
  1. **Loader writes a sidecar `.json`** next to each clean `.md` with the full DynamoDB item — simplest, but ties analytics files to object-per-doc.
  2. **Preferred: DynamoDB → S3 full export (PITR-based) on a daily schedule** to an `analytics/` prefix, then let Glue catalog that prefix. No loader change, no per-file JSON churn, Athena queries are cheap on DynamoDB export's native format. Well-suited to < 1K docs/month.
  3. **At higher volume: Kinesis Firehose → Parquet** with dynamic partitioning — loader publishes metadata to Firehose, Firehose buffers + converts + partitions by `year/month/day`. 10–100× cheaper to query than JSON. Has a small baseline cost, so not worth it at this volume.

- **REC-005: Glue table partition projection.** The clean bucket layout is `{year}/{month}/{filename}` (TASK-018), but the Glue table (TASK-033) has no partition declaration. Add `partition_keys = [{name="year",type="string"},{name="month",type="string"}]` **and** configure [partition projection](https://docs.aws.amazon.com/athena/latest/ug/partition-projection.html) via table properties (`projection.enabled=true`, `projection.year.type=integer`, `projection.year.range=2025,2099`, etc). This avoids running `MSCK REPAIR` or a Glue crawler on every new upload.

### High Priority — Cost & Security Guardrails

- **REC-006: Bedrock cost guardrails.** The current plan has no bound on how much a single document can cost.
  - Reject raw files > 200 KB early in the orchestrator with an explicit error routed to DLQ. A 2 MB file could consume > 500K input tokens (~$0.40/doc) and silently blow past REQ-007.
  - Pass `max_tokens = 4096` (or similar) when invoking the Agent/model to bound worst-case output cost.
  - Set **reserved concurrency = 5** on the orchestrator (`aws_lambda_function_event_invoke_config` is not enough — use `reserved_concurrent_executions`). A burst upload from html-to-md should not spike Bedrock spend or hit account throttle limits.
  - Add an **AWS Budget alarm** at 150% of the forecast Bedrock spend per month (Bedrock is the dominant variable cost).

- **REC-007: Pin Bedrock Agent alias to a specific prepared version.** `aws_bedrockagent_agent_alias` should reference a prepared agent version, not `DRAFT`, for reproducible behaviour across deploys and safe rollbacks. Document the "prepare agent → promote alias" step in the deploy runbook, and consider automating it via a `null_resource` with `local-exec` calling `aws bedrock-agent prepare-agent`.

- **REC-008: Reconsider Agent vs. direct `bedrock-runtime:InvokeModel`.** With `RETURN_CONTROL` and no action group executor (TASK-027), the Agent layer adds cold-start latency (RISK-002: 5–15s), extra IAM surface, extra Terraform, and an extra VPC Interface Endpoint — for a single-turn content-extraction call that `bedrock-runtime:InvokeModel` handles with fewer moving parts. Keep the Agent **only** if near-term plans include memory, tools, or multi-step reasoning. If the Agent is dropped: swap the Interface Endpoint from `bedrock-agent-runtime` to `bedrock-runtime`, update IAM from `bedrock:InvokeAgent` to `bedrock:InvokeModel`, and remove TASK-024 through TASK-028. Document the decision explicitly in ALT-004 either way.

- **REC-009: Enable S3 Object Lock (governance mode) on the clean bucket.** Protects published articles against accidental deletion or tampering. Compatible with versioning (already enabled by TASK-004). Must be set at bucket creation, so needs to be part of the initial Terraform apply.

- **REC-010: Amazon Macie sensitive-data scan on the clean bucket.** Web-scraped Markdown can contain emails, names, API tokens, or credentials. Configure a scheduled Macie job (`aws_macie2_classification_job`) over the clean bucket; alert via SNS on findings. Cost is trivial at this volume (~$1/GB scanned).

### Medium Priority — Data Model & Observability

- **REC-011: DynamoDB key model review.** Current schema is PK `article_id` + SK `created_at` (TASK-012). Since `article_id` is already unique per article, the sort key is unused — `GetItem` by `article_id` alone already returns exactly one row. Options:
  - **Simpler**: drop the SK; use a PK-only table with deterministic `article_id` (see REC-001).
  - **Versioned history**: keep composite, but make SK = `v#{version}` (e.g. `v#0001`, `v#0002`) so the same article can store multiple extractions as the Bedrock prompt evolves or source content changes. Most recent version is queried via `ScanIndexForward=false, Limit=1`.

- **REC-012: GSI projection type.** TASK-013 declares `status-created_at-index` but does not specify projection. Default is `KEYS_ONLY`, which forces a follow-up `GetItem` per article to render the blog list (N+1 pattern). Declare `projection_type = "INCLUDE"` with `non_key_attributes = ["title", "word_count", "s3_key", "source_url"]` so the list view is served entirely from the GSI in one query.

- **REC-013: Structured logging, metrics, and tracing with Lambda Powertools.** Adopt [`aws-lambda-powertools[tracer,metrics]`](https://docs.powertools.aws.dev/lambda/python/latest/) in both functions:
  - Structured JSON logs with a correlation ID (EventBridge `event.id`) propagated orchestrator → loader.
  - CloudWatch EMF custom metrics: `DocumentsIngested`, `BedrockLatencyMs`, `InputTokens`, `OutputTokens`, `DocumentBytes`, `ExtractionFailures`.
  - X-Ray subsegments around the Bedrock call, S3 write, and DynamoDB write.
  - Enable `tracing_config { mode = "Active" }` on both Lambda functions and provision an **X-Ray Interface VPC Endpoint** (adds ~$7.20/month — weigh against REC-008 savings if the Bedrock Agent endpoint is dropped).

- **REC-014: CloudWatch alarms.** Minimum alarm set:
  - Lambda `Errors > 0` over 5 min (both functions)
  - Lambda orchestrator duration p99 > 240s (approaching the 300s timeout)
  - `ApproximateNumberOfMessagesVisible > 0` on the DLQ (REC-002)
  - Bedrock throttling count (from Powertools custom metric) > 0
  - DynamoDB `UserErrors` / `SystemErrors` > 0
  - `ExtractionFailures` custom metric > 0

- **REC-015: Client-side Bedrock retry with full-jitter backoff.** Wrap the `InvokeAgent`/`InvokeModel` call in a retry loop (max 3 attempts) with full-jitter exponential backoff on `ThrottlingException` and `ServiceUnavailableException`. Boto3's standard retry mode helps but is not tuned for Bedrock throttling patterns. Do **not** rely on Lambda retries — TASK-022 disables them.

- **REC-016: Versioned data contract between orchestrator and loader.** Currently the orchestrator-to-loader payload is implicit. Define a versioned JSON schema and enforce it on both sides with `jsonschema`:
  ```json
  {
    "schema_version": "1.0",
    "source_bucket": "...",
    "source_key": "...",
    "content_sha256": "...",
    "clean_content": "...",
    "extraction_model": "anthropic.claude-haiku-3-5-v1:0",
    "extraction_ms": 4321,
    "input_tokens": 4123,
    "output_tokens": 1876
  }
  ```
  A contract break should fail loud (into the DLQ) instead of writing a malformed DynamoDB row.

### Low Priority — Polish

- **REC-017: Clean bucket lifecycle.** Add S3 Intelligent Tiering (or explicit IA after 30 days, Glacier Instant after 180 days) on the clean bucket. Cheap insurance as the corpus grows.

- **REC-018: Reduce loader timeout (TASK-021).** 60s for a single S3 `PutObject` + DynamoDB `PutItem` is excessive. 15s fails faster on silent hangs (e.g., a stuck VPC endpoint connection) and surfaces issues to the DLQ sooner.

- **REC-019: Decide pre-signed URL backend (TASK-042).** Recommend: **API Gateway HTTP API + Lambda authorizer + signer Lambda**, not direct AWS SDK from the SPA. Never expose AWS credentials to the browser. The signer Lambda can run **outside** the ETL VPC since it never touches S3 data — it only returns a SigV4 URL — which avoids adding another set of Interface Endpoints.

- **REC-020: VPC via community module.** Replace hand-rolled `vpc.tf` (TASK-054 through TASK-062) with [`terraform-aws-modules/vpc/aws ~> 5.0`](https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/latest). Battle-tested, keeps the tflint-required tags, and reduces maintenance burden. Pin the version explicitly per GUD convention.

- **REC-021: Unit tests for Lambda handlers.** Add `pytest` test modules under `lambda_src/orchestrator/tests/` and `lambda_src/loader/tests/` using [`moto`](https://docs.getmoto.org/) to mock S3/DynamoDB/Bedrock. Cover: happy path, oversized-input rejection (REC-006), Bedrock throttling retry (REC-015), idempotent re-processing (REC-001), contract-violation rejection (REC-016). Target 80% coverage per repo convention.

- **REC-022: Multi-AZ Interface Endpoints for production.** ALT-010 acknowledges single-AZ trade-off. Make it configurable: add variable `interface_endpoint_multi_az` (default `false` staging, `true` production) and use `subnet_ids = var.interface_endpoint_multi_az ? [subnet_a, subnet_b] : [subnet_a]`. Production outage of a single AZ should not break the pipeline.

- **REC-023: Raw bucket IA transition.** Add lifecycle rule: transition raw to One Zone-IA at 30 days before expiry at 90 days. Minor saving but good hygiene, and signals cost-awareness in the IaC.

### Summary Action List (suggested sequencing)

1. Fix correctness bugs before first apply: **REC-001, REC-002, REC-003, REC-004**.
2. Add cost guardrails before Bedrock is enabled in production: **REC-006, REC-007**.
3. Decide the Agent vs. InvokeModel question: **REC-008** (re-scopes several tasks).
4. Tighten the data model: **REC-011, REC-012**, plus data contract **REC-016**.
5. Build observability in from day one: **REC-013, REC-014, REC-015**.
6. Harden for production: **REC-009, REC-010, REC-022**.
7. Polish & test: **REC-017 through REC-021, REC-023**.
