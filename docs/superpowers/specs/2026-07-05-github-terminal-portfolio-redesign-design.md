# GitHub-Themed Terminal Portfolio Redesign (abdulmomin.dev clone)

**Date:** 2026-07-05
**Status:** Approved design — ready for implementation plan
**Supersedes:** `2026-07-05-terminal-portfolio-redesign-design.md` (dark-only terminal redesign). This design re-does the same three files to closely mirror the structure of the reference site.

## Goal

Re-implement the portfolio at `src/aws-s3-web/` as a close structural clone of **https://www.abdulmomin.dev/**, adapted to Nguyen Gia Huy's information, with a **GitHub light/dark color theme** and a light/dark toggle. The certifications section is removed.

## Reference Site Structure (to mirror)

Section order and exact headings, all preserved:

1. Hero / intro (system-kernel badge, greeting, tagline, CTA buttons, code-snippet card)
2. `# About.system`
3. `# Skills.json` ("Drag to explore skills universe")
4. `$ git log --stat --oneline`
5. `$ ls -la ~/projects`
6. `$ ls -la ~/blogs`
7. `$ ./contact.exe`

Plus: a **right-side vertical navigation bar** and the **same iconography** (GitHub, LinkedIn, email SVG icons; tech brand logos in the skills universe).

## Architecture

Full rewrite of the three files already on branch `feature/terminal-portfolio-redesign`, in place. No build step, no frameworks, **no external network requests** (must pass a strict CSP): all icons/logos are inline SVG; the only remote asset is the Google Fonts stylesheet for JetBrains Mono (fallback `monospace`).

- `src/aws-s3-web/index.html` — rewritten markup for the seven sections + top bar + right nav + theme-toggle button.
- `src/aws-s3-web/assets/css/terminal.css` — rewritten around GitHub light + dark design tokens.
- `src/aws-s3-web/assets/js/terminal.js` — theme toggle, scroll-spy right nav, skills-universe physics, typing/reveal effects.

Reused image: `assets/img/profile-img-main.jpg` (avatar). Favicons unchanged.

Fonts: **JetBrains Mono** for terminal/heading/prompt/code elements; system sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) for body paragraphs — matching the reference "monospace-dominant + sans body" feel.

## Color Theme — GitHub light/dark + toggle

Two token sets exposed as CSS custom properties on `:root`.

**Dark (GitHub dark default):**
- `--bg: #0d1117`, `--bg-subtle: #161b22`, `--bg-elev: #1c2128`
- `--border: #30363d`
- `--text: #c9d1d9`, `--text-bright: #e6edf3`, `--text-dim: #8b949e`
- `--link: #58a6ff`, `--green: #3fb950`, `--amber: #d29922`, `--red: #f85149`, `--purple: #bc8cff`

**Light (GitHub light):**
- `--bg: #ffffff`, `--bg-subtle: #f6f8fa`, `--bg-elev: #eaeef2`
- `--border: #d0d7de`
- `--text: #1f2328`, `--text-bright: #010409`, `--text-dim: #59636e`
- `--link: #0969da`, `--green: #1a7f37`, `--amber: #9a6700`, `--red: #cf222e`, `--purple: #8250df`

**Application rules:**
- Default token set follows `@media (prefers-color-scheme: light|dark)`.
- The toggle stamps `data-theme="light"` or `data-theme="dark"` on `<html>`; `:root[data-theme="…"]` overrides win in both directions.
- Preference persisted in `localStorage` (`theme` key).
- A tiny **inline script in `<head>`** reads `localStorage`/system preference and sets `data-theme` **before first paint** to prevent a flash of wrong theme.
- Toggle button: inline sun/moon SVG, in the top bar. Works without JS via `prefers-color-scheme` (button simply inert).

## Sections

