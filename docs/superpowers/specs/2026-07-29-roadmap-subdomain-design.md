# DevOps Roadmap 2026 component on `roadmap.nghuy.link` — Design

**Date:** 2026-07-29
**Area:** `src/aws-s3-web` (Next.js static-export portfolio) + `inf/terraform/aws-s3-web` (S3/CloudFront/ACM/Route53)
**Status:** Approved for planning

## Summary

Add a **roadmap** component to the portfolio site: a single, content-rich page presenting a DevOps engineer roadmap for 2026, with AI skills given first-class prominence. It is reachable at the dedicated subdomain **`roadmap.nghuy.link`** while living at the ordinary `/roadmap` route inside the existing Next.js app.

Three areas of change:

1. **Infrastructure** — extend the existing ACM certificate and CloudFront distribution to serve a second hostname, and make the CloudFront viewer-request function host-aware.
2. **Application** — a new `/roadmap` route with its own component group, route-scoped stylesheet, typed content module, and an "experience overlay" that annotates nodes with the author's real production experience.
3. **Testing** — component and data tests for the new page, plus the first-ever test suite for `cloudfront-rewrite.js`, which this work modifies and which is a single point of failure for the whole site.

No new S3 bucket, no new CloudFront distribution, no new build, no new deploy workflow.

## Context: current architecture

- **Frontend:** Next.js 16 App Router with `output: "export"` (production only — see `next.config.ts`). Tailwind v4 plus a ~2,970-line `src/app/globals.css` that defines the whole design system as CSS custom properties (`--bg`, `--surface`, `--accent`, `--border`, …) under `:root` / `html[data-theme="dark"]` / `html[data-theme="light"]`. Geist Sans + Geist Mono. Theme is chosen by an inline script in `src/app/layout.tsx` and toggled by `src/components/theme-toggle.tsx`.
- **Existing component grouping convention:** `src/components/blog/`, `src/components/skills/` — a directory per feature area, with colocated `*.test.tsx`.
- **Existing data convention:** `src/data/portfolio.ts` (a single typed `const`) with types in `src/types/portfolio.ts`.
- **Hosting:** one S3 website bucket `s3.nghuy.link` behind **one** CloudFront distribution (`inf/terraform/aws-s3-web/cdn.tf`), aliased to the apex `nghuy.link` only. One ACM certificate (us-east-1) covering the apex only.
- **URL mapping:** the static export is flat (`/blogs` → `blogs.html`). A CloudFront Function (`inf/terraform/aws-s3-web/cloudfront-rewrite.js`, runtime `cloudfront-js-2.0`, attached as `viewer-request` on the default cache behavior) rewrites clean URLs onto that flat layout.
- **Deploy:** `.github/workflows/aws-s3-web-sync-prod.yml` — `pnpm build`, `aws s3 sync out/ s3://s3.nghuy.link --delete`, then a `/*` CloudFront invalidation.
- **Terraform CI:** `terraform-plan.yml` auto-discovers changed Terraform directories on PRs; `terraform-apply.yml` applies after merge to `main`.

## Research basis

The roadmap content is grounded in current (2026) sources rather than invented. Consistent findings across them:

- The 2026 roadmap is layered: **Foundations → Modern DevOps → AI as a force multiplier → Senior/platform impact**. Fundamentals first, AI layered on top — not instead of.
- AI is framed as an **assistant with hard limits**, not a replacement. Sources are explicit about where it fails: context-heavy production decisions, system design trade-offs, security-sensitive choices, ambiguous failure resolution.
- Named AI competencies that recur: AIOps (anomaly detection, alert correlation, guarded auto-remediation), LLMOps, **building MCP servers for internal DevOps tooling**, AI-aware observability, and AI governance/security.
- Adjacent 2026 movements: OpenTelemetry as the instrumentation standard, eBPF zero-instrumentation observability, supply-chain security (SBOM, Sigstore/Cosign, SLSA), FinOps treated as a DORA-equivalent metric, and platform engineering / IDPs with golden paths.
- Market signal cited repeatedly: mid-level DevOps engineers with *demonstrated* (not merely familiar) AI skills command a 15–25% premium.

