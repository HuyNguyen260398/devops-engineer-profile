# Migrate `src/aws-s3-web/` to the Next.js Terminal Portfolio Clone — Design Spec

**Date:** 2026-07-07
**Status:** Approved for planning
**Scope:** `src/aws-s3-web/`, `ops/fetch_pinned_repos.py`, `.github/workflows/aws-s3-web-sync-*.yml`, repo-root `.gitignore`

## Goal

Replace the current hand-rolled vanilla HTML/CSS/JS terminal site under
`src/aws-s3-web/` with the source from `/Users/huyng/ws/terminal-portfolio-clone/`
(an existing Next.js recreation with the same terminal aesthetic, an
interactive React Three Fiber skills globe, and a typed content model), adapted
to build and deploy as a static export on the current S3 + GitHub Actions
architecture. All real content from the current `index.html` carries over;
the Next.js project's placeholder content is fully replaced.

## Constraints

- Static hosting on S3; deploy must still be driven by
  `aws-s3-web-sync-staging.yml` / `aws-s3-web-sync-prod.yml`, triggered on
  changes under `src/aws-s3-web/**`.
- The site is a static export (`output: "export"` in `next.config.ts`, already
  set in the source project) — no server runtime, no API routes.
- No secrets or personal data beyond what's already public on the live site
  and in the current `index.html`.

## Directory Reset

Delete everything under `src/aws-s3-web/` **except** `index.html`, which is
kept as a content-reference backup only — it is not linked from anywhere and
is not part of the Next.js build (a stray root-level `index.html` doesn't
interfere with `next build`/`next dev`, which operate on `src/app/`).

Removed: `node_modules/`, `forms/`, `assets/` (old vendor CSS/JS/Bootstrap/
AOS/etc.), `index_bk.html`, `index_2.html`, `portfolio-details.html`,
`service-details.html`, `starter-page.html`, `Readme.txt`, `README.md`.

Two real image assets are extracted before deletion and reinstated into the
new project's `public/`: `assets/img/profile-img-main.jpg` and
`assets/img/favicon-main.png` (+ `apple-touch-icon-main.png`).

## Source Copy

Copy the Next.js project from `terminal-portfolio-clone/` into
`src/aws-s3-web/`: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`,
`playwright.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `src/`,
`public/`, `e2e/`. Excluded from the copy: `node_modules/`, `.next/`, `out/`,
`test-results/`, `playwright-report/`, `coverage/`, `tsconfig.tsbuildinfo`,
`.claude/`, its own `CLAUDE.md`/`AGENTS.md`/`README.md` (this repo's root
`CLAUDE.md` already documents `src/aws-s3-web/` as a directory).

`next.config.ts` already has `output: "export"` and `images.unoptimized: true`
— no changes needed there.

Add missing ignore patterns to the repo-root `.gitignore` (today only
`node_modules/` is covered): `.next/`, `out/`, `test-results/`,
`playwright-report/`, `coverage/`, `*.tsbuildinfo`.

## CI Adaptation

Both `aws-s3-web-sync-staging.yml` and `aws-s3-web-sync-prod.yml` currently run
`aws s3 sync src/aws-s3-web/ s3://bucket/` directly against the source tree.
Update both workflows to:

1. Set up Node.js + pnpm.
2. `pnpm install --frozen-lockfile` (working directory `src/aws-s3-web/`).
3. Run `ops/fetch_pinned_repos.py` (existing step, unchanged trigger point) so
   `public/data/pinned-repos.json` is fresh before the build.
4. `pnpm build` (working directory `src/aws-s3-web/`), producing
   `src/aws-s3-web/out/`.
5. Sync `src/aws-s3-web/out/` → S3 (instead of the raw `src/aws-s3-web/`
   directory).

The backup `index.html` and the Next.js source tree are never synced to S3
under this change, since only `out/` is published.

## Content Migration into `src/data/portfolio.ts`

Mapped directly from the current `index.html`:

