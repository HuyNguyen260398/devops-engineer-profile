# Next.js Terminal Portfolio Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/aws-s3-web/` (currently a hand-rolled static HTML/CSS/JS site) with the Next.js source from `/Users/huyng/ws/terminal-portfolio-clone/`, populated with the real content from the current site, and adapt the S3 deploy pipeline to build the Next.js static export before syncing.

**Architecture:** The Next.js project (`output: "export"`, already configured) becomes the sole source of truth under `src/aws-s3-web/`. `pnpm build` produces `src/aws-s3-web/out/`, which is what gets synced to S3 — the Next.js source itself, and the old `index.html` kept as a backup reference, are never deployed.

**Tech Stack:** Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind CSS 4, React Three Fiber / Three.js (skills globe), Vitest + Testing Library (unit), Playwright (e2e), pnpm.

## Global Constraints

- Static hosting on S3 only — no server runtime, no API routes, no PHP.
- `aws-s3-web-sync-staging.yml` / `aws-s3-web-sync-prod.yml` must keep triggering on `src/aws-s3-web/**` and deploying successfully.
- No real backend for the contact form (front-end-only simulation, per approved spec).
- No new blog content (empty state, matches current site).
- Source repo for the copy: `/Users/huyng/ws/terminal-portfolio-clone/` (sibling directory on this machine, not itself part of this repo).
- Spec reference: `docs/superpowers/specs/2026-07-07-nextjs-terminal-portfolio-migration-design.md`

---

### Task 1: Reset `src/aws-s3-web/` and copy in the Next.js project

**Files:**
- Delete: everything under `src/aws-s3-web/` except `index.html`
- Create: `src/aws-s3-web/{package.json,pnpm-lock.yaml,pnpm-workspace.yaml,next.config.ts,tsconfig.json,eslint.config.mjs,postcss.config.mjs,playwright.config.ts,vitest.config.ts,vitest.setup.ts,src/**,public/**,e2e/**}` (copied from `terminal-portfolio-clone/`)
- Modify: repo-root `.gitignore`

**Interfaces:**
- Produces: a working `src/aws-s3-web/` Next.js project (placeholder content still in place — content gets replaced in Task 2 onward), buildable with `pnpm build`.

- [ ] **Step 1: Preserve the real image assets that must survive the reset**

```bash
mkdir -p /tmp/aws-s3-web-real-assets
cp src/aws-s3-web/assets/img/profile-img-main.jpg /tmp/aws-s3-web-real-assets/
cp src/aws-s3-web/assets/img/favicon-main.png /tmp/aws-s3-web-real-assets/
cp src/aws-s3-web/assets/img/apple-touch-icon-main.png /tmp/aws-s3-web-real-assets/
ls /tmp/aws-s3-web-real-assets/
```

Expected: the three files listed.

- [ ] **Step 2: Delete everything under `src/aws-s3-web/` except `index.html`**

```bash
find src/aws-s3-web -mindepth 1 -maxdepth 1 ! -name 'index.html' -exec rm -rf {} +
ls -la src/aws-s3-web/
```

Expected: only `index.html` remains.

- [ ] **Step 3: Copy the Next.js project source in, excluding its build artifacts and its own git/docs metadata**

```bash
rsync -a \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'out/' \
  --exclude 'test-results/' \
  --exclude 'playwright-report/' \
  --exclude 'coverage/' \
  --exclude 'tsconfig.tsbuildinfo' \
  --exclude '.claude/' \
  --exclude '.git/' \
  --exclude 'CLAUDE.md' \
  --exclude 'AGENTS.md' \
  --exclude 'README.md' \
  /Users/huyng/ws/terminal-portfolio-clone/ src/aws-s3-web/

ls src/aws-s3-web/
```

