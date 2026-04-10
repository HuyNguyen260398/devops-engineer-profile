---
goal: AWS Agentic ETL Pipeline — Markdown Content Extraction, Transformation & Blog Loading
version: 1.0
date_created: 2026-04-10
last_updated: 2026-04-10
owner: devops-engineer-profile / data-engineer
status: 'Planned'
tags: [data, infrastructure, etl, aws, bedrock, lambda, s3, terraform, agentic-ai, blog]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan describes a serverless, cost-optimized AWS ETL pipeline that ingests raw Markdown files (produced by the **html-to-md** app in the Vue.js Admin Dashboard), uses **Amazon Bedrock Agents + Claude** to extract clean main content, stores the clean Markdown in S3, persists article metadata in DynamoDB, and exposes the results to the **Blog** app inside the Vue.js Admin Dashboard. All AWS infrastructure is managed by Terraform located at `inf/terraform/aws-etl-pipeline/`.

## Pipeline Flow

```
[html-to-md app]
      │  upload .md file
      ▼
[S3 raw-bucket]
      │  PutObject event
      ▼
[EventBridge Rule]
      │  triggers
      ▼
[Lambda — etl-orchestrator]
      │  reads raw .md, calls Bedrock Agent
      ▼
[Amazon Bedrock Agent (Claude Haiku 3.5)]
      │  extracts main content, strips noise
      ▼
[Lambda — etl-loader]  ←─────────────────────────────┐
      │                                               │
      ├──► [S3 clean-bucket]  (clean .md file)        │
      │                                               │
      └──► [DynamoDB — article-metadata]              │
                 │                                    │
      [Athena]◄──┘  (serverless SQL analytics)        │
                                                      │
[Blog app] ─── list/search ──► [DynamoDB]             │
           ─── read content ──► [S3 clean-bucket] ────┘
```

---

## 1. Requirements & Constraints

- **REQ-001**: Pipeline must be fully event-driven — triggered automatically on S3 `PutObject` via EventBridge.
- **REQ-002**: The transformation stage **must** use Amazon Bedrock (Agentic AI) to filter and extract main content from raw Markdown.
- **REQ-003**: Clean Markdown must be written to a separate S3 clean bucket preserving the original filename.
- **REQ-004**: Article metadata (title, date, tags, word count, S3 key, status) must be stored in DynamoDB for the Blog app to list and search articles.
- **REQ-005**: All AWS resources must be provisioned with Terraform at `inf/terraform/aws-etl-pipeline/`.
- **REQ-006**: The Blog app in the Vue.js Admin Dashboard must be able to list articles via DynamoDB and fetch full Markdown via pre-signed S3 URLs.
- **REQ-007**: Total cost at < 100 documents/month must remain below **$5 USD/month**.
- **SEC-001**: All S3 buckets must block public access; content must be accessed via pre-signed URLs only.
- **SEC-002**: Lambda execution roles must follow the principle of least privilege.
- **SEC-003**: Bedrock Agent invocation must be authorized by a dedicated IAM role — never use overly broad permissions.
- **SEC-004**: DynamoDB must use AWS-managed encryption at rest.
- **CON-001**: No managed Kafka, Kinesis streams, or EMR — pipeline volume does not justify streaming infrastructure.
- **CON-002**: OpenSearch Serverless is excluded due to minimum 2 OCU cost (~$350/month); DynamoDB + Athena serve analytics needs instead.
- **CON-003**: Terraform state must use a remote backend (existing S3 + DynamoDB lock table pattern from the repo).
- **GUD-001**: Follow Terraform snake_case naming convention enforced by `.tflint.hcl` across existing projects.
- **GUD-002**: All resources must carry `Environment`, `Project`, `ManagedBy` tags per repo convention.
- **GUD-003**: Lambda functions must be packaged as ZIP archives referenced by Terraform.
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
| TASK-003 | Create `variables.tf` — declare: `aws_region` (default `ap-southeast-1`), `environment`, `project` (default `aws-etl-pipeline`), `raw_bucket_name`, `clean_bucket_name`, `bedrock_model_id` (default `anthropic.claude-haiku-3-5-v1:0`) | | |
| TASK-004 | Create `s3.tf` — `aws_s3_bucket.etl_raw`, `aws_s3_bucket.etl_clean`; both with `block_public_acls=true`, versioning enabled, SSE-S3 encryption, lifecycle rule to expire raw files after 90 days | | |
| TASK-005 | Add EventBridge notification config to raw bucket: enable `aws_s3_bucket_notification` with `eventbridge = true` so all `ObjectCreated` events are sent to the default EventBridge bus | | |
| TASK-006 | Create `outputs.tf` — export: raw bucket ARN/name, clean bucket ARN/name, Lambda ARN, DynamoDB table name | | |

