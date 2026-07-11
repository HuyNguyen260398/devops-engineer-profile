# Serverless Blog at `nghuy.link/blogs` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Revision (2026-07-11): path-based routing.** The blog was moved off the
> dedicated `blogs.nghuy.link` subdomain to a **path under the apex domain**. The
> `aws-blog-serverless` CloudFront distribution now owns `nghuy.link` itself and
> serves the whole app same-origin: portfolio home at `/`, blog under `/blogs`,
> API at `/api/*`, images at `/media/*`. The frontend lives in the existing
> `src/aws-s3-web/` Next app (and ships via `aws-s3-web-sync-prod.yml` to the
> existing `s3.nghuy.link` website bucket); the Lambda backend lives in
> `src/aws-s3-web/backend/`. Final routes:
>
> | Path | Access | Purpose |
> |------|--------|---------|
> | `/blogs` | public | list published posts |
> | `/blogs/<slug>` | public | post detail |
> | `/login` | public | Cognito sign-in (auth entry) |
> | `/blogs-draft` | private | list draft posts |
> | `/blogs/editor` | private | create a post |
> | `/blogs/editor/<slug>` | private | edit a post |
>
> Private routes are gated client-side (redirect to `/login`); real enforcement is
> the API Gateway Cognito authorizer on writes and draft reads. Sections below that
> predate this revision (references to `blogs.nghuy.link`, `/admin`, a dedicated
> site bucket, or `src/blog-backend/`) are superseded by this note.

**Goal:** Ship a dynamic, self-managed blog at `nghuy.link/blogs` — public read, single-admin write — on a VPC-attached AWS serverless stack (Cognito → CloudFront → S3/API Gateway → Lambda → DynamoDB + S3), with a Confluence-style TipTap editor, all provisioned in Terraform.

**Architecture:** A single CloudFront distribution owns the apex `nghuy.link` and fronts a Next.js static-export app (the terminal-themed portfolio in `src/aws-s3-web/`, which also contains the blog UI) and, same-origin under `/api/*`, an API Gateway REST API with a Cognito authorizer on write methods. A single Node 20 Lambda (attached to VPC private subnets) performs CRUD; post metadata lives in DynamoDB, post bodies (ProseMirror JSON) and images live in an S3 media bucket. Lambda reaches AWS services through VPC endpoints (DynamoDB + S3 gateway, CloudWatch Logs interface) — no NAT Gateway. The site origin is the existing `s3.nghuy.link` website bucket (built + synced by `aws-s3-web-sync-prod.yml`); a viewer-request CloudFront Function maps clean routes onto the flat static-export layout.

**Tech Stack:** Terraform (AWS provider ~> 5.0), AWS Lambda (Node.js 20 + TypeScript, AWS SDK v3), API Gateway REST, Cognito, DynamoDB (on-demand), S3, CloudFront + OAC + CloudFront Functions, ACM (us-east-1), Route53; Next.js 16 App Router static export, Tailwind 4, TipTap (ProseMirror), AWS Amplify v6 auth; GitHub Actions + OIDC; Vitest + Playwright.

## Global Constraints

- Terraform: all resources/variables/outputs/modules/data sources use `snake_case`.
- Terraform: every AWS resource carries required tags `Environment`, `Project`, `ManagedBy`.
- Terraform: all variables and outputs have `description` and `type`; all modules pin a version; AWS provider pinned `~> 5.0`; `required_version >= 1.6`.
- New Terraform root: `inf/terraform/aws-blog-serverless/` with its own remote state (own backend key).
- Frontend must be a static export (`output: "export"`) — no server runtime, no Next API routes, no `next/image` optimization (already `unoptimized: true`).
- Frontend blog code lives inside the existing `src/aws-s3-web/` project and reuses its terminal theme, `globals.css` tokens, `theme-toggle`, and shared components.
- Backend runs in the VPC; no NAT Gateway — outbound only via VPC endpoints.
- Cognito self-signup is disabled; a single admin user is provisioned in Terraform.
- Same-origin API (CloudFront `/api/*`) — no CORS in the browser path. (CORS still configured on API Gateway only as defense-in-depth for direct calls.)
- CI/CD authenticates via GitHub OIDC → IAM role; no long-lived AWS credentials.
- ACM certificate for CloudFront MUST be in `us-east-1`.
- Domain: apex `nghuy.link` served under a path (`/blogs`); Route53 hosted zone already exists (reference by `route53_zone_id`). The `aws-blog-serverless` CloudFront distribution takes over the apex A/AAAA records, retiring the prior out-of-band distribution (`E3MGWTP58YX35G`). The site origin is the existing `s3.nghuy.link` website bucket (owned by the `aws-s3-web` stack), referenced via a data source — this stack does not create a site bucket.
- Region for the stack: `ap-southeast-1` (matches repo default) except the CloudFront ACM cert which is `us-east-1`.

---

## File Structure

**Terraform — `inf/terraform/aws-blog-serverless/`**
- `provider.tf` — terraform block, AWS providers (default `ap-southeast-1` + aliased `us_east_1`), backend.
- `variables.tf` — all inputs (region, domain, zone id, admin email, bucket names, tags source).
- `locals.tf` — common tags, name prefix, derived domain.
- `network.tf` — VPC, private subnets, route tables, security groups, VPC endpoints.
- `data.tf` — DynamoDB table + GSIs.
- `storage.tf` — S3 **media** bucket only (versioning, encryption, public-access block); the site bucket is external (`s3.nghuy.link`) and referenced via a data source in `cdn.tf`.
- `cognito.tf` — user pool, app client, admin user.
- `lambda.tf` — Lambda function, IAM role/policies, log group.
- `api.tf` — API Gateway REST API, resources, methods, integrations, authorizer, stage.
- `cdn.tf` — ACM cert (us-east-1, apex `nghuy.link`) + validation, CloudFront Functions, CloudFront distribution (apex), Route53 records, media bucket policy; site origin = existing `s3.nghuy.link` website bucket (custom origin).
- `outputs.tf` — cognito ids, api id, distribution id/domain.
- `terraform.tfvars.example` — sample values.
- `README.md` — stack usage.

**Backend — `src/aws-s3-web/backend/`** (co-located with the frontend app)
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `esbuild.config.mjs`.
- `src/handler.ts` — Lambda entry + router.
- `src/lib/response.ts` — HTTP response helpers.
- `src/lib/repository.ts` — DynamoDB + S3 data access.
- `src/lib/validation.ts` — input validation + slug helpers.
- `src/lib/types.ts` — shared types.
- `test/*.test.ts` — unit tests.
- `local/` — in-memory dev harness for the Lambda handler.

**Frontend — inside `src/aws-s3-web/`**
- `src/app/page.tsx` — portfolio home (apex `/`).
- `src/app/blogs/page.tsx` — published list; `src/app/blogs/[slug]/page.tsx` — detail (`_` shell).
- `src/app/blogs-draft/page.tsx` — private draft list (auth-guarded).
- `src/app/blogs/editor/page.tsx` — create; `src/app/blogs/editor/[slug]/page.tsx` — edit (`_` shell).
- `src/app/login/page.tsx` — Cognito sign-in.
- `src/lib/blog/api.ts` — typed fetch client (same-origin `/api`).
- `src/lib/blog/auth.ts` — Amplify config + session helpers (+ local dev-auth bypass).
- `src/components/blog/*` — post-card, post-view, blog-shell, editor (TipTap), editor-toolbar, auth-guard.
- `src/lib/blog/*.test.ts`, `src/components/blog/*.test.tsx`.

**CI/CD**
- `.github/workflows/blog-deploy.yml` — backend/infra only: build Lambda bundle + `terraform apply` on `main`; reports outputs to wire as repo variables.
- `.github/workflows/aws-s3-web-sync-prod.yml` — builds the static export (with Cognito config) and syncs it to `s3.nghuy.link`, then invalidates the apex distribution.
- `.github/workflows/blog-ci.yml` — backend/frontend lint+test on PR (Terraform plan handled by existing `terraform-plan.yml` matrix).

---

## Phase 1 — Terraform: project skeleton & networking

### Task 1: Terraform root skeleton (provider, variables, locals)

**Files:**
- Create: `inf/terraform/aws-blog-serverless/provider.tf`
- Create: `inf/terraform/aws-blog-serverless/variables.tf`
- Create: `inf/terraform/aws-blog-serverless/locals.tf`
- Create: `inf/terraform/aws-blog-serverless/terraform.tfvars.example`

**Interfaces:**
- Produces: `local.common_tags`, `local.name_prefix` (`"blog"`), `local.domain` (`= var.root_domain`, the apex `nghuy.link`), providers `aws` (default) and `aws.us_east_1`.

- [ ] **Step 1: Write `provider.tf`**

```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {} # configured via -backend-config in CI
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

- [ ] **Step 2: Write `variables.tf`** (every var typed + described)

```hcl
variable "aws_region" {
  description = "Primary AWS region for the blog stack."
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name (staging or production)."
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name for naming and tagging."
  type        = string
  default     = "devops-engineer-profile"
}

variable "root_domain" {
  description = "Apex domain that owns the Route53 hosted zone, e.g. nghuy.link."
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for root_domain."
  type        = string
}

variable "site_bucket_name" {
  description = "Name of the existing S3 website bucket serving the app (e.g. s3.nghuy.link); referenced as a CloudFront custom origin, not created here."
  type        = string
}

variable "media_bucket_name" {
  description = "Globally-unique S3 bucket name for post bodies and images."
  type        = string
}

