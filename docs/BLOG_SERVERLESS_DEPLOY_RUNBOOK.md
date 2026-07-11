# Serverless Blog — First-Time Production Deploy Runbook

**Scope:** Bring the serverless blog (portfolio + blog + API + media, served same-origin
at apex `nghuy.link`) live in production for the **first time**.

**Status at time of writing (2026-07-12):**
- The entire feature lives on branch `feat/blogs-serverless-blog` as open **PR #45 → `main`**
  (46 commits). None of it is on `main`, so **nothing is deployed yet**.
- The unified stack `inf/terraform/aws-s3-web/` (portfolio site **and** blog, one
  state) has **never been applied** as a module. The site bucket `s3.nghuy.link`
  exists out-of-band and is **imported** into state on the first apply.
- Repo config is unset: only variable `S3_BUCKET_NAME` exists; `AWS_DEPLOY_ROLE_ARN`
  secret and all blog variables are missing.

> ⚠️ This deploy **repoints apex `nghuy.link`'s CloudFront** to the new distribution,
> retiring the previous out-of-band distribution `E3MGWTP58YX35G`. It is a real,
> hard-to-reverse change to the live site's serving path.

---

## Architecture (what gets provisioned)

```
Cognito ── CloudFront (nghuy.link) ┬─ /*       → S3 website bucket s3.nghuy.link (Next.js static export)
                                    ├─ /media/* → S3 media bucket (images, OAC)
                                    └─ /api/*   → API Gateway → Lambda (VPC) → DynamoDB + S3
   Lambda reaches AWS via VPC endpoints: DynamoDB (gateway), S3 (gateway), CloudWatch Logs (interface).
```

Two workflows drive deployment, both off `main`:
- `.github/workflows/blog-deploy.yml` — backend/infra: builds the Lambda bundle,
  imports the site bucket on first run, runs `terraform apply` on
  `inf/terraform/aws-s3-web/`. Triggers on push to `main` under
  `src/aws-s3-web/backend/**` or `inf/terraform/aws-s3-web/**`.
- `.github/workflows/aws-s3-web-sync-prod.yml` — frontend: builds the Next.js static
  export (baking in Cognito config), syncs to `s3.nghuy.link`, invalidates CloudFront.
  Triggers on push to `main` under `src/aws-s3-web/**`.

---

## A. Prerequisites in AWS (NOT created by this stack — must exist first)

- [ ] **OIDC deploy role** for `AWS_DEPLOY_ROLE_ARN` — IAM role trusting GitHub OIDC,
  with a broad provisioning policy: `ec2:*` (VPC/subnets/route-tables/security-groups/
  network-interfaces/VPC-endpoints), `dynamodb:*`, `lambda:*`, `cognito-idp:*`,
  `apigateway:*`, `cloudfront:*`, `acm:*`, `route53:*`, `logs:*`, `s3:*` (scoped to the
  site bucket `s3.nghuy.link` **and** the media bucket — the site bucket is imported
  and managed on first apply), and `iam:*Role*` / `iam:PassRole` for the Lambda
  execution role, plus read/write on the state bucket + lock table. Security-sensitive
  — owner-created.