Sources:

- <https://kodekloud.com/blog/devops-cloud-ai-skills-roadmap-2026/>
- <https://kodekloud.com/blog/ai-powered-roadmap-for-devops-and-cloud-engineers/>
- <https://github.com/hammadhaqqani/awesome-devops-ai>
- <https://www.artech.com/blog/platform-engineering-skills-roadmap-career-guide/>
- <https://www.refontelearning.com/blog/devops-engineering-in-2026-top-trends-skills-and-career-strategies>
- <https://github.com/milanm/DevOps-Roadmap>
- <https://devstarsj.github.io/2026/05/14/observability-opentelemetry-ebpf-four-pillars/>
- <https://www.practical-devsecops.com/slsa-framework-guide-software-supply-chain-security/>
- <https://leanopstech.com/blog/platform-engineering-trends-2026/>

## Decisions taken

| Decision | Choice | Rejected alternatives |
| --- | --- | --- |
| Subdomain hosting | Same distribution, host-aware rewrite | Second CloudFront distribution over the same bucket; fully separate bucket + distribution + pipeline |
| Content source | Static typed TS module (`src/data/roadmap.ts`) | DynamoDB + API + admin UI (reusing the blog stack) |
| Visitor progress tracking | **None.** Read-only reference page | localStorage checkboxes; localStorage + shareable URL state |
| Framing | Neutral 2026 reference roadmap + optional "my experience" overlay | Pure neutral reference; explicitly personal learning roadmap |
| Layout | Interactive track map: vertical spine, branching nodes, sticky stage rail, slide-over detail panel | Bento grid of domains; horizontal scroll-pinned journey |
| Portfolio → roadmap link | External link chip in the hero section | Full nav entry (would require touching `SectionId`, `section-nav`, `use-active-section`) |

## Part 1 — Infrastructure

### Goal

`https://roadmap.nghuy.link/` serves the roadmap page. `https://nghuy.link/` continues to serve the portfolio, byte-for-byte unchanged.

### Changes in `inf/terraform/aws-s3-web/`

**`locals.tf`**

```hcl
roadmap_domain = "roadmap.${var.root_domain}"
cert_domains   = [local.domain, local.roadmap_domain]
```

**`cdn.tf`**

- `aws_acm_certificate.blog` — add `subject_alternative_names = [local.roadmap_domain]`.
- `aws_route53_record.cert_validation` — `for_each = toset(local.cert_domains)` (was `toset([local.domain])`). The existing `one([for dvo in ... if dvo.domain_name == each.key])` lookup pattern already generalises to two domains and needs no change.
- `aws_cloudfront_distribution.blog` — `aliases = local.cert_domains`.
- New `aws_route53_record.roadmap_a` and `aws_route53_record.roadmap_aaaa` — alias records for `local.roadmap_domain` pointing at the same distribution. These are new record sets, so **no** `allow_overwrite`.

**`cloudfront-rewrite.js`** — becomes host-aware. Inserted after the existing "real files pass through" and trailing-slash-normalisation blocks, before the apex routing rules:

```js
var host = req.headers.host ? req.headers.host.value : "";

// Host-based site selection: the roadmap subdomain is served from the
// /roadmap subtree of the same flat static export.
if (host.indexOf("roadmap.") === 0) {
  req.uri = (uri === "" || uri === "/") ? "/roadmap.html" : "/roadmap" + uri + ".html";
  return req;
}
```

All existing apex rules stay exactly as they are.

### Why this is safe

