# AWS Agentic ETL Pipeline

A serverless, cost-optimized ETL pipeline on AWS that ingests raw Markdown files, uses **Amazon Bedrock** (Claude Haiku 3.5) to extract clean article content, and makes the results available to a Blog application via DynamoDB and S3 pre-signed URLs.

All compute runs inside a **dedicated VPC with private subnets**. No NAT Gateway — all AWS service traffic stays on the AWS backbone via VPC Endpoints.

---

## Architecture

```
[html-to-md app]
      │  upload .md file
      ▼
[S3 raw-bucket]          ◄── bucket policy: sourceVpce only
      │  ObjectCreated event
      ▼
[EventBridge Rule]       (.md suffix filter)
      │
      ▼
[Lambda — orchestrator]  ◄── VPC private subnet
      │  reads raw .md via S3 Gateway Endpoint
      │  validates file size (≤ 200 KB)
      │  calls Bedrock Agent via Interface Endpoint
      ▼
[Bedrock Agent (Claude Haiku 3.5)]
      │  extracts main article body, strips nav/ads/comments
      ▼
[Lambda — loader]        ◄── VPC private subnet (async)
      │
      ├──► [S3 clean-bucket]              {year}/{month}/{filename}.md
      ├──► [S3 clean-bucket/metadata/]   {year}/{month}/{article_id}.json  (for Athena)
      └──► [DynamoDB — article-metadata] (idempotent PutItem, sha256-derived PK)
                 │
      [Athena + Glue] ◄── serverless SQL analytics over metadata JSON
      [Blog app] ──► DynamoDB (list) + S3 pre-signed URL (read content)

VPC Network:
  Private Subnet A (ap-southeast-1a) ─── Lambda execution
  Private Subnet B (ap-southeast-1b) ─── Lambda HA failover
  S3 Gateway Endpoint                ─── free, no AZ constraint
  DynamoDB Gateway Endpoint          ─── free, no AZ constraint
  Interface Endpoint: bedrock-agent-runtime
  Interface Endpoint: logs (CloudWatch)
  Interface Endpoint: lambda
  VPC Flow Logs ──► CloudWatch (14-day retention)
```

## Features

- **Fully event-driven** — S3 upload triggers the entire pipeline via EventBridge; zero polling
- **Agentic AI extraction** — Bedrock Agent with Claude Haiku 3.5 strips navigation, ads, comments, and boilerplate from raw web-scraped Markdown
- **Idempotent by design** — `article_id` is a deterministic `sha256` hash of the source path; replaying the same file is always safe
- **Cost-guarded** — 200 KB input cap, reserved concurrency limit on the orchestrator, and an AWS Budget alarm prevent runaway Bedrock spend
- **No NAT Gateway** — all outbound traffic routes through VPC Endpoints, saving ~$32/month vs. NAT while keeping Lambda off the public internet
- **Dead-letter queues on every hop** — EventBridge target DLQ, orchestrator DLQ, and loader DLQ ensure no event is silently lost
- **Serverless analytics** — Athena queries metadata JSON sidecars via a Glue table with partition projection; no `MSCK REPAIR` needed on new uploads
- **Multi-environment** — staging and production have separate state backends, CIDR blocks, and endpoint HA settings

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Terraform | `>= 1.7` |
| AWS CLI | any recent version |
| Python | `3.12` (for local testing) |
| AWS provider | `~> 5.35` (auto-installed) |

You also need:

- An existing **S3 bucket + DynamoDB lock table** for Terraform remote state
- **Bedrock model access** enabled for `anthropic.claude-haiku-3-5-v1:0` in your target region (AWS Console → Amazon Bedrock → Model access)
- IAM permissions to create VPC, Lambda, S3, DynamoDB, Bedrock Agent, EventBridge, SQS, CloudWatch, Glue, and Athena resources

> [!IMPORTANT]
> Before applying, verify the VPC CIDR does not overlap with existing VPCs in your account:
> ```bash
> aws ec2 describe-vpcs --query 'Vpcs[*].CidrBlock'
> ```
> And confirm `bedrock-agent-runtime` Interface Endpoint availability in your region:
> ```bash
> aws ec2 describe-vpc-endpoint-services \
>   --filters Name=service-name,Values=com.amazonaws.ap-southeast-1.bedrock-agent-runtime
> ```

## Getting Started

**1. Clone and navigate**

```bash
cd inf/terraform/aws-etl-pipeline
```

**2. Configure your environment**

```bash
cp environments/staging/terraform.tfvars.example environments/staging/terraform.tfvars
```

