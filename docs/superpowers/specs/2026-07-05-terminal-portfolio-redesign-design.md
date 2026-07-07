# Terminal-Style Portfolio Redesign — Design Spec

**Date:** 2026-07-05
**Status:** Approved for planning
**Scope:** `src/aws-s3-web/` static portfolio site

## Goal

Replace the current Bootstrap "MyResume" template with a fresh, from-scratch
terminal/code-editor aesthetic inspired by the look and feel of
https://www.abdulmomin.dev/ (design inspiration only — no code, assets, or text
copied from that site). All existing content carries over.

## Constraints

- Static hosting on S3 + CloudFront; existing `aws-s3-web-sync-*.yml` workflows
  must keep working with zero changes.
- No build step: plain HTML/CSS/JS files served as-is.
- Reuse existing images (profile photo, favicon, certification badges, blog SVGs).

## Tech Stack & Files

| File | Role |
|---|---|
| `src/aws-s3-web/index.html` | Rewritten single-page site (replaces current content) |
| `src/aws-s3-web/assets/css/terminal.css` | New stylesheet (only stylesheet used) |
| `src/aws-s3-web/assets/js/terminal.js` | New script (~200 lines, only script used) |

- **No Bootstrap, no vendor libraries.** Vanilla HTML/CSS/JS.
- Google Fonts: **JetBrains Mono** with `monospace` fallback.
- Old template files (`index_bk.html`, `index_2.html`, `assets/vendor/`,
  `assets/css/main.css`, `assets/js/main.js`, other `*.html` pages) are left
  untouched in this pass; cleanup is a separate follow-up once the new site is
  verified live.

## Visual Language

- Background near-black `#0a0e14`; panels slightly lighter (`#0f1420`-range).
- Primary accent: terminal green (`#22c55e`-range). Secondary accent: cyan
  (`#22d3ee`-range). Body text: soft gray; headings: white.
- Sections framed as terminal windows: title bar with traffic-light dots and a
  fake path/filename; content prefixed with prompts like `huy@aws:~$`.
- Blinking cursor effects; scroll-reveal animations via IntersectionObserver.
- `prefers-reduced-motion: reduce` disables typing/reveal animations (content
  shown immediately).
- Dark-only theme (matches the terminal concept).

## Page Structure (single page, anchor navigation)

0. **Boot loader** — full-screen preloader on first paint: brief terminal
   boot/loading sequence (progress lines, blinking cursor) that fades into the
   page. Skipped entirely under `prefers-reduced-motion`, and auto-dismissed
   after a short timeout so it can never block content.
1. **Nav** — fixed top bar styled as a shell path / editor tabs
   (`~/home`, `~/about`, `~/skills`, `~/experience`, `~/projects`,
   `~/certs`, `~/blog`, `~/contact`). Active-section highlighting.
   Mobile: hamburger toggling a full-width dropdown.
2. **Hero** — typed boot-sequence lines (e.g. `[OK] SYSTEM ONLINE`), large name
   heading, typed rotating roles (DevOps Engineer / Developer / Freelancer),
   social links (X, Facebook, Instagram, LinkedIn) rendered as command-style
   buttons.
3. **About** — terminal window titled `cat about.txt`: existing bio paragraph;
   profile photo (`profile-img-main.jpg`) with green glow border; personal info
   (DOB, phone, degree, city, email) as key-value config pairs; CV download
   link styled as `wget resume.pdf` (same CloudFront PDF URL as today).
4. **Skills** — interactive **"skills universe"**: a canvas-based field of
   floating skill nodes the visitor can drag to pan/explore (mouse + touch),
   with node size reflecting proficiency and a hint label ("drag to explore").
   Below it, ASCII progress bars animated on scroll using current values:
   AWS 90, Azure 60, Python 90, Linux 75, Terraform 75, Ansible 80, Docker 80,
   Kubernetes 70. Format: `AWS  [█████████░] 90%`. With
   `prefers-reduced-motion` or no JS, the canvas is skipped and only the bars
   render (filled immediately).
5. **Experience** — git-log-style timeline: pseudo commit hashes + date ranges
   + role/company for every current resume item (Bosch roles Jan 2020–present,
   all professional-experience project entries) plus the education entry
   (University of Greenwich, 2017–2020, GPA 3.6/4).
6. **Projects** — repository-style cards for the 3 current projects
   (DevOps Engineer Profile, AWS Resume Web, AWS CloudOps Agent): repo icon,
   name, description, tech badges, GitHub link.
7. **Certifications** — window titled `ls ~/certifications/`: the 3 AWS badge
   images in a grid, each linking to its Credly URL.
8. **Blogs** — file-directory listing: the 6 current blog cards restyled as
   `.md` file entries with title, date, source link, excerpt, Read More link.
9. **Contact** — contact info (address, phone, email) as `whois huy` output;
   contact form styled as terminal input fields, same `forms/contact.php`
   action as today (known limitation: PHP does not execute on S3, unchanged
   behavior; possible later swap to `mailto:`).
10. **Footer** — minimal: name (fixes the current "Alex Smith" copyright bug),
    social links, `exit 0` flourish. BootstrapMade attribution removed since
    the template is no longer used.

## Behavior (terminal.js)

- Boot-loader sequence with guaranteed dismissal (timeout fallback).
- Typed hero boot lines + rotating role text (custom, no typed.js).
- Skills-universe canvas: floating skill nodes, drag/touch panning,
  requestAnimationFrame loop paused when off-screen.
- IntersectionObserver: section reveal + skill-bar fill animation.
- Sticky nav active-link highlighting (scroll position based).
- Smooth anchor scrolling; mobile menu toggle.
- Blinking-cursor accents on section headings.
- No external JS dependencies.

## Accessibility & Performance

- Semantic HTML5 landmarks; alt text on all images; visible focus states;
  color contrast ≥ WCAG AA against the dark background.
- Single CSS file + single JS file; fonts preconnected; images lazy-loaded
  below the fold.

## Testing

- Serve locally: `python3 -m http.server` from `src/aws-s3-web/`.
- Verify in browser at desktop and mobile widths (~375px, ~768px, ≥1200px).
- Check every link (social, Credly, GitHub, blog, CV PDF) and image resolves.
- Verify reduced-motion behavior and keyboard navigation.

## Out of Scope

- Removing old template/vendor files (follow-up task).
- Replacing the contact form backend.
- Changes to CI/CD workflows or infrastructure.
