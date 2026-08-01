# Roadmap Subdomain (`roadmap.nghuy.link`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a DevOps 2026 roadmap page — with AI skills as a first-class stage — served at `roadmap.nghuy.link` off the existing CloudFront distribution.

**Architecture:** The page is an ordinary Next.js App Router route at `/roadmap`, so the static export emits `out/roadmap.html`. The single existing CloudFront distribution gains a second alias and a host-aware viewer-request function that maps `roadmap.nghuy.link/` onto `/roadmap.html`. Content is a typed static TS module; there is no backend and no persisted visitor state.

**Tech Stack:** Next.js 16 (App Router, `output: "export"`), React 19, TypeScript, Tailwind v4 + CSS custom properties, Vitest + Testing Library, Playwright, Terraform (AWS provider), CloudFront Functions (`cloudfront-js-2.0`).

**Spec:** `docs/superpowers/specs/2026-07-29-roadmap-subdomain-design.md`

**Branch:** `feat/roadmap-subdomain` (already created; the spec is committed at `5b185b4`)

## Global Constraints

- All `pnpm` commands run from `src/aws-s3-web`. Package manager is `pnpm@11.13.1`.
- Test commands: `pnpm test` (Vitest), `pnpm typecheck` (`tsc --noEmit`), `pnpm lint` (ESLint), `pnpm test:e2e` (Playwright). Run a single Vitest file with `pnpm test -- <path>`.
- File naming is kebab-case. Component tests are colocated as `<name>.test.tsx` next to the component. Vitest `exclude` is only `e2e/**`, `node_modules/**`, `backend/**` — anything else matching the default test glob is picked up with no config change.
- **`vitest.setup.ts` mocks `window.matchMedia` so `(prefers-reduced-motion: reduce)` always matches.** Every component test therefore runs in reduced-motion mode. Do not write tests that assert on animated/transitional states.
- **jsdom has no `IntersectionObserver`.** Any component using it must guard with `if (typeof IntersectionObserver === "undefined") return;`, matching the existing pattern in `src/hooks/use-active-section.ts:12`.
- Reuse design tokens from `src/app/globals.css` (`--bg`, `--surface`, `--surface-raised`, `--border`, `--border-soft`, `--text`, `--muted`, `--faint`, `--accent`, `--accent-bright`, `--accent-rgb`, `--green`, `--shadow`, `--content`). Do **not** add roadmap styles to `globals.css`.
- Terraform: `snake_case` names; every resource carries `local.common_tags`; new variables need `description` and `type`. Lint with `tflint --recursive` from the repo root.
- Commit messages are Conventional Commits with the `roadmap` scope, e.g. `feat(roadmap): ...`. End every commit body with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

**One deliberate deviation from the spec, flagged for review:** the spec's Part 2 says animations use the `motion` package. This plan uses **plain CSS transitions plus `IntersectionObserver`** instead. Rationale: `globals.css` already animates everything this way (see `.boot-loader`), it adds no bundle weight to a static page, and it keeps the components trivially testable under the forced reduced-motion setup above. If you want `motion` specifically, say so before Task 8 — that is the only task affected.

---

### Task 1: Host-aware CloudFront rewrite, with its first test suite

`inf/terraform/aws-s3-web/cloudfront-rewrite.js` is attached as `viewer-request` on the default cache behaviour of the **only** distribution. A regression there breaks the portfolio and the blog, not just the roadmap — and it currently has zero test coverage. This task pins today's behaviour first, then adds the new branch.

**Files:**
- Create: `src/aws-s3-web/src/lib/cloudfront-rewrite.test.ts`
- Modify: `inf/terraform/aws-s3-web/cloudfront-rewrite.js`

**Interfaces:**
- Consumes: nothing.
- Produces: the rewrite contract relied on by Task 2 (Terraform) and Task 11 (verification) — `roadmap.<anything>` host + URI `/` or `""` → `/roadmap.html`; any other roadmap-host clean URI `/x` → `/roadmap/x.html`.

- [ ] **Step 1: Write the characterisation + new-behaviour test**

Create `src/aws-s3-web/src/lib/cloudfront-rewrite.test.ts`. The path from `process.cwd()` (which is `src/aws-s3-web` when Vitest runs) up to the repo root is `../../`, matching the `process.cwd()`-relative pattern already used in `src/lib/accent-palette.test.ts:17`.

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type CfRequest = { uri: string; headers: Record<string, { value: string }> };
type CfHandler = (event: { request: CfRequest }) => CfRequest;

const source = readFileSync(
  join(process.cwd(), "../../inf/terraform/aws-s3-web/cloudfront-rewrite.js"),
  "utf8",
);

// The file is a bare CloudFront Function module: a top-level `function handler`
// with no exports. Evaluate it and hand back the symbol.
const handler = new Function(`${source}; return handler;`)() as CfHandler;

function run(uri: string, host?: string): string {
  const headers = host ? { host: { value: host } } : {};
  return handler({ request: { uri, headers } }).uri;
}

describe("cloudfront-rewrite — apex (pins existing behaviour)", () => {
  const apex = "nghuy.link";

  it.each([
    ["/", "/index.html"],
    ["/blogs", "/blogs.html"],
    ["/blogs/", "/blogs.html"],
    ["/blogs/my-post", "/blogs/_.html"],
    ["/blogs/editor", "/blogs/editor.html"],
    ["/blogs/editor/my-post", "/blogs/editor/_.html"],
    ["/blogs-draft", "/blogs-draft.html"],
    ["/blogs-draft/my-post", "/blogs-draft/_.html"],
    ["/login", "/login.html"],
    ["/roadmap", "/roadmap.html"],
  ])("maps %s to %s", (uri, expected) => {
    expect(run(uri, apex)).toBe(expected);
  });

  it("passes real files through untouched", () => {
    expect(run("/_next/static/chunk.js", apex)).toBe("/_next/static/chunk.js");
    expect(run("/favicon.ico", apex)).toBe("/favicon.ico");
  });

  it("falls back to apex behaviour when the host header is absent", () => {
    expect(run("/")).toBe("/index.html");
    expect(run("/blogs")).toBe("/blogs.html");
  });
});

describe("cloudfront-rewrite — roadmap subdomain", () => {
  const roadmap = "roadmap.nghuy.link";

  it("serves the roadmap page at the subdomain root", () => {
    expect(run("/", roadmap)).toBe("/roadmap.html");
    expect(run("", roadmap)).toBe("/roadmap.html");
  });

  it("normalises a trailing slash at the subdomain root", () => {
    expect(run("/", roadmap)).toBe("/roadmap.html");
  });

  it("maps other clean routes into the /roadmap subtree", () => {
    expect(run("/guide", roadmap)).toBe("/roadmap/guide.html");
  });

  it("shares static assets with the apex", () => {
    expect(run("/_next/static/chunk.js", roadmap)).toBe("/_next/static/chunk.js");
  });
});
```

- [ ] **Step 2: Run the test — apex passes, roadmap fails**

Run: `pnpm test -- src/lib/cloudfront-rewrite.test.ts`

Expected: the `apex` describe block **PASSES** (this proves the harness loads the real function correctly). The `roadmap subdomain` block **FAILS** — `run("/", roadmap)` returns `/index.html`, not `/roadmap.html`.

If any apex assertion fails, stop: the harness is wrong, not the function. Fix the harness before touching the function.

- [ ] **Step 3: Add the host-aware branch**

In `inf/terraform/aws-s3-web/cloudfront-rewrite.js`, extend the header comment and insert the host check **after** the trailing-slash normalisation and **before** the `uri === "" || uri === "/"` root rule.

Update the top comment block by appending this line to it:

```js
// The roadmap subdomain (roadmap.nghuy.link) is served from the /roadmap subtree
// of this same export: its "/" -> roadmap.html, its /<path> -> roadmap/<path>.html.
```

Add `var host` alongside the existing `var uri` declaration:

```js
  var req = event.request;
  var uri = req.uri;
  var host = req.headers.host ? req.headers.host.value : "";
```

Then insert this block immediately after the trailing-slash normalisation block and before the "Root serves the portfolio home" block:

```js
  // Host-based site selection. Asset requests already returned above, so every
  // remaining roadmap-host request is a clean route into the /roadmap subtree.
  if (host.indexOf("roadmap.") === 0) {
    req.uri = uri === "" || uri === "/" ? "/roadmap.html" : "/roadmap" + uri + ".html";
    return req;
  }
```

Leave every existing apex rule byte-for-byte unchanged.

- [ ] **Step 4: Run the test — everything passes**

Run: `pnpm test -- src/lib/cloudfront-rewrite.test.ts`
Expected: PASS, all describes.

The apex block still passing is the point of this task — it proves the new branch changed nothing for the existing site.

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/lib/cloudfront-rewrite.test.ts inf/terraform/aws-s3-web/cloudfront-rewrite.js
git commit -m "$(cat <<'EOF'
feat(roadmap): make the CloudFront rewrite host-aware

Adds the first test suite for cloudfront-rewrite.js, pinning every existing
apex mapping, then routes roadmap.* hosts into the /roadmap subtree.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Terraform — second alias, SAN certificate, subdomain DNS

**Files:**
- Modify: `inf/terraform/aws-s3-web/locals.tf`
- Modify: `inf/terraform/aws-s3-web/cdn.tf`

**Interfaces:**
- Consumes: the rewrite contract from Task 1.
- Produces: `roadmap.nghuy.link` resolving to the existing distribution. Nothing in later tasks depends on this — the app tasks are verifiable locally without AWS.

- [ ] **Step 1: Add the domain locals**

In `inf/terraform/aws-s3-web/locals.tf`, replace the existing `domain` block comment and value with:

```hcl
  # The blog and portfolio are served under the apex (nghuy.link); the roadmap
  # component gets a dedicated subdomain served off the same distribution via a
  # host-aware viewer-request function.
  domain         = var.root_domain
  roadmap_domain = "roadmap.${var.root_domain}"
  cert_domains   = [local.domain, local.roadmap_domain]