- [ ] **Terraform state bucket + DynamoDB lock table** (reuse the repo's existing ones).
- [ ] **Route53 hosted zone** for `nghuy.link` (its zone ID is an input below).

## B. Repo config to set (Settings → Secrets and variables → Actions)

| Kind | Name | Value |
|------|------|-------|
| secret | `AWS_DEPLOY_ROLE_ARN` | *(your OIDC deploy role ARN)* |
| var | `AWS_REGION` | `ap-southeast-1` |
| var | `STATE_BUCKET_NAME` | *(existing TF state bucket)* |
| var | `LOCK_TABLE_NAME` | *(existing TF lock table)* |
| var | `BLOG_ROOT_DOMAIN` | `nghuy.link` |
| var | `BLOG_ROUTE53_ZONE_ID` | *(hosted zone ID for nghuy.link)* |
| var | `BLOG_SITE_BUCKET_NAME` | `s3.nghuy.link` |
| var | `BLOG_MEDIA_BUCKET_NAME` | *(new globally-unique bucket, e.g. `blogs-nghuy-link-media-<acct-id>`)* |
| var | `BLOG_ADMIN_EMAIL` | *(admin login email)* |

The three **frontend-wiring** variables below are set **later** (section C, step 3) from
the backend `terraform apply` outputs — they do not exist until the backend is applied:

| Kind | Name | Source (blog-deploy output) |
|------|------|------------------------------|
| var | `BLOG_USER_POOL_ID` | `user_pool_id` |
| var | `BLOG_USER_POOL_CLIENT_ID` | `user_pool_client_id` |
| var | `PROD_CLOUDFRONT_DISTRIBUTION_ID` | `distribution_id` |

## C. Deploy sequence

> **Ordering caveat:** the frontend workflow needs the Cognito + CloudFront IDs that only
> exist *after* the backend applies. `workflow_dispatch` is unavailable until the workflow
> files reach `main`. So the first merge fires both workflows, and the frontend run is
> expected to fail once (on the CloudFront invalidation) until the wiring vars are set.

1. **[you]** Complete sections A and B.
2. **[you]** Merge **PR #45** → `main`. Both workflows fire:
   - `blog-deploy.yml`: imports the existing `s3.nghuy.link` bucket (first run
     only), then `terraform apply` provisions the full stack ✅
   - `aws-s3-web-sync-prod.yml`: syncs the site to S3, then **fails on CloudFront
     invalidation** (distribution ID not set yet) — this single red run is expected.
3. **[assistant]** Read the `blog-deploy` run summary; set the three wiring vars from
   `user_pool_id` / `user_pool_client_id` / `distribution_id` (via `gh variable set`).
4. **[assistant]** Re-run `aws-s3-web-sync-prod.yml` (now dispatchable on `main`). It
   rebuilds with Cognito config baked in, syncs, and invalidates cleanly ✅.
5. **[you + assistant]** Walk the post-deploy verification checklist (section D).

## D. Post-deploy verification

(From `inf/terraform/aws-s3-web/README.md`.)

- [ ] `terraform apply` completes; ACM cert validates (DNS).
- [ ] `https://nghuy.link/` still loads the portfolio home.
- [ ] `https://nghuy.link/blogs` loads the blogs home (empty list at first).
- [ ] Set admin password: sign in at `/login` with the temporary password Cognito
      emailed, then complete the new-password prompt (or set one in the console).
- [ ] `/login` → sign in → redirected to `/blogs/editor`.
- [ ] Create a post with text + an image → publish.
- [ ] Image PUT to the presigned URL succeeds; image renders via `/media/*`.
- [ ] `/blogs` shows the published post; the detail page renders body + image.
- [ ] A draft is hidden from `/blogs` but visible in `/blogs-draft`.
- [ ] `curl https://nghuy.link/api/posts` returns published JSON (200).
- [ ] `curl -XPOST https://nghuy.link/api/posts` (no token) returns 401.
- [ ] The portfolio blogs section shows the 6 latest published posts (this branch's change).

## E. Rollback / teardown notes

- The media bucket must be emptied before `terraform destroy` (no `force_destroy`):
  `aws s3 rm "s3://<BLOG_MEDIA_BUCKET_NAME>" --recursive` then `terraform destroy` with
  the same `-backend-config` + `-var` flags as apply.
- The site bucket `s3.nghuy.link` is now **managed by this stack** (imported on first
  apply). A `terraform destroy` would delete it — to keep it, run
  `terraform state rm aws_s3_bucket.website` first, or empty/back up its objects.
- Reverting the apex repoint means restoring the prior distribution's Route53 A/AAAA
  records; keep note of `E3MGWTP58YX35G` in case a fast rollback is needed.

---

## Reference

- Stack module + detailed docs: `inf/terraform/aws-s3-web/README.md`
- Backend deploy workflow: `.github/workflows/blog-deploy.yml`
- Frontend sync workflow: `.github/workflows/aws-s3-web-sync-prod.yml`
- PR: #45 — `feat(blog): serverless blog at blogs.nghuy.link`