variable "admin_email" {
  description = "Email of the single admin user seeded in Cognito."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the blog VPC."
  type        = string
  default     = "10.42.0.0/16"
}
```

- [ ] **Step 3: Write `locals.tf`**

```hcl
locals {
  name_prefix = "blog"
  domain      = var.root_domain # apex; blog served under /blogs path

  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
```

- [ ] **Step 4: Write `terraform.tfvars.example`**

```hcl
aws_region        = "ap-southeast-1"
environment       = "production"
root_domain       = "nghuy.link"
route53_zone_id   = "Z0000000000000000000"
site_bucket_name  = "s3.nghuy.link" # existing website bucket (aws-s3-web stack)
media_bucket_name = "blogs-nghuy-link-media-<account-id>"
admin_email       = "huynguyen260398@gmail.com"
```

- [ ] **Step 5: Validate**

Run: `cd inf/terraform/aws-blog-serverless && terraform init -backend=false && terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 6: Commit**

```bash
git add inf/terraform/aws-blog-serverless/
git commit -m "feat(blog-infra): terraform root skeleton for blogs stack"
```

### Task 2: VPC, private subnets, and VPC endpoints (no NAT)

**Files:**
- Create: `inf/terraform/aws-blog-serverless/network.tf`

**Interfaces:**
- Produces: `aws_subnet.private[*].id`, `aws_security_group.lambda.id`, gateway endpoints for DynamoDB + S3 attached to the private route table, interface endpoint for `logs`.

- [ ] **Step 1: Write `network.tf`**

```hcl
data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.common_tags, { Name = "${local.name_prefix}-vpc" })
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags              = merge(local.common_tags, { Name = "${local.name_prefix}-private-${count.index}" })
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "${local.name_prefix}-private-rt" })
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "lambda" {
  name        = "${local.name_prefix}-lambda-sg"
  description = "Egress for blog Lambda to VPC endpoints"
  vpc_id      = aws_vpc.main.id
  egress {
    description = "All egress (constrained to endpoints by routing)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-lambda-sg" })
}

resource "aws_security_group" "endpoints" {
  name        = "${local.name_prefix}-endpoints-sg"
  description = "Allow HTTPS from Lambda SG to interface endpoints"
  vpc_id      = aws_vpc.main.id
  ingress {
    description     = "HTTPS from Lambda"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-endpoints-sg" })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags              = merge(local.common_tags, { Name = "${local.name_prefix}-ddb-endpoint" })
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags              = merge(local.common_tags, { Name = "${local.name_prefix}-s3-endpoint" })
}

resource "aws_vpc_endpoint" "logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true
  tags                = merge(local.common_tags, { Name = "${local.name_prefix}-logs-endpoint" })
}
```

- [ ] **Step 2: Validate & format**

Run: `cd inf/terraform/aws-blog-serverless && terraform fmt && terraform validate`
Expected: valid.

- [ ] **Step 3: Commit**

```bash
git add inf/terraform/aws-blog-serverless/network.tf
git commit -m "feat(blog-infra): VPC with private subnets and VPC endpoints (no NAT)"
```

### Task 3: DynamoDB table + GSIs

**Files:**
- Create: `inf/terraform/aws-blog-serverless/data.tf`

**Interfaces:**
- Produces: `aws_dynamodb_table.posts` with keys `PK` (hash), `SK` (range), GSI `gsi1` (`GSI1PK`/`GSI1SK`) for newest-first listing, GSI `gsi2` (`GSI2PK`) for slug lookup. Consumed by Lambda IAM policy (Task 6) and repository (Task 11).

- [ ] **Step 1: Write `data.tf`**

```hcl
resource "aws_dynamodb_table" "posts" {
  name         = "${local.name_prefix}-posts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute { name = "PK"      type = "S" }
  attribute { name = "SK"      type = "S" }
  attribute { name = "GSI1PK"  type = "S" }
  attribute { name = "GSI1SK"  type = "S" }
  attribute { name = "GSI2PK"  type = "S" }

  global_secondary_index {
    name            = "gsi1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "gsi2"
    hash_key        = "GSI2PK"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-posts" })
}
```

- [ ] **Step 2: Validate**

Run: `terraform fmt && terraform validate`
Expected: valid.

- [ ] **Step 3: Commit**

```bash
git add inf/terraform/aws-blog-serverless/data.tf
git commit -m "feat(blog-infra): DynamoDB posts table with listing and slug GSIs"
```

### Task 4: S3 media bucket (site bucket is external)

> **Superseded by path-based revision:** only the **media** bucket is created here.
> The site origin is the existing `s3.nghuy.link` website bucket (owned by the
> `aws-s3-web` stack), referenced via `data "aws_s3_bucket" "site"` in `cdn.tf`.
> Drop the `aws_s3_bucket.site` resource and its SSE/public-access-block below.


**Files:**
- Create: `inf/terraform/aws-blog-serverless/storage.tf`

**Interfaces:**
- Produces: `aws_s3_bucket.site`, `aws_s3_bucket.media`, and `aws_cloudfront_origin_access_control` resources referenced by the distribution (Task 9). Bucket policies are attached in `cdn.tf` after the distribution exists (to reference its ARN); here create buckets, versioning, encryption, and public-access blocks (all four `true`).

- [ ] **Step 1: Write `storage.tf`**

```hcl
resource "aws_s3_bucket" "site" {
  bucket = var.site_bucket_name
  tags   = merge(local.common_tags, { Name = var.site_bucket_name, Type = "BlogSPA" })
}

resource "aws_s3_bucket" "media" {
  bucket = var.media_bucket_name
  tags   = merge(local.common_tags, { Name = var.media_bucket_name, Type = "BlogMedia" })
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

- [ ] **Step 2: Validate**

Run: `terraform fmt && terraform validate`

- [ ] **Step 3: Commit**

```bash
git add inf/terraform/aws-blog-serverless/storage.tf
git commit -m "feat(blog-infra): private site and media S3 buckets"
```

### Task 5: Cognito user pool, app client, admin user

**Files:**
- Create: `inf/terraform/aws-blog-serverless/cognito.tf`

**Interfaces:**
- Produces: `aws_cognito_user_pool.blog`, `aws_cognito_user_pool_client.blog` (no secret — public SPA client), `aws_cognito_user.admin`. Consumed by API authorizer (Task 7) and frontend env (Task 20).

- [ ] **Step 1: Write `cognito.tf`**

```hcl
resource "aws_cognito_user_pool" "blog" {
  name                     = "${local.name_prefix}-users"
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true # self-signup disabled
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-users" })
}

resource "aws_cognito_user_pool_client" "blog" {
  name            = "${local.name_prefix}-spa"
  user_pool_id    = aws_cognito_user_pool.blog.id
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user" "admin" {
  user_pool_id = aws_cognito_user_pool.blog.id
  username     = var.admin_email
  attributes = {
    email          = var.admin_email
    email_verified = "true"
  }
  # Cognito emails a temporary password on first apply; admin sets a permanent one at first login.
}
```

- [ ] **Step 2: Validate**

Run: `terraform fmt && terraform validate`

- [ ] **Step 3: Commit**

```bash
git add inf/terraform/aws-blog-serverless/cognito.tf
git commit -m "feat(blog-infra): Cognito pool with admin-only signup"
```

---

## Phase 2 — Backend Lambda (TDD)

### Task 6: Backend project scaffold + shared types

**Files:**
- Create: `src/blog-backend/package.json`, `tsconfig.json`, `vitest.config.ts`, `esbuild.config.mjs`
- Create: `src/blog-backend/src/lib/types.ts`

**Interfaces:**
- Produces: `PostMeta`, `PostInput`, `PostRecord` types consumed by all backend tasks.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "blog-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node esbuild.config.mjs",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.700.0",
    "@aws-sdk/lib-dynamodb": "^3.700.0",
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/s3-request-presigner": "^3.700.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "@types/node": "^22.0.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`, `vitest.config.ts`, `esbuild.config.mjs`**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

```js
// esbuild.config.mjs
import { build } from "esbuild";
await build({
  entryPoints: ["src/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/handler.mjs",
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
```

- [ ] **Step 3: Write `src/lib/types.ts`**

```ts
export type PostStatus = "draft" | "published";

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  coverImage: string | null;
  status: PostStatus;
  body: unknown; // ProseMirror JSON document
}

export interface PostMeta {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  coverImage: string | null;
  status: PostStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface PostRecord extends PostMeta {
  body: unknown;
}
```

- [ ] **Step 4: Install & typecheck**

Run: `cd src/blog-backend && pnpm install && pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/blog-backend/
git commit -m "feat(blog-backend): project scaffold and shared types"
```

### Task 7: Validation + slug helpers (TDD)

**Files:**
- Create: `src/blog-backend/src/lib/validation.ts`
- Test: `src/blog-backend/test/validation.test.ts`

**Interfaces:**
- Produces: `slugify(title: string): string`, `validatePostInput(body: unknown): { ok: true; value: PostInput } | { ok: false; error: string }`, `MAX_BODY_BYTES = 350_000`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { slugify, validatePostInput } from "../src/lib/validation";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello, DevOps World!")).toBe("hello-devops-world");
  });
});