- **No cache-key collision.** CloudFront viewer-request functions run *before* the cache lookup, and the cache key is computed from the **rewritten** URI. `nghuy.link/` keys on `/index.html`; `roadmap.nghuy.link/` keys on `/roadmap.html`. The `Managed-CachingOptimized` policy not including `Host` in the cache key is therefore irrelevant — the host has already been folded into the URI.
- **Assets are shared and correct.** `_next/static/**` paths contain a `.`, so they hit the existing pass-through `if (uri.includes("."))` branch and are served unmodified from the bucket root on both hostnames. Next.js emits absolute `/_next/...` URLs, so this is correct on both hosts.
- **Apex `/roadmap` keeps working.** The existing generic fallback (`req.uri = uri + ".html"`) already maps it to `/roadmap.html`. Both hostnames serve the same content; the page declares a canonical URL pointing at the subdomain (see Part 2).
- **Unknown paths on the roadmap host** (e.g. `roadmap.nghuy.link/anything`) resolve to `/roadmap/anything.html`, which does not exist, so the S3 website endpoint returns the configured error document. This is the same failure mode the apex already has for unknown routes.

### Risks and sequencing

1. **ACM certificate replacement.** Adding a SAN forces a new certificate. `lifecycle { create_before_destroy = true }` is already set on `aws_acm_certificate.blog`, so the new certificate is created and validated before the old one is destroyed and the apex stays served throughout. The distribution update still takes roughly 5–15 minutes to propagate.
2. **DNS availability.** `roadmap.nghuy.link` does not resolve until the apply completes and the alias records exist.
3. **The rewrite function gates the entire site.** A regression here takes down the portfolio and the blog, not just the roadmap. Mitigated by the new test suite in Part 3, which pins every existing apex mapping.
4. Apply order is handled by Terraform's own dependency graph; no manual staging is required.

### CI impact

None beyond the automatic behaviour that already exists. `terraform-plan.yml` discovers the changed `inf/terraform/aws-s3-web` directory and plans it on the PR; `terraform-apply.yml` applies it on merge. The site sync workflow needs no change — same bucket, same distribution, and its invalidation is already `/*`.

## Part 2 — Application

### Route

`src/app/roadmap/page.tsx`. Because it is an ordinary App Router route, it is reachable at `localhost:3000/roadmap` during development with no host simulation, and the static export emits `out/roadmap.html`, which is exactly what the CloudFront function targets.

The route exports `metadata` with a roadmap-specific title and description, and `alternates.canonical = "https://roadmap.nghuy.link/"` so the duplicate apex path does not compete in search results.

### File layout

```
src/app/roadmap/page.tsx            route entry: metadata + <RoadmapShell />
src/app/roadmap/roadmap.css         route-scoped styles
src/types/roadmap.ts                types
src/data/roadmap.ts                 content
src/lib/roadmap/experience.ts       pure helpers: stage coverage, node lookup
src/components/roadmap/
  roadmap-shell.tsx                 page frame: backdrop, theme toggle, header, rail + track
  stage-rail.tsx                    sticky stage navigation, active-stage highlighting
  roadmap-track.tsx                 the spine; renders the stage sequence
  roadmap-stage.tsx                 one stage: header, outcome, node layout
  roadmap-node.tsx                  one node card (a <button> that opens the panel)
  node-detail-panel.tsx             slide-over detail dialog
  track-connector.tsx               SVG spine and branch paths
  experience-toggle.tsx             the "show my experience" switch
```

Each file has one job: the shell composes, the rail navigates, the track sequences, the stage lays out, the node presents, the panel details. `src/lib/roadmap/experience.ts` holds the only non-trivial computation (per-stage experience coverage) so it can be unit-tested without rendering.

### Styles

Styles live in a **route-scoped `src/app/roadmap/roadmap.css`**, imported by `page.tsx` — not appended to `globals.css`.

`globals.css` is already ~2,970 lines and is loaded on every page. Adding a full page's worth of rules to it would make an already-oversized file worse and ship roadmap CSS to the portfolio and blog. Because `globals.css` defines the design system as CSS custom properties on `:root` and `html[data-theme=...]`, the route stylesheet inherits `--bg`, `--surface`, `--accent`, `--border`, `--muted`, the shadows, and the grid backdrop for free. Light/dark and the site's visual identity carry over with no duplication.