### 1. Hero / intro
- Small badge line: `SYSTEM.KERNEL :: v1.0.0 ONLINE` (green dot + monospace).
- Greeting `Hello, I'm` + `Nguyen Gia Huy` (large).
- Rotating typed role (`DevOps Engineer` / `Cloud Engineer` / `Automation Engineer`) with blinking cursor.
- Tagline: `Automating Infrastructure Beyond Boundaries`.
- Two CTA buttons: **`> Initialize OS`** (smooth-scrolls to `#about`) and **`> Check out GitHub`** (links to https://github.com/HuyNguyen260398).
- Social icons row: GitHub, LinkedIn, email (inline SVG).
- **Code-snippet card**: a syntax-highlighted **Terraform/HCL** block (window chrome with red/amber/green dots + filename `about-me.tf`) describing him, e.g. a `resource "devops_engineer" "huy"` block with `name`, `location`, `experience`, `focus`, `stack` attributes. Static highlighting via spans (no JS highlighter).

### 2. `# About.system`
- Two-column: avatar (`profile-img-main.jpg`) + info block.
- Key/value fields styled like a system readout:
  - `Operator: Nguyen Gia Huy`
  - `Role: DevOps Engineer`
  - `Location: Ho Chi Minh City, Viet Nam`
  - `Status: ● Online — open to opportunities`
- Short terminal-prompt bio paragraph (adapted from existing bio: 5 years DevOps, CI/CD, cloud on AWS & Azure, focus on AI-enhanced automation).
- `wget resume.pdf` button → `https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf`.

### 3. `# Skills.json` — Drag to explore skills universe
- **Interactive draggable badge universe** (the 1:1-cloned centerpiece).
- Implementation: **DOM badges positioned absolutely inside a bounded stage**, animated with a lightweight `requestAnimationFrame` physics loop (gentle drift velocity, wall bounce inside the stage, soft mutual repulsion so they don't fully overlap). **Pointer drag** grabs a badge (grab/grabbing cursor), and releasing imparts velocity (fling). `touch-action: none` for mobile drag.
- Each badge: a rounded pill/circle with an **inline SVG brand logo in brand color** + label. Badges:
  AWS, Azure, Docker, Kubernetes, Terraform, Ansible, Python, Linux, Jenkins, Git.
- Caption: `< drag to explore the skills universe >`.
- **Accessible / no-JS / reduced-motion fallback**: a `skills.json`-styled static block listing the same skills with proficiency (JSON syntax highlighting), always present in the DOM. Under `no-js` or `prefers-reduced-motion`, the physics stage is hidden and the badges render as a static wrapped grid; the JSON block remains readable. Skill levels reused from prior plan: AWS 90, Terraform 75, Azure 60, Ansible 80, Python 90, Docker 80, Linux 75, Kubernetes 70 (Jenkins 80, Git 85 added).

### 4. `$ git log --stat --oneline`
- The 11 experience + education entries rendered as a git commit log.
- Each entry: `<hash> <(refs)> <date>` line (amber hash, blue/purple refs, dim date), role title, org (italic dim), bullet points, and a `--stat`-style footer line (e.g. `3 files changed, 240 insertions(+)`) to echo `--stat`. Vertical timeline line with commit-dot nodes on the left.
- Content carried verbatim from the existing implementation (Bosch roles, AWS CloudOps Agent, MCP Server, CI/CD in K8s, ActiveSafety, Splunk, PowerTrain, KPI Dashboard, Automation Tool Developer, Python Intern, and the education entry). Fix the missing-space typos already noted.

### 5. `$ ls -la ~/projects`
- The **real pinned GitHub repos**, rendered **live** from a build-time-generated data file (see "Projects Data Pipeline" below), as GitHub-style repo cards, each with:
  - repo icon (▣) + repo-name link (opens the real GitHub URL)
  - real description
  - **real ★ star count and fork count** (inline star/fork SVG icons), shown even when 0
  - primary-language dot + language tags
- On load, `terminal.js` fetches `assets/data/pinned-repos.json` (same-origin) and renders the cards from it. If the fetch fails or JS/network is unavailable, the **static fallback cards baked into the HTML** (the current pins, below) remain visible — progressive enhancement, never an empty section.
- Current pinned data (fetched 2026-07-05, used as the committed fallback + initial `pinned-repos.json`):
  1. `devops-engineer-profile` — "devops-engineer-profile" — ★1 ⑂0 — HCL, HTML, Python, PowerShell, Vue, CSS
  2. `aws-cloudops-agent` — "A beginner-friendly AWS operations agent built with AWS Strands Agent SDK and Amazon Bedrock Claude 4 Sonnet." — ★0 ⑂0 — Python
  3. `aws_resume_web_inf` — "Cloudformation templates for aws resume web" — ★0 ⑂0 — Python, PowerShell, Shell
  4. `aws_resume_web_src` — "Source code of asw resume web" — ★0 ⑂0 — HTML, CSS, JavaScript, PHP
  5. `aws-serverless-webapp` — "A simple web app built on AWS Serverless Architecture" — ★0 ⑂0 — TypeScript, HCL, JavaScript, CSS

### 6. `$ ls -la ~/blogs`
- **"No pinned blogs yet."** empty-state placeholder, mirroring the reference site exactly. Styled as a terminal directory listing showing an empty result (dim comment line).

### 7. `$ ./contact.exe`
- Two-column: a **JSON-styled contact block** + a terminal contact form.
- JSON block fields: `email: "huynguyen2603989@gmail.com"`, `github: "@HuyNguyen260398"`, `linkedin: "huy-nguyen-966488189"`, `location: "Ho Chi Minh City, VN"`, `status: "available"`. JSON syntax highlighting via spans.
- Form: Name, Email, Subject, Message; keeps `action="forms/contact.php" method="post"` unchanged. Submit button `./send-message.sh`.
- Social icons row (GitHub, LinkedIn, email).

**Certifications section: removed entirely.**

## Right-Side Navigation

- Fixed vertical nav on the **right edge**, vertically centered.
- One entry per section: Home, About, Skills, Experience, Projects, Blogs, Contact.
- Each entry is a small dot; a text label reveals on hover (slides in from the right). The dot of the section currently in view is highlighted (larger / accent color).
- **Scroll-spy** via `IntersectionObserver` (fallback: scroll handler) sets the active dot.
- Clicking a dot smooth-scrolls to that section.
- Hidden below ~900px width; on small screens the existing top-bar hamburger menu is the navigation.

## Top Bar

- Slim fixed top bar: `<Dev/>`-style brand mark on the left; theme-toggle button + social icons on the right; hamburger for mobile menu. (Kept minimal — the right-side nav is the primary in-page navigation on desktop.)

## Projects Data Pipeline (live pinned repos)

Keeps the Projects section in sync with GitHub pinned repos **at build/deploy time**, without embedding any token in the static site and without any third-party runtime dependency.

**Data file:** `src/aws-s3-web/assets/data/pinned-repos.json` — a stable, versioned schema the front-end consumes:
```json
{
  "generated_at": "2026-07-05T00:00:00Z",
  "username": "HuyNguyen260398",
  "repos": [
    { "name": "...", "description": "...", "url": "...",
      "stars": 1, "forks": 0,
      "primaryLanguage": "HCL", "languages": ["HCL", "HTML", "..."] }
  ]
}
```
An initial version (the 5 current pins) is committed so the site works before the first CI refresh and so local `http.server` testing exercises the fetch path.

**Generator script:** `ops/fetch_pinned_repos.py`
- Reads `GITHUB_TOKEN` (required) and optional `GITHUB_USERNAME` (default `HuyNguyen260398`) from env.
- POSTs the `pinnedItems(first: 6, types: REPOSITORY)` GraphQL query to `https://api.github.com/graphql` using `requests` (already a workflow dependency).
- Shapes the response into the schema above and writes `src/aws-s3-web/assets/data/pinned-repos.json`.
- **Fail-safe:** on any error (network, auth, empty result) it logs and exits **non-zero without overwriting** the existing file, so the committed fallback survives. The workflow step runs with `continue-on-error: true` so a GitHub API hiccup never blocks a deploy.
- Uses the default `GITHUB_TOKEN` (pinned items are public GraphQL data). Contingency noted in the plan: if the default token returns empty, swap to a read-only PAT stored as the `PINNED_REPOS_TOKEN` secret.

**Workflow integration** (both `aws-s3-web-sync-staging.yml` and `aws-s3-web-sync-prod.yml`):
- Add a `Refresh pinned repos data` step **before** the `aws s3 sync` step:
  ```yaml
  - name: Refresh pinned repos data
    continue-on-error: true
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    run: python ops/fetch_pinned_repos.py
  ```
  (Python + `requests` are already set up in these jobs.)
- Add `contents: read` alongside the existing `id-token: write` permission (default token read scope is sufficient for public GraphQL).
- **Prod** (`aws-s3-web-sync-prod.yml`) additionally gets a `schedule:` trigger (daily cron, e.g. `0 18 * * *`) so pins refresh and re-sync even with no code push. `workflow_dispatch` already exists there.
- The regenerated JSON is picked up by the existing `aws s3 sync` (no extra upload logic). No commit-back to the repo is needed; S3 always holds the freshest copy. Freshness bound: browser/CloudFront cache is `max-age=3600`, so changes appear within ~1h of a deploy/scheduled run.

## Accessibility / Robustness

- `prefers-reduced-motion: reduce` skips: hero typing, boot/kernel animation, reveal transitions, and the skills physics loop (badges shown as a static grid; JSON skills block always readable).
- With JS disabled (`no-js` class pattern): all content visible, loader hidden, reveals visible, skills physics hidden but JSON block + static badge grid shown, theme still driven by `prefers-color-scheme`.
- All interactive controls keyboard-focusable with visible focus rings; right-nav dots have `aria-label`s; skills stage has an `aria-label` and the JSON block is the accessible representation.
- Contact form and CV URL behavior unchanged.

## Testing / Verification

Serve locally: `python3 -m http.server 8080` from `src/aws-s3-web/` (background; kill when done). Verify:
1. All seven sections render in order with correct headings.
2. Theme toggle flips both palettes, persists across reload, and shows **no flash** on load (inline head script).
3. `prefers-color-scheme` drives theme with JS disabled.
4. Right-side nav highlights the active section on scroll and scroll-jumps on click; hidden on mobile.
5. Skills badges drift, are draggable, and fling on release; reduced-motion shows a static grid.
6. Projects render from `assets/data/pinned-repos.json` with real ★/fork counts; deleting/renaming the JSON falls back to the static HTML cards (no empty section). `python ops/fetch_pinned_repos.py` (with a token) regenerates the JSON with current pins.
7. Blogs shows the empty placeholder.
8. Contact form still posts to `forms/contact.php`.
9. `prefers-reduced-motion` and `no-js` fallbacks behave as specified.

## Files Touched

- `src/aws-s3-web/index.html`, `assets/css/terminal.css`, `assets/js/terminal.js` — rewritten (portfolio redesign).
- `src/aws-s3-web/assets/data/pinned-repos.json` — new (initial committed pins + CI-refreshed).
- `ops/fetch_pinned_repos.py` — new (GraphQL generator).
- `.github/workflows/aws-s3-web-sync-staging.yml`, `aws-s3-web-sync-prod.yml` — add the refresh step + permission; prod also gets the daily `schedule`.

## Out of Scope

- No changes to `inf/`, `gitops/`, or other `.github/` workflows.
- Old template files (`index_bk.html`, `index_2.html`, `main.css`, `main.js`, etc.) left in place; cleanup out of scope.
- No backend/contact-form logic changes.