### Implementation Phase 2 — IAM Roles & Policies

- GOAL-002: Define all IAM roles and inline/managed policies following least-privilege for Lambda, Bedrock Agent, and EventBridge.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | Create `iam.tf` — `aws_iam_role.lambda_etl_orchestrator` with trust policy for `lambda.amazonaws.com` | | |
| TASK-008 | Attach inline policy to orchestrator role: `s3:GetObject` on raw bucket, `bedrock:InvokeAgent`, `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` | | |
| TASK-009 | Create `aws_iam_role.lambda_etl_loader` with trust policy for `lambda.amazonaws.com` | | |
| TASK-010 | Attach inline policy to loader role: `s3:PutObject` on clean bucket, `dynamodb:PutItem` + `dynamodb:UpdateItem` on article table, `logs:*` | | |
| TASK-011 | Create `aws_iam_role.bedrock_agent_execution` with trust policy for `bedrock.amazonaws.com`, attach `bedrock:InvokeModel` on model ARN, `lambda:InvokeFunction` on loader Lambda | | |

### Implementation Phase 3 — DynamoDB Table (Analytics Store)

- GOAL-003: Provision a DynamoDB table in on-demand (PAY_PER_REQUEST) billing mode to store article metadata for the Blog app.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Create `dynamodb.tf` — `aws_dynamodb_table.article_metadata`: partition key `article_id` (String), sort key `created_at` (String) | | |
| TASK-013 | Add GSI `status-created_at-index` on `status` (hash) + `created_at` (range) so Blog app can query `status = PUBLISHED` | | |
| TASK-014 | Enable point-in-time recovery, SSE with AWS_OWNED_KMS, billing_mode `PAY_PER_REQUEST` | | |
| TASK-015 | Add TTL attribute `expires_at` (unused by default but present for future archival) | | |

### Implementation Phase 4 — Lambda Functions (Python 3.12)

- GOAL-004: Implement two Lambda functions: `etl-orchestrator` (reads raw MD, invokes Bedrock Agent) and `etl-loader` (receives clean content, writes to S3 + DynamoDB).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Create `inf/terraform/aws-etl-pipeline/lambda_src/orchestrator/handler.py` — reads S3 object from event, calls `bedrock-agent-runtime:InvokeAgent`, passes raw markdown as session input | | |
| TASK-017 | In `orchestrator/handler.py`: parse Bedrock Agent response stream, concatenate completion chunks, invoke `etl-loader` Lambda asynchronously with `{clean_content, source_key, source_bucket}` | | |
| TASK-018 | Create `inf/terraform/aws-etl-pipeline/lambda_src/loader/handler.py` — writes clean markdown to `s3://etl-clean-bucket/{year}/{month}/{filename}`, builds metadata dict, calls `dynamodb.put_item` | | |
| TASK-019 | DynamoDB item schema in loader: `article_id` (UUID), `created_at` (ISO8601), `title` (extracted from first H1 in clean MD), `s3_key` (clean bucket path), `word_count` (int), `status` (`PUBLISHED`), `source_url` (from original filename convention) | | |
| TASK-020 | Create `requirements.txt` for each Lambda (orchestrator: `boto3>=1.34`; loader: `boto3>=1.34`) — both use Lambda Python 3.12 runtime which includes boto3, so requirements files are for local dev reference only | | |
| TASK-021 | Create `lambda.tf` — two `aws_lambda_function` resources; use `archive_file` data source to ZIP each `lambda_src/*/` directory; set memory 256MB, timeout 300s for orchestrator (Bedrock calls can be slow), 60s for loader | | |
| TASK-022 | Add `aws_lambda_function_event_invoke_config` for orchestrator: `maximum_retry_attempts = 0` to prevent double-processing on failure | | |
| TASK-023 | Add CloudWatch Log Groups with 7-day retention for both Lambda functions | | |