Expected output includes: `index.html`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `src`, `public`, `e2e`, `docs` (the clone's own `docs/` — see Step 4).

- [ ] **Step 4: Drop the clone's own `docs/` folder (unrelated planning notes, not portfolio content)**

```bash
rm -rf src/aws-s3-web/docs
```

- [ ] **Step 5: Add the Next.js build-artifact patterns to the repo-root `.gitignore`**

Open `.gitignore` and append this section at the end (it currently only ignores `node_modules/` under a generic "Node.js" heading):

```gitignore

# Next.js build artifacts (src/aws-s3-web/)
.next/
out/
test-results/
playwright-report/
coverage/
*.tsbuildinfo
```

- [ ] **Step 6: Install dependencies and verify the copied project builds as-is**

```bash
cd src/aws-s3-web
pnpm install
pnpm build
cd -
```

Expected: build succeeds, ending with output confirming a static export (`Exporting (3/3)` or similar) and `src/aws-s3-web/out/index.html` exists.

```bash
ls src/aws-s3-web/out/index.html
```

Expected: file exists (still has placeholder "Sample Developer" content at this point — that's expected, fixed in later tasks).

- [ ] **Step 7: Commit**

```bash
git add -A src/aws-s3-web .gitignore
git commit -m "$(cat <<'EOF'
chore(web): replace static site with Next.js terminal-clone source

Resets src/aws-s3-web/ to the Next.js project from terminal-portfolio-clone,
keeping the old index.html as a content-reference backup only. Content is
still placeholder at this point; migrated in the following tasks.
EOF
)"
```

---

### Task 2: Migrate real content into `src/data/portfolio.ts`

**Files:**
- Modify: `src/aws-s3-web/src/data/portfolio.ts` (full rewrite of the `portfolio` object)

**Interfaces:**
- Consumes: `PortfolioContent` type from `src/aws-s3-web/src/types/portfolio.ts` (unchanged).
- Produces: `portfolio.identity`, `portfolio.profile`, `portfolio.skills`, `portfolio.experience`, `portfolio.projects`, `portfolio.blogs`, `portfolio.socials`, `portfolio.assistant`, `portfolio.heroModules`, `portfolio.navigation` — consumed by every section component (Tasks 3–8 reference these).

- [ ] **Step 1: Replace the file contents**

Replace `src/aws-s3-web/src/data/portfolio.ts` in full with:

```typescript
import type { PortfolioContent } from "@/types/portfolio";

export const portfolio = {
  navigation: [
    { id: "hero", label: "Home", fileLabel: "main.ts" },
    { id: "about", label: "About", fileLabel: "about.md" },
    { id: "skills", label: "Skills", fileLabel: "skills.json" },
    { id: "experience", label: "Experience", fileLabel: "experience.git" },
    { id: "projects", label: "Projects", fileLabel: "projects/" },
    { id: "blogs", label: "Blogs", fileLabel: "blogs/" },
    { id: "contact", label: "Contact", fileLabel: "contact.exe" },
  ],
  identity: {
    name: "Nguyen Gia Huy",
    role: "DevOps Engineer",
    roles: ["DevOps Engineer"],
    eyebrow: "SYSTEM.KERNEL :: v1.0.0 ONLINE",
    tagline: "Automating Infrastructure Beyond Boundaries",
    summary:
      "Automating infrastructure, CI/CD, and cloud delivery across AWS and Azure.",
    location: "Ho Chi Minh City, VN",
    status: "ONLINE",
    email: "huynguyen2603989@gmail.com",
  },
  heroModules: ["AWS", "Azure", "Kubernetes", "Terraform", "CI/CD", "GitOps"],
  profile: {
    bio: "I'm a DevOps Engineer with 5 years of hands-on experience automating infrastructure, optimizing CI/CD pipelines, and shipping scalable cloud deployments across AWS and Azure. I bridge development and operations to deliver reliable, high-performing systems.",
    mission:
      "Turning complex operational problems into resilient, automated platforms — with a current focus on predictive monitoring, GitOps, and agentic-AI-enhanced DevOps workflows.",
    metrics: [
      { label: "EXPERIENCE", value: "5+", suffix: "YRS" },
      { label: "PROJECTS", value: "10+", suffix: "SHIPPED" },
      { label: "CAFFEINE", value: "∞", suffix: "ml" },
    ],
  },
  skills: [
    { label: "AWS", icon: "aws", color: "#FF9900" },
    { label: "Azure", icon: "azure", color: "#0078D4" },
    { label: "Docker", icon: "docker", color: "#2496ED" },
    { label: "Kubernetes", icon: "kubernetes", color: "#326CE5" },
    { label: "Terraform", icon: "terraform", color: "#7B42BC" },
    { label: "Ansible", icon: "ansible", color: "#EE0000" },
    { label: "Python", icon: "python", color: "#3776AB" },
    { label: "Linux", icon: "linux", color: "#FCC624" },
    { label: "Jenkins", icon: "jenkins", color: "#D24939" },
    { label: "Git", icon: "git", color: "#F05032" },
  ],
  experience: [
    {
      id: "exp-1",
      hash: "f4c3a9e",
      company: "Bosch Global Software Technology Vietnam",
      role: "DevOps Engineer",
      period: "Jan 2020 — Present",
      description:
        "DevOps engineer with a strong progression from automation development to large-scale CI/CD infrastructure supporting multiple embedded teams. Skilled in building automation solutions with Jenkins, Groovy, Python, Helm, and Ansible across Powertrain, Splunk, and Active Safety domains. Experienced in maintaining CI infrastructure on Azure Cloud with Kubernetes, ArgoCD, and Terraform. Collaborates with teams in Germany, India, China, and Hungary to deliver reliable pipelines and scalable infrastructure. Proactively researching early adoption of agentic AI to enhance DevOps workflows.",
      technologies: ["Jenkins", "Groovy", "Python", "Helm", "Ansible", "Kubernetes", "ArgoCD", "Terraform", "Azure"],
      stats: { files: 6, insertions: 512, deletions: 0 },
    },
    {
      id: "exp-2",
      hash: "e7d21b8",
      company: "Bosch Global Software Technology Vietnam",
      role: "AWS CloudOps Agent — Leader",
      period: "Oct 2025 — Dec 2025",
      description:
        "Leading development of an intelligent agentic AI system powered by AWS Bedrock AgentCore and the AWS Strands Agent SDK for autonomous AWS cloud operations management.",
      technologies: ["AWS Bedrock AgentCore", "AWS Strands Agent SDK"],
      stats: { files: 2, insertions: 180, deletions: 0 },
    },
    {
      id: "exp-3",
      hash: "c9a54f3",
      company: "Bosch Global Software Technology Vietnam",
      role: "MCP Server for DevOps — DevOps Engineer",
      period: "Sep 2025 — Dec 2025",
      description:
        "Conducting research and early implementation of agentic AI in DevOps. Developing an MCP server to explore intelligent automation capabilities.",
      technologies: ["MCP", "Agentic AI"],
      stats: { files: 3, insertions: 120, deletions: 0 },
    },
    {
      id: "exp-4",
      hash: "b3e8d17",
      company: "Bosch Global Software Technology Vietnam",
      role: "CI/CD Infrastructure in K8S — DevOps Engineer",
      period: "Jun 2025 — Dec 2025",
      description:
        "Received knowledge transfer from the Hungary team to operate and maintain Jenkins systems on Azure Cloud. Leveraged Kubernetes and ArgoCD for GitOps-based deployments. Maintained Azure cloud infrastructure with Terraform.",
      technologies: ["Jenkins", "Kubernetes", "ArgoCD", "Terraform", "Azure"],
      stats: { files: 4, insertions: 260, deletions: 0 },
    },
    {
      id: "exp-5",
      hash: "a1f6c42",
      company: "Bosch Global Software Technology Vietnam",
      role: "Jenkins CI/CD Pipelines for DE ActiveSafety Team — DevOps Engineer",
      period: "Jun 2024 — Dec 2025",
      description:
        "Enhanced Jenkins pipelines using custom Python libraries. Implemented Jenkins Infrastructure as Code with Helm.",
      technologies: ["Jenkins", "Python", "Helm"],
      stats: { files: 3, insertions: 210, deletions: 0 },
    },
    {
      id: "exp-6",
      hash: "98d3e5b",
      company: "Bosch Global Software Technology Vietnam",
      role: "Splunk & CI Infrastructure — DevOps Engineer",
      period: "Jan 2024 — Jun 2024",
      description:
        "Supported the Splunk team setting up and optimizing Jenkins pipelines for log analytics and monitoring. Maintained and improved CI infrastructure for German projects, including Jenkins, Grafana, and Prometheus.",
      technologies: ["Jenkins", "Splunk", "Grafana", "Prometheus"],
      stats: { files: 3, insertions: 175, deletions: 0 },
    },
    {
      id: "exp-7",
      hash: "87c2f9a",
      company: "Bosch Global Software Technology Vietnam",
      role: "Jenkins CI/CD Pipelines for DE PowerTrain Team — DevOps Engineer",
      period: "Jan 2021 — Jun 2024",
      description:
        "Transitioned into the DevOps team, working closely with colleagues in Germany on large-scale automotive software. Designed and implemented CI/CD pipelines with Jenkins and Groovy for automated build, test, and deployment. May 2023: onsite trip to Bosch Abstatt to work closely with German colleagues.",
      technologies: ["Jenkins", "Groovy"],
      stats: { files: 5, insertions: 340, deletions: 0 },
    },
    {
      id: "exp-8",
      hash: "76b1e48",
      company: "Bosch Global Software Technology Vietnam",
      role: "KPI Dashboard — Automation Tool Developer",
      period: "Apr 2020 — Jan 2021",
      description:
        "Collaborated with China-based software PCMs and managers to design and deliver KPI dashboards using PowerBI and SQL. Improved visibility into project performance through data visualization.",
      technologies: ["Power BI", "SQL"],
      stats: { files: 2, insertions: 90, deletions: 0 },
    },
    {
      id: "exp-9",
      hash: "65a9d37",
      company: "Bosch Global Software Technology Vietnam",
      role: "Automation Tool Developer",
      period: "Apr 2020 — Jan 2021",
      description:
        "Developed automation applications in C# and Python to streamline workflow and process management on Jira. Supported embedded teams in India and Germany.",
      technologies: ["C#", "Python", "Jira"],
      stats: { files: 3, insertions: 150, deletions: 0 },
    },
    {
      id: "exp-10",
      hash: "54f8c26",
      company: "Bosch Global Software Technology Vietnam",
      role: "Python Intern — Embedded Automation Tools",
      period: "Jan 2020 — Apr 2020",
      description:
        "Supported senior engineers developing internal tools and improving code quality.",
      technologies: ["Python"],
      stats: { files: 1, insertions: 40, deletions: 0 },
    },
    {
      id: "exp-11",
      hash: "43e7b15",
      company: "University of Greenwich, Viet Nam",
      role: "Bachelor of Information Technology",
      period: "2017 — 2020",
      description: "GPA: 3.6 / 4.0",
      technologies: [],
      stats: { files: 1, insertions: 20, deletions: 0 },
    },
  ],
  projects: [
    {
      id: "devops-engineer-profile",
      title: "devops-engineer-profile",
      description: "devops-engineer-profile",
      technologies: ["HCL", "HTML", "Python", "PowerShell", "Vue", "CSS", "JavaScript", "Shell"],
      language: "HCL",
      color: "#844FBA",
      stars: 1,
      forks: 0,
      featured: true,
      href: "https://github.com/HuyNguyen260398/devops-engineer-profile",
    },
    {
      id: "aws-cloudops-agent",
      title: "aws-cloudops-agent",
      description:
        "A beginner-friendly AWS operations agent built with AWS Strands Agent SDK and Amazon Bedrock Claude 4 Sonnet.",
      technologies: ["Python"],
      language: "Python",
      color: "#3572A5",
      stars: 0,
      forks: 0,
      featured: true,
      href: "https://github.com/HuyNguyen260398/aws-cloudops-agent",
    },
    {
      id: "aws_resume_web_inf",
      title: "aws_resume_web_inf",
      description: "Cloudformation templates for aws resume web",
      technologies: ["Python", "PowerShell", "Shell"],
      language: "Python",
      color: "#3572A5",
      stars: 0,
      forks: 0,
      featured: true,
      href: "https://github.com/HuyNguyen260398/aws_resume_web_inf",
    },
    {
      id: "aws_resume_web_src",
      title: "aws_resume_web_src",
      description: "Source code of asw resume web",
      technologies: ["HTML", "CSS", "JavaScript", "PHP"],
      language: "HTML",
      color: "#e34c26",
      stars: 0,
      forks: 0,
      featured: true,
      href: "https://github.com/HuyNguyen260398/aws_resume_web_src",
    },
    {
      id: "aws-serverless-webapp",
      title: "aws-serverless-webapp",
      description: "A simple web app built on AWS Serverless Architecture",
      technologies: ["TypeScript", "HCL", "JavaScript", "CSS"],
      language: "TypeScript",
      color: "#3178c6",
      stars: 0,
      forks: 0,
      featured: true,
      href: "https://github.com/HuyNguyen260398/aws-serverless-webapp",
    },
  ],
  blogs: [],
  socials: [
    { label: "GitHub", value: "@HuyNguyen260398", href: "https://github.com/HuyNguyen260398" },
    { label: "LinkedIn", value: "huy-nguyen-966488189", href: "https://www.linkedin.com/in/huy-nguyen-966488189" },
  ],
  assistant: {
    welcome:
      "I'm a scripted local assistant — I can show pinned projects, summarize the stack, or explain how to reach me. Replies are canned and nothing leaves your browser.",
    suggestions: [
      {
        label: "Show pinned projects",
        reply:
          "Pinned repos: devops-engineer-profile, aws-cloudops-agent, aws_resume_web_inf, aws_resume_web_src, and aws-serverless-webapp — all under github.com/HuyNguyen260398.",
      },
      {
        label: "Summarize the stack",
        reply:
          "Day to day: AWS, Azure, Kubernetes, Terraform, Jenkins, Ansible, Python, and GitOps with ArgoCD.",
      },
      {
        label: "How do I get in touch?",
        reply:
          "Use the contact form below or email huynguyen2603989@gmail.com — currently available for new opportunities.",
      },
    ],
  },
} as const satisfies PortfolioContent;
```

- [ ] **Step 2: Typecheck**

```bash
cd src/aws-s3-web && pnpm typecheck && cd -
```

Expected: no errors (this only validates the data shape against `PortfolioContent` — the `azure`/`git` skill icons don't need to resolve yet, that's Task 3; skill icon keys are plain `string` in the type).

- [ ] **Step 3: Commit**

```bash
git add src/aws-s3-web/src/data/portfolio.ts
git commit -m "$(cat <<'EOF'
feat(web): replace placeholder portfolio content with real data

Migrates identity, skills, all 11 experience entries, project seed data,
socials, and assistant scripted replies from the old index.html.
EOF
)"
```

---

### Task 3: Add Azure and Git brand icons to the skills globe

> **Amended during execution:** `react-icons/si` (v5.7.0, as installed) has no
> Azure export — Microsoft trademarked icons (Azure, Teams, Edge, ...) were
> removed from the Simple Icons set. `SiMicrosoftazure` referenced below does
> not exist. Actual fix: import `CloudCog` from `lucide-react` and map
> `azure: CloudCog` instead — the same generic-icon fallback already used for
> `aws: Cloud` in this file. `SiGit` does exist and is used as planned.

**Files:**
- Modify: `src/aws-s3-web/src/components/skills/skill-node.tsx:1-59`

**Interfaces:**
- Consumes: `portfolio.skills` entries with `icon: "azure"` and `icon: "git"` from Task 2.
- Produces: `iconMap` now resolves every skill icon key used in `portfolio.ts` to a real brand icon (no silent fallback to the generic `Bot` icon).

- [ ] **Step 1: Add the two missing imports**

In `src/aws-s3-web/src/components/skills/skill-node.tsx`, change the `react-icons/si` import block from:

```typescript
import {
  SiAnsible,
  SiArgo,
  SiCloudflare,
  SiDocker,
  SiGithub,
  SiGitlab,
  SiGnubash,
  SiGrafana,
  SiHelm,
  SiJenkins,
  SiKubernetes,
  SiLinux,
  SiNextdotjs,
  SiNginx,
  SiNodedotjs,
  SiPostgresql,
  SiPrometheus,
  SiPython,
  SiReact,
  SiRedis,
  SiTerraform,
  SiTypescript,
} from "react-icons/si";
```

to:

```typescript
import {
  SiAnsible,
  SiArgo,
  SiCloudflare,
  SiDocker,
  SiGit,
  SiGithub,
  SiGitlab,
  SiGnubash,
  SiGrafana,
  SiHelm,
  SiJenkins,
  SiKubernetes,
  SiLinux,
  SiMicrosoftazure,
  SiNextdotjs,
  SiNginx,
  SiNodedotjs,
  SiPostgresql,
  SiPrometheus,
  SiPython,
  SiReact,
  SiRedis,
  SiTerraform,
  SiTypescript,
} from "react-icons/si";
```

- [ ] **Step 2: Add both keys to `iconMap`**

Find the `iconMap` object (same file) and add two entries — `git` and `azure` — anywhere in the object, e.g. right after `docker`:

```typescript
  docker: SiDocker,
  git: SiGit,
  azure: SiMicrosoftazure,
```

(Leave every other existing entry untouched.)

- [ ] **Step 3: Typecheck and run the skills unit test**

```bash
cd src/aws-s3-web
pnpm typecheck
pnpm test -- skills-section.test.tsx
cd -
```

Expected: both pass (this test only asserts on the accessible skill list, e.g. `"Terraform"` text, which still renders regardless of icon).

- [ ] **Step 4: Commit**

```bash
git add src/aws-s3-web/src/components/skills/skill-node.tsx
git commit -m "$(cat <<'EOF'
feat(web): add Azure and Git brand icons to the skills globe

portfolio.ts now lists azure and git skill entries; the icon map needs
matching react-icons/si exports or those nodes silently fall back to a
generic bot icon.
EOF
)"
```

---

### Task 4: Swap in real avatar/favicon assets and fix the resume link

**Files:**
- Delete: `src/aws-s3-web/public/avatar-placeholder.svg`
- Create: `src/aws-s3-web/public/avatar.jpg`, `src/aws-s3-web/src/app/icon.png`, `src/aws-s3-web/src/app/apple-icon.png`
- Modify: `src/aws-s3-web/src/components/about-section.tsx:20,51`, `src/aws-s3-web/src/components/assistant-widget.tsx:56,71`, `src/aws-s3-web/src/lib/accent-palette.test.ts:5`, `src/aws-s3-web/src/data/portfolio.ts:1` (assistant help text no longer references the old filename — already covered by Task 2's rewrite, verified here)

**Interfaces:**
- Produces: `/avatar.jpg` served from `public/`, and Next.js App Router auto-detected `icon.png`/`apple-icon.png` favicons (no metadata code changes needed for those — Next.js picks up `src/app/icon.png` and `src/app/apple-icon.png` automatically).

- [ ] **Step 1: Move the preserved real images into place**

```bash
cp /tmp/aws-s3-web-real-assets/profile-img-main.jpg src/aws-s3-web/public/avatar.jpg
cp /tmp/aws-s3-web-real-assets/favicon-main.png src/aws-s3-web/src/app/icon.png
cp /tmp/aws-s3-web-real-assets/apple-touch-icon-main.png src/aws-s3-web/src/app/apple-icon.png
rm src/aws-s3-web/public/avatar-placeholder.svg
ls src/aws-s3-web/public src/aws-s3-web/src/app
```

Expected: `public/avatar.jpg` present, `public/avatar-placeholder.svg` gone; `src/app/icon.png` and `src/app/apple-icon.png` present alongside `layout.tsx`/`page.tsx`/`globals.css`.

- [ ] **Step 2: Point `about-section.tsx` at the real avatar and the real resume URL**

In `src/aws-s3-web/src/components/about-section.tsx`, change:

```tsx
<Image src="/avatar-placeholder.svg" alt="Sample developer avatar" width={160} height={160} priority />
```

to:

```tsx
<Image src="/avatar.jpg" alt="Portrait of Nguyen Gia Huy" width={160} height={160} priority />
```

and change:

```tsx
<a className="resume-download" href="/resume.pdf" download>
  <FileDown aria-hidden="true" size={17} /> Download resume
</a>
```

to:

```tsx
<a
  className="resume-download"
  href="https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf"
  download="Nguyen-Gia-Huy-DevOps-Engineer.pdf"
  target="_blank"
  rel="noopener noreferrer"
>
  <FileDown aria-hidden="true" size={17} /> Download resume
</a>
```

- [ ] **Step 3: Point `assistant-widget.tsx` at the real avatar**

In `src/aws-s3-web/src/components/assistant-widget.tsx`, change both occurrences:

```tsx
<Image src="/avatar-placeholder.svg" alt="" width={43} height={43} />
```

to:

```tsx
<Image src="/avatar.jpg" alt="" width={43} height={43} />
```

and:

```tsx
<div className="assistant-avatar"><Image src="/avatar-placeholder.svg" alt="" width={38} height={38} /><span aria-hidden="true" /></div>
```

to:

```tsx
<div className="assistant-avatar"><Image src="/avatar.jpg" alt="" width={38} height={38} /><span aria-hidden="true" /></div>
```

- [ ] **Step 4: Fix the accent-palette test so it doesn't try to text-scan a deleted SVG**

In `src/aws-s3-web/src/lib/accent-palette.test.ts`, change:

```typescript
const productionAssets = ["src/app/globals.css", "public/avatar-placeholder.svg"];
```

to:

```typescript
const productionAssets = ["src/app/globals.css"];
```

(The avatar is now a JPEG with no CSS accent literals to scan; the only production asset with meaningful text content is `globals.css`.)

- [ ] **Step 5: Run the affected tests and build**

```bash
cd src/aws-s3-web
pnpm test -- accent-palette.test.ts
pnpm build
cd -
```

Expected: `accent-palette.test.ts` passes; `pnpm build` succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/public src/aws-s3-web/src/app/icon.png src/aws-s3-web/src/app/apple-icon.png \
  src/aws-s3-web/src/components/about-section.tsx src/aws-s3-web/src/components/assistant-widget.tsx \
  src/aws-s3-web/src/lib/accent-palette.test.ts
git commit -m "$(cat <<'EOF'
feat(web): use the real avatar/favicon and resume link

Replaces the placeholder avatar SVG with the real profile photo, adds
real favicons via Next.js App Router auto-detection, and points the
resume download at the existing CloudFront-hosted PDF.
EOF
)"
```

---

### Task 5: Real hero code-window content and GitHub link

**Files:**
- Modify: `src/aws-s3-web/src/components/code-window.tsx:6-16,44-65`
- Modify: `src/aws-s3-web/src/components/hero-section.tsx:94-101`

**Interfaces:**
- Consumes: `portfolio.socials` (Task 2) for the GitHub link href.

- [ ] **Step 1: Replace the code-window's sample Terraform lines with the real ones**

In `src/aws-s3-web/src/components/code-window.tsx`, replace the `lines` array:

```tsx
const lines = [
  <><span className="code-comment">{"# Welcome to the sample workspace"}</span></>,
  <><span className="code-yellow">resource</span> <span className="code-green">&quot;developer&quot;</span> <span className="code-green">&quot;sample&quot;</span> {"{"}</>,
  <>&nbsp;&nbsp;<span className="code-orange">name</span>&nbsp;&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Sample Developer&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">role</span>&nbsp;&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Platform Engineer&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">location</span> = <span className="code-green">&quot;Remote / Anywhere&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">focus</span>&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Reliable Systems&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">stack</span>&nbsp;&nbsp;&nbsp; = [<span className="code-green">&quot;Kubernetes&quot;</span>, <span className="code-green">&quot;Terraform&quot;</span>, <span className="code-green">&quot;AWS&quot;</span>]</>,
  <>&nbsp;&nbsp;<span className="code-orange">status</span>&nbsp;&nbsp; = <span className="code-blue">true</span></>,
  <>{"}"}</>,
];
```

with:

```tsx
const lines = [
  <><span className="code-comment">{"# Welcome to my workspace"}</span></>,
  <><span className="code-yellow">resource</span> <span className="code-green">&quot;devops_engineer&quot;</span> <span className="code-green">&quot;huy&quot;</span> {"{"}</>,
  <>&nbsp;&nbsp;<span className="code-orange">name</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;Nguyen Gia Huy&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">location</span>&nbsp;&nbsp; = <span className="code-green">&quot;Ho Chi Minh City, VN&quot;</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">experience</span> = <span className="code-blue">5</span> <span className="code-comment"># years</span></>,
  <>&nbsp;&nbsp;<span className="code-orange">focus</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = [<span className="code-green">&quot;CI/CD&quot;</span>, <span className="code-green">&quot;GitOps&quot;</span>, <span className="code-green">&quot;IaC&quot;</span>]</>,
  <>&nbsp;&nbsp;<span className="code-orange">stack</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = [<span className="code-green">&quot;AWS&quot;</span>, <span className="code-green">&quot;Azure&quot;</span>, <span className="code-green">&quot;Kubernetes&quot;</span>]</>,
  <>&nbsp;&nbsp;<span className="code-orange">status</span>&nbsp;&nbsp;&nbsp; = <span className="code-green">&quot;available&quot;</span></>,
  <>{"}"}</>,
];
```

Then, in the same file, change the window title and aria-label:

```tsx
<div className="window-file"><span aria-hidden="true" /> portfolio.tf</div>
```

to:

```tsx
<div className="window-file"><span aria-hidden="true" /> about-me.tf</div>
```

and:

```tsx
<div className="code-body" aria-label="Sample Terraform profile">
```

to:

```tsx
<div className="code-body" aria-label="Terraform profile">
```

- [ ] **Step 2: Point the hero GitHub card at the real profile**

In `src/aws-s3-web/src/components/hero-section.tsx`, change:

```tsx
<a className="github-card" href="https://example.com" target="_blank" rel="noreferrer">
```

to:

```tsx
<a
  className="github-card"
  href={portfolio.socials.find((social) => social.label === "GitHub")?.href}
  target="_blank"
  rel="noreferrer"
>
```

- [ ] **Step 3: Build and run the hero test (expected to still fail on the heading text — fixed in Task 9)**

```bash
cd src/aws-s3-web && pnpm build && cd -
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/aws-s3-web/src/components/code-window.tsx src/aws-s3-web/src/components/hero-section.tsx
git commit -m "$(cat <<'EOF'
feat(web): real Terraform snippet and GitHub link in the hero

Mirrors the old about-me.tf hero card content and wires the GitHub card
to the real profile URL from portfolio.socials instead of a placeholder.
EOF
)"
```

---

### Task 6: Blogs section empty state

> **Amended during execution:** the bare `blogs: []` literal in `portfolio.ts`
> narrows to an empty-tuple type under `as const`, which breaks type
> inference for `BlogPost` fields in the (unreachable today, but still
> type-checked) non-empty render branch. Fix: in `src/aws-s3-web/src/data/portfolio.ts`,
> change `blogs: [],` to `blogs: [] as PortfolioContent["blogs"],`.

**Files:**
- Modify: `src/aws-s3-web/src/components/blogs-section.tsx`
- Modify: `src/aws-s3-web/src/data/portfolio.ts` (widen the `blogs` field type — see amendment above)

**Interfaces:**
- Consumes: `portfolio.blogs` (empty array, from Task 2).

- [ ] **Step 1: Write the failing test**

Create `src/aws-s3-web/src/components/blogs-section.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { BlogsSection } from "./blogs-section";

it("shows a terminal empty state when there are no pinned posts", () => {
  render(<BlogsSection />);

  expect(screen.getByText("total 0")).toBeInTheDocument();
  expect(screen.getByText("# No pinned blogs yet.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd src/aws-s3-web && pnpm test -- blogs-section.test.tsx && cd -
```

Expected: FAIL — `total 0` / `# No pinned blogs yet.` not found (the current component renders an empty `.blog-grid` with nothing in it).

- [ ] **Step 3: Add the empty-state branch**

Replace the body of `src/aws-s3-web/src/components/blogs-section.tsx`:

```tsx
import { ArrowUpRight, CalendarDays, Clock3, FileText } from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

export function BlogsSection() {
  return (
    <section className="page-section blogs-section" id="blogs" aria-labelledby="blogs-heading">
      <div id="blogs-heading"><SectionHeading prefix="$" title="ls -la ~/blogs" icon={sectionIcons.blogs} /></div>
      {portfolio.blogs.length === 0 ? (
        <div className="blogs-empty">
          <p className="blogs-empty-prompt">ls -la ~/blogs</p>
          <p className="blogs-empty-comment">total 0</p>
          <p className="blogs-empty-comment"># No pinned blogs yet.</p>
        </div>
      ) : (
        <div className="blog-grid">
          {portfolio.blogs.map((post, index) => (
            <article className="blog-card" key={post.id}>
              <div className="blog-index">0{index + 1}</div>
              <div className="blog-thumb" aria-hidden="true">
                <FileText size={30} />
              </div>
              <div className="blog-meta">
                <span><CalendarDays aria-hidden="true" size={13} />{post.date}</span>
                <span><Clock3 aria-hidden="true" size={13} />{post.readingTime}</span>
              </div>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <div className="tag-row">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <a href={post.href} target="_blank" rel="noreferrer">
                Read sample article <ArrowUpRight aria-hidden="true" size={15} />
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd src/aws-s3-web && pnpm test -- blogs-section.test.tsx && cd -
```

Expected: PASS.

- [ ] **Step 5: Add matching CSS for the new classnames**

Open `src/aws-s3-web/src/app/globals.css` and add (near the existing `.blog-grid`/`.blog-card` rules — search for `.blogs-section` to find them):

```css
.blogs-empty {
  font-family: var(--font-geist-mono), monospace;
  color: var(--muted-foreground);
  padding: 2rem 0;
}

.blogs-empty-prompt::before {
  content: "$ ";
  opacity: 0.6;
}

.blogs-empty-comment {
  opacity: 0.6;
}
```

(If `--muted-foreground` isn't defined in this file, `grep -n "muted-foreground\|--foreground" src/aws-s3-web/src/app/globals.css` to find the existing token name used elsewhere and substitute it.)

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/src/components/blogs-section.tsx src/aws-s3-web/src/components/blogs-section.test.tsx src/aws-s3-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(web): add terminal-style empty state to the blogs section

portfolio.blogs is empty (no pinned posts yet, matching the live site);
the section previously rendered a blank grid instead of communicating that.
EOF
)"
```

---

### Task 7: Live-fetch pinned GitHub repos in the Projects section

**Files:**
- Modify: `ops/fetch_pinned_repos.py:14` (OUT_PATH)
- Delete: (none — `src/aws-s3-web/assets/data/pinned-repos.json` doesn't exist yet in the new tree; it's created fresh)
- Create: `src/aws-s3-web/public/data/pinned-repos.json` (seed copy of the current data, so local `pnpm dev`/`pnpm build` has something to fetch before the first CI refresh)
- Modify: `src/aws-s3-web/src/components/projects-section.tsx` (full rewrite)

**Interfaces:**
- Produces: `ProjectsSection` renders `portfolio.projects` (Task 2 seed data) immediately, then replaces it with freshly fetched `/data/pinned-repos.json` content if the fetch succeeds — so the section always reflects real GitHub pinned repos without requiring a Next.js rebuild.

- [ ] **Step 1: Update the fetch script's output path**

In `ops/fetch_pinned_repos.py`, change:

```python
OUT_PATH = os.path.join(REPO_ROOT, "src", "aws-s3-web", "assets", "data", "pinned-repos.json")
```

to:

```python
OUT_PATH = os.path.join(REPO_ROOT, "src", "aws-s3-web", "public", "data", "pinned-repos.json")
```

- [ ] **Step 2: Seed the JSON so the site has content before the first CI-driven refresh**

```bash
mkdir -p src/aws-s3-web/public/data
cat > src/aws-s3-web/public/data/pinned-repos.json <<'EOF'
{
  "generated_at": "2026-07-05T12:48:19Z",
  "username": "HuyNguyen260398",
  "repos": [
    {
      "name": "devops-engineer-profile",
      "description": "devops-engineer-profile",
      "url": "https://github.com/HuyNguyen260398/devops-engineer-profile",
      "stars": 1,
      "forks": 0,
      "primaryLanguage": "HCL",
      "languages": ["HCL", "HTML", "Python", "PowerShell", "Vue", "CSS", "JavaScript", "Shell"]
    },
    {
      "name": "aws-cloudops-agent",
      "description": "A beginner-friendly AWS operations agent built with AWS Strands Agent SDK and Amazon Bedrock Claude 4 Sonnet.",
      "url": "https://github.com/HuyNguyen260398/aws-cloudops-agent",
      "stars": 0,
      "forks": 0,
      "primaryLanguage": "Python",
      "languages": ["Python"]
    },
    {
      "name": "aws_resume_web_inf",
      "description": "Cloudformation templates for aws resume web",
      "url": "https://github.com/HuyNguyen260398/aws_resume_web_inf",
      "stars": 0,
      "forks": 0,
      "primaryLanguage": "Python",
      "languages": ["Python", "PowerShell", "Shell"]
    },
    {
      "name": "aws_resume_web_src",
      "description": "Source code of asw resume web",
      "url": "https://github.com/HuyNguyen260398/aws_resume_web_src",
      "stars": 0,
      "forks": 0,
      "primaryLanguage": "HTML",
      "languages": ["HTML", "CSS", "JavaScript", "PHP"]
    },
    {
      "name": "aws-serverless-webapp",
      "description": "A simple web app built on AWS Serverless Architecture",
      "url": "https://github.com/HuyNguyen260398/aws-serverless-webapp",
      "stars": 0,
      "forks": 0,
      "primaryLanguage": "TypeScript",
      "languages": ["TypeScript", "HCL", "JavaScript", "CSS"]
    }
  ]
}
EOF
```

- [ ] **Step 3: Write the failing test for the live-fetch behavior**

Replace `src/aws-s3-web/src/components/content-sections.test.tsx` in full (this also fixes the placeholder-content assertions flagged in Task 9 — done here since it's the same file and the fetch behavior can't be tested without touching it):

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AboutSection } from "./about-section";
import { ExperienceSection } from "./experience-section";
import { ProjectsSection } from "./projects-section";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generated_at: "2026-07-05T12:48:19Z",
        username: "HuyNguyen260398",
        repos: [
          {
            name: "devops-engineer-profile",
            description: "devops-engineer-profile",
            url: "https://github.com/HuyNguyen260398/devops-engineer-profile",
            stars: 1,
            forks: 0,
            primaryLanguage: "HCL",
            languages: ["HCL", "HTML"],
          },
        ],
      }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("renders real work history", () => {
  render(<ExperienceSection />);

  expect(screen.getAllByText("Bosch Global Software Technology Vietnam").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: /DevOps Engineer/ }).length).toBeGreaterThan(0);
  expect(screen.getByText("6 files changed")).toBeInTheDocument();
});

it("shows the seed projects immediately, then swaps in the live-fetched pinned repos", async () => {
  render(<ProjectsSection />);

  expect(screen.getByRole("heading", { name: "aws-cloudops-agent" })).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: "aws-cloudops-agent" })).not.toBeInTheDocument();
  });
  expect(screen.getByRole("heading", { name: "devops-engineer-profile" })).toBeInTheDocument();
});

it("offers the real resume path and only renders projects, not a duplicate repo list", () => {
  render(
    <>
      <AboutSection />
      <ProjectsSection />
    </>,
  );

  expect(screen.getByRole("link", { name: "Download resume" })).toHaveAttribute(
    "href",
    "https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf",
  );
  expect(screen.getByRole("link", { name: "Download resume" })).toHaveAttribute("download");
});
```

Note: the experience list has 10 Bosch entries, so the assertion above uses `getAllByText` rather than `getByText` (which throws on multiple matches).

- [ ] **Step 4: Run it to verify it fails**

```bash
cd src/aws-s3-web && pnpm test -- content-sections.test.tsx && cd -
```

Expected: FAIL — `ProjectsSection` doesn't fetch yet, so `"devops-engineer-profile"` heading never appears from the mocked fetch (it might still appear from seed data, but `aws-cloudops-agent` heading never disappears, so the `waitFor` times out).

- [ ] **Step 5: Rewrite `projects-section.tsx` to fetch live data with a static fallback**

Replace `src/aws-s3-web/src/components/projects-section.tsx` in full:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FolderGit2, GitFork, Star } from "lucide-react";
import { SiGithub } from "react-icons/si";

import { SectionHeading } from "@/components/section-heading";
import { portfolio } from "@/data/portfolio";
import { sectionIcons } from "@/components/section-icons";

type DisplayProject = {
  id: string;
  title: string;
  description: string;
  technologies: readonly string[];
  language: string;
  color: string;
  stars: number;
  forks: number;
  href: string;
  demoHref?: string;
};

type PinnedRepo = {
  name: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  primaryLanguage: string;
  languages: readonly string[];
};

type PinnedReposFile = {
  generated_at: string;
  username: string;
  repos: readonly PinnedRepo[];
};

const languageColors: Record<string, string> = {
  HCL: "#844FBA",
  Python: "#3572A5",
  HTML: "#e34c26",
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  CSS: "#563d7c",
  PHP: "#4F5D95",
  Shell: "#89e051",
  PowerShell: "#012456",
};

function toDisplayProjects(repos: readonly PinnedRepo[]): DisplayProject[] {
  return repos.map((repo) => ({
    id: repo.url,
    title: repo.name,
    description: repo.description || repo.name,
    technologies: repo.languages,
    language: repo.primaryLanguage || "Code",
    color: languageColors[repo.primaryLanguage] ?? "#8b949e",
    stars: repo.stars,
    forks: repo.forks,
    href: repo.url,
  }));
}

const seedProjects: DisplayProject[] = portfolio.projects.filter((project) => project.featured);

export function ProjectsSection() {
  const [projects, setProjects] = useState<DisplayProject[]>(seedProjects);

  useEffect(() => {
    let cancelled = false;

    fetch("/data/pinned-repos.json", { cache: "no-cache" })
      .then((response) => (response.ok ? (response.json() as Promise<PinnedReposFile>) : null))
      .then((data) => {
        if (cancelled || !data || data.repos.length === 0) return;
        setProjects(toDisplayProjects(data.repos));
      })
      .catch(() => {
        // Keep the seed data; the live refresh is a progressive enhancement.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-section projects-section" id="projects" aria-labelledby="projects-heading">
      <div id="projects-heading"><SectionHeading prefix="$" title="ls -la ~/projects" icon={sectionIcons.projects} /></div>
      <div className="pinned-projects">
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <div>
                  <header>
                    <FolderGit2 aria-hidden="true" size={17} />
                    <h3>{project.title}</h3>
                    <span>Public</span>
                  </header>
                  <p>{project.description}</p>
                  <div className="tag-row">
                    {project.technologies.map((technology) => <span key={technology}>{technology}</span>)}
                  </div>
                </div>
                <footer>
                  <span><i style={{ background: project.color }} />{project.language}</span>
                  <span><Star aria-hidden="true" size={14} />{project.stars}</span>
                  <span><GitFork aria-hidden="true" size={14} />{project.forks}</span>
                  <a href={project.href} target="_blank" rel="noreferrer">
                    <SiGithub aria-hidden="true" size={12} /> Source
                  </a>
                  {project.demoHref ? (
                    <a className="project-demo-link" href={project.demoHref} target="_blank" rel="noreferrer">
                      Demo <ExternalLink aria-hidden="true" size={12} />
                    </a>
                  ) : null}
                </footer>
              </article>
            ))}
          </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd src/aws-s3-web && pnpm test -- content-sections.test.tsx && cd -
```

Expected: PASS.

- [ ] **Step 7: Build and confirm the seed JSON ships in the static export**

```bash
cd src/aws-s3-web && pnpm build && cd -
ls src/aws-s3-web/out/data/pinned-repos.json
```

Expected: file exists (Next.js copies everything under `public/` verbatim into `out/`).

- [ ] **Step 8: Commit**

```bash
git add ops/fetch_pinned_repos.py src/aws-s3-web/public/data/pinned-repos.json \
  src/aws-s3-web/src/components/projects-section.tsx src/aws-s3-web/src/components/content-sections.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): live-fetch pinned GitHub repos in the Projects section

Moves pinned-repos.json under public/data/ (Next static export serves it
verbatim) and makes ProjectsSection a client component that renders the
seed data immediately, then swaps in freshly fetched repos — same
progressive-enhancement pattern the old vanilla-JS site used.
EOF
)"
```

---

### Task 8: Contact section and assistant widget copy cleanup

**Files:**
- Modify: `src/aws-s3-web/src/components/contact-section.tsx`
- Modify: `src/aws-s3-web/src/components/assistant-widget.tsx`
- Modify: `src/aws-s3-web/src/app/layout.tsx`

**Interfaces:** none (pure copy edits, no data/type changes).

Note on scope: this task removes "sample"/"placeholder" wording that implies the site itself is a throwaway demo (button labels, footer identity, page title). It deliberately **keeps** the honest functional disclosures that the contact form and assistant don't actually transmit or persist anything (e.g. "Demo message accepted locally. No data was sent.", "Local demo — no data leaves this browser") — those are true statements about real, permanent site behavior (per the approved spec's contact-form decision), not placeholder flavor text, and removing them would make the simulated form misleading to a real visitor.

- [ ] **Step 1: Fix the contact section's identity and status literals**

In `src/aws-s3-web/src/components/contact-section.tsx`, change:

```tsx
<p className="indent-one"><span className="json-key">&quot;status&quot;</span>: <span className="json-green">&quot;sample_available&quot;</span>,</p>
```

to:

```tsx
<p className="indent-one"><span className="json-key">&quot;status&quot;</span>: <span className="json-green">&quot;available&quot;</span>,</p>
```

and change:

```tsx
<footer className="site-footer">
  <p><Code2 aria-hidden="true" size={18} /> Sample Developer <span>|</span> Platform Engineer</p>
  <small>Built as an original Next.js, TypeScript, and Three.js demonstration.</small>
  <small>© {new Date().getFullYear()} Sample Portfolio. Replace with your details.</small>
</footer>
```

to:

```tsx
<footer className="site-footer">
  <p><Code2 aria-hidden="true" size={18} /> Nguyen Gia Huy <span>|</span> DevOps Engineer</p>
  <small>Built with Next.js, TypeScript, and Three.js.</small>
  <small>© {new Date().getFullYear()} Nguyen Gia Huy.</small>
</footer>
```

- [ ] **Step 2: Drop "sample" from the assistant widget's action labels (keep the honest local-only disclosures)**

In `src/aws-s3-web/src/components/assistant-widget.tsx`, change each of these (aria-labels and visible strings only — leave `"Local demo — no data leaves this browser"` and `"Scripted placeholder responses"`'s local-only meaning intact, see Step 3):

```tsx
aria-label="Open sample assistant"
```
→
```tsx
aria-label="Open assistant"
```

```tsx
<strong>&gt;</strong> Open sample assistant<small>local replies only</small>
```
→
```tsx
<strong>&gt;</strong> Open assistant<small>local replies only</small>
```

```tsx
<h2 id="assistant-title"><span>&gt;</span> sample.ai</h2>
```
→
```tsx
<h2 id="assistant-title"><span>&gt;</span> huy.ai</h2>
```

```tsx
aria-label="Reset sample assistant"
```
→
```tsx
aria-label="Reset assistant"
```

```tsx
aria-label={minimized ? "Restore sample assistant" : "Minimize sample assistant"}
```
→
```tsx
aria-label={minimized ? "Restore assistant" : "Minimize assistant"}
```

```tsx
<button type="button" aria-label="Close sample assistant" onClick={close}>
```
→
```tsx
<button type="button" aria-label="Close assistant" onClick={close}>
```

- [ ] **Step 3: Tidy the assistant footer disclosure wording**

```tsx
<footer><Sparkles aria-hidden="true" size={13} /> Scripted placeholder responses</footer>
```
→
```tsx
<footer><Sparkles aria-hidden="true" size={13} /> Scripted local responses</footer>
```

- [ ] **Step 4: Fix the page metadata**

In `src/aws-s3-web/src/app/layout.tsx`, change:

```typescript
export const metadata: Metadata = {
  title: "Sample Developer | Platform Engineer",
  description:
    "A sample terminal-inspired engineering portfolio with an interactive Three.js skills universe.",
};
```

to:

```typescript
export const metadata: Metadata = {
  title: "Nguyen Gia Huy — DevOps Engineer",
  description:
    "Nguyen Gia Huy — DevOps Engineer portfolio: AWS, Azure, Kubernetes, Terraform, CI/CD, GitOps.",
};
```

- [ ] **Step 5: Build**

```bash
cd src/aws-s3-web && pnpm build && cd -
```

Expected: succeeds (unit tests referencing these exact strings are updated next, in Task 9 — don't run `pnpm test` yet or several will still fail on the old copy).

- [ ] **Step 6: Commit**

```bash
git add src/aws-s3-web/src/components/contact-section.tsx src/aws-s3-web/src/components/assistant-widget.tsx src/aws-s3-web/src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): replace placeholder identity copy in contact, assistant, and metadata

Drops "sample"/"placeholder" wording that implied the site itself is a
demo, while keeping the honest "nothing is actually transmitted"
disclosures on the simulated contact form and local assistant.
EOF
)"
```

---

### Task 9: Update remaining component and e2e tests for real content

**Files:**
- Modify: `src/aws-s3-web/src/components/hero-section.test.tsx`
- Modify: `src/aws-s3-web/src/components/assistant-widget.test.tsx`
- Modify: `src/aws-s3-web/src/components/contact-section.test.tsx`
- Modify: `src/aws-s3-web/e2e/portfolio.spec.ts`

**Interfaces:** none (test-only changes; `content-sections.test.tsx` and `accent-palette.test.ts` were already handled in Tasks 4 and 7).

- [ ] **Step 1: Fix the hero test**

In `src/aws-s3-web/src/components/hero-section.test.tsx`, change:

```tsx
it("renders the sample identity and emits section actions", async () => {
  const onNavigate = vi.fn();
  const user = userEvent.setup();

  render(<HeroSection onNavigate={onNavigate} reducedMotion />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sample Developer");
```

to:

```tsx
it("renders the real identity and emits section actions", async () => {
  const onNavigate = vi.fn();
  const user = userEvent.setup();

  render(<HeroSection onNavigate={onNavigate} reducedMotion />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nguyen Gia Huy");
```

(the rest of the test — clicking "Run profile" / "View projects" — is unchanged, those labels live in `code-window.tsx` and weren't renamed).

- [ ] **Step 2: Fix the assistant widget test**

Replace `src/aws-s3-web/src/components/assistant-widget.test.tsx` in full:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { AssistantWidget } from "./assistant-widget";

it("opens, answers a local suggestion, minimizes, and closes", async () => {
  const user = userEvent.setup();
  render(<AssistantWidget />);

  await user.click(screen.getByRole("button", { name: "Open assistant" }));
  expect(screen.getByText("Local demo — no data leaves this browser")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Show pinned projects" }));
  expect(screen.getByText(/devops-engineer-profile/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Minimize assistant" }));
  await user.click(screen.getByRole("button", { name: "Restore assistant" }));
  await user.click(screen.getByRole("button", { name: "Close assistant" }));

  expect(screen.getByRole("button", { name: "Open assistant" })).toBeInTheDocument();
});
```

- [ ] **Step 3: Fix the contact section test**

In `src/aws-s3-web/src/components/contact-section.test.tsx`, the button label and submitted values don't reference identity data, so only the button name needs no change — but verify it still matches (the label text itself, `"Send demo message"`, was intentionally kept in Task 8). Run it as-is first:

```bash
cd src/aws-s3-web && pnpm test -- contact-section.test.tsx && cd -
```

Expected: PASS already (no edit needed — this file never asserted on "Sample Developer" or similar identity strings, only on the generic simulated-submission behavior which Task 8 preserved).

- [ ] **Step 4: Fix the e2e spec**

In `src/aws-s3-web/e2e/portfolio.spec.ts`, change:

```typescript
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sample Developer");
```

to:

```typescript
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nguyen Gia Huy");
```

and change:

```typescript
  await page.getByRole("button", { name: "Open sample assistant" }).click();
```

to:

```typescript
  await page.getByRole("button", { name: "Open assistant" }).click();
```

- [ ] **Step 5: Run the full unit test suite**

```bash
cd src/aws-s3-web && pnpm test && cd -
```

Expected: all tests pass.

- [ ] **Step 6: Typecheck and lint**

```bash
cd src/aws-s3-web
pnpm typecheck
pnpm lint
cd -
```

Expected: both pass.

- [ ] **Step 7: Commit**

```bash
git add src/aws-s3-web/src/components/hero-section.test.tsx src/aws-s3-web/src/components/assistant-widget.test.tsx src/aws-s3-web/e2e/portfolio.spec.ts
git commit -m "$(cat <<'EOF'
test(web): update component and e2e assertions for real content

Hero heading, assistant button labels, and the e2e smoke test now match
the migrated identity and copy from earlier tasks.
EOF
)"
```

---

### Task 10: Adapt CI workflows to build then sync `out/`

**Files:**
- Modify: `.github/workflows/aws-s3-web-sync-staging.yml`
- Modify: `.github/workflows/aws-s3-web-sync-prod.yml`

**Interfaces:** none (CI-only change; no application code consumes this).

- [ ] **Step 1: Update the staging workflow**

In `.github/workflows/aws-s3-web-sync-staging.yml`, replace the section from `- name: Set up Python` through the `Sync aws-s3-web to S3 Bucket` step with:

```yaml
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: "pip"
          cache-dependency-path: "ops/requirements.txt"

      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          pip install boto3 requests

      - name: Refresh pinned repos data
        continue-on-error: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: python ops/fetch_pinned_repos.py

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: "11"

      - name: Install site dependencies
        working-directory: src/aws-s3-web
        run: pnpm install --frozen-lockfile

      - name: Build static export
        working-directory: src/aws-s3-web
        run: pnpm build

      - name: Sync aws-s3-web build output to S3 Bucket
        id: sync
        run: |
          echo "Starting S3 sync at $(date)" | tee -a workflow.log

          aws s3 sync src/aws-s3-web/out/ s3://${{ env.S3_BUCKET }}/ \
            --delete \
            --cache-control "public, max-age=3600" 2>&1 | tee -a workflow.log

          SYNC_EXIT_CODE=${PIPESTATUS[0]}

          if [ $SYNC_EXIT_CODE -eq 0 ]; then
            echo "✅ Successfully synced src/aws-s3-web/out to s3://${{ env.S3_BUCKET }}" | tee -a workflow.log
            echo "sync_status=success" >> $GITHUB_OUTPUT
          else
            echo "❌ Sync failed with exit code $SYNC_EXIT_CODE" | tee -a workflow.log
            echo "sync_status=failed" >> $GITHUB_OUTPUT
            exit $SYNC_EXIT_CODE
          fi

          echo "Completed at $(date)" | tee -a workflow.log
```

(Everything after this — Upload Workflow Log, Generate Workflow Summary — is unchanged.)

- [ ] **Step 2: Apply the identical change to the prod workflow**

Make the same replacement in `.github/workflows/aws-s3-web-sync-prod.yml` (same step names, same commands — only `env.S3_BUCKET` differs, and that's already parameterized).

- [ ] **Step 3: Validate workflow YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/aws-s3-web-sync-staging.yml'))" && echo OK
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/aws-s3-web-sync-prod.yml'))" && echo OK
```

Expected: `OK` printed twice.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/aws-s3-web-sync-staging.yml .github/workflows/aws-s3-web-sync-prod.yml
git commit -m "$(cat <<'EOF'
ci(web): build the Next.js static export before syncing to S3

src/aws-s3-web/ now contains Next.js source instead of a plain static
site, so the sync workflows install deps, refresh pinned repos, run
pnpm build, and sync the generated out/ directory instead of the raw
source tree.
EOF
)"
```

---

### Task 11: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Clean install and full build**

```bash
cd src/aws-s3-web
rm -rf node_modules .next out
pnpm install
pnpm build
cd -
```

Expected: succeeds; `src/aws-s3-web/out/index.html` exists.

- [ ] **Step 2: Full test suite, typecheck, lint**

```bash
cd src/aws-s3-web
pnpm typecheck
pnpm lint
pnpm test
cd -
```

Expected: all pass.

- [ ] **Step 3: Serve the static export locally and manually verify content parity**

```bash
cd src/aws-s3-web && npx serve out -l 5000 &
```

Open `http://localhost:5000` and check against the checklist derived from the old `index.html`:

- Hero: name "Nguyen Gia Huy", role "DevOps Engineer", tagline "Automating Infrastructure Beyond Boundaries", GitHub card links to `github.com/HuyNguyen260398`.
- About: real avatar photo visible, bio/mission paragraphs match, metrics show `5+ YRS` / `10+ SHIPPED` / `∞ ml`, resume link opens the CloudFront PDF.
- Skills: globe renders AWS/Azure/Docker/Kubernetes/Terraform/Ansible/Python/Linux/Jenkins/Git nodes with icons (no generic bot-icon fallback).
- Experience: all 11 entries present in reverse-chronological order, correct file/insertion counts.
- Projects: 5 cards matching the current GitHub pinned repos (devops-engineer-profile, aws-cloudops-agent, aws_resume_web_inf, aws_resume_web_src, aws-serverless-webapp).
- Blogs: terminal empty state ("total 0" / "# No pinned blogs yet.").
- Contact: email/GitHub/LinkedIn correct, submitting the form shows the "no data was sent" message (not a real send).
- Browser tab: favicon is the real one, title is "Nguyen Gia Huy — DevOps Engineer".

Stop the server when done:

```bash
kill %1
```

- [ ] **Step 4: Confirm `git status` is clean and every task's commits are present**

```bash
git log --oneline -12
git status
```

Expected: working tree clean, and the log shows the commits from Tasks 1–10 in order.

---

## Notes for the implementer

- Tasks 1–10 must run in order — each later task edits files introduced or reshaped by an earlier one (e.g. Task 7 rewrites the file Task 2 seeded, Task 9 fixes tests broken by Tasks 5/8).
- `pnpm test -- <file>` (Vitest) filters by filename substring; if a step's expected filter doesn't match, run `pnpm test` (no filter) and locate the relevant test in the output.
- If `pnpm` isn't on PATH in the execution environment, install it first: `corepack enable && corepack prepare pnpm@11 --activate`.