New roadmap-specific tokens are namespaced `--rm-*` and defined inside `roadmap.css`, derived from existing tokens via `color-mix()` where possible (the codebase already uses this pattern in `globals.css`).

### Visual design

Modern, but recognisably the same site.

- A vertical gradient **spine** runs the length of the page. Stage markers sit on the spine; node cards branch off it, alternating left/right on wide viewports.
- **Stage headers** use large display type with a mono kicker (Geist Mono, e.g. `STAGE 02 :: AI LAYER`) to echo the existing terminal identity.
- **Node cards** are elevated glass tiles built on `--surface-raised` and `--border`, with an importance indicator (core / recommended / optional).
- **SVG connectors** (`track-connector.tsx`) draw in as each stage scrolls into view, via `IntersectionObserver` plus a `stroke-dashoffset` transition.
- **The AI stage is visually distinct** — its own violet→cyan accent gradient and a subtle glow — so it reads as the centre of gravity of the page.
- **Detail panel:** clicking a node opens a slide-over containing the node's `why`, its tool list, and its resource links.

**Motion:** uses `motion`, already a project dependency. Every animation is gated on the existing `src/hooks/use-reduced-motion.ts`; with reduced motion the connectors render fully drawn and the panel appears without transition.

**Responsive:**

| Viewport | Behaviour |
| --- | --- |
| ≥ 1100px | Sticky left stage rail; nodes branch alternately left/right of the spine |
| 900–1100px | Rail persists; nodes stack to one side of the spine |
| < 900px | Rail collapses to a horizontal sticky chip bar; single-column nodes; the slide-over becomes a bottom sheet |

**Accessibility:**

- Node cards are real `<button>` elements, reachable and operable by keyboard.
- The detail panel is `role="dialog" aria-modal="true"` with a focus trap, Escape to close, and focus returned to the originating node button on close.
- Decorative SVG connectors and the spine are `aria-hidden="true"`.
- The stage rail is a `<nav>` with an accessible label; the active stage is marked `aria-current="true"`.
- Colour is never the sole carrier of meaning: importance and experience level each have a text label in addition to their colour.

### Data model

`src/types/roadmap.ts`:

```ts
export type NodeImportance = "core" | "recommended" | "optional";
export type MyLevel = "production" | "working" | "learning" | "none";

export type RoadmapResource = {
  label: string;
  url: string;
};

export type RoadmapNode = {
  id: string;                                  // url-safe, stable, unique across the roadmap
  title: string;
  importance: NodeImportance;
  summary: string;                             // one line, shown on the card
  why: string;                                 // why it matters in 2026, shown in the panel
  tools: readonly string[];
  resources: readonly RoadmapResource[];
  myLevel: MyLevel;                            // powers the experience overlay
};

export type StageAccent = "blue" | "green" | "ai" | "violet";

export type RoadmapStage = {
  id: string;
  index: number;
  label: string;
  kicker: string;                              // mono eyebrow, e.g. "STAGE 02"
  outcome: string;                             // "after this stage you can ..."
  accent: StageAccent;
  nodes: readonly RoadmapNode[];
};
```

`src/data/roadmap.ts` exports `export const roadmapStages: readonly RoadmapStage[]`, matching the single-typed-const shape of `src/data/portfolio.ts`.

### The experience overlay

The existing `Skill` type in `src/types/portfolio.ts` is `{ label, icon, color }` — it carries **no** proficiency information, so the overlay cannot be derived from `portfolio.skills`. Each roadmap node therefore authors its own `myLevel` field.

To stop the two datasets drifting apart, a unit test asserts that every `portfolio.skills` label which also appears in a roadmap node's `title` or `tools` has a `myLevel` other than `"none"` on that node. A skill claimed on the portfolio cannot be silently marked as unpractised on the roadmap.

Overlay behaviour: a single toggle in the page header, defaulting to **off**.