describe("validatePostInput", () => {
  const base = { title: "T", slug: "t", excerpt: "e", tags: [], coverImage: null, status: "draft", body: { type: "doc", content: [] } };
  it("accepts a valid input", () => {
    const r = validatePostInput(base);
    expect(r.ok).toBe(true);
  });
  it("rejects missing title", () => {
    const r = validatePostInput({ ...base, title: "" });
    expect(r.ok).toBe(false);
  });
  it("rejects invalid status", () => {
    const r = validatePostInput({ ...base, status: "weird" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- validation`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/lib/validation.ts`**

```ts
import type { PostInput } from "./types";

export const MAX_BODY_BYTES = 350_000;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type Result = { ok: true; value: PostInput } | { ok: false; error: string };

export function validatePostInput(input: unknown): Result {
  if (typeof input !== "object" || input === null) return { ok: false, error: "body must be an object" };
  const b = input as Record<string, unknown>;
  if (typeof b.title !== "string" || b.title.trim() === "") return { ok: false, error: "title required" };
  if (b.status !== "draft" && b.status !== "published") return { ok: false, error: "invalid status" };
  if (typeof b.body !== "object" || b.body === null) return { ok: false, error: "body document required" };
  if (Buffer.byteLength(JSON.stringify(b.body)) > MAX_BODY_BYTES) return { ok: false, error: "body too large" };
  const slug = typeof b.slug === "string" && b.slug.trim() ? slugify(b.slug) : slugify(b.title);
  return {
    ok: true,
    value: {
      title: b.title.trim(),
      slug,
      excerpt: typeof b.excerpt === "string" ? b.excerpt : "",
      tags: Array.isArray(b.tags) ? (b.tags.filter((t) => typeof t === "string") as string[]) : [],
      coverImage: typeof b.coverImage === "string" ? b.coverImage : null,
      status: b.status,
      body: b.body,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test -- validation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/blog-backend/src/lib/validation.ts src/blog-backend/test/validation.test.ts
git commit -m "feat(blog-backend): post input validation and slugify"
```

### Task 8: Response helpers (TDD)

**Files:**
- Create: `src/blog-backend/src/lib/response.ts`
- Test: `src/blog-backend/test/response.test.ts`

**Interfaces:**
- Produces: `json(statusCode, body): APIGatewayProxyResult`, `error(statusCode, message)`. All responses include `content-type: application/json`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { json, error } from "../src/lib/response";

describe("response helpers", () => {
  it("json serializes body and sets status", () => {
    const r = json(201, { id: "1" });
    expect(r.statusCode).toBe(201);
    expect(JSON.parse(r.body)).toEqual({ id: "1" });
    expect(r.headers?.["content-type"]).toBe("application/json");
  });
  it("error wraps a message", () => {
    const r = error(400, "bad");
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body)).toEqual({ error: "bad" });
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pnpm test -- response` → FAIL.

- [ ] **Step 3: Write `src/lib/response.ts`**

```ts
import type { APIGatewayProxyResult } from "aws-lambda";

const headers = { "content-type": "application/json" };

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers, body: JSON.stringify(body) };
}

export function error(statusCode: number, message: string): APIGatewayProxyResult {
  return json(statusCode, { error: message });
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm test -- response` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/blog-backend/src/lib/response.ts src/blog-backend/test/response.test.ts
git commit -m "feat(blog-backend): HTTP response helpers"
```

### Task 9: Repository (DynamoDB + S3) with injectable clients (TDD)

**Files:**
- Create: `src/blog-backend/src/lib/repository.ts`
- Test: `src/blog-backend/test/repository.test.ts`

**Interfaces:**
- Consumes: `PostInput`, `PostMeta`, `PostRecord`.
- Produces: class `Repository` with `constructor(deps: { doc: DynamoDBDocumentClient; s3: S3Client; table: string; bucket: string })` and methods:
  - `listPublished(): Promise<PostMeta[]>`
  - `listAll(): Promise<PostMeta[]>`
  - `getBySlug(slug: string, includeDraft: boolean): Promise<PostRecord | null>`
  - `create(input: PostInput): Promise<PostMeta>`
  - `update(id: string, input: PostInput): Promise<PostMeta | null>`
  - `remove(id: string): Promise<boolean>`
  - `presignUpload(contentType: string): Promise<{ url: string; key: string }>`

- [ ] **Step 1: Write the failing test** (uses `aws-sdk-client-mock`)

Add dev dep first: `pnpm add -D aws-sdk-client-mock`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Repository } from "../src/lib/repository";

const ddb = mockClient(DynamoDBDocumentClient);
const s3 = mockClient(S3Client);

function repo() {
  return new Repository({
    doc: ddb as unknown as DynamoDBDocumentClient,
    s3: s3 as unknown as S3Client,
    table: "t",
    bucket: "b",
  });
}

beforeEach(() => { ddb.reset(); s3.reset(); });

describe("Repository.listPublished", () => {
  it("queries gsi1 and maps items", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [{ id: "1", slug: "a", title: "A", status: "published", publishedAt: "2026-01-01", updatedAt: "2026-01-01", excerpt: "", tags: [], coverImage: null }],
    });
    const posts = await repo().listPublished();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("a");
  });
});

describe("Repository.create", () => {
  it("writes body to s3 and metadata to dynamo", async () => {
    ddb.on(PutCommand).resolves({});
    const meta = await repo().create({
      title: "New", slug: "new", excerpt: "", tags: [], coverImage: null, status: "published", body: { type: "doc", content: [] },
    });
    expect(meta.id).toBeTruthy();
    expect(meta.slug).toBe("new");
    expect(s3.calls().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pnpm test -- repository` → FAIL.

- [ ] **Step 3: Write `src/lib/repository.ts`**

```ts
import { randomUUID } from "node:crypto";
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PostInput, PostMeta, PostRecord } from "./types";

interface Deps {
  doc: DynamoDBDocumentClient;
  s3: S3Client;
  table: string;
  bucket: string;
}

const META = (m: Record<string, unknown>): PostMeta => ({
  id: m.id as string,
  slug: m.slug as string,
  title: m.title as string,
  excerpt: (m.excerpt as string) ?? "",
  tags: (m.tags as string[]) ?? [],
  coverImage: (m.coverImage as string) ?? null,
  status: m.status as PostMeta["status"],
  publishedAt: (m.publishedAt as string) ?? null,
  updatedAt: m.updatedAt as string,
});

export class Repository {
  constructor(private d: Deps) {}

  private bodyKey(id: string) { return `bodies/${id}.json`; }

  async listPublished(): Promise<PostMeta[]> {
    const r = await this.d.doc.send(new QueryCommand({
      TableName: this.d.table, IndexName: "gsi1",
      KeyConditionExpression: "GSI1PK = :p",
      FilterExpression: "#s = :pub",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":p": "POST", ":pub": "published" },
      ScanIndexForward: false,
    }));
    return (r.Items ?? []).map(META);
  }

  async listAll(): Promise<PostMeta[]> {
    const r = await this.d.doc.send(new QueryCommand({
      TableName: this.d.table, IndexName: "gsi1",
      KeyConditionExpression: "GSI1PK = :p",
      ExpressionAttributeValues: { ":p": "POST" },
      ScanIndexForward: false,
    }));
    return (r.Items ?? []).map(META);
  }

  async getBySlug(slug: string, includeDraft: boolean): Promise<PostRecord | null> {
    const q = await this.d.doc.send(new QueryCommand({
      TableName: this.d.table, IndexName: "gsi2",
      KeyConditionExpression: "GSI2PK = :s",
      ExpressionAttributeValues: { ":s": `SLUG#${slug}` },
    }));
    const item = q.Items?.[0];
    if (!item) return null;
    if (item.status !== "published" && !includeDraft) return null;
    const body = await this.readBody(item.id as string);
    return { ...META(item), body };
  }

  private async readBody(id: string): Promise<unknown> {
    const obj = await this.d.s3.send(new GetObjectCommand({ Bucket: this.d.bucket, Key: this.bodyKey(id) }));
    const text = await obj.Body!.transformToString();
    return JSON.parse(text);
  }

  private async writeItem(id: string, input: PostInput, publishedAt: string | null, updatedAt: string) {
    await this.d.s3.send(new PutObjectCommand({
      Bucket: this.d.bucket, Key: this.bodyKey(id),
      Body: JSON.stringify(input.body), ContentType: "application/json",
    }));
    await this.d.doc.send(new PutCommand({
      TableName: this.d.table,
      Item: {
        PK: `POST#${id}`, SK: "META",
        GSI1PK: "POST", GSI1SK: publishedAt ?? updatedAt,
        GSI2PK: `SLUG#${input.slug}`,
        id, slug: input.slug, title: input.title, excerpt: input.excerpt,
        tags: input.tags, coverImage: input.coverImage, status: input.status,
        publishedAt, updatedAt, bodyKey: this.bodyKey(id),
      },
    }));
  }

  async create(input: PostInput): Promise<PostMeta> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const publishedAt = input.status === "published" ? now : null;
    await this.writeItem(id, input, publishedAt, now);
    return { id, slug: input.slug, title: input.title, excerpt: input.excerpt, tags: input.tags, coverImage: input.coverImage, status: input.status, publishedAt, updatedAt: now };
  }

  async update(id: string, input: PostInput): Promise<PostMeta | null> {
    const existing = await this.d.doc.send(new GetCommand({ TableName: this.d.table, Key: { PK: `POST#${id}`, SK: "META" } }));
    if (!existing.Item) return null;
    const now = new Date().toISOString();
    const publishedAt = input.status === "published"
      ? (existing.Item.publishedAt as string) ?? now
      : null;
    await this.writeItem(id, input, publishedAt, now);
    return { id, slug: input.slug, title: input.title, excerpt: input.excerpt, tags: input.tags, coverImage: input.coverImage, status: input.status, publishedAt, updatedAt: now };
  }

  async remove(id: string): Promise<boolean> {
    await this.d.doc.send(new DeleteCommand({ TableName: this.d.table, Key: { PK: `POST#${id}`, SK: "META" } }));
    await this.d.s3.send(new DeleteObjectCommand({ Bucket: this.d.bucket, Key: this.bodyKey(id) }));
    return true;
  }

  async presignUpload(contentType: string): Promise<{ url: string; key: string }> {
    const ext = contentType.split("/")[1] ?? "bin";
    const key = `media/${randomUUID()}.${ext}`;
    const url = await getSignedUrl(this.d.s3, new PutObjectCommand({ Bucket: this.d.bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
    return { url, key };
  }
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm test -- repository` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/blog-backend/src/lib/repository.ts src/blog-backend/test/repository.test.ts src/blog-backend/package.json
git commit -m "feat(blog-backend): DynamoDB + S3 repository"
```

### Task 10: Handler router (TDD)

**Files:**
- Create: `src/blog-backend/src/handler.ts`
- Test: `src/blog-backend/test/handler.test.ts`

**Interfaces:**
- Consumes: `Repository`, `validatePostInput`, `json`/`error`.
- Produces: `export const handler: APIGatewayProxyHandler` and `export function createHandler(repo: Repository)` (injectable repo for tests). Routes: `GET /posts`, `GET /posts/{slug}`, `POST /posts`, `PUT /posts/{id}`, `DELETE /posts/{id}`, `POST /uploads`. Admin identity presence is read from `event.requestContext.authorizer.claims` (populated by the API Gateway Cognito authorizer); its mere presence authorizes writes and draft visibility.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createHandler } from "../src/handler";

function evt(method: string, resource: string, opts: Partial<any> = {}) {
  return { httpMethod: method, resource, pathParameters: null, body: null, requestContext: { authorizer: null }, ...opts } as any;
}

describe("router", () => {
  it("GET /posts returns published list", async () => {
    const repo = { listPublished: vi.fn().mockResolvedValue([{ slug: "a" }]) } as any;
    const res = await createHandler(repo)(evt("GET", "/posts"), {} as any, () => {});
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([{ slug: "a" }]);
  });

  it("POST /posts without authorizer claims is 401", async () => {
    const repo = {} as any;
    const res = await createHandler(repo)(evt("POST", "/posts", { body: "{}" }), {} as any, () => {});
    expect(res.statusCode).toBe(401);
  });

  it("POST /posts with claims and valid body creates", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ id: "1", slug: "new" }) } as any;
    const body = JSON.stringify({ title: "New", slug: "new", excerpt: "", tags: [], coverImage: null, status: "published", body: { type: "doc", content: [] } });
    const res = await createHandler(repo)(evt("POST", "/posts", { body, requestContext: { authorizer: { claims: { sub: "u1" } } } }), {} as any, () => {});
    expect(res.statusCode).toBe(201);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pnpm test -- handler` → FAIL.

- [ ] **Step 3: Write `src/handler.ts`**

```ts
import type { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Repository } from "./lib/repository";
import { validatePostInput } from "./lib/validation";
import { json, error } from "./lib/response";

function isAuthed(event: APIGatewayProxyEvent): boolean {
  return Boolean((event.requestContext as any)?.authorizer?.claims);
}

export function createHandler(repo: Repository) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { httpMethod, resource } = event;
    try {
      if (httpMethod === "GET" && resource === "/posts") {
        return json(200, isAuthed(event) ? await repo.listAll() : await repo.listPublished());
      }
      if (httpMethod === "GET" && resource === "/posts/{slug}") {
        const post = await repo.getBySlug(event.pathParameters!.slug!, isAuthed(event));
        return post ? json(200, post) : error(404, "not found");
      }
      if (!isAuthed(event)) return error(401, "unauthorized");

      if (httpMethod === "POST" && resource === "/posts") {
        const v = validatePostInput(JSON.parse(event.body ?? "{}"));
        if (!v.ok) return error(400, v.error);
        return json(201, await repo.create(v.value));
      }
      if (httpMethod === "PUT" && resource === "/posts/{id}") {
        const v = validatePostInput(JSON.parse(event.body ?? "{}"));
        if (!v.ok) return error(400, v.error);
        const updated = await repo.update(event.pathParameters!.id!, v.value);
        return updated ? json(200, updated) : error(404, "not found");
      }
      if (httpMethod === "DELETE" && resource === "/posts/{id}") {
        await repo.remove(event.pathParameters!.id!);
        return json(204, {});
      }
      if (httpMethod === "POST" && resource === "/uploads") {
        const { contentType } = JSON.parse(event.body ?? "{}");
        if (!/^image\/(png|jpeg|gif|webp)$/.test(contentType ?? "")) return error(400, "invalid content type");
        return json(200, await repo.presignUpload(contentType));
      }
      return error(404, "not found");
    } catch (e) {
      console.error(e);
      return error(500, "internal error");
    }
  };
}

const repo = new Repository({
  doc: DynamoDBDocumentClient.from(new DynamoDBClient({})),
  s3: new S3Client({}),
  table: process.env.TABLE_NAME!,
  bucket: process.env.MEDIA_BUCKET!,
});

export const handler: APIGatewayProxyHandler = (event) => createHandler(repo)(event);
```

- [ ] **Step 4: Run to verify pass** — `pnpm test` → all PASS.

- [ ] **Step 5: Build check**

Run: `pnpm build && ls dist/handler.mjs`
Expected: file exists.

- [ ] **Step 6: Commit**

```bash
git add src/blog-backend/src/handler.ts src/blog-backend/test/handler.test.ts
git commit -m "feat(blog-backend): API router with auth gating"
```

---

## Phase 3 — Terraform: Lambda, API Gateway, CDN

### Task 11: Lambda function + IAM + log group

**Files:**
- Create: `inf/terraform/aws-blog-serverless/lambda.tf`

**Interfaces:**
- Consumes: `aws_subnet.private`, `aws_security_group.lambda`, `aws_dynamodb_table.posts`, `aws_s3_bucket.media`.
- Produces: `aws_lambda_function.api` (invoked by API Gateway in Task 12). Bundle path: `../../../src/blog-backend/dist/handler.mjs` zipped via `archive_file`.

- [ ] **Step 1: Write `lambda.tf`**

```hcl
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../../../src/blog-backend/dist"
  output_path = "${path.module}/build/handler.zip"
}

resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-lambda-role" })
}

resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Query", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = [aws_dynamodb_table.posts.arn, "${aws_dynamodb_table.posts.arn}/index/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.media.arn}/*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.name_prefix}-api"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_lambda_function" "api" {
  function_name    = "${local.name_prefix}-api"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 15
  memory_size      = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.posts.name
      MEDIA_BUCKET = aws_s3_bucket.media.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
  tags       = merge(local.common_tags, { Name = "${local.name_prefix}-api" })
}
```

- [ ] **Step 2: Build bundle then validate** (bundle must exist for archive_file)

Run: `cd src/blog-backend && pnpm build && cd - && cd inf/terraform/aws-blog-serverless && terraform fmt && terraform validate`
Expected: valid.

- [ ] **Step 3: Commit**

```bash
git add inf/terraform/aws-blog-serverless/lambda.tf
git commit -m "feat(blog-infra): VPC-attached Lambda with least-privilege IAM"
```

### Task 12: API Gateway REST API + Cognito authorizer

**Files:**
- Create: `inf/terraform/aws-blog-serverless/api.tf`

**Interfaces:**
- Consumes: `aws_lambda_function.api`, `aws_cognito_user_pool.blog`.
- Produces: `aws_api_gateway_rest_api.blog`, deployed `aws_api_gateway_stage.blog` (stage `v1`), invoke ARN used by CloudFront (Task 13). Resources `/posts`, `/posts/{slug}` (GET), `/posts/{id}` shares path — use two resources: `/posts` and `/posts/{proxy}` is avoided; instead define `/posts/{slug}` for GET and `/posts/{id}` cannot coexist with same parent path segment. Use a single path variable `{key}` and let the handler treat it as slug for GET and id for PUT/DELETE.

  > Design note: to avoid API Gateway's "two different path parameter names at the same position" limitation, the resource is `/posts/{key}`. The Lambda handler already branches on method; update `handler.ts` resource strings to `/posts/{key}` and read `pathParameters.key` (adjust Task 10 resource matching accordingly during implementation: GET → treat as slug, PUT/DELETE → treat as id).

- [ ] **Step 1: Adjust handler resource strings** (reconcile with Task 10)

In `src/blog-backend/src/handler.ts` and `test/handler.test.ts`, replace resource `"/posts/{slug}"` and `"/posts/{id}"` with `"/posts/{key}"`, and read `event.pathParameters!.key!`. Re-run `pnpm test` → PASS. Commit:

```bash
git commit -am "refactor(blog-backend): unify post path parameter to {key}"
```

- [ ] **Step 2: Write `api.tf`**

```hcl
resource "aws_api_gateway_rest_api" "blog" {
  name = "${local.name_prefix}-api"
  endpoint_configuration { types = ["REGIONAL"] }
  tags = merge(local.common_tags, { Name = "${local.name_prefix}-api" })
}

resource "aws_api_gateway_authorizer" "cognito" {
  name            = "${local.name_prefix}-cognito"
  type            = "COGNITO_USER_POOLS"
  rest_api_id     = aws_api_gateway_rest_api.blog.id
  provider_arns   = [aws_cognito_user_pool.blog.arn]
  identity_source = "method.request.header.Authorization"
}

resource "aws_api_gateway_resource" "posts" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_rest_api.blog.root_resource_id
  path_part   = "posts"
}

resource "aws_api_gateway_resource" "post_key" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_resource.posts.id
  path_part   = "{key}"
}

resource "aws_api_gateway_resource" "uploads" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  parent_id   = aws_api_gateway_rest_api.blog.root_resource_id
  path_part   = "uploads"
}

locals {
  # method -> { resource_id, auth }  (auth true = Cognito required)
  methods = {
    list_posts   = { resource = aws_api_gateway_resource.posts.id,    http = "GET",    auth = false }
    create_post  = { resource = aws_api_gateway_resource.posts.id,    http = "POST",   auth = true }
    get_post     = { resource = aws_api_gateway_resource.post_key.id, http = "GET",    auth = false }
    update_post  = { resource = aws_api_gateway_resource.post_key.id, http = "PUT",    auth = true }
    delete_post  = { resource = aws_api_gateway_resource.post_key.id, http = "DELETE", auth = true }
    presign      = { resource = aws_api_gateway_resource.uploads.id,  http = "POST",   auth = true }
  }
}

resource "aws_api_gateway_method" "m" {
  for_each      = local.methods
  rest_api_id   = aws_api_gateway_rest_api.blog.id
  resource_id   = each.value.resource
  http_method   = each.value.http
  authorization = each.value.auth ? "COGNITO_USER_POOLS" : "NONE"
  authorizer_id = each.value.auth ? aws_api_gateway_authorizer.cognito.id : null
}

resource "aws_api_gateway_integration" "m" {
  for_each                = local.methods
  rest_api_id             = aws_api_gateway_rest_api.blog.id
  resource_id             = each.value.resource
  http_method             = aws_api_gateway_method.m[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.blog.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "blog" {
  rest_api_id = aws_api_gateway_rest_api.blog.id
  triggers = {
    redeploy = sha1(jsonencode([local.methods, aws_lambda_function.api.source_code_hash]))
  }
  lifecycle { create_before_destroy = true }
  depends_on = [aws_api_gateway_integration.m]
}

resource "aws_api_gateway_stage" "blog" {
  rest_api_id   = aws_api_gateway_rest_api.blog.id
  deployment_id = aws_api_gateway_deployment.blog.id
  stage_name    = "v1"
  tags          = local.common_tags
}
```

- [ ] **Step 3: Validate**

Run: `terraform fmt && terraform validate`

- [ ] **Step 4: Commit**

```bash
git add inf/terraform/aws-blog-serverless/api.tf
git commit -m "feat(blog-infra): API Gateway with Cognito authorizer on writes"
```

### Task 13: ACM cert, CloudFront Function, CloudFront distribution (apex), Route53, media bucket policy

> **Superseded by path-based revision.** This is the central change. Final `cdn.tf`:
> - `data "aws_s3_bucket" "site"` looks up the existing `s3.nghuy.link` website bucket.
> - ACM cert + validation for the apex `local.domain` (= `var.root_domain`, `nghuy.link`).
> - CloudFront distribution `aliases = [local.domain]`, `default_root_object = "index.html"`, with three origins: **site** (S3 website endpoint, `http-only` custom origin), **media** (OAC), **api** (API Gateway). Behaviors: default → site (+ rewrite function), `/api/*` → api (+ api-strip function), `/media/*` → media.
> - The viewer-request rewrite function maps clean routes onto the flat static export (see `cloudfront-rewrite.js` below). `/` → portfolio home.
> - Route53 A/AAAA for the apex → this distribution. Only the **media** bucket policy is created here (site bucket is external, so no site OAC / site bucket policy / `site_bucket_name` output).

**Files:**
- Create: `inf/terraform/aws-blog-serverless/cdn.tf`
- Create: `inf/terraform/aws-blog-serverless/cloudfront-rewrite.js`

**Interfaces:**
- Consumes: `data.aws_s3_bucket.site` (external `s3.nghuy.link`), `aws_s3_bucket.media`, `aws_api_gateway_stage.blog`, `local.domain`, `var.route53_zone_id`.
- Produces: `aws_cloudfront_distribution.blog` (aliased to the apex `local.domain`), Route53 A/AAAA records, and the media bucket policy granting OAC read.

- [ ] **Step 1: Write `cloudfront-rewrite.js`** (viewer-request — map clean routes onto the flat static export)

```js
function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri.includes(".")) return req;                       // real files pass through
  if (uri.length > 1 && uri.endsWith("/")) uri = uri.slice(0, -1);
  if (uri === "" || uri === "/") { req.uri = "/index.html"; return req; }        // portfolio home
  if (/^\/blogs\/editor\/.+/.test(uri)) { req.uri = "/blogs/editor/_.html"; return req; }
  if (uri === "/blogs/editor") { req.uri = "/blogs/editor.html"; return req; }
  if (/^\/blogs\/.+/.test(uri)) { req.uri = "/blogs/_.html"; return req; }       // /blogs/<slug>
  req.uri = uri + ".html";                                  // /blogs, /blogs-draft, /login, ...
  return req;
}
```

- [ ] **Step 2: Write `cdn.tf`**

```hcl
resource "aws_acm_certificate" "blog" {
  provider          = aws.us_east_1
  domain_name       = local.domain
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
  tags = merge(local.common_tags, { Name = local.domain })
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.blog.domain_validation_options :
    dvo.domain_name => { name = dvo.resource_record_name, type = dvo.resource_record_type, record = dvo.resource_record_value }
  }
  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "blog" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.blog.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_cloudfront_function" "rewrite" {
  name    = "${local.name_prefix}-rewrite"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/cloudfront-rewrite.js")
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${local.name_prefix}-site-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${local.name_prefix}-media-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "blog" {
  enabled             = true
  aliases             = [local.domain]        # apex nghuy.link
  default_root_object = "index.html"
  comment             = local.domain

  # Site origin = existing s3.nghuy.link website bucket. S3 website endpoints only
  # speak HTTP, so this is a custom (http-only) origin, not OAC.
  origin {
    origin_id   = "site"
    domain_name = data.aws_s3_bucket.site.website_endpoint
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  origin {
    origin_id                = "media"
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }
  origin {
    origin_id   = "api"
    domain_name = "${aws_api_gateway_rest_api.blog.id}.execute-api.${var.aws_region}.amazonaws.com"
    origin_path = "/${aws_api_gateway_stage.blog.stage_name}"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rewrite.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
  }

  ordered_cache_behavior {
    path_pattern           = "/media/*"
    target_origin_id       = "media"
    viewer_protocol_policy  = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions { geo_restriction { restriction_type = "none" } }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.blog.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(local.common_tags, { Name = local.domain })
}

# /api/* is rewritten to the API origin which has origin_path=/v1; the /api prefix
# must be stripped. Use a second CloudFront Function OR rely on API resources being
# defined under /api. Simpler: API Gateway resources are /posts etc, and the CDN
# behavior forwards /api/* — add a rewrite in the api behavior to strip /api.
resource "aws_cloudfront_function" "api_strip" {
  name    = "${local.name_prefix}-api-strip"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = "function handler(event){var r=event.request;r.uri=r.uri.replace(/^\\/api/,'');return r;}"
}

resource "aws_route53_record" "a" {
  zone_id = var.route53_zone_id
  name    = local.domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.blog.domain_name
    zone_id                = aws_cloudfront_distribution.blog.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "aaaa" {
  zone_id = var.route53_zone_id
  name    = local.domain
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.blog.domain_name
    zone_id                = aws_cloudfront_distribution.blog.hosted_zone_id
    evaluate_target_health = false
  }
}

data "aws_iam_policy_document" "site" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
    principals { type = "Service" identifiers = ["cloudfront.amazonaws.com"] }
    condition { test = "StringEquals" variable = "AWS:SourceArn" values = [aws_cloudfront_distribution.blog.arn] }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}

data "aws_iam_policy_document" "media_read" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/media/*"] # only images are CDN-readable
    principals { type = "Service" identifiers = ["cloudfront.amazonaws.com"] }
    condition { test = "StringEquals" variable = "AWS:SourceArn" values = [aws_cloudfront_distribution.blog.arn] }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = data.aws_iam_policy_document.media_read.json
}
```

  > Implementation note: attach `aws_cloudfront_function.api_strip` to the `/api/*` behavior via a `function_association` block (viewer-request). It is shown as a separate resource above; add the association inside the `ordered_cache_behavior` for `/api/*` when wiring — a single function may combine strip logic if preferred. Only `media/*` keys in the media bucket are exposed through CloudFront; `bodies/*` remain private (Lambda-only).

- [ ] **Step 3: Validate**

Run: `terraform fmt && terraform validate`
Expected: valid.

- [ ] **Step 4: Write `outputs.tf`**

```hcl
output "distribution_id" {
  description = "CloudFront distribution ID for cache invalidation."
  value       = aws_cloudfront_distribution.blog.id
}
output "distribution_domain" {
  description = "CloudFront domain name."
  value       = aws_cloudfront_distribution.blog.domain_name
}
output "blog_url" {
  description = "Public blog URL."
  value       = "https://${local.domain}"
}
output "site_bucket_name" {
  description = "Blog SPA bucket name."
  value       = aws_s3_bucket.site.id
}
output "user_pool_id" {
  description = "Cognito user pool ID."
  value       = aws_cognito_user_pool.blog.id
}
output "user_pool_client_id" {
  description = "Cognito app client ID."
  value       = aws_cognito_user_pool_client.blog.id
}
output "api_id" {
  description = "API Gateway REST API ID."
  value       = aws_api_gateway_rest_api.blog.id
}
```

- [ ] **Step 5: Commit**

```bash
git add inf/terraform/aws-blog-serverless/cdn.tf inf/terraform/aws-blog-serverless/cloudfront-rewrite.js inf/terraform/aws-blog-serverless/outputs.tf
git commit -m "feat(blog-infra): CloudFront, ACM, Route53, bucket policies"
```

---

## Phase 4 — Frontend (inside `src/aws-s3-web/`)

> All commands in this phase run from `src/aws-s3-web/`.

### Task 14: Install blog dependencies

**Files:**
- Modify: `src/aws-s3-web/package.json`

**Interfaces:**
- Produces: TipTap + Amplify available to later tasks.

- [ ] **Step 1: Add dependencies**

Run:
```bash
cd src/aws-s3-web
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder @tiptap/pm aws-amplify @aws-amplify/ui-react
```

- [ ] **Step 2: Verify build still works**

Run: `pnpm build`
Expected: static export succeeds.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(blog-web): add TipTap and Amplify dependencies"
```

### Task 15: Typed API client (TDD)

**Files:**
- Create: `src/aws-s3-web/src/lib/blog/api.ts`
- Test: `src/aws-s3-web/src/lib/blog/api.test.ts`

**Interfaces:**
- Produces: `listPosts()`, `getPost(slug)`, `createPost(input, token)`, `updatePost(id, input, token)`, `deletePost(id, token)`, `presignUpload(contentType, token)`. All call `/api/...` same-origin. Types re-declared here (`PostMeta`, `PostRecord`, `PostInput`) matching backend `types.ts`.

- [ ] **Step 1: Write the failing test** (mock `fetch`)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listPosts, createPost } from "./api";

beforeEach(() => { vi.restoreAllMocks(); });

describe("api client", () => {
  it("listPosts GETs /api/posts", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ slug: "a" }] });
    vi.stubGlobal("fetch", f);
    const posts = await listPosts();
    expect(f).toHaveBeenCalledWith("/api/posts", expect.objectContaining({ method: "GET" }));
    expect(posts[0].slug).toBe("a");
  });

  it("createPost sends bearer token", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "1" }) });
    vi.stubGlobal("fetch", f);
    await createPost({ title: "t" } as any, "TOKEN");
    expect(f).toHaveBeenCalledWith("/api/posts", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer TOKEN" }),
    }));
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pnpm test -- api` → FAIL.

- [ ] **Step 3: Write `src/lib/blog/api.ts`**

```ts
export type PostStatus = "draft" | "published";
export interface PostInput {
  title: string; slug: string; excerpt: string; tags: string[];
  coverImage: string | null; status: PostStatus; body: unknown;
}
export interface PostMeta {
  id: string; slug: string; title: string; excerpt: string; tags: string[];
  coverImage: string | null; status: PostStatus; publishedAt: string | null; updatedAt: string;
}
export interface PostRecord extends PostMeta { body: unknown; }

async function req<T>(path: string, method: string, token?: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const listPosts = (token?: string) => req<PostMeta[]>("/posts", "GET", token);
export const getPost = (slug: string, token?: string) => req<PostRecord>(`/posts/${slug}`, "GET", token);
export const createPost = (input: PostInput, token: string) => req<PostMeta>("/posts", "POST", token, input);
export const updatePost = (id: string, input: PostInput, token: string) => req<PostMeta>(`/posts/${id}`, "PUT", token, input);
export const deletePost = (id: string, token: string) => req<void>(`/posts/${id}`, "DELETE", token);
export const presignUpload = (contentType: string, token: string) =>
  req<{ url: string; key: string }>("/uploads", "POST", token, { contentType });
```

- [ ] **Step 4: Run to verify pass** — `pnpm test -- api` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/api.ts src/lib/blog/api.test.ts
git commit -m "feat(blog-web): typed same-origin API client"
```

### Task 16: Amplify auth config + session helper

**Files:**
- Create: `src/aws-s3-web/src/lib/blog/auth.ts`

**Interfaces:**
- Produces: `configureAuth()` (idempotent Amplify config from `NEXT_PUBLIC_*` env), `getIdToken(): Promise<string | null>`, `signIn(email, password)`, `signOut()`, `currentUser(): Promise<{ email: string } | null>`.

- [ ] **Step 1: Write `src/lib/blog/auth.ts`**

```ts
"use client";
import { Amplify } from "aws-amplify";
import { signIn as amplifySignIn, signOut as amplifySignOut, fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

let configured = false;
export function configureAuth() {
  if (configured) return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
      },
    },
  });
  configured = true;
}

export async function getIdToken(): Promise<string | null> {
  configureAuth();
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch { return null; }
}

export async function signIn(email: string, password: string) {
  configureAuth();
  return amplifySignIn({ username: email, password });
}

export async function signOut() { configureAuth(); return amplifySignOut(); }

export async function currentUser(): Promise<{ email: string } | null> {
  configureAuth();
  try {
    const u = await getCurrentUser();
    return { email: u.signInDetails?.loginId ?? u.username };
  } catch { return null; }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/blog/auth.ts
git commit -m "feat(blog-web): Amplify Cognito auth helpers"
```

### Task 17: Public pages — home list + post card (TDD on card)

**Files:**
- Create: `src/aws-s3-web/src/components/blog/post-card.tsx`
- Create: `src/aws-s3-web/src/app/blogs/page.tsx`
- Test: `src/aws-s3-web/src/components/blog/post-card.test.tsx`

**Interfaces:**
- Consumes: `PostMeta`, terminal-theme tokens from `globals.css`, existing `section-heading` component.
- Produces: `<PostCard post={PostMeta} />`, `/blogs` page (client component fetching `listPosts()` on mount).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PostCard } from "./post-card";

describe("PostCard", () => {
  it("renders title, excerpt, and a link to the slug", () => {
    render(<PostCard post={{ id: "1", slug: "hello-world", title: "Hello World", excerpt: "An intro", tags: ["aws"], coverImage: null, status: "published", publishedAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z" }} />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("An intro")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/blogs/hello-world");
  });
});
```

- [ ] **Step 2: Run to verify fail** — `pnpm test -- post-card` → FAIL.

- [ ] **Step 3: Write `post-card.tsx`** (terminal theme classes — reuse Tailwind tokens used elsewhere in the app; monospace, border, accent)

```tsx
import Link from "next/link";
import type { PostMeta } from "@/lib/blog/api";

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blogs/${post.slug}`}
      className="block border border-neutral-800 rounded-md p-4 font-mono hover:border-emerald-500 transition-colors"
    >
      <h3 className="text-lg text-emerald-400">{post.title}</h3>
      <p className="text-sm text-neutral-400 mt-2">{post.excerpt}</p>
      <div className="flex gap-3 mt-3 text-xs text-neutral-500">
        {post.publishedAt && <span>{new Date(post.publishedAt).toISOString().slice(0, 10)}</span>}
        {post.tags.map((t) => <span key={t}>#{t}</span>)}
      </div>
    </Link>
  );
}
```

  > Match the exact accent/token classes the portfolio uses (check `globals.css` and an existing section component) so the card is visually identical to the rest of the terminal theme; the classes above are the intended structure.

- [ ] **Step 4: Write `src/app/blogs/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { listPosts, type PostMeta } from "@/lib/blog/api";
import { PostCard } from "@/components/blog/post-card";

export default function BlogsPage() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listPosts().then(setPosts).finally(() => setLoading(false)); }, []);
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-mono text-emerald-400 mb-8">~/blogs</h1>
      {loading ? <p className="font-mono text-neutral-500">loading…</p> :
        <div className="grid gap-4">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>}
    </main>
  );
}
```

- [ ] **Step 5: Run tests + build** — `pnpm test -- post-card` → PASS; `pnpm build` → static export includes `/blogs`.

- [ ] **Step 6: Commit**

```bash
git add src/components/blog/post-card.tsx src/components/blog/post-card.test.tsx src/app/blogs/page.tsx
git commit -m "feat(blog-web): blogs home page and post card"
```

### Task 18: Post detail page + ProseMirror renderer

**Files:**
- Create: `src/aws-s3-web/src/components/blog/post-view.tsx`
- Create: `src/aws-s3-web/src/app/blogs/[slug]/page.tsx`
- Create: `src/aws-s3-web/src/app/blogs/[slug]/blog-detail-client.tsx`

**Interfaces:**
- Consumes: `getPost(slug)`, TipTap `generateHTML`.
- Produces: statically-exported `[slug]` route. Because `output: "export"` requires `generateStaticParams` for dynamic routes, the route uses a catch-all rendered fully client-side: implement `[slug]/page.tsx` returning `generateStaticParams` empty + `dynamicParams` behavior via a single client component keyed off `window.location`.

  > Static-export detail routing: `output: "export"` cannot pre-render unknown slugs. Implement the detail route as `src/app/blogs/[slug]/page.tsx` exporting `export function generateStaticParams() { return [{ slug: "_" }]; }` to satisfy the exporter, and have the client component read the real slug from the URL at runtime and fetch it. The export is **flat** (no `trailingSlash`): the single shell is `blogs/_.html`, served for any `/blogs/<slug>` path by the CloudFront rewrite.

- [ ] **Step 1: Blog-detail routing is handled by the consolidated rewrite in Task 13.**

The final `cloudfront-rewrite.js` (see Task 13) maps `/blogs/<slug>` → `/blogs/_.html`, `/blogs/editor/<slug>` → `/blogs/editor/_.html`, and `/` → `/index.html` (portfolio home). No separate rewrite edit is needed here.

- [ ] **Step 2: Write `post-view.tsx`**

```tsx
"use client";
import { useMemo } from "react";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import type { PostRecord } from "@/lib/blog/api";

export function PostView({ post }: { post: PostRecord }) {
  const html = useMemo(
    () => generateHTML(post.body as object, [StarterKit, Image, Link]),
    [post.body]
  );
  return (
    <article className="prose prose-invert font-mono max-w-none">
      <h1 className="text-emerald-400">{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
```

  > `dangerouslySetInnerHTML` renders TipTap-generated HTML from ProseMirror JSON. Since only the authenticated admin can write posts, the trust boundary is the admin; still, keep the extension list minimal (no raw HTML node) so arbitrary script cannot be serialized in.

- [ ] **Step 3: Write `[slug]/page.tsx` and `blog-detail-client.tsx`**

```tsx
// src/app/blogs/[slug]/page.tsx
import { BlogDetailClient } from "./blog-detail-client";
export function generateStaticParams() { return [{ slug: "_" }]; }
export default function Page() { return <BlogDetailClient />; }
```

```tsx
// src/app/blogs/[slug]/blog-detail-client.tsx
"use client";
import { useEffect, useState } from "react";
import { getPost, type PostRecord } from "@/lib/blog/api";
import { PostView } from "@/components/blog/post-view";

export function BlogDetailClient() {
  const [post, setPost] = useState<PostRecord | null>(null);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");
  useEffect(() => {
    const slug = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    getPost(slug).then((p) => { setPost(p); setState("ok"); }).catch(() => setState("error"));
  }, []);
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      {state === "loading" && <p className="font-mono text-neutral-500">loading…</p>}
      {state === "error" && <p className="font-mono text-red-400">post not found</p>}
      {state === "ok" && post && <PostView post={post} />}
    </main>
  );
}
```

- [ ] **Step 4: Build check**

Run: `pnpm build && ls out/blogs/_/index.html`
Expected: shell file exists.

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/post-view.tsx "src/app/blogs/[slug]"
git commit -m "feat(blog-web): post detail page with ProseMirror rendering"
```

### Task 19: Login page + auth guard

**Files:**
- Create: `src/aws-s3-web/src/components/blog/auth-guard.tsx`
- Create: `src/aws-s3-web/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `signIn`, `currentUser` from `auth.ts`.
- Produces: `<AuthGuard>` (redirects to `/login` if no session), `/login` page.

- [ ] **Step 1: Write `auth-guard.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { currentUser } from "@/lib/blog/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    currentUser().then((u) => {
      if (!u) { window.location.href = "/login"; return; }
      setOk(true);
    });
  }, []);
  if (ok === null) return <p className="font-mono text-neutral-500 p-8">checking session…</p>;
  return <>{children}</>;
}
```

- [ ] **Step 2: Write `src/app/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { signIn } from "@/lib/blog/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try { await signIn(email, password); window.location.href = "/blogs/editor"; }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <main className="max-w-sm mx-auto px-4 py-16 font-mono">
      <h1 className="text-xl text-emerald-400 mb-6">~/login</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="border border-emerald-500 text-emerald-400 rounded py-2 hover:bg-emerald-500/10" type="submit">sign in</button>
        {err && <p className="text-red-400 text-sm">{err}</p>}
      </form>
    </main>
  );
}
```

  > First-login note: the Cognito admin user is created with a temporary password (`FORCE_CHANGE_PASSWORD`). Handle the `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED` challenge from Amplify `signIn` by prompting for a new password. Add this branch when wiring; for v1 the admin can also set a permanent password via the AWS console before first login.

- [ ] **Step 3: Build check** — `pnpm build` → `/login` exported.

- [ ] **Step 4: Commit**

```bash
git add src/components/blog/auth-guard.tsx src/app/login/page.tsx
git commit -m "feat(blog-web): login page and client auth guard"
```

### Task 20: Private draft list (`/blogs-draft`)

> **Superseded by path-based revision.** There is no `/admin`. The private listing
> is `src/app/blogs-draft/page.tsx`, wrapped in `<AuthGuard>` + `<BlogShell>`. It
> calls `getIdToken()` then `listPosts(token)` (an authenticated `GET /posts`
> returns every status) and filters to `status !== "published"`. Draft cards link
> to `/blogs/editor/<slug>` (drafts are not publicly reachable). The stale `/admin`
> markup below is illustrative only.


**Files:**
- Create: `src/aws-s3-web/src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `AuthGuard`, `getIdToken`, `listPosts`, `deletePost`.
- Produces: `/admin` route listing all posts (incl. drafts) with edit/delete links and a "new post" link to `/admin/editor`.

- [ ] **Step 1: Write `src/app/admin/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/blog/auth-guard";
import { getIdToken } from "@/lib/blog/auth";
import { listPosts, deletePost, type PostMeta } from "@/lib/blog/api";

function Dashboard() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  async function load() {
    const token = await getIdToken();
    setPosts(await listPosts(token ?? undefined));
  }
  useEffect(() => { load(); }, []);
  async function onDelete(id: string) {
    const token = await getIdToken();
    if (token && confirm("Delete this post?")) { await deletePost(id, token); load(); }
  }
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 font-mono">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl text-emerald-400">~/admin</h1>
        <Link href="/admin/editor" className="border border-emerald-500 text-emerald-400 rounded px-3 py-1">new post</Link>
      </div>
      <ul className="grid gap-2">
        {posts.map((p) => (
          <li key={p.id} className="flex justify-between items-center border border-neutral-800 rounded px-3 py-2">
            <span>{p.title} <em className="text-neutral-500 text-xs">[{p.status}]</em></span>
            <span className="flex gap-3 text-sm">
              <Link href={`/admin/editor?id=${p.id}`} className="text-emerald-400">edit</Link>
              <button onClick={() => onDelete(p.id)} className="text-red-400">del</button>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function AdminPage() { return <AuthGuard><Dashboard /></AuthGuard>; }
```

- [ ] **Step 2: Build check** — `pnpm build` → `/admin` exported.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(blog-web): admin dashboard"
```

### Task 21: TipTap editor (Confluence-style) with image upload

> **Superseded by path-based revision.** Editor routes are `src/app/blogs/editor/page.tsx`
> (create) and `src/app/blogs/editor/[slug]/page.tsx` (edit, `_` shell + client that
> reads the slug from the URL), both `<AuthGuard>`-wrapped. After save: published →
> `/blogs/<slug>`, draft → `/blogs-draft`.


**Files:**
- Create: `src/aws-s3-web/src/components/blog/editor.tsx`
- Create: `src/aws-s3-web/src/components/blog/editor-toolbar.tsx`
- Create: `src/aws-s3-web/src/app/admin/editor/page.tsx`

**Interfaces:**
- Consumes: TipTap, `presignUpload`, `getIdToken`, `createPost`, `updatePost`, `getPost`.
- Produces: `<BlogEditor initial={PostRecord | null} />` and `/admin/editor` route (query `?id=` for edit). Editor uses query-string id (works in static export — no dynamic segment needed).

- [ ] **Step 1: Write `editor-toolbar.tsx`** (formatting buttons + image insert)

```tsx
"use client";
import type { Editor } from "@tiptap/react";
import { getIdToken } from "@/lib/blog/auth";
import { presignUpload } from "@/lib/blog/api";

async function uploadImage(file: File): Promise<string> {
  const token = await getIdToken();
  if (!token) throw new Error("not authenticated");
  const { url, key } = await presignUpload(file.type, token);
  await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
  return `/${key}`; // served via CloudFront /media/*
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  if (!editor) return null;
  const btn = "px-2 py-1 border border-neutral-700 rounded text-xs hover:border-emerald-500";
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await uploadImage(file);
    editor.chain().focus().setImage({ src }).run();
    e.target.value = "";
  }
  return (
    <div className="flex flex-wrap gap-1 mb-2 font-mono">
      <button className={btn} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
      <button className={btn} onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
      <button className={btn} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button className={btn} onClick={() => editor.chain().focus().toggleBulletList().run()}>• list</button>
      <button className={btn} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>code</button>
      <button className={btn} onClick={() => editor.chain().focus().toggleBlockquote().run()}>quote</button>
      <label className={btn + " cursor-pointer"}>img<input type="file" accept="image/*" className="hidden" onChange={onPickImage} /></label>
    </div>
  );
}
```

- [ ] **Step 2: Write `editor.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "./editor-toolbar";
import { getIdToken } from "@/lib/blog/auth";
import { createPost, updatePost, type PostRecord, type PostStatus } from "@/lib/blog/api";

export function BlogEditor({ initial }: { initial: PostRecord | null }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Image, Link, Placeholder.configure({ placeholder: "Write your post…" })],
    content: (initial?.body as object) ?? { type: "doc", content: [] },
    immediatelyRender: false,
  });

  async function save(status: PostStatus) {
    if (!editor) return;
    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("not authenticated");
      const input = {
        title, slug: initial?.slug ?? "", excerpt,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        coverImage: initial?.coverImage ?? null, status,
        body: editor.getJSON(),
      };
      if (initial) await updatePost(initial.id, input, token);
      else await createPost(input, token);
      window.location.href = saved && saved.status === "published" ? `/blogs/${saved.slug}` : "/blogs-draft";
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 font-mono">
      <input className="w-full bg-transparent text-2xl text-emerald-400 mb-3 outline-none" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 mb-2 text-sm" placeholder="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      <input className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 mb-4 text-sm" placeholder="tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
      {editor && <EditorToolbar editor={editor} />}
      <div className="border border-neutral-800 rounded p-4 min-h-[300px]">
        <EditorContent editor={editor} />
      </div>
      <div className="flex gap-3 mt-4">
        <button disabled={saving} onClick={() => save("draft")} className="border border-neutral-600 rounded px-4 py-1">save draft</button>
        <button disabled={saving} onClick={() => save("published")} className="border border-emerald-500 text-emerald-400 rounded px-4 py-1">publish</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/app/admin/editor/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/blog/auth-guard";
import { BlogEditor } from "@/components/blog/editor";
import { getIdToken } from "@/lib/blog/auth";
import { getPost, listPosts, type PostRecord } from "@/lib/blog/api";

function EditorRoute() {
  const [initial, setInitial] = useState<PostRecord | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setReady(true); return; }
    (async () => {
      const token = await getIdToken();
      const all = await listPosts(token ?? undefined);
      const meta = all.find((p) => p.id === id);
      if (meta) setInitial(await getPost(meta.slug, token ?? undefined));
      setReady(true);
    })();
  }, []);
  if (!ready) return <p className="font-mono text-neutral-500 p-8">loading…</p>;
  return <BlogEditor initial={initial} />;
}

export default function Page() { return <AuthGuard><EditorRoute /></AuthGuard>; }
```

- [ ] **Step 4: Build check** — `pnpm build` → `/admin/editor` exported; verify no SSR errors (all editor components are client + `immediatelyRender: false`).

- [ ] **Step 5: Commit**

```bash
git add src/components/blog/editor.tsx src/components/blog/editor-toolbar.tsx src/app/admin/editor/page.tsx
git commit -m "feat(blog-web): TipTap Confluence-style editor with image upload"
```

### Task 22: Link the blog from the portfolio + env example

**Files:**
- Modify: `src/aws-s3-web/src/components/blogs-section.tsx` (add a link to the `/blogs` path)
- Create: `src/aws-s3-web/.env.example`

**Interfaces:**
- Produces: `.env.example` documenting `NEXT_PUBLIC_USER_POOL_ID`, `NEXT_PUBLIC_USER_POOL_CLIENT_ID`.

- [ ] **Step 1: Add env example**

```bash
# .env.example
NEXT_PUBLIC_USER_POOL_ID=
NEXT_PUBLIC_USER_POOL_CLIENT_ID=
```

- [ ] **Step 2: Add a "Visit the blog" link** in `blogs-section.tsx` pointing to the same-origin `/blogs` path (match existing markup/styles in that component; read it first and append a link element).

- [ ] **Step 3: Build + commit**

Run: `pnpm build`
```bash
git add src/components/blogs-section.tsx .env.example
git commit -m "feat(blog-web): link portfolio blog section to /blogs"
```

---

## Phase 5 — CI/CD & deploy

### Task 23: CI workflow (PR) for backend + frontend

**Files:**
- Create: `.github/workflows/blog-ci.yml`

**Interfaces:**
- Produces: PR checks: backend `pnpm test`, frontend `pnpm test` + `pnpm build`. Terraform plan is handled by the existing `terraform-plan.yml` matrix (auto-discovers the new dir).

- [ ] **Step 1: Write `.github/workflows/blog-ci.yml`**

```yaml
name: Blog CI
on:
  pull_request:
    paths:
      - "src/blog-backend/**"
      - "src/aws-s3-web/**"
      - ".github/workflows/blog-ci.yml"
jobs:
  backend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: src/blog-backend } }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm, cache-dependency-path: src/blog-backend/pnpm-lock.yaml }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
  frontend:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: src/aws-s3-web } }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm, cache-dependency-path: src/aws-s3-web/pnpm-lock.yaml }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - env: { NEXT_PUBLIC_USER_POOL_ID: placeholder, NEXT_PUBLIC_USER_POOL_CLIENT_ID: placeholder }
        run: pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/blog-ci.yml
git commit -m "ci(blog): PR checks for backend and frontend"
```

### Task 24: Deploy workflows (main)

> **Superseded by path-based revision.** Deploy is split in two:
> - `blog-deploy.yml` (paths `src/aws-s3-web/backend/**` + `inf/terraform/aws-blog-serverless/**`): builds the Lambda bundle and runs `terraform apply` (backend + infra only). It reports the outputs to set as repo variables: `BLOG_USER_POOL_ID`, `BLOG_USER_POOL_CLIENT_ID`, `PROD_CLOUDFRONT_DISTRIBUTION_ID`. No frontend build/sync/invalidate, and no `site_bucket_name` output.
> - `aws-s3-web-sync-prod.yml`: builds the static export (with `NEXT_PUBLIC_USER_POOL_ID` / `NEXT_PUBLIC_USER_POOL_CLIENT_ID`) and syncs it to `s3.nghuy.link`, then invalidates `PROD_CLOUDFRONT_DISTRIBUTION_ID` (the apex distribution).


**Files:**
- Create: `.github/workflows/blog-deploy.yml`

**Interfaces:**
- Consumes: repo variables/secrets following the existing OIDC pattern (`AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `STATE_BUCKET_NAME`, `LOCK_TABLE_NAME`). New vars: `BLOG_SITE_BUCKET_NAME`, `BLOG_MEDIA_BUCKET_NAME`, `BLOG_ROOT_DOMAIN`, `BLOG_ROUTE53_ZONE_ID`, `BLOG_ADMIN_EMAIL`.
- Produces: deployed stack + synced SPA.

- [ ] **Step 1: Write `.github/workflows/blog-deploy.yml`**

```yaml
name: Blog Deploy
on:
  push:
    branches: [main]
    paths:
      - "src/blog-backend/**"
      - "src/aws-s3-web/**"
      - "inf/terraform/aws-blog-serverless/**"
      - ".github/workflows/blog-deploy.yml"
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: hashicorp/setup-terraform@v3
        with: { terraform_version: 1.9.0 }
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION }}

      - name: Build Lambda bundle
        working-directory: src/blog-backend
        run: pnpm install --frozen-lockfile && pnpm build

      - name: Terraform apply
        working-directory: inf/terraform/aws-blog-serverless
        run: |
          terraform init \
            -backend-config="bucket=${{ vars.STATE_BUCKET_NAME }}" \
            -backend-config="key=blog/terraform.tfstate" \
            -backend-config="region=${{ vars.AWS_REGION }}" \
            -backend-config="dynamodb_table=${{ vars.LOCK_TABLE_NAME }}"
          terraform apply -auto-approve \
            -var="aws_region=${{ vars.AWS_REGION }}" \
            -var="root_domain=${{ vars.BLOG_ROOT_DOMAIN }}" \
            -var="route53_zone_id=${{ vars.BLOG_ROUTE53_ZONE_ID }}" \
            -var="site_bucket_name=${{ vars.BLOG_SITE_BUCKET_NAME }}" \
            -var="media_bucket_name=${{ vars.BLOG_MEDIA_BUCKET_NAME }}" \
            -var="admin_email=${{ vars.BLOG_ADMIN_EMAIL }}"

      - name: Capture outputs
        id: tf
        working-directory: inf/terraform/aws-blog-serverless
        run: |
          echo "pool_id=$(terraform output -raw user_pool_id)" >> "$GITHUB_OUTPUT"
          echo "client_id=$(terraform output -raw user_pool_client_id)" >> "$GITHUB_OUTPUT"
          echo "site_bucket=$(terraform output -raw site_bucket_name)" >> "$GITHUB_OUTPUT"
          echo "dist_id=$(terraform output -raw distribution_id)" >> "$GITHUB_OUTPUT"

      - name: Build frontend
        working-directory: src/aws-s3-web
        env:
          NEXT_PUBLIC_USER_POOL_ID: ${{ steps.tf.outputs.pool_id }}
          NEXT_PUBLIC_USER_POOL_CLIENT_ID: ${{ steps.tf.outputs.client_id }}
        run: pnpm install --frozen-lockfile && pnpm build

      - name: Sync to S3
        working-directory: src/aws-s3-web
        run: aws s3 sync out/ "s3://${{ steps.tf.outputs.site_bucket }}" --delete

      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id ${{ steps.tf.outputs.dist_id }} --paths "/*"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/blog-deploy.yml
git commit -m "ci(blog): deploy workflow (apply + sync + invalidate)"
```

### Task 25: README + first manual deploy verification

**Files:**
- Create: `inf/terraform/aws-blog-serverless/README.md`

**Interfaces:**
- Produces: setup/teardown docs and the manual verification checklist below.

- [ ] **Step 1: Write `README.md`** documenting: prerequisites, the new repo variables to set (`BLOG_*`), the IAM deploy-role permissions needed (add `ec2:*Vpc*/*Subnet*/*SecurityGroup*/*NetworkInterface*/*RouteTable*/*VpcEndpoint*`, `cognito-idp:*`, `apigateway:*`, `lambda:*`, `dynamodb:*`, `cloudfront:*`, `acm:*`, `route53:*`, `s3:*` for the two buckets, `iam:*Role*` for the Lambda role), and the teardown steps (empty the media bucket — the site bucket is external — then `terraform destroy`).

- [ ] **Step 2: Manual verification checklist** (run once after first deploy)

```
[ ] terraform apply completes; ACM cert validates (DNS); apex A/AAAA point at the new distribution (E3MGWTP58YX35G retired); sync workflow's CLOUDFRONT_DISTRIBUTION_ID repointed.
[ ] https://nghuy.link/ still loads the portfolio home.
[ ] https://nghuy.link/blogs loads the blogs home (empty list).
[ ] Set admin password (console) or complete NEW_PASSWORD challenge at /login.
[ ] /login → sign in → redirected to /blogs/editor.
[ ] Create a post with text + an image → publish.
[ ] Image PUT to presigned URL succeeds; image renders via /media/*.
[ ] /blogs shows the published post; detail page renders body + image.
[ ] A draft is hidden from /blogs but visible in /blogs-draft.
[ ] curl https://nghuy.link/api/posts returns published JSON (200).
[ ] curl -XPOST https://nghuy.link/api/posts (no token) returns 401.
```

- [ ] **Step 3: Commit**

```bash
git add inf/terraform/aws-blog-serverless/README.md
git commit -m "docs(blog): stack README and deploy verification checklist"
```

---

## Self-Review Notes

- **Spec coverage:** home (Task 17), detail (Task 18), create/edit (Task 21), login (Task 19), Cognito (Tasks 5,16,19), Lambda (Tasks 6–12), DynamoDB+S3 (Tasks 3,4,9), VPC + endpoints no NAT (Task 2), all Terraform (Phases 1&3), source in `src/aws-s3-web` (Phase 4), terminal theme (Tasks 17–21 reuse tokens), image upload + rich editor (Task 21), Confluence-style editor = TipTap (Task 21). All covered.
- **Known reconciliations flagged in-plan:** Task 12 Step 1 unifies the post path parameter to `{key}` (updates Task 10 code); Task 18 Step 1 updates the CloudFront rewrite for detail routing. Implementers must apply these in order.
- **Static-export constraint:** dynamic `[slug]` uses a single `_` shell + client fetch + CloudFront rewrite (Task 18); editor uses `?id=` query rather than a dynamic segment (Task 21) to stay export-compatible.
- **Deferred/loose ends to resolve during implementation:** exact terminal-theme Tailwind class names (read `globals.css` + an existing section component and match), the Cognito NEW_PASSWORD first-login challenge branch (Task 19 note), and confirming the deploy IAM role has the expanded permission set (Task 25).
```
