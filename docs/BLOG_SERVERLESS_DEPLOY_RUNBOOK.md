# Serverless Blog — Production Deploy Runbook

**Scope:** Bring the serverless blog (portfolio + blog + API + media, served same-origin
at apex `nghuy.link`) live in production. Retained as a rebuild/DR runbook.

**Status: ✅ DEPLOYED (2026-07-12).** The unified stack `inf/terraform/aws-s3-web/`
(portfolio site **and** blog, one state, production-only) is applied and live at
`https://nghuy.link`. Key facts of the live deployment:

| Item | Value |
|------|-------|
| Apex distribution (new) | `E344PIZPEIRDFM` (`dvw75ke9tyb60.cloudfront.net`) |
| Retired distribution | `E3MGWTP58YX35G` — now serves only `s3.nghuy.link` |
| Cognito user pool / client | `ap-southeast-1_bCo60GwJy` / `4mj666q9j8tkhbbhgb8j9u7jlc` |
| TF state | `s3://aws-github-oidc-tfstate-010382427026/aws-s3-web/terraform.tfstate` |
| TF lock table | `aws-github-oidc-tfstate-lock` |
| Deploy role | `github-actions-blog-deploy` (IaC: `inf/terraform/aws-github-oidc/blog-deploy-role.tf`) |
| Route53 zone | `Z10168803Q16IBJCR6YRD` |

> ⚠️ This deploy **repointed apex `nghuy.link`'s CloudFront** to the new distribution,
> retiring the previous out-of-band distribution `E3MGWTP58YX35G`. Freeing the apex
> CNAME caused a short apex outage during the cutover (see §C / §F).

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

## A. Prerequisites in AWS

- [x] **OIDC deploy role** (`AWS_DEPLOY_ROLE_ARN`) — now **managed as code** in
  `inf/terraform/aws-github-oidc/blog-deploy-role.tf` (role `github-actions-blog-deploy`,
  trust scoped to `repo:HuyNguyen260398/devops-engineer-profile:ref:refs/heads/main`).
  Data-plane perms (S3, DynamoDB, Lambda, Logs, IAM) are scoped to `blog-*` resources +
  the TF state; control-plane services it must provision (`ec2:*`, `cognito-idp:*`,
  `apigateway:*`, `cloudfront:*`, `acm:*`, `route53:*`) are broad. Note: `logs:*` is
  scoped to `blog-*` **plus** a separate `logs:DescribeLogGroups` on `*` (a list action
  that cannot be ARN-scoped). Apply with `terraform apply -var-file=environments/prod.tfvars`.
- [x] **Terraform state bucket + DynamoDB lock table** — reused the repo's existing
  `aws-github-oidc-tfstate-010382427026` + `aws-github-oidc-tfstate-lock`.
- [x] **Route53 hosted zone** for `nghuy.link` — `Z10168803Q16IBJCR6YRD`.

## B. Repo config (Settings → Secrets and variables → Actions)

| Kind | Name | Live value |
|------|------|-------|
| secret | `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::010382427026:role/github-actions-blog-deploy` |
| var | `AWS_REGION` | `ap-southeast-1` |
| var | `STATE_BUCKET_NAME` | `aws-github-oidc-tfstate-010382427026` |
| var | `LOCK_TABLE_NAME` | `aws-github-oidc-tfstate-lock` |
| var | `BLOG_ROOT_DOMAIN` | `nghuy.link` |
| var | `BLOG_ROUTE53_ZONE_ID` | `Z10168803Q16IBJCR6YRD` |
| var | `BLOG_SITE_BUCKET_NAME` | `s3.nghuy.link` |
| var | `BLOG_MEDIA_BUCKET_NAME` | `blogs-nghuy-link-media-010382427026` |
| var | `BLOG_ADMIN_EMAIL` | `huynguyen260398@gmail.com` |

