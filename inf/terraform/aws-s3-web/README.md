# aws-s3-web — Portfolio Static Site + Serverless Blog

Single Terraform root module for **`nghuy.link`**. It owns both:

1. **The portfolio static-site bucket** (`s3.nghuy.link`) — a public S3 website
   holding the Next.js static export (portfolio home + blog UI).
2. **The serverless blog** served same-origin under `/blogs` — a CloudFront apex
   distribution, API Gateway → Lambda (in a VPC) → DynamoDB + a private media
   bucket, with Cognito for the single admin user.

Everything lives in **one state**. The module is **production-only**: the apex
domain, ACM cert, and Route53 records only make sense for production. Staging
remains a plain out-of-band `aws s3 sync` (see `aws-s3-web-sync-staging.yml`) and
is not managed here.

```
Cognito ── CloudFront (nghuy.link) ┬─ /*       → S3 website bucket s3.nghuy.link (Next.js static export)
                                    ├─ /media/* → S3 media bucket (images, OAC)
                                    └─ /api/*   → API Gateway → Lambda (VPC) → DynamoDB + S3
   Lambda reaches AWS via VPC endpoints: DynamoDB (gateway), S3 (gateway), CloudWatch Logs (interface).
```

**Routing** (resolved at the edge by `cloudfront-rewrite.js`):

| Path | Access | Purpose |
|------|--------|---------|
| `/` | public | portfolio home |
| `/blogs` | public | list published posts |
| `/blogs/<slug>` | public | post detail |
| `/login` | public | Cognito sign-in (auth entry) |
| `/blogs-draft` | private | list draft posts |
| `/blogs/editor` | private | create a post |
| `/blogs/editor/<slug>` | private | edit a post |

Private routes are gated client-side (redirect to `/login`); real enforcement is
the API Gateway Cognito authorizer on writes and draft reads.

## Layout

| File | Contents |
|------|----------|
| `provider.tf` | Terraform + AWS providers (default region + aliased `us_east_1`), S3 backend |
| `main.tf` | Portfolio static-website S3 bucket (public website, versioning, policy, encryption) |
| `variables.tf` | All inputs (site bucket knobs + blog inputs) |
| `locals.tf` | `common_tags`, `name_prefix`, apex `domain` |
| `outputs.tf` | Site bucket outputs + blog outputs (distribution/user-pool/api IDs) |
| `network.tf` | VPC, 2 private subnets, route table, security groups, VPC endpoints |
| `dynamodb.tf` | DynamoDB `blog-posts` table + `gsi1` (listing) / `gsi2` (slug lookup) |
| `storage.tf` | Private media S3 bucket |
| `cognito.tf` | User pool (admin-only signup), SPA app client, admin user |
| `lambda.tf` | VPC-attached Lambda + least-privilege IAM + log group |
| `api.tf` | API Gateway REST API, Cognito authorizer on writes, `v1` stage |
| `cdn.tf` | ACM cert (us-east-1), CloudFront (apex) + media OAC + rewrite functions, Route53, media bucket policy |
| `cloudfront-rewrite.js` | Viewer-request function mapping clean URLs to the flat Next export layout |

## Prerequisites

- The Lambda bundle must be built before `terraform apply` (the deploy workflow
  does this): `cd src/aws-s3-web/backend && pnpm install && pnpm build` → produces
  `dist/handler.mjs`, which `archive_file` zips.
- A Route53 hosted zone for the apex domain (`root_domain`); pass its ID as
  `route53_zone_id`.