```

- [ ] **Step 2: Put the subdomain on the certificate**

In `inf/terraform/aws-s3-web/cdn.tf`, add the SAN to `aws_acm_certificate.blog`:

```hcl
resource "aws_acm_certificate" "blog" {
  provider                  = aws.us_east_1
  domain_name               = local.domain
  subject_alternative_names = [local.roadmap_domain]
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
  tags = merge(local.common_tags, { Name = local.domain })
}
```

- [ ] **Step 3: Validate both domains**

Change the `for_each` on `aws_route53_record.cert_validation` from `toset([local.domain])` to:

```hcl
  for_each = toset(local.cert_domains)
```

The existing `one([for dvo in ... if dvo.domain_name == each.key])` lookups already generalise to two domains — leave them alone.

- [ ] **Step 4: Add the alias and the subdomain records**

On `aws_cloudfront_distribution.blog`, change `aliases = [local.domain]` to:

```hcl
  aliases = local.cert_domains
```

Then add these two records after the existing `aws_route53_record.aaaa` block. These are new record sets, so no `allow_overwrite`:

```hcl
# The roadmap subdomain points at the same distribution; the viewer-request
# function selects the /roadmap subtree by Host header.
resource "aws_route53_record" "roadmap_a" {
  zone_id = var.route53_zone_id
  name    = local.roadmap_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.blog.domain_name
    zone_id                = aws_cloudfront_distribution.blog.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "roadmap_aaaa" {
  zone_id = var.route53_zone_id
  name    = local.roadmap_domain
  type    = "AAAA"
  alias {
    name                   = aws_cloudfront_distribution.blog.domain_name
    zone_id                = aws_cloudfront_distribution.blog.hosted_zone_id
    evaluate_target_health = false
  }
}
```

- [ ] **Step 5: Validate and lint**

```bash
cd inf/terraform/aws-s3-web && terraform init -backend=false && terraform validate
cd ../../.. && tflint --recursive
```

Expected: `Success! The configuration is valid.` and no tflint findings for this directory.

- [ ] **Step 6: Review the plan output for destructive changes**

If you have AWS credentials, run `terraform plan -var-file="terraform.tfvars"` in `inf/terraform/aws-s3-web` and confirm:
- `aws_acm_certificate.blog` — **replaced** (expected; `create_before_destroy` keeps the apex served)
- `aws_route53_record.cert_validation["roadmap.nghuy.link"]` — created
- `aws_route53_record.roadmap_a` / `roadmap_aaaa` — created
- `aws_cloudfront_distribution.blog` — updated in place (aliases + certificate ARN)
- `aws_cloudfront_function.rewrite` — updated in place
- **No destroy or replace on `aws_route53_record.a`, `aws_route53_record.aaaa`, `aws_s3_bucket.website`, or `aws_s3_bucket.media`.**

If you have no credentials, note that in the PR and leave this for the `terraform-plan.yml` run on the pull request, which auto-discovers this directory. Do not apply from a workstation.

- [ ] **Step 7: Commit**

```bash
git add inf/terraform/aws-s3-web/locals.tf inf/terraform/aws-s3-web/cdn.tf
git commit -m "$(cat <<'EOF'
feat(roadmap): serve roadmap.nghuy.link from the existing distribution

Adds the subdomain as an ACM SAN, a second CloudFront alias, and Route53
alias records. No new bucket, distribution, or deploy pipeline.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Roadmap types and content

**Files:**
- Create: `src/aws-s3-web/src/types/roadmap.ts`
- Create: `src/aws-s3-web/src/data/roadmap.ts`
- Create: `src/aws-s3-web/src/data/roadmap.test.ts`

**Interfaces:**
- Consumes: `portfolio` from `@/data/portfolio` (for the drift test only).
- Produces: types `NodeImportance`, `MyLevel`, `RoadmapResource`, `StageAccent`, `RoadmapNode`, `RoadmapStage` from `@/types/roadmap`; and `roadmapStages: readonly RoadmapStage[]` from `@/data/roadmap`. Every later task imports from these two modules.

- [ ] **Step 1: Write the failing data test**

Create `src/aws-s3-web/src/data/roadmap.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { portfolio } from "@/data/portfolio";
import { roadmapStages } from "@/data/roadmap";
import type { MyLevel, NodeImportance } from "@/types/roadmap";

const IMPORTANCE: NodeImportance[] = ["core", "recommended", "optional"];
const LEVELS: MyLevel[] = ["production", "working", "learning", "none"];
const allNodes = roadmapStages.flatMap((stage) => stage.nodes);

describe("roadmap stages", () => {
  it("has four stages with contiguous, ordered indexes", () => {
    expect(roadmapStages).toHaveLength(4);
    expect(roadmapStages.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it("has unique, url-safe stage ids", () => {
    const ids = roadmapStages.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it("gives every stage a label, kicker, and outcome", () => {
    roadmapStages.forEach((stage) => {
      expect(stage.label.length).toBeGreaterThan(0);
      expect(stage.kicker.length).toBeGreaterThan(0);
      expect(stage.outcome.length).toBeGreaterThan(0);
    });
  });

  it("includes exactly one AI-accented stage", () => {
    expect(roadmapStages.filter((s) => s.accent === "ai")).toHaveLength(1);
  });
});

describe("roadmap nodes", () => {
  it("has unique, url-safe node ids across all stages", () => {
    const ids = allNodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9-]+$/));
  });

  it("gives every node a title, summary, why, and at least one tool", () => {
    allNodes.forEach((node) => {
      expect(node.title.length, node.id).toBeGreaterThan(0);
      expect(node.summary.length, node.id).toBeGreaterThan(0);
      expect(node.why.length, node.id).toBeGreaterThan(0);
      expect(node.tools.length, node.id).toBeGreaterThan(0);
    });
  });

  it("gives every node at least one absolute https resource", () => {
    allNodes.forEach((node) => {
      expect(node.resources.length, node.id).toBeGreaterThan(0);
      node.resources.forEach((resource) => {
        expect(resource.label.length, node.id).toBeGreaterThan(0);
        expect(resource.url, node.id).toMatch(/^https:\/\//);
        expect(() => new URL(resource.url)).not.toThrow();
      });
    });
  });

  it("uses only known importance and experience values", () => {
    allNodes.forEach((node) => {
      expect(IMPORTANCE, node.id).toContain(node.importance);
      expect(LEVELS, node.id).toContain(node.myLevel);
    });
  });
});

describe("portfolio drift", () => {
  // A skill claimed on the portfolio must not be marked unpractised on the
  // roadmap. Matches on exact tool equality or a whole-word title match, so
  // "Git" does not spuriously match "GitHub Actions".
  it("never marks a claimed portfolio skill as myLevel 'none'", () => {
    const violations: string[] = [];

    portfolio.skills.forEach((skill) => {
      const label = skill.label.toLowerCase();
      const titlePattern = new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

      allNodes.forEach((node) => {
        const matches =
          node.tools.some((tool) => tool.toLowerCase() === label) || titlePattern.test(node.title);
        if (matches && node.myLevel === "none") {
          violations.push(`${skill.label} -> ${node.id}`);
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/data/roadmap.test.ts`
Expected: FAIL — `Failed to resolve import "@/data/roadmap"`.

- [ ] **Step 3: Write the types**

Create `src/aws-s3-web/src/types/roadmap.ts`:

```ts
export type NodeImportance = "core" | "recommended" | "optional";

export type MyLevel = "production" | "working" | "learning" | "none";

export type StageAccent = "blue" | "green" | "ai" | "violet";

export type RoadmapResource = {
  label: string;
  url: string;
};

export type RoadmapNode = {
  /** url-safe, stable, unique across the whole roadmap */
  id: string;
  title: string;
  importance: NodeImportance;
  /** one line, shown on the card */
  summary: string;
  /** why it matters in 2026, shown in the detail panel */
  why: string;
  tools: readonly string[];
  resources: readonly RoadmapResource[];
  /** author's real experience, surfaced only by the experience overlay */
  myLevel: MyLevel;
};

export type RoadmapStage = {
  id: string;
  index: number;
  label: string;
  /** mono eyebrow, e.g. "STAGE 02" */
  kicker: string;
  /** what you can do once this stage is behind you */
  outcome: string;
  accent: StageAccent;
  nodes: readonly RoadmapNode[];
};
```

- [ ] **Step 4: Write the content module**

Create `src/aws-s3-web/src/data/roadmap.ts`:

```ts
import type { RoadmapStage } from "@/types/roadmap";

export const roadmapStages: readonly RoadmapStage[] = [
  {
    id: "foundations",
    index: 0,
    label: "Foundations",
    kicker: "STAGE 00",
    outcome: "You can debug a Linux box, read a network trace, and reason about cloud primitives without a tutorial open.",
    accent: "blue",
    nodes: [
      {
        id: "linux",
        title: "Linux & systems",
        importance: "core",
        summary: "Processes, filesystems, systemd, and the /proc view of a running box.",
        why: "Every container, node, and CI runner is a Linux box. When an incident escapes your dashboards, the shell is the last tool that still works.",
        tools: ["bash", "systemd", "journalctl", "strace"],
        resources: [
          { label: "Linux Journey", url: "https://linuxjourney.com/" },
          { label: "The Linux Command Line (free)", url: "https://linuxcommand.org/tlcl.php" },
        ],
        myLevel: "production",
      },
      {
        id: "networking",
        title: "Networking, DNS & TLS",
        importance: "core",
        summary: "Routing, NAT, resolution order, and what actually happens during a TLS handshake.",
        why: "Most “the cluster is broken” pages turn out to be DNS, MTU, or an expired certificate. Networking is the debugging skill with the longest half-life.",
        tools: ["dig", "tcpdump", "curl", "openssl"],
        resources: [
          { label: "Mess with DNS", url: "https://messwithdns.net/" },
          { label: "High Performance Browser Networking", url: "https://hpbn.co/" },
        ],
        myLevel: "production",
      },
      {
        id: "git",
        title: "Git & trunk-based flow",
        importance: "core",
        summary: "Branching, rebasing, bisecting, and a merge strategy CI can actually enforce.",
        why: "Git is the source of truth for GitOps. If the branching model is confused, every downstream promotion pipeline inherits that confusion.",
        tools: ["Git", "pre-commit", "conventional commits"],
        resources: [
          { label: "Pro Git (free)", url: "https://git-scm.com/book/en/v2" },
          { label: "Trunk Based Development", url: "https://trunkbaseddevelopment.com/" },
        ],
        myLevel: "production",
      },
      {
        id: "programming",
        title: "One language, properly",
        importance: "core",
        summary: "Python or Go to the level where you ship tested tools, not just glue scripts.",
        why: "The gap between a DevOps engineer and a platform engineer is usually the ability to maintain an internal tool rather than write another 400-line bash script.",
        tools: ["Python", "Go", "pytest", "uv"],
        resources: [
          { label: "Automate the Boring Stuff", url: "https://automatetheboringstuff.com/" },
          { label: "Go by Example", url: "https://gobyexample.com/" },
        ],
        myLevel: "production",
      },
      {
        id: "cloud-fundamentals",
        title: "Cloud fundamentals",
        importance: "core",
        summary: "Compute, storage, networking, IAM, and the cost model sitting behind each of them.",
        why: "Cloud primitives change name per provider but not per concept. Learn the IAM and networking model once and the rest is documentation.",
        tools: ["AWS", "Azure", "IAM", "VPC"],
        resources: [
          { label: "AWS Well-Architected Framework", url: "https://aws.amazon.com/architecture/well-architected/" },
          { label: "AWS Skill Builder", url: "https://skillbuilder.aws/" },
        ],
        myLevel: "production",
      },
    ],
  },
  {
    id: "modern-devops",
    index: 1,
    label: "Modern DevOps",
    kicker: "STAGE 01",
    outcome: "You can take a service from a Dockerfile to a monitored, signed, GitOps-managed production deployment.",
    accent: "green",
    nodes: [
      {
        id: "containers",
        title: "Containers & OCI",
        importance: "core",
        summary: "Image layers, multi-stage builds, rootless runtimes, and what the OCI spec standardises.",
        why: "A sloppy image is a security finding and a slow pipeline at the same time. Build discipline here pays back on every deploy.",
        tools: ["Docker", "BuildKit", "Podman", "Trivy"],
        resources: [
          { label: "Docker documentation", url: "https://docs.docker.com/" },
          { label: "OCI image specification", url: "https://github.com/opencontainers/image-spec" },
        ],
        myLevel: "production",
      },
      {
        id: "kubernetes",
        title: "Kubernetes",
        importance: "core",
        summary: "Workload primitives, scheduling, networking, RBAC, and the controller reconciliation loop.",
        why: "Kubernetes is the substrate almost everything else in this stage assumes. Understanding reconciliation is what makes GitOps and operators stop feeling like magic.",
        tools: ["kubectl", "Helm", "Kustomize", "CRDs"],
        resources: [
          { label: "Kubernetes documentation", url: "https://kubernetes.io/docs/home/" },
          { label: "Kubernetes The Hard Way", url: "https://github.com/kelseyhightower/kubernetes-the-hard-way" },
        ],
        myLevel: "production",
      },
      {
        id: "iac",
        title: "Infrastructure as Code",
        importance: "core",
        summary: "Modules, remote state with locking, drift detection, and plans reviewed like code.",
        why: "IaC is where most teams first meet real engineering discipline in infrastructure: review, testing, versioning, and a blast radius you can read before you cause it.",
        tools: ["Terraform", "OpenTofu", "Ansible", "tflint"],
        resources: [
          { label: "Terraform documentation", url: "https://developer.hashicorp.com/terraform/docs" },
          { label: "OpenTofu", url: "https://opentofu.org/docs/" },
        ],
        myLevel: "production",
      },
      {
        id: "cicd-gitops",
        title: "CI/CD & GitOps",
        importance: "core",
        summary: "Pipelines as code, keyless cloud auth via OIDC, and Git as the deployment source of truth.",
        why: "GitOps turns “what is running in production?” from an investigation into a `git diff`. It is also the cleanest way to get auditability for free.",
        tools: ["GitHub Actions", "Argo CD", "Flux", "Jenkins"],
        resources: [
          { label: "OpenGitOps principles", url: "https://opengitops.dev/" },
          { label: "Argo CD documentation", url: "https://argo-cd.readthedocs.io/en/stable/" },
        ],
        myLevel: "production",
      },
      {
        id: "observability",
        title: "Observability",
        importance: "core",
        summary: "OpenTelemetry as the instrumentation standard, plus eBPF for what you cannot instrument.",
        why: "2026 consolidated on OpenTelemetry for signals you control and eBPF auto-instrumentation for the rest. Vendor-specific agents are becoming an implementation detail rather than a skill.",
        tools: ["OpenTelemetry", "Prometheus", "Grafana", "Cilium"],
        resources: [
          { label: "OpenTelemetry documentation", url: "https://opentelemetry.io/docs/" },
          { label: "eBPF.io", url: "https://ebpf.io/what-is-ebpf/" },
        ],
        myLevel: "production",
      },
      {
        id: "devsecops",
        title: "DevSecOps & supply chain",
        importance: "core",
        summary: "SBOMs, signed artifacts, provenance attestations, and policy as code in the pipeline.",
        why: "Supply-chain requirements moved from theoretical to contractual. SBOM generation and artifact signing are now hiring requirements in regulated and government work.",
        tools: ["Sigstore", "SLSA", "Syft", "OPA"],
        resources: [
          { label: "SLSA framework", url: "https://slsa.dev/" },
          { label: "Sigstore", url: "https://www.sigstore.dev/" },
        ],
        myLevel: "working",
      },
    ],
  },
  {
    id: "ai-layer",
    index: 2,
    label: "AI Layer",
    kicker: "STAGE 02",
    outcome: "You can put AI inside your delivery and operations loops with guardrails, and explain precisely where you chose not to.",
    accent: "ai",
    nodes: [
      {
        id: "ai-assisted-engineering",
        title: "AI-assisted engineering",
        importance: "core",
        summary: "Agentic coding tools in the loop, with context discipline and non-negotiable review gates.",
        why: "This is the compounding skill of 2026. Sources consistently report a 15–25% pay premium for demonstrated — not merely familiar — AI ability. The demonstration is a reviewed diff, not a chat log.",
        tools: ["Claude Code", "Codex", "Cursor", "pre-commit"],
        resources: [
          { label: "Claude Code documentation", url: "https://docs.claude.com/en/docs/claude-code/overview" },
          { label: "Building effective agents", url: "https://www.anthropic.com/engineering/building-effective-agents" },
        ],
        myLevel: "production",
      },
      {
        id: "llm-fundamentals",
        title: "LLM fundamentals for ops",
        importance: "core",
        summary: "Tokens, context windows, embeddings, and retrieval over your own runbooks.",
        why: "Without the fundamentals you cannot tell a bad answer from a badly retrieved one. Context engineering is the difference between an assistant that helps during an incident and one that invents a service that does not exist.",
        tools: ["RAG", "embeddings", "vector stores", "evals"],
        resources: [
          { label: "Prompt engineering overview", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview" },
          { label: "Contextual retrieval", url: "https://www.anthropic.com/news/contextual-retrieval" },
        ],
        myLevel: "working",
      },
      {
        id: "mcp",
        title: "MCP & tool integration",
        importance: "recommended",
        summary: "Model Context Protocol: wiring real infrastructure tools into agents, and writing servers for the ones that lack them.",
        why: "The highest-signal portfolio project available right now. Pick an internal tool with no MCP server and build one — it proves you understand the integration layer rather than just the chat box.",
        tools: ["MCP", "JSON-RPC", "OpenAPI"],
        resources: [
          { label: "Model Context Protocol", url: "https://modelcontextprotocol.io/" },
          { label: "awesome-devops-ai", url: "https://github.com/hammadhaqqani/awesome-devops-ai" },
        ],
        myLevel: "working",
      },
      {
        id: "aiops",
        title: "AIOps",
        importance: "core",
        summary: "Anomaly detection, alert correlation and summarisation, and auto-remediation behind guardrails.",
        why: "Alert volume long ago outgrew human triage. The valuable skill is not “buy an AIOps product” but knowing which remediations are safe to automate and what blast radius each one carries.",
        tools: ["anomaly detection", "alert correlation", "runbook automation", "Grafana"],
        resources: [
          { label: "SRE Book — Monitoring distributed systems", url: "https://sre.google/sre-book/monitoring-distributed-systems/" },
          { label: "OpenTelemetry documentation", url: "https://opentelemetry.io/docs/" },
        ],
        myLevel: "learning",
      },
      {
        id: "llmops",
        title: "LLMOps / AI platform",
        importance: "recommended",
        summary: "Serving models, scheduling GPUs, running evals, and holding cost and latency budgets.",
        why: "When your company ships an AI feature, someone has to run it. That someone is a platform engineer, and the job is the familiar one — capacity, cost, latency, rollout — with unfamiliar units.",
        tools: ["Kubernetes", "GPU scheduling", "model gateways", "evals"],
        resources: [
          { label: "Kubernetes device plugins", url: "https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/" },
          { label: "Claude API documentation", url: "https://docs.claude.com/en/api/overview" },
        ],
        myLevel: "learning",
      },
      {
        id: "ai-security",
        title: "AI security & governance",
        importance: "core",
        summary: "Prompt injection, secrets leaking through context, and non-determinism inside deterministic pipelines.",
        why: "An agent holding production credentials is a new class of privileged identity. Treat its context window as an untrusted input channel and its tool permissions as an IAM problem.",
        tools: ["OWASP LLM Top 10", "threat modelling", "IAM", "audit logging"],
        resources: [
          { label: "OWASP Top 10 for LLM Applications", url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/" },
          { label: "NIST AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework" },
        ],
        myLevel: "learning",
      },
      {
        id: "ai-limits",
        title: "Where AI still fails",
        importance: "core",
        summary: "Context-heavy production calls, system design trade-offs, and security decisions stay human.",
        why: "Every serious 2026 roadmap lands on the same caveat: AI is a force multiplier with hard edges. Knowing where to stop delegating is itself a senior skill, and it separates an engineer who ships with AI from one who is merely fast until the first outage.",
        tools: ["incident review", "design docs", "threat modelling"],
        resources: [
          { label: "SRE Book — Postmortem culture", url: "https://sre.google/sre-book/postmortem-culture/" },
          { label: "2026 DevOps, Cloud & AI skills roadmap", url: "https://kodekloud.com/blog/devops-cloud-ai-skills-roadmap-2026/" },
        ],
        myLevel: "production",
      },
    ],
  },
  {
    id: "senior-impact",
    index: 3,
    label: "Senior Impact",
    kicker: "STAGE 03",
    outcome: "You change how a whole organisation ships, and you can defend the trade-offs to people who do not write code.",
    accent: "violet",
    nodes: [
      {
        id: "platform-engineering",
        title: "Platform engineering & IDPs",
        importance: "core",
        summary: "Golden paths, self-service environments, and treating the platform as a product with users.",
        why: "The 2026 job market pays for leverage, not for tickets closed. An internal platform that removes a step for fifty engineers outperforms any amount of individual heroics.",
        tools: ["Backstage", "golden paths", "Crossplane", "Argo CD"],
        resources: [
          { label: "Platform Engineering", url: "https://platformengineering.org/" },
          { label: "Backstage documentation", url: "https://backstage.io/docs/overview/what-is-backstage/" },
        ],
        myLevel: "working",
      },
      {
        id: "sre",
        title: "SRE practice",
        importance: "core",
        summary: "SLOs, error budgets, and DORA metrics used to make decisions rather than decorate a dashboard.",
        why: "An error budget is the only mechanism that reliably converts a reliability argument into a scheduling decision. Without one, “we should slow down” is just an opinion.",
        tools: ["SLO", "error budgets", "DORA", "incident response"],
        resources: [
          { label: "Google SRE Book", url: "https://sre.google/sre-book/table-of-contents/" },
          { label: "DORA", url: "https://dora.dev/" },
        ],
        myLevel: "working",
      },
      {
        id: "finops",
        title: "FinOps",
        importance: "recommended",
        summary: "Cost as a first-class engineering metric, optimised at provisioning time rather than in a monthly review.",
        why: "2026 sources place cost alongside speed and stability as a DORA-equivalent signal, and estimate that teams ignoring it leave 30–40% of possible savings unclaimed.",
        tools: ["Infracost", "Cost Explorer", "tagging policy", "rightsizing"],
        resources: [
          { label: "FinOps Foundation", url: "https://www.finops.org/introduction/what-is-finops/" },
          { label: "Infracost", url: "https://www.infracost.io/docs/" },
        ],
        myLevel: "working",
      },
      {
        id: "architecture",
        title: "Architecture & resilience",
        importance: "core",
        summary: "Multi-AZ design, failure domains, disaster recovery you have actually rehearsed, and capacity planning.",
        why: "Resilience is a design property, not a monitoring feature. The architecture decisions made before launch set the ceiling on every availability number you will ever report.",
        tools: ["multi-AZ", "disaster recovery", "chaos engineering", "capacity planning"],
        resources: [
          { label: "AWS Well-Architected — Reliability pillar", url: "https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html" },
          { label: "Principles of Chaos Engineering", url: "https://principlesofchaos.org/" },
        ],
        myLevel: "working",
      },
      {
        id: "leadership",
        title: "Leadership & incident command",
        importance: "recommended",
        summary: "Running incidents, writing blameless postmortems, and making trade-offs legible to non-engineers.",
        why: "At senior level the bottleneck stops being technical. Calm incident command and a postmortem people are willing to be honest in are worth more than another tool in the stack.",
        tools: ["incident command", "postmortems", "ADRs", "mentoring"],
        resources: [
          { label: "SRE Book — Managing incidents", url: "https://sre.google/sre-book/managing-incidents/" },
          { label: "Architecture Decision Records", url: "https://adr.github.io/" },
        ],
        myLevel: "working",
      },
    ],
  },
];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- src/data/roadmap.test.ts`
Expected: PASS, all describes.

Then `pnpm typecheck` — expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/src/types/roadmap.ts src/aws-s3-web/src/data/roadmap.ts src/aws-s3-web/src/data/roadmap.test.ts
git commit -m "$(cat <<'EOF'
feat(roadmap): add roadmap types and 2026 content

Four stages, 23 nodes, with AI as a first-class stage. Includes a drift test
so a skill claimed on the portfolio cannot be marked unpractised here.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Experience overlay helpers

**Files:**
- Create: `src/aws-s3-web/src/lib/roadmap/experience.ts`
- Create: `src/aws-s3-web/src/lib/roadmap/experience.test.ts`

**Interfaces:**
- Consumes: `RoadmapStage`, `RoadmapNode`, `MyLevel`, `NodeImportance` from `@/types/roadmap`.
- Produces:
  - `stageCoverage(stage: RoadmapStage): { practised: number; total: number; percent: number }`
  - `findNode(stages: readonly RoadmapStage[], nodeId: string): RoadmapNode | undefined`
  - `MY_LEVEL_LABELS: Record<MyLevel, string>`
  - `IMPORTANCE_LABELS: Record<NodeImportance, string>`

- [ ] **Step 1: Write the failing test**

Create `src/aws-s3-web/src/lib/roadmap/experience.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { IMPORTANCE_LABELS, MY_LEVEL_LABELS, findNode, stageCoverage } from "@/lib/roadmap/experience";
import type { MyLevel, RoadmapNode, RoadmapStage } from "@/types/roadmap";

function node(id: string, myLevel: MyLevel): RoadmapNode {
  return {
    id,
    title: id,
    importance: "core",
    summary: "s",
    why: "w",
    tools: ["t"],
    resources: [{ label: "r", url: "https://example.com/" }],
    myLevel,
  };
}

function stage(nodes: RoadmapNode[]): RoadmapStage {
  return {
    id: "stage",
    index: 0,
    label: "Stage",
    kicker: "STAGE 00",
    outcome: "o",
    accent: "blue",
    nodes,
  };
}

describe("stageCoverage", () => {
  it("counts production and working as practised, learning and none as not", () => {
    const result = stageCoverage(
      stage([node("a", "production"), node("b", "working"), node("c", "learning"), node("d", "none")]),
    );
    expect(result).toEqual({ practised: 2, total: 4, percent: 50 });
  });

  it("reports 100 percent when every node is practised", () => {
    expect(stageCoverage(stage([node("a", "production"), node("b", "working")]))).toEqual({
      practised: 2,
      total: 2,
      percent: 100,
    });
  });

  it("reports 0 percent when nothing is practised", () => {
    expect(stageCoverage(stage([node("a", "learning"), node("b", "none")]))).toEqual({
      practised: 0,
      total: 2,
      percent: 0,
    });
  });

  it("reports 0 percent for an empty stage instead of dividing by zero", () => {
    expect(stageCoverage(stage([]))).toEqual({ practised: 0, total: 0, percent: 0 });
  });

  it("rounds the percentage to a whole number", () => {
    expect(stageCoverage(stage([node("a", "production"), node("b", "none"), node("c", "none")])).percent).toBe(33);
  });
});

describe("findNode", () => {
  const stages = [stage([node("alpha", "production")])];

  it("finds a node by id across stages", () => {
    expect(findNode(stages, "alpha")?.id).toBe("alpha");
  });

  it("returns undefined for an unknown id", () => {
    expect(findNode(stages, "nope")).toBeUndefined();
  });
});

describe("label maps", () => {
  it("labels every experience level", () => {
    (["production", "working", "learning", "none"] as MyLevel[]).forEach((level) => {
      expect(MY_LEVEL_LABELS[level]).toBeTruthy();
    });
  });

  it("labels every importance level", () => {
    expect(IMPORTANCE_LABELS.core).toBeTruthy();
    expect(IMPORTANCE_LABELS.recommended).toBeTruthy();
    expect(IMPORTANCE_LABELS.optional).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/lib/roadmap/experience.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/roadmap/experience"`.

- [ ] **Step 3: Write the implementation**

Create `src/aws-s3-web/src/lib/roadmap/experience.ts`:

```ts
import type { MyLevel, NodeImportance, RoadmapNode, RoadmapStage } from "@/types/roadmap";

export const MY_LEVEL_LABELS: Record<MyLevel, string> = {
  production: "Production experience",
  working: "Working knowledge",
  learning: "Currently learning",
  none: "Not yet",
};

export const IMPORTANCE_LABELS: Record<NodeImportance, string> = {
  core: "Core",
  recommended: "Recommended",
  optional: "Optional",
};

/** Levels that count as hands-on rather than aspirational. */
const PRACTISED: readonly MyLevel[] = ["production", "working"];

export type StageCoverage = {
  practised: number;
  total: number;
  percent: number;
};

export function stageCoverage(stage: RoadmapStage): StageCoverage {
  const total = stage.nodes.length;
  const practised = stage.nodes.filter((node) => PRACTISED.includes(node.myLevel)).length;
  const percent = total === 0 ? 0 : Math.round((practised / total) * 100);

  return { practised, total, percent };
}

export function findNode(
  stages: readonly RoadmapStage[],
  nodeId: string,
): RoadmapNode | undefined {
  for (const stage of stages) {
    const found = stage.nodes.find((node) => node.id === nodeId);
    if (found) return found;
  }
  return undefined;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- src/lib/roadmap/experience.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/lib/roadmap/
git commit -m "$(cat <<'EOF'
feat(roadmap): add experience coverage helpers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Node card + route stylesheet

**Files:**
- Create: `src/aws-s3-web/src/app/roadmap/roadmap.css`
- Create: `src/aws-s3-web/src/components/roadmap/roadmap-node.tsx`
- Create: `src/aws-s3-web/src/components/roadmap/roadmap-node.test.tsx`

**Interfaces:**
- Consumes: `RoadmapNode` from `@/types/roadmap`; `IMPORTANCE_LABELS`, `MY_LEVEL_LABELS` from `@/lib/roadmap/experience`.
- Produces: `RoadmapNodeCard({ node, showExperience, onOpen }: RoadmapNodeCardProps)` — renders a `<button>`; `onOpen: (nodeId: string) => void`. Consumed by Task 8.

- [ ] **Step 1: Write the failing test**

Create `src/aws-s3-web/src/components/roadmap/roadmap-node.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapNodeCard } from "./roadmap-node";
import type { RoadmapNode } from "@/types/roadmap";