Edit `terraform.tfvars` and set your bucket names and state backend values. Bucket names must be globally unique.

**3. Update the state backend**

Edit `environments/staging/backend.hcl` to point to your existing Terraform state S3 bucket and DynamoDB lock table.

**4. Initialise and deploy**

```bash
terraform init -backend-config=environments/staging/backend.hcl
terraform plan  -var-file=environments/staging/terraform.tfvars
terraform apply -var-file=environments/staging/terraform.tfvars
```

**5. Smoke test the pipeline**

```bash
# Upload a raw .md file (must be done from inside the VPC due to bucket policy)
aws s3 cp my-article.md s3://<raw-bucket-name>/

# Watch EventBridge trigger the orchestrator (allow ~30s for Bedrock)
aws logs tail /aws/lambda/<env>-aws-etl-pipeline-orchestrator --follow

# Confirm the clean file and DynamoDB record were created
aws s3 ls s3://<clean-bucket-name>/ --recursive
aws dynamodb scan --table-name <env>-aws-etl-pipeline-article-metadata
```

> [!TIP]
> The raw bucket's `aws:sourceVpce` policy blocks direct `aws s3 cp` from a developer laptop. Use AWS Systems Manager Session Manager on an EC2 in the private subnet, or temporarily relax the bucket policy for initial testing.

## Configuration

All variables are declared in `variables.tf`. Copy the relevant `.tfvars.example` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `ap-southeast-1` | AWS region for all resources |
| `environment` | — | `staging` or `production` |
| `project` | `aws-etl-pipeline` | Used as a resource name prefix |
| `raw_bucket_name` | — | S3 bucket receiving raw `.md` uploads |
| `clean_bucket_name` | — | S3 bucket for extracted content + metadata |
| `bedrock_model_id` | `anthropic.claude-haiku-3-5-v1:0` | Foundation model for the Bedrock Agent |
| `vpc_cidr` | `10.10.0.0/24` | CIDR for the ETL VPC |
| `private_subnet_cidrs` | `["10.10.0.0/26","10.10.0.64/26"]` | CIDRs for the two private subnets |
| `availability_zones` | `["ap-southeast-1a","ap-southeast-1b"]` | AZs for the private subnets |
| `orchestrator_timeout_seconds` | `300` | Lambda timeout for the orchestrator |
| `loader_timeout_seconds` | `15` | Lambda timeout for the loader |
| `orchestrator_reserved_concurrency` | `5` | Caps simultaneous Bedrock calls |
| `interface_endpoint_multi_az` | `false` | `true` in production for HA endpoints |

## Project Structure

```
aws-etl-pipeline/
├── main.tf                  # Terraform config, provider, backend
├── variables.tf             # All input variables
├── locals.tf                # Common tags and name prefix
├── outputs.tf               # Resource IDs exported after apply
├── s3.tf                    # Raw + clean S3 buckets, lifecycle rules, bucket policy
├── vpc.tf                   # VPC, private subnets, security groups, VPC endpoints, flow logs
├── iam.tf                   # IAM roles, inline policies, VPC endpoint policies
├── dynamodb.tf              # article-metadata table with GSI (INCLUDE projection)
├── lambda.tf                # Orchestrator + Loader Lambdas, DLQs, CloudWatch alarms
├── bedrock.tf               # Bedrock Agent, alias
├── eventbridge.tf           # EventBridge rule, target, Lambda permission
├── athena.tf                # Glue database/table (JsonSerDe + partition projection), Athena workgroup
├── .tflint.hcl              # TFLint rules (AWS ruleset v0.45.0)
├── environments/
│   ├── staging/
│   │   ├── backend.hcl
│   │   └── terraform.tfvars.example
│   └── production/
│       ├── backend.hcl
│       └── terraform.tfvars.example
└── lambda_src/
    ├── orchestrator/
    │   ├── handler.py       # S3 read → Bedrock Agent → invoke loader
    │   ├── requirements.txt
    │   └── tests/
    │       └── test_handler.py
    └── loader/
        ├── handler.py       # Write clean .md, metadata JSON sidecar, DynamoDB item
        ├── requirements.txt
        └── tests/
            └── test_handler.py
```

## Security Design