- Remote state backend (reuses the repo's existing state bucket + lock table)
  configured via `-backend-config` at `terraform init`.

### First apply: import the existing site bucket

`s3.nghuy.link` already exists out-of-band (created/synced by the sync workflow
before this module managed it). Import it once so the first apply doesn't collide:

```bash
terraform import aws_s3_bucket.website s3.nghuy.link
```

The `blog-deploy.yml` workflow does this idempotently
(`terraform state list | grep -q aws_s3_bucket.website || terraform import ...`).
Only the bucket itself needs importing; the sub-config resources (versioning,
encryption, public-access-block, policy, website config) apply cleanly over the
existing bucket.

## Deploy (CI)

`.github/workflows/blog-deploy.yml` runs on pushes to `main` under this path or
`src/aws-s3-web/backend/**`. Set these **repository variables** and **secret**
(OIDC, no static keys):

| Kind | Name | Value |
|------|------|-------|
| var | `AWS_REGION` | e.g. `ap-southeast-1` |
| var | `STATE_BUCKET_NAME` | existing Terraform state bucket |
| var | `LOCK_TABLE_NAME` | existing Terraform lock table |
| var | `BLOG_ROOT_DOMAIN` | `nghuy.link` |
| var | `BLOG_ROUTE53_ZONE_ID` | hosted zone ID for `nghuy.link` |
| var | `BLOG_SITE_BUCKET_NAME` | website bucket serving the app (`s3.nghuy.link`) |
| var | `BLOG_MEDIA_BUCKET_NAME` | new globally-unique bucket for bodies + images |
| var | `BLOG_ADMIN_EMAIL` | admin login email |
| secret | `AWS_DEPLOY_ROLE_ARN` | IAM role the workflow assumes via GitHub OIDC |

The deploy role's policy must allow (in addition to read/write on the state
bucket + lock table): `ec2:*` for VPCs/subnets/route-tables/security-groups/
network-interfaces/VPC-endpoints, plus `dynamodb:*`, `lambda:*`,
`cognito-idp:*`, `apigateway:*`, `cloudfront:*`, `acm:*`, `route53:*`, `logs:*`,
`s3:*` (scoped to the site bucket `s3.nghuy.link` **and** the media bucket), and
`iam:*Role*`/`iam:PassRole` for the Lambda execution role.

## Local plan

```bash
cd src/aws-s3-web/backend && pnpm install && pnpm build && cd -
cd inf/terraform/aws-s3-web
cp terraform.tfvars.example terraform.tfvars   # fill in real values
terraform init \
  -backend-config="bucket=<STATE_BUCKET>" \
  -backend-config="key=aws-s3-web/terraform.tfstate" \
  -backend-config="region=<REGION>" \
  -backend-config="dynamodb_table=<LOCK_TABLE>"
terraform import aws_s3_bucket.website s3.nghuy.link   # first time only
terraform plan
```

## Post-deploy verification

This distribution takes over the apex `nghuy.link`. After `terraform apply`, the
Route53 A/AAAA records for `nghuy.link` point at this distribution, retiring the
previous out-of-band distribution (`E3MGWTP58YX35G`). Repoint the
`aws-s3-web-sync-prod` workflow's `PROD_CLOUDFRONT_DISTRIBUTION_ID` to the new
`distribution_id` output.

```
[ ] terraform apply completes; ACM cert validates (DNS).
[ ] https://nghuy.link/ still loads the portfolio home.
[ ] https://nghuy.link/blogs loads the blogs home (empty list).
[ ] Set admin password: sign in at /login with the temporary password Cognito
    emailed, then complete the new-password prompt (or set one in the console).
[ ] /login → sign in → redirected to /blogs/editor.
[ ] Create a post with text + an image → publish.
[ ] Image PUT to the presigned URL succeeds; image renders via /media/*.
[ ] /blogs shows the published post; the detail page renders body + image.
[ ] A draft is hidden from /blogs but visible in /blogs-draft.
[ ] curl https://nghuy.link/api/posts returns published JSON (200).
[ ] curl -XPOST https://nghuy.link/api/posts (no token) returns 401.
```

## Tear down

The media bucket must be emptied before `terraform destroy` (no `force_destroy`).

```bash
aws s3 rm "s3://<BLOG_MEDIA_BUCKET_NAME>" --recursive
terraform destroy   # same -backend-config + -var flags as apply
```

> ⚠️ `terraform destroy` will also delete the site bucket `s3.nghuy.link` (now
> managed here). Empty it first if you intend to keep the objects.