### Implementation Phase 5 — Amazon Bedrock Agent

- GOAL-005: Create a Bedrock Agent configured to extract main blog content from Markdown, backed by Claude Haiku 3.5 for cost efficiency.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Create `bedrock.tf` — `aws_bedrockagent_agent` resource: `agent_name = "etl-content-extractor"`, `foundation_model = var.bedrock_model_id`, `idle_session_ttl_in_seconds = 600` | | |
| TASK-025 | Set agent `instruction` prompt: *"You are a content extraction specialist. When given raw Markdown scraped from a website, extract ONLY the main article body. Remove: navigation menus, comment sections, author bios, avatar images, related posts links, advertisement blocks, social share buttons, footer content, sidebar widgets. Return the cleaned content as valid Markdown preserving headings, code blocks, lists, and inline formatting. Do not add any explanation — return only the clean Markdown."* | | |
| TASK-026 | Create `aws_bedrockagent_agent_alias` with `alias_name = "live"` pointing to the agent version | | |
| TASK-027 | Create `aws_bedrockagent_agent_action_group` named `content-extraction` with executor type `RETURN_CONTROL` (no Lambda executor needed — agent returns content directly to orchestrator) | | |
| TASK-028 | Add `depends_on` on agent alias to ensure agent is prepared before alias creation; add `aws_bedrockagent_agent_action_group_association` | | |

### Implementation Phase 6 — EventBridge Rule (Trigger)

- GOAL-006: Wire S3 raw bucket uploads to the orchestrator Lambda via EventBridge with a scoped event pattern.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-029 | Create `eventbridge.tf` — `aws_cloudwatch_event_rule.s3_raw_upload` with event pattern: `{"source":["aws.s3"],"detail-type":["Object Created"],"detail":{"bucket":{"name":[var.raw_bucket_name]},"object":{"key":[{"suffix":".md"}]}}}` | | |
| TASK-030 | Create `aws_cloudwatch_event_target` pointing to `aws_lambda_function.etl_orchestrator.arn` | | |
| TASK-031 | Create `aws_lambda_permission` allowing `events.amazonaws.com` to invoke the orchestrator Lambda | | |

### Implementation Phase 7 — Athena (Analytics)

- GOAL-007: Enable serverless SQL analytics over the clean S3 bucket using Athena + Glue Data Catalog.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-032 | Create `athena.tf` — `aws_glue_catalog_database.etl_articles` | | |
| TASK-033 | Create `aws_glue_catalog_table.clean_articles` with `table_type = "EXTERNAL_TABLE"`, location pointing to clean S3 bucket prefix, `input_format = "org.apache.hadoop.mapred.TextInputFormat"`, serde `org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe`, columns: `article_id string`, `title string`, `word_count int`, `created_at string` (sourced from DynamoDB export or a companion metadata JSON written alongside each `.md` file) | | |
| TASK-034 | Create `aws_athena_workgroup.etl` with S3 output location set to a `/athena-results/` prefix in clean bucket, enforce result encryption | | |

### Implementation Phase 8 — Blog App Integration (Vue.js Admin Dashboard)

- GOAL-008: Add a Blog section to the Vue.js Admin Dashboard that lists articles from DynamoDB and renders clean Markdown fetched via pre-signed S3 URLs.

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

### Implementation Phase 9 — Terraform Variables & Environments

- GOAL-009: Finalize Terraform variable files for staging and production environments.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-043 | Create `inf/terraform/aws-etl-pipeline/environments/staging/terraform.tfvars` with staging bucket names and region | | |
| TASK-044 | Create `inf/terraform/aws-etl-pipeline/environments/staging/backend.hcl` pointing to existing S3 state bucket | | |
| TASK-045 | Create `inf/terraform/aws-etl-pipeline/environments/production/terraform.tfvars` | | |
| TASK-046 | Create `inf/terraform/aws-etl-pipeline/environments/production/backend.hcl` | | |
| TASK-047 | Add `.tflint.hcl` file at `inf/terraform/aws-etl-pipeline/` following the same rules as existing projects (snake_case, required tags, pinned module versions) | | |

### Implementation Phase 10 — Validation & Cost Verification

