# Serverless Blog at `blogs.nghuy.link` — Design Spec

**Date:** 2026-07-11
**Status:** Approved for planning
**Scope:** `src/aws-s3-web/` (new blog route segments + editor), new Terraform root `inf/terraform/aws-blog-serverless/`, new Lambda backend source, new GitHub Actions workflow.

## Goal

Add a dynamic, self-managed blog on a dedicated subdomain **`blogs.nghuy.link`**,
built on an AWS serverless architecture that mirrors the reference app at
`/Users/huyng/ws/aws-serverless-webapp` (Cognito → CloudFront → S3 → API Gateway
→ Lambda → DynamoDB), adapted to satisfy an explicit requirement that the backend
run **inside a VPC** using VPC endpoints (no NAT Gateway). The blog frontend reuses
the existing terminal-themed portfolio app; a Confluence-style WYSIWYG editor
(TipTap/ProseMirror) supports rich post authoring with images.

## Requirements (from request)

- A blogs **home** page, a blog **detail** page, and a **create/edit** page.
- A **login** page authenticating via **AWS Cognito**.
- Backend handled by **AWS Lambda** (serverless compute).
- Database handled by **AWS serverless data services** (DynamoDB + S3).
- Backend placed in a **VPC** with additional networking services (VPC endpoints;
  NAT Gateway explicitly avoided in favor of endpoints — see rationale).
- **All infrastructure provisioned in Terraform.**
- Blog **source code placed in `src/aws-s3-web/`** (the existing portfolio app).
- **UI/UX identical to the portfolio site** (terminal theme, shared tokens/components).
- Create-post supports **image insertion** and standard rich text editing — a
  **Confluence-style editor clone**.

## Access Model

- **Public, unauthenticated (read):**
  - `GET /api/posts` — list published posts (newest first).
  - `GET /api/posts/{slug}` — read a single published post (metadata + body).
- **Cognito-authenticated (single admin — you):**
  - `POST /api/posts` — create.
  - `PUT /api/posts/{id}` — update.
  - `DELETE /api/posts/{id}` — delete.
  - `POST /api/uploads` — get a presigned S3 PUT URL for an image.
  - `GET /api/posts?status=draft` (admin-only view of drafts).
- **Cognito self-signup is disabled.** The single admin user is provisioned via
  Terraform / console, not public registration.
- API Gateway attaches a **Cognito authorizer to write methods only**; GET
  (published) methods are open. Draft listing/reading requires a valid JWT.

## Architecture

```
                                   ┌── /        → S3 (Next.js static-export SPA, terminal theme)
Cognito ── CloudFront (blogs.nghuy.link) ┤── /media/* → S3 media bucket (images, served read-through)
                                   └── /api/*   → API Gateway (REST)
                                                      │  (Cognito authorizer on writes)
                                                      ▼
                                           Lambda (Node 20 / TS)  — attached to VPC private subnets
                                                      │
                          ┌────────────────────────────┼──────────────────────────┐
                          ▼                             ▼                           ▼
              DynamoDB (Gateway VPC endpoint)  S3 (Gateway VPC endpoint)  CloudWatch Logs (Interface endpoint)
```

- **Same-origin:** CloudFront fronts both the SPA and the API under one domain →
  **no CORS**, matching the reference app.
- **No NAT Gateway.** Lambda's outbound dependencies (DynamoDB, S3, CloudWatch
  Logs) are reached via VPC endpoints. Gateway endpoints for DynamoDB and S3 are
  free and keep traffic on the AWS backbone; an interface endpoint covers logs.
  JWT validation happens at the API Gateway Cognito authorizer, so the Lambda
  itself makes no outbound Cognito call. This is cheaper and has no internet
  egress path.

## Frontend (inside `src/aws-s3-web/`)

The existing project is Next.js 16 (App Router), **static export** (`output:
"export"`), Tailwind CSS 4, terminal theme with a light/dark `theme-toggle` and
shared design tokens in `globals.css`. The blog is added as **new route
segments in the same project** so it inherits theme, fonts, and components:

- `app/blogs/page.tsx` — home: grid/list of published posts (title, excerpt,
  date, tags, cover image).
- `app/blogs/[slug]/page.tsx` — detail: renders post body (ProseMirror JSON →
  sanitized HTML) client-side.
- `app/login/page.tsx` — Cognito login (AWS Amplify auth or `amazon-cognito-identity-js`).
- `app/admin/page.tsx` — dashboard: list all posts (incl. drafts), manage.
- `app/admin/editor/[[...id]]/page.tsx` — create (no id) / edit (id) with the
  TipTap editor.

Admin routes are **client-guarded** by the Cognito session (redirect to
`/login` when unauthenticated). Because the app is a static SPA, public pages
fetch post data from the API **at runtime** (client-side) so newly published
posts appear without a rebuild.