const node: RoadmapNode = {
  id: "kubernetes",
  title: "Kubernetes",
  importance: "core",
  summary: "Workload primitives and the reconciliation loop.",
  why: "It is the substrate everything else assumes.",
  tools: ["kubectl", "Helm"],
  resources: [{ label: "Docs", url: "https://kubernetes.io/docs/home/" }],
  myLevel: "production",
};

describe("RoadmapNodeCard", () => {
  it("renders the title, summary, and importance label", () => {
    render(<RoadmapNodeCard node={node} showExperience={false} onOpen={() => {}} />);
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Workload primitives and the reconciliation loop.")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
  });

  it("is an accessible button that reports the node id when activated", async () => {
    const onOpen = vi.fn();
    render(<RoadmapNodeCard node={node} showExperience={false} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: /Kubernetes/ }));
    expect(onOpen).toHaveBeenCalledWith("kubernetes");
  });

  it("hides the experience label when the overlay is off", () => {
    render(<RoadmapNodeCard node={node} showExperience={false} onOpen={() => {}} />);
    expect(screen.queryByText("Production experience")).not.toBeInTheDocument();
  });

  it("shows the experience label when the overlay is on", () => {
    render(<RoadmapNodeCard node={node} showExperience onOpen={() => {}} />);
    expect(screen.getByText("Production experience")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/components/roadmap/roadmap-node.test.tsx`
Expected: FAIL — cannot resolve `./roadmap-node`.

- [ ] **Step 3: Write the component**

Create `src/aws-s3-web/src/components/roadmap/roadmap-node.tsx`:

```tsx
"use client";

import { IMPORTANCE_LABELS, MY_LEVEL_LABELS } from "@/lib/roadmap/experience";
import type { RoadmapNode } from "@/types/roadmap";

export type RoadmapNodeCardProps = {
  node: RoadmapNode;
  showExperience: boolean;
  onOpen: (nodeId: string) => void;
};

export function RoadmapNodeCard({ node, showExperience, onOpen }: RoadmapNodeCardProps) {
  return (
    <button
      type="button"
      className="rm-node"
      data-importance={node.importance}
      data-level={showExperience ? node.myLevel : undefined}
      onClick={() => onOpen(node.id)}
    >
      <span className="rm-node-head">
        <span className="rm-node-title">{node.title}</span>
        <span className="rm-node-importance">{IMPORTANCE_LABELS[node.importance]}</span>
      </span>
      <span className="rm-node-summary">{node.summary}</span>
      {showExperience ? (
        <span className="rm-node-level">{MY_LEVEL_LABELS[node.myLevel]}</span>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 4: Write the route stylesheet**

Create `src/aws-s3-web/src/app/roadmap/roadmap.css`. This is the full stylesheet for the page — later tasks add no CSS, they only use these classes.

```css
/* Roadmap route styles. Loaded only by /roadmap, so none of this ships to the
   portfolio or blog. Every colour derives from the globals.css token layer, so
   light/dark and the site identity carry over with no duplication. */

.rm-page {
  --rm-spine: color-mix(in srgb, var(--accent) 45%, transparent);
  --rm-stage: var(--accent);
  --rm-glow: transparent;

  position: relative;
  min-height: 100dvh;
  padding: 0 20px 96px;
}

.rm-inner {
  position: relative;
  z-index: 1;
  max-width: var(--content);
  margin: 0 auto;
}

/* ---------- header ---------- */

.rm-header {
  padding: 72px 0 40px;
}

.rm-kicker {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.rm-title {
  margin: 12px 0 0;
  font-size: clamp(2.25rem, 6vw, 3.75rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.rm-lede {
  max-width: 60ch;
  margin: 16px 0 0;
  color: var(--muted);
  font-size: 1.05rem;
}

.rm-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 28px;
}

.rm-toggle {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  padding: 9px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.rm-toggle:hover {
  background: var(--surface-hover);
  border-color: var(--accent);
}

.rm-toggle[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-bright);
}

.rm-toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--faint);
}

.rm-toggle[aria-pressed="true"] .rm-toggle-dot {
  background: var(--accent-bright);
}

.rm-home-link {
  color: var(--muted);
  font-size: 0.9rem;
  text-decoration: none;
}

.rm-home-link:hover {
  color: var(--accent);
}

/* ---------- layout ---------- */

.rm-body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}

/* ---------- stage rail ---------- */

.rm-rail {
  position: sticky;
  top: 32px;
}

.rm-rail-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rm-rail-item button {
  display: flex;
  gap: 10px;
  align-items: baseline;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-left: 2px solid var(--border);
  border-radius: 0 6px 6px 0;
  background: transparent;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease;
}

.rm-rail-item button:hover {
  background: var(--surface);
  color: var(--text);
}

.rm-rail-item button[aria-current="true"] {
  border-left-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}

.rm-rail-index {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.72rem;
  color: var(--faint);
}

.rm-rail-coverage {
  margin-top: 6px;
  height: 3px;
  border-radius: 999px;
  background: var(--border);
}

.rm-rail-coverage span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 320ms ease;
}

/* ---------- track ---------- */

.rm-track {
  position: relative;
  padding-left: 32px;
}

.rm-spine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 7px;
  width: 2px;
  background: linear-gradient(
    to bottom,
    transparent,
    var(--rm-spine) 6%,
    var(--rm-spine) 94%,
    transparent
  );
}

.rm-stage {
  position: relative;
  padding: 0 0 72px;
  scroll-margin-top: 24px;
}

.rm-stage[data-accent="blue"] {
  --rm-stage: var(--blue);
  --rm-spine: color-mix(in srgb, var(--blue) 45%, transparent);
}

.rm-stage[data-accent="green"] {
  --rm-stage: var(--green);
  --rm-spine: color-mix(in srgb, var(--green) 45%, transparent);
}

.rm-stage[data-accent="ai"] {
  --rm-stage: #a371f7;
  --rm-spine: color-mix(in srgb, #a371f7 60%, transparent);
  --rm-glow: color-mix(in srgb, #a371f7 14%, transparent);
}

.rm-stage[data-accent="violet"] {
  --rm-stage: #bc8cff;
  --rm-spine: color-mix(in srgb, #bc8cff 45%, transparent);
}

.rm-stage-marker {
  position: absolute;
  top: 8px;
  left: -32px;
  width: 16px;
  height: 16px;
  border: 2px solid var(--rm-stage);
  border-radius: 50%;
  background: var(--bg);
  box-shadow: 0 0 0 5px var(--bg);
}

.rm-stage[data-accent="ai"] .rm-stage-marker {
  background: var(--rm-stage);
  box-shadow: 0 0 0 5px var(--bg), 0 0 22px var(--rm-stage);
}

.rm-stage-kicker {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--rm-stage);
}

.rm-stage-title {
  margin: 8px 0 0;
  font-size: clamp(1.6rem, 3.5vw, 2.25rem);
  letter-spacing: -0.015em;
}

.rm-stage-outcome {
  max-width: 62ch;
  margin: 10px 0 0;
  color: var(--muted);
}

.rm-stage-coverage {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--muted);
}

.rm-stage-coverage-bar {
  width: 120px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
}

.rm-stage-coverage-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--rm-stage);
  transition: width 320ms ease;
}

.rm-nodes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
  margin-top: 26px;
}

/* ---------- node card ---------- */

.rm-node {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: linear-gradient(160deg, var(--surface-raised), var(--surface));
  box-shadow: 0 1px 2px var(--shadow);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.rm-node:hover {
  transform: translateY(-2px);
  border-color: var(--rm-stage);
  box-shadow: 0 8px 24px var(--shadow), 0 0 0 1px var(--rm-glow);
}

.rm-node-head {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
}

.rm-node-title {
  font-weight: 600;
}

.rm-node-importance {
  flex-shrink: 0;
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--faint);
}

.rm-node[data-importance="core"] .rm-node-importance {
  color: var(--rm-stage);
}

.rm-node-summary {
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.rm-node-level {
  align-self: flex-start;
  padding: 3px 9px;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--muted);
}

.rm-node[data-level="production"] .rm-node-level {
  border-color: color-mix(in srgb, var(--green) 45%, transparent);
  color: var(--green);
}

.rm-node[data-level="working"] .rm-node-level {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  color: var(--accent);
}

.rm-node[data-level="learning"] .rm-node-level {
  border-color: color-mix(in srgb, var(--yellow) 45%, transparent);
  color: var(--yellow);
}

/* ---------- detail panel ---------- */

.rm-panel-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  border: 0;
  padding: 0;
  background: var(--overlay);
}

.rm-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 91;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(460px, 100%);
  overflow-y: auto;
  padding: 28px 26px 40px;
  border-left: 1px solid var(--border);
  background: var(--panel);
  box-shadow: -12px 0 40px var(--shadow);
}

.rm-panel-close {
  align-self: flex-end;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
}

.rm-panel-close:hover {
  color: var(--text);
  border-color: var(--accent);
}

.rm-panel-title {
  margin: 0;
  font-size: 1.6rem;
  letter-spacing: -0.015em;
}

.rm-panel-why {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.rm-panel-label {
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
}

.rm-panel-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.rm-panel-tools li {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-family: "Geist Mono", ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--muted);
}

.rm-panel-resources {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.rm-panel-resources a {
  color: var(--accent);
  text-decoration: none;
}

.rm-panel-resources a:hover {
  text-decoration: underline;
}

/* ---------- responsive ---------- */

@media (max-width: 1100px) {
  .rm-nodes {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .rm-body {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }

  .rm-rail {
    top: 0;
    z-index: 5;
    margin: 0 -20px;
    padding: 10px 20px;
    background: var(--overlay);
    backdrop-filter: blur(8px);
  }

  .rm-rail-list {
    flex-direction: row;
    overflow-x: auto;
    gap: 8px;
  }

  .rm-rail-item button {
    flex-shrink: 0;
    border-left: 0;
    border-bottom: 2px solid var(--border);
    border-radius: 6px 6px 0 0;
  }

  .rm-rail-item button[aria-current="true"] {
    border-left-color: transparent;
    border-bottom-color: var(--accent);
  }

  .rm-rail-coverage {
    display: none;
  }

  .rm-panel {
    top: auto;
    left: 0;
    width: 100%;
    max-height: 82dvh;
    border-left: 0;
    border-top: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rm-node,
  .rm-toggle,
  .rm-rail-item button,
  .rm-stage-coverage-bar span,
  .rm-rail-coverage span {
    transition: none;
  }

  .rm-node:hover {
    transform: none;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- src/components/roadmap/roadmap-node.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/src/app/roadmap/roadmap.css src/aws-s3-web/src/components/roadmap/
git commit -m "$(cat <<'EOF'
feat(roadmap): add node card and route-scoped stylesheet

Styles live in a route stylesheet rather than globals.css, which is already
~3k lines and loads on every page.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Node detail panel

**Files:**
- Create: `src/aws-s3-web/src/components/roadmap/node-detail-panel.tsx`
- Create: `src/aws-s3-web/src/components/roadmap/node-detail-panel.test.tsx`

**Interfaces:**
- Consumes: `RoadmapNode` from `@/types/roadmap`; `MY_LEVEL_LABELS` from `@/lib/roadmap/experience`.
- Produces: `NodeDetailPanel({ node, showExperience, onClose }: NodeDetailPanelProps)` where `node: RoadmapNode | null` (renders nothing when `null`) and `onClose: () => void`. Consumed by Task 9.

- [ ] **Step 1: Write the failing test**

Create `src/aws-s3-web/src/components/roadmap/node-detail-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NodeDetailPanel } from "./node-detail-panel";
import type { RoadmapNode } from "@/types/roadmap";

const node: RoadmapNode = {
  id: "mcp",
  title: "MCP & tool integration",
  importance: "recommended",
  summary: "Wiring real infrastructure tools into agents.",
  why: "The highest-signal portfolio project available right now.",
  tools: ["MCP", "JSON-RPC"],
  resources: [{ label: "Model Context Protocol", url: "https://modelcontextprotocol.io/" }],
  myLevel: "working",
};

describe("NodeDetailPanel", () => {
  it("renders nothing when no node is selected", () => {
    const { container } = render(
      <NodeDetailPanel node={null} showExperience={false} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the node title, why, tools, and resources as a modal dialog", () => {
    render(<NodeDetailPanel node={node} showExperience={false} onClose={() => {}} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("MCP & tool integration")).toBeInTheDocument();
    expect(screen.getByText(node.why)).toBeInTheDocument();
    expect(screen.getByText("JSON-RPC")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Model Context Protocol" });
    expect(link).toHaveAttribute("href", "https://modelcontextprotocol.io/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("shows the experience level only when the overlay is on", () => {
    const { rerender } = render(
      <NodeDetailPanel node={node} showExperience={false} onClose={() => {}} />,
    );
    expect(screen.queryByText("Working knowledge")).not.toBeInTheDocument();

    rerender(<NodeDetailPanel node={node} showExperience onClose={() => {}} />);
    expect(screen.getByText("Working knowledge")).toBeInTheDocument();
  });

  it("closes on the close button", async () => {
    const onClose = vi.fn();
    render(<NodeDetailPanel node={node} showExperience={false} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<NodeDetailPanel node={node} showExperience={false} onClose={onClose} />);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("moves focus into the panel when it opens", () => {
    render(<NodeDetailPanel node={node} showExperience={false} onClose={() => {}} />);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/components/roadmap/node-detail-panel.test.tsx`
Expected: FAIL — cannot resolve `./node-detail-panel`.

- [ ] **Step 3: Write the component**

Create `src/aws-s3-web/src/components/roadmap/node-detail-panel.tsx`. The focus trap cycles Tab within the panel; focus *return* to the originating card is owned by the shell in Task 9, because only the shell knows which card was clicked.

```tsx
"use client";

import { useEffect, useRef } from "react";

import { MY_LEVEL_LABELS } from "@/lib/roadmap/experience";
import type { RoadmapNode } from "@/types/roadmap";

export type NodeDetailPanelProps = {
  node: RoadmapNode | null;
  showExperience: boolean;
  onClose: () => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NodeDetailPanel({ node, showExperience, onClose }: NodeDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!node) return;
    closeRef.current?.focus();
  }, [node]);

  useEffect(() => {
    if (!node) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const targets = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (targets.length === 0) return;

      const first = targets[0];
      const last = targets[targets.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [node, onClose]);

  if (!node) return null;

  return (
    <>
      <button
        type="button"
        className="rm-panel-backdrop"
        aria-label="Close details"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="rm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rm-panel-title"
      >
        <button ref={closeRef} type="button" className="rm-panel-close" onClick={onClose}>
          Close
        </button>

        <h2 id="rm-panel-title" className="rm-panel-title">
          {node.title}
        </h2>
        <p className="rm-panel-why">{node.why}</p>

        {showExperience ? (
          <p className="rm-node-level">{MY_LEVEL_LABELS[node.myLevel]}</p>
        ) : null}

        <div>
          <span className="rm-panel-label">Tools</span>
          <ul className="rm-panel-tools">
            {node.tools.map((tool) => (
              <li key={tool}>{tool}</li>
            ))}
          </ul>
        </div>

        <div>
          <span className="rm-panel-label">Resources</span>
          <ul className="rm-panel-resources">
            {node.resources.map((resource) => (
              <li key={resource.url}>
                <a href={resource.url} target="_blank" rel="noreferrer">
                  {resource.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- src/components/roadmap/node-detail-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/components/roadmap/node-detail-panel.tsx src/aws-s3-web/src/components/roadmap/node-detail-panel.test.tsx
git commit -m "$(cat <<'EOF'
feat(roadmap): add the node detail slide-over panel

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Stage rail

**Files:**
- Create: `src/aws-s3-web/src/components/roadmap/stage-rail.tsx`
- Create: `src/aws-s3-web/src/components/roadmap/stage-rail.test.tsx`

**Interfaces:**
- Consumes: `RoadmapStage` from `@/types/roadmap`; `stageCoverage` from `@/lib/roadmap/experience`.
- Produces: `StageRail({ stages, activeStageId, showExperience, onSelect }: StageRailProps)` where `onSelect: (stageId: string) => void`. Consumed by Task 9.

- [ ] **Step 1: Write the failing test**

Create `src/aws-s3-web/src/components/roadmap/stage-rail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StageRail } from "./stage-rail";
import { roadmapStages } from "@/data/roadmap";

describe("StageRail", () => {
  it("renders a navigation entry for every stage", () => {
    render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience={false}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByRole("navigation", { name: /roadmap stages/i })).toBeInTheDocument();
    roadmapStages.forEach((stage) => {
      expect(screen.getByRole("button", { name: new RegExp(stage.label) })).toBeInTheDocument();
    });
  });

  it("marks only the active stage with aria-current", () => {
    render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[2].id}
        showExperience={false}
        onSelect={() => {}}
      />,
    );

    const current = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-current") === "true");

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(roadmapStages[2].label);
  });

  it("reports the stage id when an entry is activated", async () => {
    const onSelect = vi.fn();
    render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience={false}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: new RegExp(roadmapStages[1].label) }));
    expect(onSelect).toHaveBeenCalledWith(roadmapStages[1].id);
  });

  it("shows coverage bars only when the overlay is on", () => {
    const { container, rerender } = render(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience={false}
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-rail-coverage")).toHaveLength(0);

    rerender(
      <StageRail
        stages={roadmapStages}
        activeStageId={roadmapStages[0].id}
        showExperience
        onSelect={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-rail-coverage")).toHaveLength(roadmapStages.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/components/roadmap/stage-rail.test.tsx`
Expected: FAIL — cannot resolve `./stage-rail`.

- [ ] **Step 3: Write the component**

Create `src/aws-s3-web/src/components/roadmap/stage-rail.tsx`:

```tsx
"use client";

import { stageCoverage } from "@/lib/roadmap/experience";
import type { RoadmapStage } from "@/types/roadmap";

export type StageRailProps = {
  stages: readonly RoadmapStage[];
  activeStageId: string;
  showExperience: boolean;
  onSelect: (stageId: string) => void;
};

export function StageRail({ stages, activeStageId, showExperience, onSelect }: StageRailProps) {
  return (
    <nav className="rm-rail" aria-label="Roadmap stages">
      <ul className="rm-rail-list">
        {stages.map((stage) => {
          const coverage = stageCoverage(stage);

          return (
            <li key={stage.id} className="rm-rail-item">
              <button
                type="button"
                aria-current={stage.id === activeStageId ? "true" : undefined}
                onClick={() => onSelect(stage.id)}
              >
                <span className="rm-rail-index">
                  {String(stage.index).padStart(2, "0")}
                </span>
                <span>
                  {stage.label}
                  {showExperience ? (
                    <span className="rm-rail-coverage">
                      <span style={{ width: `${coverage.percent}%` }} />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- src/components/roadmap/stage-rail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aws-s3-web/src/components/roadmap/stage-rail.tsx src/aws-s3-web/src/components/roadmap/stage-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(roadmap): add the sticky stage rail

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Track and stage sections

**Files:**
- Create: `src/aws-s3-web/src/components/roadmap/roadmap-stage.tsx`
- Create: `src/aws-s3-web/src/components/roadmap/roadmap-track.tsx`
- Create: `src/aws-s3-web/src/components/roadmap/roadmap-track.test.tsx`

**Interfaces:**
- Consumes: `RoadmapNodeCard` (Task 5), `stageCoverage` (Task 4), `roadmapStages`/types (Task 3).
- Produces:
  - `RoadmapStageSection({ stage, showExperience, onOpenNode }: RoadmapStageSectionProps)` — renders `<section id={stage.id}>`
  - `RoadmapTrack({ stages, showExperience, onOpenNode, onActiveStageChange }: RoadmapTrackProps)` where `onActiveStageChange: (stageId: string) => void`. Consumed by Task 9.

There is no separate `track-connector.tsx`: the spine is a single styled element (`.rm-spine`) inside the track, and per-stage markers are `.rm-stage-marker`. A dedicated component for two decorative divs would be indirection without benefit.

- [ ] **Step 1: Write the failing test**

Create `src/aws-s3-web/src/components/roadmap/roadmap-track.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RoadmapTrack } from "./roadmap-track";
import { roadmapStages } from "@/data/roadmap";

const allNodes = roadmapStages.flatMap((stage) => stage.nodes);

describe("RoadmapTrack", () => {
  it("renders every stage as a section with its own id", () => {
    const { container } = render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );

    roadmapStages.forEach((stage) => {
      expect(container.querySelector(`section#${stage.id}`)).not.toBeNull();
      expect(screen.getByRole("heading", { name: stage.label })).toBeInTheDocument();
      expect(screen.getByText(stage.outcome)).toBeInTheDocument();
    });
  });

  it("renders a card for every node in the roadmap", () => {
    render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );

    allNodes.forEach((node) => {
      expect(screen.getByText(node.title)).toBeInTheDocument();
    });
  });

  it("reports the node id when a card is activated", async () => {
    const onOpenNode = vi.fn();
    render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={onOpenNode}
        onActiveStageChange={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Kubernetes/ }));
    expect(onOpenNode).toHaveBeenCalledWith("kubernetes");
  });

  it("shows stage coverage only when the overlay is on", () => {
    const { container, rerender } = render(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience={false}
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-stage-coverage")).toHaveLength(0);

    rerender(
      <RoadmapTrack
        stages={roadmapStages}
        showExperience
        onOpenNode={() => {}}
        onActiveStageChange={() => {}}
      />,
    );
    expect(container.querySelectorAll(".rm-stage-coverage")).toHaveLength(roadmapStages.length);
  });

  it("renders without an IntersectionObserver available (jsdom)", () => {
    expect(typeof IntersectionObserver).toBe("undefined");
    expect(() =>
      render(
        <RoadmapTrack
          stages={roadmapStages}
          showExperience={false}
          onOpenNode={() => {}}
          onActiveStageChange={() => {}}
        />,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/components/roadmap/roadmap-track.test.tsx`
Expected: FAIL — cannot resolve `./roadmap-track`.

- [ ] **Step 3: Write the stage section**

Create `src/aws-s3-web/src/components/roadmap/roadmap-stage.tsx`:

```tsx
"use client";

import { RoadmapNodeCard } from "@/components/roadmap/roadmap-node";
import { stageCoverage } from "@/lib/roadmap/experience";
import type { RoadmapStage } from "@/types/roadmap";

export type RoadmapStageSectionProps = {
  stage: RoadmapStage;
  showExperience: boolean;
  onOpenNode: (nodeId: string) => void;
};

export function RoadmapStageSection({ stage, showExperience, onOpenNode }: RoadmapStageSectionProps) {
  const coverage = stageCoverage(stage);

  return (
    <section id={stage.id} className="rm-stage" data-accent={stage.accent}>
      <span className="rm-stage-marker" aria-hidden="true" />
      <span className="rm-stage-kicker">{stage.kicker}</span>
      <h2 className="rm-stage-title">{stage.label}</h2>
      <p className="rm-stage-outcome">{stage.outcome}</p>

      {showExperience ? (
        <p className="rm-stage-coverage">
          <span className="rm-stage-coverage-bar">
            <span style={{ width: `${coverage.percent}%` }} />
          </span>
          {coverage.practised}/{coverage.total} hands-on
        </p>
      ) : null}

      <div className="rm-nodes">
        {stage.nodes.map((node) => (
          <RoadmapNodeCard
            key={node.id}
            node={node}
            showExperience={showExperience}
            onOpen={onOpenNode}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write the track**

Create `src/aws-s3-web/src/components/roadmap/roadmap-track.tsx`. The `IntersectionObserver` guard and options mirror `src/hooks/use-active-section.ts`:

```tsx
"use client";

import { useEffect } from "react";

import { RoadmapStageSection } from "@/components/roadmap/roadmap-stage";
import type { RoadmapStage } from "@/types/roadmap";

export type RoadmapTrackProps = {
  stages: readonly RoadmapStage[];
  showExperience: boolean;
  onOpenNode: (nodeId: string) => void;
  onActiveStageChange: (stageId: string) => void;
};

export function RoadmapTrack({
  stages,
  showExperience,
  onOpenNode,
  onActiveStageChange,
}: RoadmapTrackProps) {
  useEffect(() => {
    // jsdom has no IntersectionObserver; the rail simply stays on its initial
    // stage in that environment. Same guard as use-active-section.ts.
    if (typeof IntersectionObserver === "undefined") return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestId: string | undefined;
        let bestRatio = 0;
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        if (bestId) onActiveStageChange(bestId);
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.2, 0.5, 0.8] },
    );

    stages.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [stages, onActiveStageChange]);

  return (
    <div className="rm-track">
      <span className="rm-spine" aria-hidden="true" />
      {stages.map((stage) => (
        <RoadmapStageSection
          key={stage.id}
          stage={stage}
          showExperience={showExperience}
          onOpenNode={onOpenNode}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- src/components/roadmap/roadmap-track.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/src/components/roadmap/roadmap-stage.tsx src/aws-s3-web/src/components/roadmap/roadmap-track.tsx src/aws-s3-web/src/components/roadmap/roadmap-track.test.tsx
git commit -m "$(cat <<'EOF'
feat(roadmap): add the stage track with spine and markers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Shell and route

**Files:**
- Create: `src/aws-s3-web/src/components/roadmap/roadmap-shell.tsx`
- Create: `src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx`
- Create: `src/aws-s3-web/src/app/roadmap/page.tsx`

**Interfaces:**
- Consumes: `StageRail` (Task 7), `RoadmapTrack` (Task 8), `NodeDetailPanel` (Task 6), `findNode` (Task 4), `roadmapStages` (Task 3), `ThemeToggle` from `@/components/theme-toggle`.
- Produces: `RoadmapShell()` (no props) and the `/roadmap` route. Consumed by Task 11's e2e spec.

- [ ] **Step 1: Write the failing test**

Create `src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RoadmapShell } from "./roadmap-shell";
import { roadmapStages } from "@/data/roadmap";

describe("RoadmapShell", () => {
  it("renders the page heading and every stage", () => {
    render(<RoadmapShell />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/DevOps Engineer Roadmap/i);
    roadmapStages.forEach((stage) => {
      expect(screen.getByRole("heading", { name: stage.label })).toBeInTheDocument();
    });
  });

  it("starts with the experience overlay off", () => {
    render(<RoadmapShell />);
    expect(screen.getByRole("button", { name: /my experience/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText("Production experience")).not.toBeInTheDocument();
  });

  it("reveals experience annotations when the overlay is toggled on", async () => {
    render(<RoadmapShell />);

    await userEvent.click(screen.getByRole("button", { name: /my experience/i }));

    expect(screen.getByRole("button", { name: /my experience/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByText("Production experience").length).toBeGreaterThan(0);
  });

  it("opens the detail panel for a node and returns focus to its card on close", async () => {
    render(<RoadmapShell />);

    const card = screen.getByRole("button", { name: /Kubernetes/ });
    await userEvent.click(card);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(card);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/components/roadmap/roadmap-shell.test.tsx`
Expected: FAIL — cannot resolve `./roadmap-shell`.

- [ ] **Step 3: Write the shell**

Create `src/aws-s3-web/src/components/roadmap/roadmap-shell.tsx`. The shell owns focus *return* because only it knows which card was clicked.

```tsx
"use client";

import { useCallback, useRef, useState } from "react";

import { NodeDetailPanel } from "@/components/roadmap/node-detail-panel";
import { RoadmapTrack } from "@/components/roadmap/roadmap-track";
import { StageRail } from "@/components/roadmap/stage-rail";
import { ThemeToggle } from "@/components/theme-toggle";
import { roadmapStages } from "@/data/roadmap";
import { findNode } from "@/lib/roadmap/experience";

export function RoadmapShell() {
  const [showExperience, setShowExperience] = useState(false);
  const [activeStageId, setActiveStageId] = useState(roadmapStages[0].id);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const openNode = useCallback((nodeId: string) => {
    // The click target is the card button; remember it so focus can return.
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
    setOpenNodeId(nodeId);
  }, []);

  const closeNode = useCallback(() => {
    setOpenNodeId(null);
    lastTriggerRef.current?.focus();
  }, []);

  const selectStage = useCallback((stageId: string) => {
    setActiveStageId(stageId);
    document.getElementById(stageId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="site-shell rm-page">
      <div className="grid-backdrop" aria-hidden="true" />
      <ThemeToggle />

      <main className="rm-inner">
        <header className="rm-header">
          <span className="rm-kicker">DEVOPS :: ROADMAP 2026</span>
          <h1 className="rm-title">DevOps Engineer Roadmap</h1>
          <p className="rm-lede">
            What actually matters in 2026: the fundamentals first, AI layered on top as a force
            multiplier — including an honest note on where it still fails.
          </p>

          <div className="rm-header-actions">
            <button
              type="button"
              className="rm-toggle"
              aria-pressed={showExperience}
              onClick={() => setShowExperience((value) => !value)}
            >
              <span className="rm-toggle-dot" aria-hidden="true" />
              Show my experience
            </button>
            <a className="rm-home-link" href="https://nghuy.link">
              ← nghuy.link
            </a>
          </div>
        </header>

        <div className="rm-body">
          <StageRail
            stages={roadmapStages}
            activeStageId={activeStageId}
            showExperience={showExperience}
            onSelect={selectStage}
          />
          <RoadmapTrack
            stages={roadmapStages}
            showExperience={showExperience}
            onOpenNode={openNode}
            onActiveStageChange={setActiveStageId}
          />
        </div>
      </main>

      <NodeDetailPanel
        node={openNodeId ? (findNode(roadmapStages, openNodeId) ?? null) : null}
        showExperience={showExperience}
        onClose={closeNode}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write the route**

Create `src/aws-s3-web/src/app/roadmap/page.tsx`. This is a server component so it can export `metadata`; the shell it renders is the client component.

```tsx
import type { Metadata } from "next";

import { RoadmapShell } from "@/components/roadmap/roadmap-shell";

import "./roadmap.css";

export const metadata: Metadata = {
  title: "DevOps Engineer Roadmap 2026",
  description:
    "A 2026 DevOps engineer roadmap: foundations, modern DevOps, the AI layer (AIOps, LLMOps, MCP), and senior platform impact.",
  alternates: {
    // The page is reachable at both nghuy.link/roadmap and the subdomain; the
    // subdomain is canonical.
    canonical: "https://roadmap.nghuy.link/",
  },
};

export default function RoadmapPage() {
  return <RoadmapShell />;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- src/components/roadmap/roadmap-shell.test.tsx`
Expected: PASS.

Then run the whole suite and the type check:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

Expected: all pass, no new warnings.

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/src/components/roadmap/roadmap-shell.tsx src/aws-s3-web/src/components/roadmap/roadmap-shell.test.tsx src/aws-s3-web/src/app/roadmap/page.tsx
git commit -m "$(cat <<'EOF'
feat(roadmap): add the roadmap shell and /roadmap route

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Link the portfolio to the roadmap

**Files:**
- Modify: `src/aws-s3-web/src/components/hero-section.tsx:104-107`
- Create: `src/aws-s3-web/src/components/hero-section.test.tsx` — **check first**: a `hero-section.test.tsx` already exists. Add the test below to it rather than creating a second file.

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Append this to the existing `src/aws-s3-web/src/components/hero-section.test.tsx`. That file uses top-level `it(...)` with no `describe`, and already imports `render`, `screen`, `expect`, and `it` — so no import changes are needed. Match its style:

```tsx
it("links to the roadmap subdomain in a new tab", () => {
  render(<HeroSection onNavigate={() => {}} reducedMotion />);

  const link = screen.getByRole("link", { name: /roadmap/i });
  expect(link).toHaveAttribute("href", "https://roadmap.nghuy.link");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noreferrer");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/components/hero-section.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "link" and name /roadmap/i`.

- [ ] **Step 3: Add the link chip**

In `src/aws-s3-web/src/components/hero-section.tsx`, replace the `module-row` block (currently lines 104-107) with:

```tsx
          <div className="module-row" aria-label="Loaded modules">
            <span>LOADED_MODULES:</span>
            {portfolio.heroModules.map((module) => <code key={module}>{module.toUpperCase()}</code>)}
            <a
              className="module-link"
              href="https://roadmap.nghuy.link"
              target="_blank"
              rel="noreferrer"
            >
              <code>ROADMAP 2026</code>
              <ExternalLink aria-hidden="true" size={11} />
            </a>
          </div>
```

`ExternalLink` is already imported at `hero-section.tsx:3`.

- [ ] **Step 4: Style the chip**

Append to `src/aws-s3-web/src/app/globals.css` immediately after the `.module-row code` rule at **line ~758** (the base rules block is lines 745–760; note there is a second `.module-row code` override at ~2416 and a media-query variant at ~1183 — do not put it there). This is the one small addition to `globals.css` — it belongs to the portfolio hero, not the roadmap page.

```css
.module-link {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  color: var(--accent);
  text-decoration: none;
}

.module-link:hover code {
  border-color: var(--accent);
  color: var(--accent-bright);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- src/components/hero-section.test.tsx`
Expected: PASS, including every pre-existing test in that file.

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/src/components/hero-section.tsx src/aws-s3-web/src/components/hero-section.test.tsx src/aws-s3-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(roadmap): link the portfolio hero to roadmap.nghuy.link

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: End-to-end spec and full verification

**Files:**
- Create: `src/aws-s3-web/e2e/roadmap.spec.ts`

**Interfaces:**
- Consumes: the `/roadmap` route from Task 9.
- Produces: nothing.

- [ ] **Step 1: Write the e2e spec**

Create `src/aws-s3-web/e2e/roadmap.spec.ts`, following the patterns in `e2e/portfolio.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("renders every stage and opens a node detail panel", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("DevOps Engineer Roadmap");

  for (const stage of ["Foundations", "Modern DevOps", "AI Layer", "Senior Impact"]) {
    await expect(page.getByRole("heading", { name: stage })).toBeVisible();
  }

  await page.getByRole("button", { name: /Kubernetes/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Kubernetes" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("reveals experience annotations when the overlay is toggled", async ({ page }) => {
  await page.goto("/roadmap");

  const toggle = page.getByRole("button", { name: /my experience/i });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Production experience").first()).toBeVisible();
});

test("navigates to a stage from the rail", async ({ page }) => {
  await page.goto("/roadmap");

  await page.getByRole("navigation", { name: /roadmap stages/i })
    .getByRole("button", { name: /AI Layer/ })
    .click();

  await expect(page.locator("#ai-layer")).toBeInViewport();
});

test("fits a mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/roadmap");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
```

- [ ] **Step 2: Run the e2e spec**

Run: `pnpm test:e2e -- roadmap.spec.ts`
Expected: 4 passed. Playwright starts the dev server itself via the `webServer` config.

- [ ] **Step 3: Run the full verification suite**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm test:e2e
pnpm build
```

Expected: everything passes.

- [ ] **Step 4: Confirm the static export emits the file CloudFront targets**

```bash
ls -la out/roadmap.html
```

Expected: the file exists. **This is the single most important check in the plan** — if `out/roadmap.html` is missing, the CloudFront function from Task 1 rewrites to a 404 and the subdomain serves the error document.

- [ ] **Step 5: Manual check in the browser**

Run `pnpm dev` and open `http://localhost:3000/roadmap`. Verify:
- Light and dark themes both read correctly (use the theme toggle).
- The three breakpoints behave: ≥1100px (multi-column nodes, sticky left rail), 900–1100px (single-column nodes), <900px (horizontal chip rail, bottom-sheet panel).
- With reduced motion forced (DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`), nothing animates and everything stays legible.
- Keyboard only: Tab reaches every node card, Enter opens the panel, Tab cycles inside it, Escape closes it and returns focus to the card you opened.

- [ ] **Step 6: Commit and open the PR**

```bash
git add src/aws-s3-web/e2e/roadmap.spec.ts
git commit -m "$(cat <<'EOF'
test(roadmap): add end-to-end coverage for the roadmap page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/roadmap-subdomain
```

Then open the PR. In the description, call out for the reviewer:
- The Terraform plan **replaces the ACM certificate** (`create_before_destroy` keeps the apex served) and takes ~5–15 min of distribution propagation.
- `roadmap.nghuy.link` will not resolve until `terraform-apply.yml` completes on merge.
- Check the `terraform-plan.yml` output on the PR for any destroy on `aws_route53_record.a`/`aaaa` or either S3 bucket — there should be none.

---

## Plan Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| Part 1 — locals, ACM SAN, cert validation `for_each`, aliases, Route53 records | Task 2 |
| Part 1 — host-aware rewrite function | Task 1 |
| Part 2 — route, metadata, canonical URL | Task 9 |
| Part 2 — file layout | Tasks 3–9 |
| Part 2 — route-scoped stylesheet, not `globals.css` | Task 5 |
| Part 2 — visual design, responsive, a11y | Task 5 (CSS), Tasks 6–9 (markup), Task 11 (manual + e2e) |
| Part 2 — data model | Task 3 |
| Part 2 — experience overlay + drift guard | Tasks 3 (drift test), 4 (helpers), 5/7/8/9 (UI) |
| Part 2 — roadmap content, 4 stages / 23 nodes | Task 3 |
| Part 2 — portfolio hero link | Task 10 |
| Part 3 — data integrity tests | Task 3 |
| Part 3 — pure logic tests | Task 4 |
| Part 3 — component tests | Tasks 5, 6, 7, 8, 9 |
| Part 3 — `cloudfront-rewrite` test suite | Task 1 |
| Part 3 — e2e spec | Task 11 |
| Part 3 — local verification order | Task 11 |

Two intentional departures from the spec, both flagged in place rather than silently applied:

1. **No `track-connector.tsx`.** The spec's file layout lists it, but the spine reduced to two decorative elements (`.rm-spine`, `.rm-stage-marker`) once the node grid replaced alternating branches at the CSS level. A component wrapping two divs would be indirection without benefit. Noted in Task 8.
2. **CSS transitions instead of the `motion` package.** Rationale and the offer to reverse it are in Global Constraints; only Task 8 would change.

**Type consistency:** `RoadmapNode`/`RoadmapStage`/`MyLevel`/`NodeImportance`/`StageAccent`/`RoadmapResource` are defined once in Task 3 and imported unchanged thereafter. `stageCoverage`, `findNode`, `MY_LEVEL_LABELS`, `IMPORTANCE_LABELS` are defined in Task 4 and used with identical signatures in Tasks 5, 7, 8, 9. Component prop types (`RoadmapNodeCardProps`, `NodeDetailPanelProps`, `StageRailProps`, `RoadmapStageSectionProps`, `RoadmapTrackProps`) are each declared in their own task and consumed with matching shapes. `onOpen`/`onOpenNode` both carry `(nodeId: string) => void`; the rename at the track boundary is deliberate and consistent.

**Placeholder scan:** no TBD, TODO, "similar to Task N", or "add error handling" instructions. Every code step contains the actual code.