- GOAL-010: Validate the full pipeline end-to-end and confirm monthly cost estimates.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-048 | Run `terraform init && terraform validate && terraform plan` for staging environment — confirm zero errors | | |
| TASK-049 | Deploy to staging, upload a sample `.md` file, verify EventBridge fires, orchestrator Lambda executes, Bedrock Agent returns clean content | | |
| TASK-050 | Verify clean `.md` file appears in clean S3 bucket and DynamoDB record is created with correct metadata | | |
| TASK-051 | Open Blog app in Vue.js Dashboard, confirm article appears in list and full Markdown renders correctly | | |
| TASK-052 | Run Athena query `SELECT title, word_count, created_at FROM etl_articles.clean_articles LIMIT 10` — confirm results | | |
| TASK-053 | Document actual cost after 1 month in staging and compare to estimates below | | |

---

## 3. Alternatives

- **ALT-001: OpenSearch Serverless for analytics** — Rejected. Minimum 2 OCU = ~$350/month. Vastly exceeds the $5/month target for < 100 documents.
- **ALT-002: Amazon Kendra for intelligent search** — Rejected. Developer Edition costs $810/month minimum. Grossly over-engineered for this volume.
- **ALT-003: Amazon S3 event notifications → SNS/SQS → Lambda** — Rejected in favor of EventBridge. EventBridge provides richer filtering (suffix `.md`), easier rule management, and native audit logging via CloudTrail.
- **ALT-004: Bedrock InvokeModel directly (no Agent)** — Valid but rejected in favor of Bedrock Agents per requirement. Agents provide conversation state, retry logic, and future extensibility (e.g., adding memory or multi-step reasoning). Cost difference is negligible.
- **ALT-005: AWS Glue for ETL transformation** — Rejected. Glue has a 10-minute minimum billing unit ($0.44/DPU-hour). For sub-second markdown processing, Lambda is 100× cheaper.
- **ALT-006: Amazon RDS (PostgreSQL) for metadata** — Rejected. Requires always-on instance ($15+/month minimum). DynamoDB on-demand is free at this volume (within free tier).
- **ALT-007: API Gateway + Lambda for pre-signed URL generation** — Valid alternative to direct SDK calls from the frontend. Preferred for production to avoid exposing AWS credentials to the browser.

---

## 4. Dependencies

- **DEP-001**: Amazon Bedrock must have **model access enabled** for `anthropic.claude-haiku-3-5-v1:0` in `ap-southeast-1`. This must be requested manually in the AWS Console → Bedrock → Model access before Terraform apply.
- **DEP-002**: Existing S3 Terraform state bucket and DynamoDB lock table (used by other projects in this repo) must be accessible for backend configuration.
- **DEP-003**: `marked` npm package (`^13.0.0`) must be added to `src/vuejs-admin-dashboard/package.json` for Markdown rendering in the Blog app.
- **DEP-004**: `dompurify` npm package must be added for XSS sanitization of rendered HTML.
- **DEP-005**: AWS CLI configured with credentials that have permissions to create Bedrock agents, Lambda functions, DynamoDB tables, S3 buckets, and EventBridge rules.
- **DEP-006**: Python 3.12 runtime available in target AWS region for Lambda functions.
- **DEP-007**: Terraform `>= 1.7.0` installed locally (required for `archive_file` data source behavior).

---

## 5. Files

### Terraform Files (`inf/terraform/aws-etl-pipeline/`)