- **Off** — a clean, neutral 2026 reference roadmap. No personal annotation anywhere.
- **On** — each node shows its experience level, and each stage header gains a coverage bar computed by `src/lib/roadmap/experience.ts`.

This is presentational state held in a React `useState` in `roadmap-shell.tsx`. There is **no** visitor progress tracking, no `localStorage`, no persisted state, and no PII.

### Roadmap content

Four stages, 23 nodes.

**Stage 00 — Foundations** (accent `blue`)
Linux & systems · Networking, DNS & TLS · Git & trunk-based flow · One language (Python/Go) · Cloud fundamentals (compute, storage, IAM, cost)

**Stage 01 — Modern DevOps** (accent `green`)
Containers & OCI · Kubernetes · IaC (Terraform / OpenTofu + Ansible) · CI/CD & GitOps (Argo CD, Flux) · Observability (OpenTelemetry, Prometheus/Grafana, eBPF zero-instrumentation) · DevSecOps & supply chain (SBOM, Sigstore/Cosign, SLSA)

**Stage 02 — AI Layer** (accent `ai` — the visually prominent stage)

| Node | Focus |
| --- | --- |
| AI-assisted engineering | Agentic coding tools in the loop, context discipline, mandatory review gates |
| LLM fundamentals for ops | Tokens, context windows, embeddings, RAG over runbooks |
| MCP & tool integration | Building MCP servers for internal DevOps tooling |
| AIOps | Anomaly detection, alert correlation and summarisation, auto-remediation with guardrails |
| LLMOps / AI platform | Serving, GPU scheduling, evals, cost and latency budgets, model gateways |
| AI security & governance | Prompt injection, secrets in context, non-determinism in pipelines, policy obligations |
| Where AI still fails | Context-heavy production calls, system design trade-offs, security decisions |

The final node is deliberate. Every source consulted frames AI as a force multiplier with hard limits; a roadmap that only sells AI would read as hype and would be less useful than one that states the boundary.

**Stage 03 — Senior Impact** (accent `violet`)
Platform engineering & IDPs (golden paths, Backstage) · SRE practice (SLOs, error budgets, DORA) · FinOps (cost as a first-class metric, optimisation at provisioning time) · Architecture, multi-cloud & resilience · Leadership & incident command

### Portfolio → roadmap link

An external link chip is added to `src/components/hero-section.tsx` pointing at `https://roadmap.nghuy.link/`, styled consistently with the existing hero module chips.

A full navigation entry was rejected: it would require extending the `SectionId` union in `src/types/portfolio.ts` and changing `section-nav.tsx` and `use-active-section.ts`, all of which are built around in-page scroll sections. The roadmap is a separate destination, not a section of the portfolio page.

## Part 3 — Testing

The project uses Vitest with Testing Library for unit and component tests (colocated `*.test.ts(x)`) and Playwright for end-to-end tests in `e2e/`.

### Data integrity — `src/data/roadmap.test.ts`

- Every node `id` is unique across the whole roadmap and is URL-safe.
- Every node has a non-empty `summary`, a non-empty `why`, and at least one resource.
- Every resource `url` is a valid absolute `https://` URL.
- `importance` and `myLevel` values are within their unions.
- Stage `index` values are contiguous and ordered.
- **Drift check:** every `portfolio.skills` label appearing in a node's `title` or `tools` has `myLevel !== "none"`.

### Pure logic — `src/lib/roadmap/experience.test.ts`

Stage coverage calculation across the boundary cases: no experience, full experience, mixed levels, and an empty stage.

### Components

Following the existing `*.test.tsx` convention:

- `stage-rail.test.tsx` — renders every stage, marks the active stage with `aria-current`, and navigates on click.
- `roadmap-node.test.tsx` — renders title, summary and importance; is an accessible button; reflects `myLevel` only when the overlay is enabled.
- `node-detail-panel.test.tsx` — opens with the correct node's content, is `aria-modal`, closes on Escape and on the close control, and returns focus to the originating node button.
- `roadmap-shell.test.tsx` — the experience toggle is off by default and switches annotations on.

