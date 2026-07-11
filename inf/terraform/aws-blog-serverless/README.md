# Serverless Blog — `blogs.nghuy.link`

Terraform root module for the self-managed blog on `blogs.nghuy.link`. It maps
to the AWS Well-Architected serverless web-application reference, adapted to run
the backend **inside a VPC** using VPC endpoints (no NAT Gateway).

```
Cognito ── CloudFront (blogs.nghuy.link) ┬─ /        → S3 (Next.js static-export SPA)
                                          ├─ /media/* → S3 media bucket (images, OAC)
                                          └─ /api/*   → API Gateway → Lambda (VPC) → DynamoDB + S3
   Lambda reaches AWS via VPC endpoints: DynamoDB (gateway), S3 (gateway), CloudWatch Logs (interface).
```

- **Public read / admin write.** `GET /api/posts` and `GET /api/posts/{key}` are
  open; `POST/PUT/DELETE` and `POST /api/uploads` require a Cognito JWT.
- **Single admin.** Cognito self-signup is disabled; the admin user is seeded
  from `admin_email`.
- **Post storage.** DynamoDB holds metadata + indexes; post bodies (TipTap
  ProseMirror JSON) and images live in the media S3 bucket.

## Layout

| File | Contents |
|------|----------|
| `provider.tf` | Terraform + AWS providers (default region + aliased `us_east_1`), S3 backend |
| `network.tf` | VPC, 2 private subnets, route table, security groups, VPC endpoints |
| `data.tf` | DynamoDB `blog-posts` table + `gsi1` (listing) / `gsi2` (slug lookup) |
| `storage.tf` | Private site + media S3 buckets |
| `cognito.tf` | User pool (admin-only signup), SPA app client, admin user |
| `lambda.tf` | VPC-attached Lambda + least-privilege IAM + log group |
| `api.tf` | API Gateway REST API, Cognito authorizer on writes, `v1` stage |
| `cdn.tf` | ACM cert (us-east-1), CloudFront + OAC + rewrite functions, Route53, bucket policies |
| `cloudfront-rewrite.js` | Viewer-request function mapping clean URLs to the flat Next export layout |

## Prerequisites

- The Lambda bundle must be built before `terraform apply` (the deploy workflow
  does this): `cd src/aws-s3-web/backend && pnpm install && pnpm build` → produces
  `dist/handler.mjs`, which `archive_file` zips.
- A Route53 hosted zone for the apex domain (`root_domain`); pass its ID as
  `route53_zone_id`.
- Remote state backend (reuses the repo's existing state bucket + lock table)
  configured via `-backend-config` at `terraform init`.

## Deploy (CI)

`/.github/workflows/blog-deploy.yml` runs on pushes to `main` under this path.
Set these **repository variables** and **secret** (OIDC, no static keys):

| Kind | Name | Value |
|------|------|-------|
| var | `AWS_REGION` | e.g. `ap-southeast-1` |
| var | `STATE_BUCKET_NAME` | existing Terraform state bucket |
| var | `LOCK_TABLE_NAME` | existing Terraform lock table |
| var | `BLOG_ROOT_DOMAIN` | `nghuy.link` |
| var | `BLOG_ROUTE53_ZONE_ID` | hosted zone ID for `nghuy.link` |
| var | `BLOG_SITE_BUCKET_NAME` | new globally-unique bucket for the SPA |
| var | `BLOG_MEDIA_BUCKET_NAME` | new globally-unique bucket for bodies + images |
| var | `BLOG_ADMIN_EMAIL` | admin login email |
| secret | `AWS_DEPLOY_ROLE_ARN` | IAM role the workflow assumes via GitHub OIDC |

The deploy role's policy must allow (in addition to read/write on the state
bucket + lock table): `ec2:*` for VPCs/subnets/route-tables/security-groups/
network-interfaces/VPC-endpoints, plus `dynamodb:*`, `lambda:*`,
`cognito-idp:*`, `apigateway:*`, `cloudfront:*`, `acm:*`, `route53:*`, `logs:*`,
`s3:*` (scoped to the two blog buckets), and `iam:*Role*`/`iam:PassRole` for the
Lambda execution role.

## Local plan

```bash
cd src/aws-s3-web/backend && pnpm install && pnpm build && cd -
cd inf/terraform/aws-blog-serverless
cp terraform.tfvars.example terraform.tfvars   # fill in real values
terraform init \
  -backend-config="bucket=<STATE_BUCKET>" \
  -backend-config="key=blog/terraform.tfstate" \
  -backend-config="region=<REGION>" \
  -backend-config="dynamodb_table=<LOCK_TABLE>"
terraform plan
```

## Post-deploy verification

```
[ ] terraform apply completes; ACM cert validates (DNS).
[ ] https://blogs.nghuy.link loads the blogs home (empty list).
[ ] Set admin password: sign in at /login with the temporary password Cognito
    emailed, then complete the new-password prompt (or set one in the console).
[ ] /login → sign in → redirected to /admin.
[ ] Create a post with text + an image → publish.
[ ] Image PUT to the presigned URL succeeds; image renders via /media/*.
[ ] Home list shows the published post; the detail page renders body + image.
[ ] A draft post is hidden from the public list but visible in /admin.
[ ] curl https://blogs.nghuy.link/api/posts returns published JSON (200).
[ ] curl -XPOST https://blogs.nghuy.link/api/posts (no token) returns 401.
```

## Tear down

Both S3 buckets must be emptied before `terraform destroy` (no `force_destroy`):

```bash
aws s3 rm "s3://<BLOG_SITE_BUCKET_NAME>" --recursive
aws s3 rm "s3://<BLOG_MEDIA_BUCKET_NAME>" --recursive
terraform destroy   # same -backend-config + -var flags as apply
```