The three **frontend-wiring** variables are set from the backend `terraform apply`
outputs (they don't exist until the backend is applied):

| Kind | Name | Source (blog-deploy output) | Live value |
|------|------|------------------------------|-----------|
| var | `BLOG_USER_POOL_ID` | `user_pool_id` | `ap-southeast-1_bCo60GwJy` |
| var | `BLOG_USER_POOL_CLIENT_ID` | `user_pool_client_id` | `4mj666q9j8tkhbbhgb8j9u7jlc` |
| var | `PROD_CLOUDFRONT_DISTRIBUTION_ID` | `distribution_id` | `E344PIZPEIRDFM` |

## C. Deploy sequence (as executed)

> **Ordering caveat:** the frontend workflow needs the Cognito + CloudFront IDs that only
> exist *after* the backend applies, so the first frontend run fails once on the CloudFront
> invalidation until the wiring vars are set.

1. **[you]** Complete sections A and B.
2. **[you]** Merge the feature PR → `main`. Both workflows fire:
   - `blog-deploy.yml`: imports the existing `s3.nghuy.link` bucket (first run only),
     then `terraform apply` provisions the full stack.
   - `aws-s3-web-sync-prod.yml`: syncs the site to S3, then **fails on CloudFront
     invalidation** (distribution ID not set yet) — this single red run is expected.
3. **[assistant]** Read the `blog-deploy` outputs; set `BLOG_USER_POOL_ID`,
   `BLOG_USER_POOL_CLIENT_ID`, `PROD_CLOUDFRONT_DISTRIBUTION_ID` (`gh variable set`).
4. **[assistant]** Point the sync role's invalidation at the new distribution:
   re-apply `aws-github-oidc` with `cloudfront_distribution_id_prod=<new id>` (the sync
   role `github-actions-s3-sync-role` only allows `cloudfront:CreateInvalidation` on the
   configured distribution).
5. **[assistant]** Re-run `aws-s3-web-sync-prod.yml` (`workflow_dispatch` on `main`). It
   rebuilds with Cognito config baked in, syncs, and invalidates cleanly.
6. **[you + assistant]** Walk the verification checklist (§D).

> **First apply is iterative.** On a genuinely-first apply the `terraform apply` step is
> expected to fail and be re-run several times as the issues in §F are resolved. The apply
> is idempotent and resumes from state each time.

### The apex cutover (§C.2 detail)

The new distribution cannot be created while the old one still holds the `nghuy.link`
CNAME (`CNAMEAlreadyExists`). Free it, then apply:

```bash
# Remove nghuy.link (keep s3.nghuy.link) from the old distribution, then re-run blog-deploy.
aws cloudfront get-distribution-config --id E3MGWTP58YX35G > old.json
ETAG=$(jq -r .ETag old.json)
jq '.DistributionConfig
    | .Aliases.Items = (.Aliases.Items | map(select(. != "nghuy.link")))
    | .Aliases.Quantity = (.Aliases.Items | length)' old.json > new.json
aws cloudfront update-distribution --id E3MGWTP58YX35G --distribution-config file://new.json --if-match "$ETAG"
```

Apex `nghuy.link` is down from this point until the new distribution reaches *Deployed*
and Terraform repoints the apex A/AAAA (~a few minutes to ~15 min). The A/AAAA records
already exist, so `aws_route53_record.a/aaaa` use `allow_overwrite = true`.

## D. Post-deploy verification (results 2026-07-12)

- [x] `terraform apply` completes; ACM cert validates (DNS) — new cert `CN=nghuy.link`.
- [x] `https://nghuy.link/` loads the portfolio home (HTTP 200).
- [x] `https://nghuy.link/blogs` loads the blogs home (empty list at first).
- [x] `curl https://nghuy.link/api/posts` returns published JSON (200, `[]`).
- [x] `curl -XPOST https://nghuy.link/api/posts` (no token) returns 401.
- [x] `/login` loads (200); Cognito admin seeded (`FORCE_CHANGE_PASSWORD`).
- [ ] **[manual]** Set admin password: sign in at `/login` with the temporary password
      Cognito emailed to `BLOG_ADMIN_EMAIL`, then complete the new-password prompt.
- [ ] **[manual]** `/login` → sign in → redirected to `/blogs/editor`.
- [ ] **[manual]** Create a post with text + an image → publish; image PUT to the
      presigned URL succeeds and renders via `/media/*`.
- [ ] **[manual]** `/blogs` shows the published post; a draft is hidden from `/blogs`
      but visible in `/blogs-draft`; the portfolio blogs section shows the latest posts.

## E. Rollback / teardown notes

- The media bucket must be emptied before `terraform destroy` (no `force_destroy`):
  `aws s3 rm "s3://<BLOG_MEDIA_BUCKET_NAME>" --recursive` then `terraform destroy` with
  the same `-backend-config` + `-var` flags as apply.
- The site bucket `s3.nghuy.link` is now **managed by this stack** (imported on first
  apply). A `terraform destroy` would delete it — to keep it, run
  `terraform state rm aws_s3_bucket.website` first, or empty/back up its objects.
- Reverting the apex repoint means restoring the apex A/AAAA to `E3MGWTP58YX35G` (its
  `nghuy.link` alias must be re-added first — it was removed during cutover).

## F. First-deploy issues encountered & fixes

Real problems surfaced only by the first live apply (all resolved; documented for rebuilds):

| # | Symptom | Cause | Fix |
|---|---------|-------|-----|
| 1 | `Invalid for_each argument` at graph-eval (nothing provisioned) | `aws_route53_record.cert_validation` keyed on the cert's `domain_validation_options`, unknown until apply | Key `for_each` on the static domain set; read validation values apply-time (in `cdn.tf`). |
| 2 | `logs:DescribeLogGroups ... not authorized` | Deploy role scoped all `logs:*` to `blog-*`; `DescribeLogGroups` is a list action that can't be ARN-scoped | Added `logs:DescribeLogGroups` on `*` to the deploy role. |
| 3 | `CreateLogGroup ... ResourceAlreadyExists` on retry | The log group got created but its post-create read failed (issue #2), leaving it **tainted** → each apply tried to replace it | `terraform untaint aws_cloudwatch_log_group.lambda`, then re-apply. |
| 4 | `CreateDistribution ... CNAMEAlreadyExists` | `nghuy.link` still attached to the old distribution `E3MGWTP58YX35G` | Free the CNAME from the old distribution (see §C cutover), then re-apply. |
| 5 | Route53 apex records "already exist" | Apex A/AAAA already pointed at the old distribution | `allow_overwrite = true` on `aws_route53_record.a/aaaa` (in `cdn.tf`). |
| 6 | Frontend re-run fails on CloudFront invalidation | Sync role `github-actions-s3-sync-role` allowed invalidation only on the old distribution | Re-apply `aws-github-oidc` with `cloudfront_distribution_id_prod=E344PIZPEIRDFM`. |

---

## Reference

- Stack module + detailed docs: `inf/terraform/aws-s3-web/README.md`
- Deploy role (IaC): `inf/terraform/aws-github-oidc/blog-deploy-role.tf`
- Backend deploy workflow: `.github/workflows/blog-deploy.yml`
- Frontend sync workflow: `.github/workflows/aws-s3-web-sync-prod.yml`
- PRs: #45 (restructure + serverless blog), #46 (cert-validation `for_each` fix),
  #47 (apex `allow_overwrite`), #48 (deploy-role `logs:DescribeLogGroups`).