### CloudFront rewrite — `src/lib/cloudfront-rewrite.test.ts` (new)

`inf/terraform/aws-s3-web/cloudfront-rewrite.js` currently has **no** test coverage, and this work modifies it. It is attached to the default cache behaviour of the only distribution, so a regression breaks the portfolio and the blog, not merely the roadmap.

The test reads the **real** file that Terraform consumes, following the `process.cwd()`-relative pattern already established by `src/lib/accent-palette.test.ts` (Vitest runs with `src/aws-s3-web` as the working directory):

```ts
const source = readFileSync(
  join(process.cwd(), "../../inf/terraform/aws-s3-web/cloudfront-rewrite.js"),
  "utf8",
);
```

then evaluates it to obtain `handler` and asserts, for a synthetic `{ request: { uri, headers: { host: { value } } } }` event:

| Host | Input URI | Expected `req.uri` |
| --- | --- | --- |
| `nghuy.link` | `/` | `/index.html` |
| `nghuy.link` | `/blogs` | `/blogs.html` |
| `nghuy.link` | `/blogs/my-post` | `/blogs/_.html` |
| `nghuy.link` | `/blogs/editor` | `/blogs/editor.html` |
| `nghuy.link` | `/blogs/editor/my-post` | `/blogs/editor/_.html` |
| `nghuy.link` | `/blogs-draft` | `/blogs-draft.html` |
| `nghuy.link` | `/blogs-draft/my-post` | `/blogs-draft/_.html` |
| `nghuy.link` | `/login` | `/login.html` |
| `nghuy.link` | `/blogs/` (trailing slash) | `/blogs.html` |
| `nghuy.link` | `/_next/static/x.js` | unchanged |
| `nghuy.link` | `/roadmap` | `/roadmap.html` |
| `roadmap.nghuy.link` | `/` | `/roadmap.html` |
| `roadmap.nghuy.link` | `""` | `/roadmap.html` |
| `roadmap.nghuy.link` | `/_next/static/x.js` | unchanged |
| *(host header absent)* | `/` | `/index.html` |

The apex rows pin today's behaviour exactly; the roadmap rows cover the new branch. The file lives under `src/lib/` so it is picked up by the existing Vitest glob with no configuration change (`vitest.config.ts` sets only `exclude`, for `e2e/`, `node_modules/` and `backend/`).

One accepted edge case: the "real files pass through" branch runs *before* the host check, so `roadmap.nghuy.link/anything.html` serves the apex `/anything.html`. This is what makes shared `_next/**` assets work and is the intended trade-off.

### End-to-end — `e2e/roadmap.spec.ts`

Following the patterns in `e2e/portfolio.spec.ts`: the page loads at `/roadmap`, all four stages render, clicking a node opens the detail panel, Escape closes it, and toggling the overlay reveals experience annotations.

### Local verification order

1. `pnpm test` — unit and component tests, including the rewrite suite.
2. `pnpm typecheck` and `pnpm lint`.
3. `pnpm dev`, then verify `/roadmap` manually in both themes, at all three responsive breakpoints, and with `prefers-reduced-motion: reduce` forced.
4. `pnpm test:e2e`.
5. `pnpm build`, and confirm `out/roadmap.html` exists — this is the file the CloudFront function targets.
6. `terraform validate` and `terraform plan` in `inf/terraform/aws-s3-web`, and confirm the plan shows the certificate replacement, the two new Route53 records, and the distribution alias update — and **no** destructive change to the apex records.

Steps 1–5 require no AWS access.

## Out of scope

- Per-node detail routes. The slide-over panel is the detail surface; there are no `/roadmap/<node>` pages.
- Visitor progress tracking of any kind.
- A CMS or authenticated editing flow for roadmap content; edits are pull requests against `src/data/roadmap.ts`.
- Additional roadmaps (cloud, SRE, platform). The types and layout would support them, but only the DevOps roadmap is built here.
- `robots.txt` / sitemap changes beyond the canonical URL declared in the route metadata.