**Editor:** **TipTap** (ProseMirror React wrapper — the same engine family as
Confluence's editor). Toolbar: headings, bold/italic/underline/strike, ordered
& bullet lists, blockquote, **code block**, links, tables, horizontal rule, and
**inline/embedded images**. Images upload via presigned S3 PUT and are inserted
as image nodes referencing the CloudFront `/media/*` URL. Editor is styled to
match the terminal theme.

### Deployment shape (same codebase, separate subdomain)

One `next build` produces one `out/`. The portfolio deploy is **unchanged** (its
existing bucket + distribution at `nghuy.link`). A **new blog S3 bucket +
CloudFront distribution** at `blogs.nghuy.link` serves the same export, with a
**CloudFront Function** that rewrites `/` → `/blogs/` and appends `index.html`
for directory-style routes. The `/api/*` cache behavior on the blog distribution
targets API Gateway; `/media/*` targets the media bucket via OAC. Shared
components, independent deploys.

## Data & Media

- **DynamoDB** (single table, on-demand) — post **metadata + index**:
  - Item: `PK=POST#<id>`, attributes `id`, `slug`, `title`, `excerpt`,
    `status` (`draft`|`published`), `publishedAt`, `updatedAt`, `tags`,
    `coverImage`, `bodyKey` (S3 key of the body document).
  - **GSI1** (`GSI1PK=POST`, `GSI1SK=<publishedAt>`) to list posts newest-first;
    query filters by `status`.
  - A `slug → id` lookup: store `slug` as a queryable attribute via a second GSI
    (`GSI2PK=SLUG#<slug>`) so `GET /posts/{slug}` resolves in one query.
- **S3 media bucket** — holds the **post body document** (TipTap ProseMirror
  **JSON**, lossless & re-editable) as one object per post (`bodies/<id>.json`),
  plus all uploaded **images** (`media/<id>/<uuid>.<ext>`). Rich documents can
  exceed DynamoDB's 400 KB item limit, so the body lives in S3, not the table.
- `GET /api/posts/{slug}` → Lambda reads metadata (DynamoDB) + body JSON (S3) and
  returns a combined payload. Writes persist both the DynamoDB item and the S3
  body object atomically from the Lambda's perspective (body written first, then
  metadata; delete removes both).

## Backend (Lambda)

- Single Node.js 20 / TypeScript function (AWS SDK v3), routed by API Gateway
  method+path (or a small internal router), mirroring the reference app's
  single-function CRUD style.
- **Write identity is derived from the validated JWT**, never from the request
  body (matches the reference app's ownership discipline). For a single-admin
  blog this gates all mutations behind the authorizer.
- Input validation on write (title/slug required, slug uniqueness check, body
  size bound, allowed image content-types for presign).
- Body rendered on the client; server stores raw ProseMirror JSON. Sanitization
  is applied on render (client) to defend against stored HTML injection.
- IAM role: least-privilege to the specific DynamoDB table + GSIs and the media
  bucket prefixes; VPC execution permissions (ENI management) via the AWS
  managed policy pattern; CloudWatch Logs.

## Infrastructure — `inf/terraform/aws-blog-serverless/`

New independent Terraform root (own state), following repo conventions enforced
by `.tflint.hcl`: `snake_case` names, required tags `Environment`/`Project`/
`ManagedBy` on all resources, typed+described variables and outputs, pinned
module/provider versions. Provisions:

- **VPC:** 2 private subnets across 2 AZs, route tables, no IGW/NAT.
- **VPC endpoints:** Gateway endpoints for DynamoDB and S3; interface endpoint
  for CloudWatch Logs (+ its security group).
- **DynamoDB:** on-demand table with GS1/GSI2 as above; PITR enabled.
- **S3:** media bucket (private, OAC-only access, versioning). The SPA is served
  from a **blog site bucket** (private, OAC).
- **Lambda:** function + IAM role, VPC config (private subnets + SG), env vars.
- **API Gateway:** REST API, `/api/*` resources/methods, Cognito authorizer on
  writes, stage, CloudWatch access logging.
- **Cognito:** user pool + app client (signup disabled, admin user seeded),
  hosted-UI optional (login is app-native via Amplify).
- **CloudFront:** distribution with origins for the site bucket (default), API
  Gateway (`/api/*`), and media bucket (`/media/*`); OAC; CloudFront Function
  for root/index rewrite; the ACM cert alias.
- **ACM:** certificate for `blogs.nghuy.link` in **us-east-1** (CloudFront
  requirement), DNS-validated via the existing Route53 zone.
- **Route53:** A/AAAA alias record `blogs.nghuy.link` → CloudFront, in the
  existing hosted zone (referenced by `route53_zone_id`, matching the pattern in
  `inf/terraform/aws-cloudfront-s3-oac-resume/`).

Reusable sub-modules may be factored (network, data, api, cdn) but a single
flat root is acceptable for v1.

## CI/CD

New GitHub Actions workflow following the repo's existing **GitHub OIDC → IAM
role** pattern (no long-lived credentials):

- **PR:** `terraform-plan.yml` already auto-discovers changed Terraform dirs;
  the new root is picked up by its matrix. Backend build + lint/test on PR.
- **Deploy (main):** assume deploy role → build Lambda bundle → `terraform
  apply` for `inf/terraform/aws-blog-serverless/` → capture Cognito/API/bucket/
  distribution outputs → build frontend (Cognito IDs injected as
  `NEXT_PUBLIC_*`) → `aws s3 sync out/` to the blog site bucket → CloudFront
  invalidation. Portfolio's existing sync workflows are untouched.

## Non-Goals / YAGNI (v1)

- No SSR/SSG of post content (static SPA + runtime fetch; SEO trade-off accepted
  for a personal portfolio blog).
- No multi-author / public signup (single admin).
- No comments, likes, search, or RSS in v1 (can follow later).
- No NAT Gateway (endpoints only).
- No separate dev/staging environment for the blog stack in v1 (single prod
  stack, matching the reference app).

## Trade-offs Accepted

- **Client-side rendering** of public pages → weaker SEO than SSR; acceptable and
  keeps the app a pure static export like the portfolio.
- **Lambda-in-VPC cold starts**: acceptable for a low-traffic personal blog;
  mitigated by endpoint-only networking (no NAT hop).
- **Whole `out/` deployed to the blog bucket** (including portfolio HTML):
  harmless duplication in exchange for one shared codebase/theme.

## Open Implementation Details (resolved during planning)

- Exact Cognito auth library choice (AWS Amplify v6 vs `amazon-cognito-identity-js`).
- Whether to factor Terraform sub-modules vs a flat root.
- CloudFront Function vs CloudFront `default_root_object` + custom error routing
  for the root/index rewrite.