| Control | Implementation |
|---------|---------------|
| No public IPs | Lambda runs in private subnets with no IGW or NAT |
| Network perimeter | All egress TCP 443 restricted to VPC Endpoint security group |
| Raw bucket isolation | `aws:sourceVpce` bucket policy denies `GetObject`/`PutObject` outside the VPC |
| Content access | Clean bucket served via SigV4 pre-signed URLs only; no public access |
| Least privilege | Separate IAM roles per function; inline policies scoped to exact resources |
| Encryption at rest | SSE-S3 on both buckets; DynamoDB with AWS-owned KMS key |
| Network audit | VPC Flow Logs delivered to CloudWatch (14-day retention) |
| Failure capture | SQS DLQs on EventBridge target, orchestrator Lambda, and loader Lambda |

## Cost Estimate

Costs at less than 100 documents/month (ap-southeast-1):

| Category | Monthly Cost |
|----------|-------------|
| Pipeline compute (Lambda, S3, EventBridge, DynamoDB, Athena) | ~$1.20 – $2.00 |
| Bedrock token usage (primary variable) | ~$1.20 |
| VPC Interface Endpoints (3 × single-AZ) | ~$21.60 |
| **Total** | **~$23 – $24/month** |

The VPC overhead is fixed regardless of volume. Pipeline cost scales roughly linearly with document count. Bedrock token usage is the main variable cost driver.

> [!NOTE]
> For development or cost-sensitive staging where network isolation is less critical, you can disable VPC attachment (`vpc_config = []` on the Lambda resources) and remove the three Interface Endpoints, saving ~$21.60/month.

## Lambda Handlers

### Orchestrator (`lambda_src/orchestrator/handler.py`)

1. Parses the EventBridge `Object Created` event
2. Validates file size — rejects files over 200 KB to prevent cost runaway
3. Reads the raw Markdown from the raw S3 bucket
4. Calls the Bedrock Agent with full-jitter exponential backoff on throttling (max 3 retries)
5. Invokes the loader Lambda asynchronously with a versioned JSON payload

### Loader (`lambda_src/loader/handler.py`)

1. Validates the payload `schema_version` — fails loud on contract mismatches
2. Derives a deterministic `article_id` from `sha256(source_bucket/source_key)[:16]`
3. Writes the clean Markdown to `s3://clean-bucket/{year}/{month}/{filename}.md`
4. Writes a metadata JSON sidecar to `s3://clean-bucket/metadata/{year}/{month}/{article_id}.json`
5. Upserts the DynamoDB item (idempotent — same source always produces the same PK)

## Running Tests

```bash
cd lambda_src

# Install test dependencies
pip install boto3 moto pytest

# Run all tests
pytest orchestrator/tests/ loader/tests/ -v

# Run with coverage
pytest orchestrator/tests/ loader/tests/ --cov=orchestrator --cov=loader --cov-report=term-missing
```

Tests cover: happy path, file size guard, Bedrock throttle retry, idempotent re-processing, schema contract validation, and helper function edge cases.

## Outputs

After a successful `terraform apply`:

| Output | Description |
|--------|-------------|
| `raw_bucket_name` | S3 bucket to upload raw `.md` files to |
| `clean_bucket_name` | S3 bucket containing extracted articles |
| `dynamodb_table_name` | DynamoDB table for the Blog app |
| `bedrock_agent_id` | Bedrock Agent ID |
| `bedrock_agent_alias_id` | Agent alias ID (`live`) |
| `orchestrator_lambda_arn` | ETL orchestrator ARN |
| `loader_lambda_arn` | ETL loader ARN |
| `orchestrator_dlq_url` | SQS DLQ for orchestrator failures |
| `loader_dlq_url` | SQS DLQ for loader failures |
| `vpc_id` | ETL VPC ID |
| `private_subnet_ids` | Private subnet IDs (two AZs) |

## Promoting the Bedrock Agent to Production

The Bedrock Agent alias defaults to `DRAFT`. For a stable, immutable production version:

```bash
# Create a numbered agent version
aws bedrock-agent create-agent-version \
  --agent-id <bedrock_agent_id from outputs>

# Update routing_configuration in bedrock.tf to reference the version number
# then re-apply
terraform apply -var-file=environments/production/terraform.tfvars
```

## Verifying VPC Isolation

After deploying, confirm no Lambda ENIs have public IPs:

```bash
aws ec2 describe-network-interfaces \
  --filters Name=description,Values="AWS Lambda VPC ENI*" \
            Name=vpc-id,Values=<vpc_id> \
  --query 'NetworkInterfaces[*].Association.PublicIp'
# Expected: [] (empty — no public IPs)
```

Query VPC Flow Logs to confirm all accepted flows target VPC Endpoint IPs:

```
fields srcAddr, dstAddr, action
| filter action = "ACCEPT"
| stats count(*) by dstAddr
```

All destination IPs should be private addresses within the VPC CIDR.