- **identity**: name "Nguyen Gia Huy", `role`/`roles: ["DevOps Engineer"]`
  (single static role — no invented rotation), tagline "Automating
  Infrastructure Beyond Boundaries", location "Ho Chi Minh City, VN", status
  "AVAILABLE", email `huynguyen2603989@gmail.com`, `summary` = the "whoami"
  paragraph, and a `profile.mission` = the "cat mission.txt" paragraph.
- **profile.metrics**: EXPERIENCE "5+" / "YRS", PROJECTS "10+" / "SHIPPED",
  CAFFEINE "∞" / "ml".
- **skills**: AWS (#FF9900), Azure (#0078D4), Docker (#2496ED), Kubernetes
  (#326CE5), Terraform (#7B42BC), Ansible (#EE0000), Python (#3776AB), Linux
  (#FCC624), Jenkins (#D24939), Git (#F05032). Azure and Git are not in the
  current `iconMap` in `src/components/skills/skill-node.tsx`; add
  `SiMicrosoftazure` and `SiGit` from `react-icons/si` (same library already
  used for the other brand icons) under icon keys `azure` and `git`.
- **experience**: all 11 entries from the current git-log section — the 7
  Bosch role/project entries, KPI Dashboard, Automation Tool Developer, Python
  Intern, and the University of Greenwich education entry — parsing each
  "N files changed, M insertions(+)" line into `stats.files` /
  `stats.insertions` (`stats.deletions` set to 0, since the source has none).
- **projects**: left as static seed/fallback data mirroring today's 5 repos;
  actual rendering comes from the live fetch below.
- **blogs**: `[]` (matches current reality — no pinned posts yet). Add an
  empty-state branch to `blogs-section.tsx` (which currently renders a blank
  `.blog-grid` for an empty array) reproducing the old
  `ls -la ~/blogs` / `total 0` / `# No pinned blogs yet.` terminal message.
- **socials**: GitHub (`@HuyNguyen260398`), LinkedIn
  (`huy-nguyen-966488189`). Resume link keeps pointing at the existing
  CloudFront PDF URL (external — no local asset needed).

## Dynamic Pinned Repos

- Move `assets/data/pinned-repos.json` → `src/aws-s3-web/public/data/pinned-repos.json`;
  update `OUT_PATH` in `ops/fetch_pinned_repos.py` to match.
- Add a client-side fetch in `projects-section.tsx` that loads
  `/data/pinned-repos.json` at runtime (same progressive-enhancement pattern
  as the old `terminal.js`) and renders those repos as the project cards,
  falling back to the static seed data in `portfolio.ts` if the fetch fails.

## Real Images

- Replace the `public/avatar-placeholder.svg` reference in `about-section.tsx`
  with the real photo (`profile-img-main.jpg`).
- Replace the placeholder favicon / apple-touch-icon in the app metadata
  (`src/app/layout.tsx`) with the real ones.

## Contact Form

Keep the template's existing front-end-only simulated submission (validates,
shows a success state, delivers nothing). The old form posted to
`forms/contact.php`, which cannot run on S3 static hosting and was already
non-functional in production — no regression, and no new backend
infrastructure is introduced in this pass.

## Testing / Verification

- `pnpm install` and `pnpm build` succeed, producing `out/` with the real
  content.
- `pnpm typecheck` passes.
- Existing unit tests (`*.test.tsx`) that assert placeholder strings (e.g.
  "Sample Developer") are updated to match the real content instead of being
  deleted or left failing.
- Serve `out/` locally (e.g. `npx serve out`) and compare against the current
  live site for content parity: identity, skills, experience, projects,
  contact info, resume link.

## Out of Scope

- Wiring a real contact-form backend (API Gateway/Lambda, third-party form
  service) — explicitly deferred; front-end-only simulation is intentional.
- Adding new blog content — the empty state is intentional and matches
  today's site.
- Any change to the underlying S3 bucket, CloudFront, or IAM/OIDC
  configuration — deploy target and auth remain unchanged, only what gets
  built and synced changes.