- **FILE-001**: `main.tf` — Provider config (`hashicorp/aws ~> 5.0`), backend S3 config, required_version
- **FILE-002**: `variables.tf` — All input variable declarations with descriptions and defaults
- **FILE-003**: `outputs.tf` — Raw bucket name/ARN, clean bucket name/ARN, orchestrator Lambda ARN, DynamoDB table name, Bedrock Agent ID/alias ARN
- **FILE-004**: `s3.tf` — Raw bucket, clean bucket, bucket policies, versioning, encryption, lifecycle, EventBridge notification
- **FILE-005**: `iam.tf` — Lambda orchestrator role, Lambda loader role, Bedrock agent execution role, all inline policies
- **FILE-006**: `lambda.tf` — `etl-orchestrator` Lambda, `etl-loader` Lambda, CloudWatch log groups, archive_file data sources
- **FILE-007**: `eventbridge.tf` — EventBridge rule, target, Lambda permission
- **FILE-008**: `bedrock.tf` — Bedrock Agent, Agent alias, Action Group
- **FILE-009**: `dynamodb.tf` — `article-metadata` table, GSI, TTL, PITR
- **FILE-010**: `athena.tf` — Glue database, Glue table, Athena workgroup
- **FILE-011**: `lambda_src/orchestrator/handler.py` — Orchestrator Lambda source code
- **FILE-012**: `lambda_src/loader/handler.py` — Loader Lambda source code
- **FILE-013**: `environments/staging/terraform.tfvars` — Staging environment variable values
- **FILE-014**: `environments/staging/backend.hcl` — Staging state backend config
- **FILE-015**: `environments/production/terraform.tfvars` — Production variable values
- **FILE-016**: `environments/production/backend.hcl` — Production state backend config
- **FILE-017**: `.tflint.hcl` — TFLint rules matching existing repo conventions

### Vue.js Admin Dashboard Files (`src/vuejs-admin-dashboard/`)

- **FILE-018**: `src/composables/useBlogPosts.js` — DynamoDB article list composable
- **FILE-019**: `src/composables/useBlogPost.js` — Single article fetch composable (pre-signed URL)
- **FILE-020**: `src/views/blog/BlogListView.vue` — Blog list page
- **FILE-021**: `src/views/blog/BlogPostView.vue` — Blog post detail page
- **FILE-022**: `src/components/blog/ArticleCard.vue` — Article card component
- **FILE-023**: `src/router/index.js` — Updated with `/blog` and `/blog/:id` routes

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

---

## 7. Cost Analysis (< 100 documents/month)

### Monthly Cost Breakdown

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
| **TOTAL** | | **~$1.20 – $2.00/month** |

### Cost Scaling

| Volume | Estimated Cost |
|--------|--------------|
| < 100 docs/month | ~$1.20 – $2.00 |
| 500 docs/month | ~$6.00 – $10.00 |
| 1,000 docs/month | ~$12.00 – $20.00 |

> **Primary cost driver**: Amazon Bedrock token usage. Switch to Claude Haiku 3 (cheaper) if cost reduction needed, or batch multiple transformations per Bedrock call.

---

## 8. Risks & Assumptions

- **RISK-001**: Bedrock model access (`claude-haiku-3-5-v1:0`) may not be available in `ap-southeast-1`. **Mitigation**: Check availability first; fall back to `us-east-1` and configure VPC or cross-region invocation.
- **RISK-002**: Bedrock Agent cold start adds 5–15s latency. Acceptable for async pipeline; users are not blocked.
- **RISK-003**: Large Markdown files (>100KB) may hit Lambda timeout (300s) if Bedrock streaming is slow. **Mitigation**: Chunk large files before Agent invocation.
- **RISK-004**: Bedrock Agent Terraform resource (`aws_bedrockagent_agent`) requires AWS provider `>= 5.35.0`. Verify provider version before apply.
- **RISK-005**: Glue Crawler not used (manual table definition) — schema changes in metadata JSON require manual Glue table update.
- **ASSUMPTION-001**: The html-to-md app produces `.md` files with a filename convention of `{sanitized-domain}_{timestamp}.md` which the loader uses to derive `source_url`.
- **ASSUMPTION-002**: The Vue.js Admin Dashboard frontend has access to DynamoDB (via Amplify SDK or backend API). If direct SDK access is not feasible, a Lambda + API Gateway endpoint will be added.
- **ASSUMPTION-003**: Terraform state bucket and DynamoDB lock table already exist (created by bootstrap as per other projects in the repo).
- **ASSUMPTION-004**: `ap-southeast-1` is the target region for all resources.

---

## 9. Related Specifications / Further Reading

- [Amazon Bedrock Agents Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [AWS EventBridge S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html)
- [Terraform AWS Bedrock Agent Resource](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/bedrockagent_agent)
- [DynamoDB On-Demand Pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/)
- [Amazon Athena Pricing](https://aws.amazon.com/athena/pricing/)
- [plan/feature-vuejs-html-to-markdown-1.md](feature-vuejs-html-to-markdown-1.md) — html-to-md app that produces the raw Markdown files ingested by this pipeline
