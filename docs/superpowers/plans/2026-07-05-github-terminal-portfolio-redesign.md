# GitHub-Themed Terminal Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the portfolio in `src/aws-s3-web/` as a close structural clone of https://www.abdulmomin.dev/ — GitHub light/dark theme with a toggle, right-side vertical nav, draggable "skills universe" of brand-logo badges, and a Projects section fed live from GitHub pinned repos via a CI build-time data pipeline.

**Architecture:** One static page — `index.html`, `assets/css/terminal.css`, `assets/js/terminal.js` fully rewritten. A new `assets/data/pinned-repos.json` holds project data; `ops/fetch_pinned_repos.py` regenerates it from GitHub GraphQL, wired into both S3-sync workflows (prod also on a daily cron). No frameworks, no build step, no third-party runtime calls; all icons/logos are inline SVG. Only remote asset: Google Fonts (JetBrains Mono).

**Tech Stack:** Vanilla HTML5/CSS3/ES2017 JS, `requestAnimationFrame` + Pointer Events (skills physics), IntersectionObserver (scroll-spy/reveal), `fetch` (projects), Python 3 stdlib `urllib` (generator), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-05-github-terminal-portfolio-redesign-design.md`

## Global Constraints

- No external JS/CSS dependencies except the Google Fonts stylesheet for **JetBrains Mono** (fallback `monospace`). All icons and brand logos are inline SVG.
- GitHub color tokens — **Dark:** `--bg:#0d1117`, `--bg-subtle:#161b22`, `--bg-elev:#1c2128`, `--border:#30363d`, `--text:#c9d1d9`, `--text-bright:#e6edf3`, `--text-dim:#8b949e`, `--link:#58a6ff`, `--green:#3fb950`, `--amber:#d29922`, `--red:#f85149`, `--purple:#bc8cff`. **Light:** `--bg:#ffffff`, `--bg-subtle:#f6f8fa`, `--bg-elev:#eaeef2`, `--border:#d0d7de`, `--text:#1f2328`, `--text-bright:#010409`, `--text-dim:#59636e`, `--link:#0969da`, `--green:#1a7f37`, `--amber:#9a6700`, `--red:#cf222e`, `--purple:#8250df`.
- Theme: follow `prefers-color-scheme` by default; toggle stamps `data-theme="light|dark"` on `<html>`, persisted in `localStorage` key `theme`; inline `<head>` script applies it before first paint (no flash).
- Section order & exact headings: Hero, `# About.system`, `# Skills.json`, `$ git log --stat --oneline`, `$ ls -la ~/projects`, `$ ls -la ~/blogs`, `$ ./contact.exe`. **No certifications section.**
- Skill levels: AWS 90, Terraform 75, Azure 60, Ansible 80, Python 90, Docker 80, Linux 75, Kubernetes 70, Jenkins 80, Git 85.
- CV PDF URL: `https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf`
- Contact form keeps `action="forms/contact.php" method="post"`.
- `prefers-reduced-motion: reduce` skips: kernel boot, hero typing, reveal transitions, skills physics (static badge grid shown; JSON skills block always readable).
- With JS disabled (`no-js` class on `<html>`): all content visible, loader hidden, reveals visible, skills stage hidden (static grid + JSON block shown), projects show static HTML fallback cards, theme driven by `prefers-color-scheme`.
- Projects render live from `assets/data/pinned-repos.json`; on fetch failure the static HTML cards remain (never an empty section).
- Do NOT touch `inf/`, `gitops/`, other `.github/` workflows, or files in `src/aws-s3-web/` besides `index.html`, `assets/css/terminal.css`, `assets/js/terminal.js`, `assets/data/pinned-repos.json`.
- Verification server: `python3 -m http.server 8080` run from `src/aws-s3-web/` (background; kill when done).
- Every commit message ends with a blank line then the trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (per-task commands below omit it for brevity — add it).

---

### Task 1: Page scaffold — head (no-flash theme), top bar, right nav, hero, footer + CSS foundation

**Files:**
- Modify (full rewrite): `src/aws-s3-web/index.html`
- Modify (full rewrite): `src/aws-s3-web/assets/css/terminal.css`

**Interfaces:**
- Produces CSS classes/IDs consumed by later tasks: `.container`, `.section`, `.section-head`, `.term`, `.term-bar`, `.dot`, `.dot-r/.dot-a/.dot-g`, `.term-title`, `.term-body`, `.prompt`, `.comment`, `.btn`, `.btn-primary`, `.kv`, `.reveal`, `.accent`, `.blue`, `.cursor`, `.code-*` (syntax spans), `.icon` (inline-svg sizing).
- Produces IDs consumed by Task 5 JS: `theme-toggle`, `nav-toggle`, `nav-menu`, `rail` (right nav), `typed-role`, `kernel`, `scroll-top`, `year`.
- `<html class="no-js">` — Task 5 removes it. Head script sets `data-theme` pre-paint.
- Tasks 2–4 replace the HTML comment markers `<!-- @about+skills -->`, `<!-- @experience+projects -->`, `<!-- @blogs+contact -->` inside `<main>`.

- [ ] **Step 1: Write `src/aws-s3-web/index.html` (complete file)**

```html
<!DOCTYPE html>
<html lang="en" class="no-js">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nguyen Gia Huy — DevOps Engineer</title>
  <meta name="description" content="Nguyen Gia Huy — DevOps Engineer portfolio: AWS, Azure, Kubernetes, Terraform, CI/CD, GitOps.">

  <link href="assets/img/favicon-main.png" rel="icon">
  <link href="assets/img/apple-touch-icon-main.png" rel="apple-touch-icon">

  <!-- Apply theme before first paint (no flash) -->
  <script>
    (function () {
      try {
        var t = localStorage.getItem('theme');
        if (t !== 'light' && t !== 'dark') {
          t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        document.documentElement.setAttribute('data-theme', t);
      } catch (e) {}
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">

  <link href="assets/css/terminal.css" rel="stylesheet">
</head>

<body>

  <header class="topbar">
    <div class="container topbar-inner">
      <a href="#home" class="brand">&lt;<span class="accent">Dev</span>/&gt;</a>
      <div class="topbar-right">
        <a class="icon-link" href="https://github.com/HuyNguyen260398" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
        </a>
        <a class="icon-link" href="https://www.linkedin.com/in/huy-nguyen-966488189" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.07 1.4-2.07 2.85V21H9z"/></svg>
        </a>
        <a class="icon-link" href="mailto:huynguyen2603989@gmail.com" aria-label="Email">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 .4v.6l8 5 8-5V5.4l-8 5z"/></svg>
        </a>
        <button id="theme-toggle" class="theme-toggle" aria-label="Toggle color theme">
          <svg class="icon icon-sun" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>
          <svg class="icon icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        </button>
        <button id="nav-toggle" class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">≡</button>
      </div>
    </div>
    <ul id="nav-menu" class="nav-menu">
      <li><a href="#home">Home</a></li>
      <li><a href="#about">About</a></li>
      <li><a href="#skills">Skills</a></li>
      <li><a href="#experience">Experience</a></li>
      <li><a href="#projects">Projects</a></li>
      <li><a href="#blogs">Blogs</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
  </header>

  <!-- Right-side vertical rail nav -->
  <nav id="rail" class="rail" aria-label="Section navigation">
    <a href="#home" data-label="Home" class="rail-dot active" aria-label="Home"><span></span></a>
    <a href="#about" data-label="About" class="rail-dot" aria-label="About"><span></span></a>
    <a href="#skills" data-label="Skills" class="rail-dot" aria-label="Skills"><span></span></a>
    <a href="#experience" data-label="Experience" class="rail-dot" aria-label="Experience"><span></span></a>
    <a href="#projects" data-label="Projects" class="rail-dot" aria-label="Projects"><span></span></a>
    <a href="#blogs" data-label="Blogs" class="rail-dot" aria-label="Blogs"><span></span></a>
    <a href="#contact" data-label="Contact" class="rail-dot" aria-label="Contact"><span></span></a>
  </nav>

  <main>

    <!-- Hero -->
    <section id="home" class="hero">
      <div class="container hero-grid">
        <div class="hero-left">
          <p id="kernel" class="kernel"><span class="k-dot"></span>SYSTEM.KERNEL :: v1.0.0 ONLINE</p>
          <p class="hero-hello">Hello, I'm</p>
          <h1 class="hero-name">Nguyen Gia Huy</h1>
          <p class="hero-role">&gt; <span id="typed-role" class="accent">DevOps Engineer</span><span class="cursor">_</span></p>
          <p class="hero-tagline">Automating Infrastructure Beyond Boundaries</p>
          <div class="hero-cta">
            <a class="btn btn-primary" href="#about">&gt; Initialize OS</a>
            <a class="btn" href="https://github.com/HuyNguyen260398" target="_blank" rel="noopener noreferrer">&gt; Check out GitHub</a>
          </div>
        </div>
        <div class="hero-right">
          <div class="term code-card">
            <div class="term-bar">
              <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
              <span class="term-title">about-me.tf</span>
            </div>
            <pre class="code-body"><code><span class="code-kw">resource</span> <span class="code-str">"devops_engineer"</span> <span class="code-str">"huy"</span> {
  name       = <span class="code-str">"Nguyen Gia Huy"</span>
  location   = <span class="code-str">"Ho Chi Minh City, VN"</span>
  experience = <span class="code-num">5</span> <span class="code-cm"># years</span>
  focus      = [<span class="code-str">"CI/CD"</span>, <span class="code-str">"GitOps"</span>, <span class="code-str">"IaC"</span>]
  stack      = [<span class="code-str">"AWS"</span>, <span class="code-str">"Azure"</span>, <span class="code-str">"Kubernetes"</span>]
  status     = <span class="code-str">"available"</span>
}</code></pre>
          </div>
        </div>
      </div>
    </section>

    <!-- @about+skills -->

    <!-- @experience+projects -->

    <!-- @blogs+contact -->

  </main>

  <footer class="footer">
    <div class="container">
      <p class="prompt">exit 0</p>
      <p>© <span id="year">2026</span> Nguyen Gia Huy — DevOps Engineer</p>
      <div class="footer-social">
        <a class="icon-link" href="https://github.com/HuyNguyen260398" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
        </a>
        <a class="icon-link" href="https://www.linkedin.com/in/huy-nguyen-966488189" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.07 1.4-2.07 2.85V21H9z"/></svg>
        </a>
        <a class="icon-link" href="mailto:huynguyen2603989@gmail.com" aria-label="Email">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 .4v.6l8 5 8-5V5.4l-8 5z"/></svg>
        </a>
      </div>
    </div>
  </footer>

  <a href="#home" id="scroll-top" class="scroll-top" aria-label="Back to top">↑</a>

  <script src="assets/js/terminal.js"></script>
</body>

</html>
```

- [ ] **Step 2: Write `src/aws-s3-web/assets/css/terminal.css` (foundation — later tasks append)**

```css
/* ============================================================
   GitHub-themed terminal portfolio — terminal.css
   ============================================================ */

/* ---- Dark tokens (default) ---- */
:root {
  --bg: #0d1117;
  --bg-subtle: #161b22;
  --bg-elev: #1c2128;
  --border: #30363d;
  --text: #c9d1d9;
  --text-bright: #e6edf3;
  --text-dim: #8b949e;
  --link: #58a6ff;
  --green: #3fb950;
  --amber: #d29922;
  --red: #f85149;
  --purple: #bc8cff;
  --shadow: rgba(1, 4, 9, 0.6);
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* ---- Light tokens ---- */
:root[data-theme="light"] {
  --bg: #ffffff;
  --bg-subtle: #f6f8fa;
  --bg-elev: #eaeef2;
  --border: #d0d7de;
  --text: #1f2328;
  --text-bright: #010409;
  --text-dim: #59636e;
  --link: #0969da;
  --green: #1a7f37;
  --amber: #9a6700;
  --red: #cf222e;
  --purple: #8250df;
  --shadow: rgba(140, 149, 159, 0.3);
}
/* No-JS light-preference users (JS always stamps data-theme, so this is the fallback) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #ffffff;
    --bg-subtle: #f6f8fa;
    --bg-elev: #eaeef2;
    --border: #d0d7de;
    --text: #1f2328;
    --text-bright: #010409;
    --text-dim: #59636e;
    --link: #0969da;
    --green: #1a7f37;
    --amber: #9a6700;
    --red: #cf222e;
    --purple: #8250df;
    --shadow: rgba(140, 149, 159, 0.3);
  }
}

* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 72px; }
body {
  background: var(--bg); color: var(--text);
  font-family: var(--sans); font-size: 15px; line-height: 1.7;
  transition: background .3s ease, color .3s ease;
}

img { max-width: 100%; display: block; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }

.container { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
.section { padding: 96px 0; }
.accent { color: var(--green); }
.blue { color: var(--link); }
.comment { color: var(--text-dim); }

/* Blinking cursor */
.cursor { display: inline-block; color: var(--green); animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.reduced-motion .cursor { animation: none; }

/* Section heading (terminal-style, monospace) */
.section-head { margin-bottom: 40px; font-family: var(--mono); }
.section-head h2 { color: var(--text-bright); font-size: 24px; font-weight: 700; }
.section-head .comment { display: block; font-size: 13px; margin-top: 6px; }

/* Terminal window */
.term { background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.term-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-elev); border-bottom: 1px solid var(--border); }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot-r { background: var(--red); } .dot-a { background: var(--amber); } .dot-g { background: var(--green); }
.term-title { margin-left: 10px; font-size: 12px; color: var(--text-dim); font-family: var(--mono); }
.term-body { padding: 26px; }

/* Prompt + monospace helpers */
.prompt { font-family: var(--mono); }
.prompt::before { content: 'huy@aws:~$ '; color: var(--green); font-weight: 600; }

/* Buttons */
.btn {
  display: inline-block; padding: 10px 18px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-subtle); color: var(--text-bright); font-family: var(--mono); font-size: 14px;
  cursor: pointer; transition: border-color .2s, color .2s, box-shadow .2s, background .2s;
}
.btn:hover { border-color: var(--green); color: var(--green); text-decoration: none; box-shadow: 0 0 12px var(--shadow); }
.btn-primary { border-color: var(--green); color: var(--bg); background: var(--green); }
.btn-primary:hover { background: transparent; color: var(--green); }

/* Key-value list */
.kv { font-family: var(--mono); font-size: 14px; }
.kv div { display: flex; gap: 8px; }
.kv dt { color: var(--link); min-width: 92px; }
.kv dt::after { content: ':'; }
.kv dd { color: var(--text-bright); word-break: break-word; }

/* Inline SVG icons */
.icon { width: 20px; height: 20px; display: block; }
.icon-link { color: var(--text-dim); display: inline-flex; }
.icon-link:hover { color: var(--green); }

/* Scroll reveal */
.reveal { opacity: 0; transform: translateY(18px); transition: opacity .6s ease, transform .6s ease; }
.reveal.visible { opacity: 1; transform: none; }
.no-js .reveal, .reduced-motion .reveal { opacity: 1; transform: none; }

/* ---------- Top bar ---------- */
.topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px); border-bottom: 1px solid var(--border);
}
.topbar-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
.brand { color: var(--text-bright); font-weight: 700; font-size: 18px; font-family: var(--mono); }
.brand:hover { text-decoration: none; }
.topbar-right { display: flex; align-items: center; gap: 14px; }
.theme-toggle, .nav-toggle {
  background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--text-bright);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 6px;
}
.theme-toggle:hover, .nav-toggle:hover { border-color: var(--green); color: var(--green); }
.nav-toggle { display: none; font-size: 18px; padding: 2px 10px; font-family: var(--mono); }
/* sun in light, moon in dark */
.icon-moon { display: none; } .icon-sun { display: block; }
:root[data-theme="dark"] .icon-sun { display: none; }
:root[data-theme="dark"] .icon-moon { display: block; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .icon-sun { display: none; }
  :root:not([data-theme="light"]) .icon-moon { display: block; }
}

.nav-menu { display: none; list-style: none; }
@media (max-width: 820px) {
  .nav-toggle { display: inline-flex; }
  .nav-menu {
    position: absolute; top: 56px; left: 0; right: 0; flex-direction: column;
    background: var(--bg-subtle); border-bottom: 1px solid var(--border); padding: 10px 24px;
  }
  .nav-menu.open { display: flex; }
  .nav-menu a { display: block; padding: 8px 0; color: var(--text); font-family: var(--mono); font-size: 14px; }
  .nav-menu a:hover { color: var(--green); text-decoration: none; }
}

/* ---------- Right rail nav ---------- */
.rail {
  position: fixed; right: 22px; top: 50%; transform: translateY(-50%); z-index: 900;
  display: flex; flex-direction: column; gap: 18px;
}
.rail-dot { position: relative; display: flex; align-items: center; justify-content: flex-end; }
.rail-dot span {
  width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--text-dim);
  background: transparent; transition: all .2s;
}
.rail-dot:hover span, .rail-dot.active span { background: var(--green); border-color: var(--green); }
.rail-dot.active span { box-shadow: 0 0 8px var(--green); }
.rail-dot::before {
  content: attr(data-label); position: absolute; right: 20px; white-space: nowrap;
  font-family: var(--mono); font-size: 12px; color: var(--text-bright);
  background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 5px;
  padding: 2px 8px; opacity: 0; transform: translateX(6px); pointer-events: none; transition: all .2s;
}
.rail-dot:hover::before { opacity: 1; transform: translateX(0); }
@media (max-width: 900px) { .rail { display: none; } }

/* ---------- Hero ---------- */
.hero { min-height: 100vh; display: flex; align-items: center; padding-top: 56px; }
.hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.kernel { font-family: var(--mono); font-size: 12px; color: var(--green); display: flex; align-items: center; gap: 8px; letter-spacing: 1px; }
.k-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); }
.hero-hello { margin-top: 18px; color: var(--text-dim); font-family: var(--mono); }
.hero-name { color: var(--text-bright); font-size: clamp(34px, 6vw, 60px); font-weight: 700; letter-spacing: -1px; margin: 4px 0 10px; }
.hero-role { font-family: var(--mono); font-size: clamp(16px, 2.4vw, 22px); }
.hero-tagline { margin-top: 14px; color: var(--text-dim); font-size: 16px; }
.hero-cta { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 30px; }
.code-card { box-shadow: 0 12px 40px var(--shadow); }
.code-body { padding: 20px; overflow-x: auto; font-family: var(--mono); font-size: 13px; line-height: 1.9; color: var(--text); }
.code-kw { color: var(--purple); } .code-str { color: var(--link); } .code-num { color: var(--amber); } .code-cm { color: var(--text-dim); }
@media (max-width: 820px) { .hero-grid { grid-template-columns: 1fr; gap: 32px; } }

/* ---------- Footer / scroll top ---------- */
.footer { border-top: 1px solid var(--border); padding: 40px 0; text-align: center; color: var(--text-dim); font-size: 13px; }
.footer .prompt { margin-bottom: 6px; }
.footer-social { display: flex; justify-content: center; gap: 18px; margin-top: 16px; }
.scroll-top {
  position: fixed; right: 18px; bottom: 18px; width: 42px; height: 42px; z-index: 850;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-elev);
  color: var(--green); font-size: 20px; opacity: 0; pointer-events: none; transition: opacity .3s;
}
.scroll-top.show { opacity: 1; pointer-events: auto; }
.scroll-top:hover { border-color: var(--green); text-decoration: none; }
.no-js .scroll-top { opacity: 1; pointer-events: auto; }
```

- [ ] **Step 3: Verify the page serves with the scaffold**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'theme-toggle\|rail-dot\|hero-name\|about-me.tf\|data-theme'
```
Expected: a number ≥ 5. Open `http://localhost:8080/` in a browser: two-column hero (text + Terraform code card), fixed top bar with brand + social + sun/moon toggle, a right-edge column of dots. Toggle won't work yet (JS is Task 5) but the head script means the page loads in the system theme without flashing. With JS off the page is fully visible.

- [ ] **Step 4: Kill server and commit**

```bash
kill %1
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): github-themed scaffold — top bar, right rail, hero, theme tokens"
```

---

### Task 2: `# About.system` + `# Skills.json` sections (markup + CSS)

**Files:**
- Modify: `src/aws-s3-web/index.html` (replace `<!-- @about+skills -->`)
- Modify: `src/aws-s3-web/assets/css/terminal.css` (append)

**Interfaces:**
- Consumes Task 1 classes: `.section`, `.section-head`, `.term*`, `.kv`, `.btn`, `.reveal`, `.comment`, `.accent`, `.blue`, `.code-*`.
- Produces for Task 5/6 JS: `#skills-stage` (physics stage), `.badge[data-color]` (draggable badge elements with inline SVG logos), `.skills-static` (static grid wrapper shown under no-js/reduced-motion), `.skills-json` (JSON fallback block). Skill levels live in the JSON block text.

- [ ] **Step 1: Replace `<!-- @about+skills -->` in `index.html` with:**

```html
    <!-- About.system -->
    <section id="about" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2># About.system</h2>
          <span class="comment"># operator profile — cat /etc/operator</span>
        </div>
        <div class="term reveal">
          <div class="term-bar">
            <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
            <span class="term-title">about.system — ~/huy</span>
          </div>
          <div class="term-body about-grid">
            <div class="about-photo">
              <img src="assets/img/profile-img-main.jpg" alt="Portrait of Nguyen Gia Huy">
            </div>
            <div class="about-text">
              <dl class="kv about-kv">
                <div><dt>Operator</dt><dd>Nguyen Gia Huy</dd></div>
                <div><dt>Role</dt><dd>DevOps Engineer</dd></div>
                <div><dt>Location</dt><dd>Ho Chi Minh City, Viet Nam</dd></div>
                <div><dt>Status</dt><dd><span class="accent">● Online</span> — open to opportunities</dd></div>
              </dl>
              <p class="about-bio">I'm a DevOps Engineer with 5 years of hands-on experience automating infrastructure, optimizing CI/CD pipelines, and shipping scalable cloud deployments across AWS and Azure. I bridge development and operations to deliver reliable, high-performing systems — and I'm currently focused on enhancing automation, predictive monitoring, and intelligent workflows with agentic AI.</p>
              <a class="btn btn-primary" href="https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf" download="Nguyen-Gia-Huy-DevOps-Engineer.pdf" target="_blank" rel="noopener noreferrer">&gt; wget resume.pdf</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Skills.json -->
    <section id="skills" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2># Skills.json</h2>
          <span class="comment"># drag to explore skills universe</span>
        </div>
        <div class="term reveal">
          <div class="term-bar">
            <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
            <span class="term-title">skills-universe — drag to explore</span>
          </div>
          <div class="skills-body">
            <div id="skills-stage" class="skills-stage" aria-hidden="true">
              <span class="badge" data-color="#FF9900" style="left:8%;top:20%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.8 9.9c0 .3 0 .6.1.8.1.2.2.4.3.6 0 .1.1.1.1.2s0 .1-.1.2l-.5.3h-.2c-.1 0-.2-.1-.3-.2l-.3-.4-.2-.5c-.6.7-1.4 1.1-2.3 1.1-.7 0-1.2-.2-1.6-.6-.4-.4-.6-.9-.6-1.5 0-.7.2-1.2.7-1.6.5-.4 1.1-.6 2-.6.3 0 .6 0 .9.1.3 0 .6.1.9.2v-.6c0-.6-.1-1-.4-1.2-.3-.2-.7-.4-1.3-.4-.3 0-.5 0-.8.1-.3.1-.5.1-.8.3h-.3s-.2 0-.2-.3v-.4c0-.1 0-.2.1-.3 0 0 .1-.1.3-.1.3-.1.6-.2 1-.3.4-.1.8-.1 1.2-.1.9 0 1.6.2 2 .6.4.4.6 1 .6 1.9zM4 11.4c.3 0 .5 0 .8-.1.3-.1.5-.3.7-.5.1-.1.2-.3.3-.5v-.7c-.2-.1-.5-.1-.7-.2h-.7c-.5 0-.9.1-1.1.3-.2.2-.4.5-.4.8 0 .3.1.6.3.7.1.3.4.4.8.4zm7.9 1.1c-.1 0-.2 0-.3-.1 0 0-.1-.1-.2-.3l-1.6-5.3v-.3c0-.1.1-.2.2-.2h.7c.2 0 .3 0 .3.1 0 0 .1.1.2.3l1.1 4.5 1.1-4.5c0-.2.1-.3.2-.3.1-.1.2-.1.3-.1h.6c.2 0 .3 0 .3.1.1 0 .1.1.2.3l1.1 4.6 1.2-4.6c0-.2.1-.3.2-.3.1-.1.2-.1.3-.1h.7c.1 0 .2.1.2.2v.3l-1.7 5.3c0 .2-.1.3-.2.3-.1.1-.2.1-.3.1h-.7c-.2 0-.3 0-.3-.1-.1-.1-.1-.2-.2-.3l-1.1-4.4-1.1 4.4c0 .2-.1.3-.2.3 0 .1-.2.1-.3.1zm11.5.2c-.4 0-.8 0-1.2-.1-.4-.1-.6-.2-.8-.3-.1-.1-.2-.2-.2-.2v-.5c0-.2.1-.3.2-.3h.2c.1 0 .1 0 .2.1.3.1.5.2.8.3.3.1.6.1.9.1.5 0 .8-.1 1.1-.2.2-.2.4-.4.4-.7 0-.2-.1-.4-.2-.5-.1-.1-.4-.3-.8-.4l-1.1-.3c-.6-.2-1-.4-1.2-.8-.2-.3-.4-.6-.4-1 0-.3.1-.5.2-.8.1-.2.3-.4.5-.6.2-.2.5-.3.8-.4.3-.1.6-.1 1-.1.2 0 .3 0 .5.1h.5c.1 0 .3.1.4.1.1 0 .2.1.3.1.1.1.2.1.2.2 0 .1.1.1.1.3v.4c0 .2-.1.3-.2.3-.1 0-.2 0-.4-.1-.5-.2-1-.3-1.5-.3-.4 0-.8.1-1 .2-.2.1-.3.4-.3.7 0 .2.1.4.2.5.2.1.4.3.9.4l1 .3c.5.2.9.4 1.2.7.2.3.4.6.4 1 0 .3-.1.6-.2.8-.1.3-.3.5-.5.6-.2.2-.5.3-.8.4-.4.2-.7.2-1.1.2z"/><path fill="currentColor" d="M22.7 17.7c-2.7 2-6.7 3.1-10.1 3.1-4.8 0-9.1-1.8-12.3-4.7-.3-.2 0-.6.3-.4 3.5 2 7.8 3.2 12.2 3.2 3 0 6.3-.6 9.3-1.9.5-.2.9.3.4.7zm1.1-1.3c-.3-.4-2.3-.2-3.2-.1-.3 0-.3-.2-.1-.4 1.6-1.1 4.2-.8 4.5-.4.3.4-.1 3-1.6 4.2-.2.2-.4.1-.3-.2.3-.8 1-2.7.7-3.1z"/></svg><span>AWS</span></span>
              <span class="badge" data-color="#0078D4" style="left:30%;top:12%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.1 3.5 6.6 20.2h4.7l1.2-3.6h5.4L13.1 3.5zM5.2 21.4 11 5.9l-3.4-.4L1 18.7l4.2 2.7z"/></svg><span>Azure</span></span>
              <span class="badge" data-color="#2496ED" style="left:54%;top:16%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 9.3h2.4v2.2h-2.4zm-3 0h2.4v2.2h-2.4zm-3 0h2.4v2.2H7.5zm-3 0h2.4v2.2H4.5zm3-2.9h2.4v2.2H7.5zm3 0h2.4v2.2h-2.4zm3 0h2.4v2.2h-2.4zm9.5 3.2c-.5-.3-1.5-.5-2.2-.3-.1-.7-.5-1.3-1.1-1.8l-.4-.3-.3.4c-.4.6-.6 1.5-.5 2.2 0 .3.1.7.3 1-.4.2-1 .3-1.6.3H1.2l-.1.5c-.2 1.4.1 2.9.9 4 .8 1.1 2.1 1.6 3.8 1.6 3.7 0 6.5-1.7 7.8-4.8 1 0 3-.1 4-2l.1-.2-.5-.3z"/></svg><span>Docker</span></span>
              <span class="badge" data-color="#326CE5" style="left:76%;top:24%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5 3.3 5.7 1.2 15l6 7.5h9.6l6-7.5-2.1-9.3zm0 4.2 5.8 2.8.9 4-2.6 3.2h-8.2L5.3 12.5l.9-4zm0 2.3-3.3 2.4 1.3 3.9h4l1.3-3.9z"/></svg><span>Kubernetes</span></span>
              <span class="badge" data-color="#7B42BC" style="left:14%;top:56%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.5 5.3 14 8.5v6.3l-5.5-3.2zm6.2 3.2 5.3-3.1v6.3l-5.3 3.1zM2.3 2v6.3l5.5 3.2V5.2zm6.2 10.3 5.5 3.2V22l-5.5-3.2z"/></svg><span>Terraform</span></span>
              <span class="badge" data-color="#EE0000" style="left:38%;top:60%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.6 14.6c-.3.6-1.4.9-3.6-.1-1.7.7-3.6 1-5.2.7l1.9-4.7 1.5 3.3c.9-.4 1.7-.9 2.4-1.5-.4-.5-.7-1.1-.9-1.8.6 1 1.6 1.9 2.8 2.5.3.6.7 1.1 1.1 1.9zM11 8.3l1.4 3.4-2.4-1z"/></svg><span>Ansible</span></span>
              <span class="badge" data-color="#3776AB" style="left:60%;top:58%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.9 2c-1 0-2 .1-2.8.3-2.4.4-2.8 1.3-2.8 3v2.2h5.6v.7H3.9c-1.7 0-3.2 1-3.7 3-.5 2.2-.5 3.6 0 5.9.4 1.7 1.4 3 3.1 3h1.9v-2.7c0-1.9 1.7-3.6 3.7-3.6h5.6c1.6 0 2.8-1.3 2.8-3V5.3c0-1.6-1.3-2.8-2.8-3.1-1-.2-2-.2-2.9-.2zM8.8 3.8c.6 0 1 .5 1 1s-.5 1-1 1-1-.5-1-1 .5-1 1-1z"/><path fill="currentColor" d="M18.6 8.2v2.6c0 2-1.7 3.7-3.7 3.7H9.3c-1.5 0-2.8 1.3-2.8 2.8v5.3c0 1.6 1.4 2.5 2.8 2.9 1.7.5 3.4.6 5.6 0 1.4-.4 2.8-1.2 2.8-2.9v-2.2h-5.6v-.7h8.4c1.6 0 2.2-1.1 2.8-2.9.6-1.8.5-3.5 0-5.9-.4-1.7-1.2-2.9-2.8-2.9zm-3.2 12.4c.6 0 1 .5 1 1s-.4 1-1 1c-.5 0-1-.5-1-1s.5-1 1-1z"/></svg><span>Python</span></span>
              <span class="badge" data-color="#FCC624" style="left:80%;top:56%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3c.6 0 1 .6.9 1.4-.1.5.1.9.4 1.3.5.6.5 1.4.2 2-.2.4-.2.9.1 1.3.5.7 1.3 1 2.1.9.7-.1 1.2.6 1 1.3-.2.6-.1 1.2.3 1.7.5.6.2 1.5-.5 1.7-.6.2-1 .7-1.1 1.3-.1.8-.9 1.2-1.6.9-.5-.3-1.2-.2-1.6.2-.6.5-1.5.3-1.8-.4-.2-.5-.7-.8-1.3-.8s-1.1.3-1.3.8c-.3.7-1.2.9-1.8.4-.4-.4-1.1-.5-1.6-.2-.7.3-1.5-.1-1.6-.9-.1-.6-.5-1.1-1.1-1.3-.7-.2-1-1.1-.5-1.7.4-.5.5-1.1.3-1.7-.2-.7.3-1.4 1-1.3.8.1 1.6-.2 2.1-.9.3-.4.3-.9.1-1.3-.3-.6-.3-1.4.2-2 .3-.4.5-.8.4-1.3C11 5.6 11.4 5 12 5z"/></svg><span>Linux</span></span>
              <span class="badge" data-color="#D24939" style="left:24%;top:34%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 4.5c1.2-.4 2.5.1 3.1 1.1.3.6.4 1.3.2 1.9l1.3 3.6c.3.9-.1 1.9-1 2.3-.9.3-1.9-.1-2.3-1l-1.2-3.4c-.6-.1-1.1-.5-1.4-1-.6-1.2-.1-2.7 1.3-3.5z"/></svg><span>Jenkins</span></span>
              <span class="badge" data-color="#F05032" style="left:48%;top:36%"><svg class="badge-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 11 13 1a1.4 1.4 0 0 0-2 0L8.9 3.1l2.6 2.6a1.7 1.7 0 0 1 2.1 2.1l2.5 2.5a1.7 1.7 0 1 1-1 1l-2.3-2.4v6.1a1.7 1.7 0 1 1-1.4 0V9a1.7 1.7 0 0 1-.9-2.2L7.5 4.2 1 10.7a1.4 1.4 0 0 0 0 2l10 10a1.4 1.4 0 0 0 2 0l10-9.7a1.4 1.4 0 0 0 0-2z"/></svg><span>Git</span></span>
            </div>
            <div class="skills-static" aria-hidden="false">
              <p class="skills-static-hint comment"># skills (drag disabled — static view)</p>
            </div>
            <p class="skills-hint comment">&lt; drag to explore the skills universe &gt;</p>
          </div>
        </div>
        <pre class="skills-json reveal"><code>{
  <span class="code-str">"aws"</span>:        <span class="code-num">90</span>,
  <span class="code-str">"python"</span>:     <span class="code-num">90</span>,
  <span class="code-str">"git"</span>:        <span class="code-num">85</span>,
  <span class="code-str">"ansible"</span>:    <span class="code-num">80</span>,
  <span class="code-str">"docker"</span>:     <span class="code-num">80</span>,
  <span class="code-str">"jenkins"</span>:    <span class="code-num">80</span>,
  <span class="code-str">"terraform"</span>:  <span class="code-num">75</span>,
  <span class="code-str">"linux"</span>:      <span class="code-num">75</span>,
  <span class="code-str">"kubernetes"</span>: <span class="code-num">70</span>,
  <span class="code-str">"azure"</span>:      <span class="code-num">60</span>
}</code></pre>
      </div>
    </section>
```

- [ ] **Step 2: Append to `terminal.css`:**

```css
/* ---------- About.system ---------- */
.about-grid { display: grid; grid-template-columns: 240px 1fr; gap: 32px; align-items: start; }
.about-photo img { border-radius: 10px; border: 1px solid var(--border); }
.about-kv { display: grid; gap: 8px; margin-bottom: 18px; }
.about-bio { margin-bottom: 22px; }
@media (max-width: 760px) {
  .about-grid { grid-template-columns: 1fr; }
  .about-photo { max-width: 220px; }
}

/* ---------- Skills.json ---------- */
.skills-body { position: relative; }
.skills-stage {
  position: relative; height: 380px; overflow: hidden; touch-action: none;
  background:
    radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--green) 6%, transparent), transparent 60%),
    var(--bg-subtle);
}
.badge {
  position: absolute; display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px; font-family: var(--mono); font-size: 13px;
  color: var(--text-bright); background: var(--bg-elev);
  border: 1px solid color-mix(in srgb, var(--badge-c, var(--border)) 60%, var(--border));
  box-shadow: 0 0 14px color-mix(in srgb, var(--badge-c, transparent) 30%, transparent);
  cursor: grab; user-select: none; white-space: nowrap; will-change: transform;
}
.badge:active { cursor: grabbing; }
.badge-ic { width: 18px; height: 18px; color: var(--badge-c, var(--green)); }
.skills-hint { text-align: center; font-size: 12px; padding: 12px 0; }
.skills-static { display: none; padding: 24px; }
.skills-static-hint { margin-bottom: 14px; }
.skills-static.show { display: block; }
.skills-static.show ~ .skills-hint { display: none; }
.skills-static .badge { position: static; }
.skills-static .badge-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.no-js .skills-stage, .reduced-motion .skills-stage { display: none; }

.skills-json {
  margin-top: 24px; background: var(--bg-subtle); border: 1px solid var(--border);
  border-radius: 10px; padding: 20px 24px; overflow-x: auto;
  font-family: var(--mono); font-size: 13px; line-height: 1.9; color: var(--text);
}
```

- [ ] **Step 3: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'class="badge"'
curl -s http://localhost:8080/ | grep -c 'about-grid\|skills-json'
kill %1
```
Expected: `10` badges, `2` (about-grid + skills-json). Browser: About terminal with photo + Operator/Role/Location/Status; Skills section shows the stage with 10 brand-logo badges scattered (static until Task 6) and a JSON skills block below.

- [ ] **Step 4: Commit**

```bash
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): About.system and Skills.json sections with badge stage"
```

---

### Task 3: `$ git log --stat --oneline` experience + `$ ls -la ~/projects` (static fallback cards)

**Files:**
- Modify: `src/aws-s3-web/index.html` (replace `<!-- @experience+projects -->`)
- Modify: `src/aws-s3-web/assets/css/terminal.css` (append)

**Interfaces:**
- Consumes Task 1 classes: `.section`, `.section-head`, `.reveal`, `.accent`, `.blue`, `.comment`.
- Produces for Task 7 JS: `#repo-grid` (container the fetch re-renders), `.repo-card` (fallback card shape the JS also emits), the star/fork inline SVGs, `.repo-lang` dot markup. Task 7 rebuilds `#repo-grid` innerHTML from fetched JSON using these same class names.

- [ ] **Step 1: Replace `<!-- @experience+projects -->` in `index.html` with:**

```html
    <!-- Experience: git log --stat --oneline -->
    <section id="experience" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2>$ git log --stat --oneline</h2>
          <span class="comment"># career history — 11 commits</span>
        </div>
        <ol class="git-log">
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">f4c3a9e</span><span class="ref">(HEAD -&gt; main)</span><span class="commit-date">Jan 2020 – Present</span></div>
            <h3>DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technologies Viet Nam</p>
            <ul>
              <li>DevOps engineer with a strong progression from automation development to large-scale CI/CD infrastructure supporting multiple embedded teams.</li>
              <li>Skilled in building automation solutions with Jenkins, Groovy, Python, Helm, and Ansible across Powertrain, Splunk, and Active Safety domains.</li>
              <li>Experienced in maintaining CI infrastructure on Azure Cloud with Kubernetes, ArgoCD, and Terraform.</li>
              <li>Collaborates with teams in Germany, India, China, and Hungary to deliver reliable pipelines and scalable infrastructure.</li>
              <li>Proactively researching early adoption of agentic AI to enhance DevOps workflows.</li>
            </ul>
            <p class="stat">6 files changed, 512 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">e7d21b8</span><span class="commit-date">Oct 2025 – Dec 2025</span></div>
            <h3>AWS CloudOps Agent — Leader</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Leading development of an intelligent agentic AI system powered by AWS Bedrock AgentCore and the AWS Strands Agent SDK for autonomous AWS cloud operations management.</li>
            </ul>
            <p class="stat">2 files changed, 180 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">c9a54f3</span><span class="commit-date">Sep 2025 – Dec 2025</span></div>
            <h3>MCP Server for DevOps — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Conducting research and early implementation of agentic AI in DevOps.</li>
              <li>Developing an MCP server to explore intelligent automation capabilities.</li>
            </ul>
            <p class="stat">3 files changed, 120 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">b3e8d17</span><span class="commit-date">Jun 2025 – Dec 2025</span></div>
            <h3>CI/CD Infrastructure in K8S — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Received knowledge transfer from the Hungary team to operate and maintain Jenkins systems on Azure Cloud.</li>
              <li>Leveraged Kubernetes and ArgoCD for GitOps-based deployments.</li>
              <li>Maintained Azure cloud infrastructure with Terraform.</li>
            </ul>
            <p class="stat">4 files changed, 260 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">a1f6c42</span><span class="commit-date">Jun 2024 – Dec 2025</span></div>
            <h3>Jenkins CI/CD Pipelines for DE ActiveSafety Team — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Enhanced Jenkins pipelines using custom Python libraries.</li>
              <li>Implemented Jenkins Infrastructure as Code with Helm.</li>
            </ul>
            <p class="stat">3 files changed, 210 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">98d3e5b</span><span class="commit-date">Jan 2024 – Jun 2024</span></div>
            <h3>Splunk &amp; CI Infrastructure — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Supported the Splunk team setting up and optimizing Jenkins pipelines for log analytics and monitoring.</li>
              <li>Maintained and improved CI infrastructure for German projects, including Jenkins, Grafana, and Prometheus.</li>
            </ul>
            <p class="stat">3 files changed, 175 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">87c2f9a</span><span class="commit-date">Jan 2021 – Jun 2024</span></div>
            <h3>Jenkins CI/CD Pipelines for DE PowerTrain Team — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Transitioned into the DevOps team, working closely with colleagues in Germany on large-scale automotive software.</li>
              <li>Designed and implemented CI/CD pipelines with Jenkins and Groovy for automated build, test, and deployment.</li>
              <li>May 2023: onsite trip to Bosch Abstatt to work closely with German colleagues.</li>
            </ul>
            <p class="stat">5 files changed, 340 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">76b1e48</span><span class="commit-date">Apr 2020 – Jan 2021</span></div>
            <h3>KPI Dashboard — Automation Tool Developer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Collaborated with China-based software PCMs and managers to design and deliver KPI dashboards using PowerBI and SQL.</li>
              <li>Improved visibility into project performance through data visualization.</li>
            </ul>
            <p class="stat">2 files changed, 90 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">65a9d37</span><span class="commit-date">Apr 2020 – Jan 2021</span></div>
            <h3>Automation Tool Developer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Developed automation applications in C# and Python to streamline workflow and process management on Jira.</li>
              <li>Supported embedded teams in India and Germany.</li>
            </ul>
            <p class="stat">3 files changed, 150 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">54f8c26</span><span class="commit-date">Jan 2020 – Apr 2020</span></div>
            <h3>Python Intern — Embedded Automation Tools</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Supported senior engineers developing internal tools and improving code quality.</li>
            </ul>
            <p class="stat">1 file changed, 40 insertions(+)</p>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">43e7b15</span><span class="ref">(tag: education)</span><span class="commit-date">2017 – 2020</span></div>
            <h3>Bachelor of Information Technology</h3>
            <p class="org">University of Greenwich, Viet Nam</p>
            <ul>
              <li>GPA: 3.6 / 4.0</li>
            </ul>
            <p class="stat">1 file changed, 20 insertions(+)</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Projects: ls -la ~/projects -->
    <section id="projects" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2>$ ls -la ~/projects</h2>
          <span class="comment"># pinned repositories — live from github.com/HuyNguyen260398</span>
        </div>
        <div id="repo-grid" class="repo-grid">
          <article class="repo-card reveal">
            <div class="repo-head">
              <svg class="repo-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5A1 1 0 0 0 4 15h9.25a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 14zM4.5 1.5A1 1 0 0 0 3.5 2.5v9.05c.3-.05.6-.05.99-.05h8.26V1.5z"/></svg>
              <h3><a href="https://github.com/HuyNguyen260398/devops-engineer-profile" target="_blank" rel="noopener noreferrer">devops-engineer-profile</a></h3>
            </div>
            <p class="repo-desc">devops-engineer-profile</p>
            <div class="repo-tags"><span class="tag">HCL</span><span class="tag">HTML</span><span class="tag">Python</span><span class="tag">PowerShell</span><span class="tag">Vue</span><span class="tag">CSS</span></div>
            <div class="repo-meta">
              <span class="repo-lang"><span class="lang-dot" style="background:#844FBA"></span>HCL</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .25l2.4 4.85 5.35.78-3.87 3.77.91 5.33L8 12.42 3.21 15l.91-5.33L.25 5.88l5.35-.78z"/></svg>1</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.25a1.75 1.75 0 1 0-2.5 1.58v6.34A1.75 1.75 0 1 0 5 12.75a1.75 1.75 0 0 0-1-1.58V8.5c.4.32.9.5 1.5.5H9a1.5 1.5 0 0 0 1.5-1.5v-2.42a1.75 1.75 0 1 0-1.5 0V7.5H5.5A.5.5 0 0 1 5 7V4.83c.6-.3 1-.9 1-1.58z"/></svg>0</span>
            </div>
          </article>
          <article class="repo-card reveal">
            <div class="repo-head">
              <svg class="repo-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5A1 1 0 0 0 4 15h9.25a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 14zM4.5 1.5A1 1 0 0 0 3.5 2.5v9.05c.3-.05.6-.05.99-.05h8.26V1.5z"/></svg>
              <h3><a href="https://github.com/HuyNguyen260398/aws-cloudops-agent" target="_blank" rel="noopener noreferrer">aws-cloudops-agent</a></h3>
            </div>
            <p class="repo-desc">A beginner-friendly AWS operations agent built with AWS Strands Agent SDK and Amazon Bedrock Claude 4 Sonnet.</p>
            <div class="repo-tags"><span class="tag">Python</span></div>
            <div class="repo-meta">
              <span class="repo-lang"><span class="lang-dot" style="background:#3572A5"></span>Python</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .25l2.4 4.85 5.35.78-3.87 3.77.91 5.33L8 12.42 3.21 15l.91-5.33L.25 5.88l5.35-.78z"/></svg>0</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.25a1.75 1.75 0 1 0-2.5 1.58v6.34A1.75 1.75 0 1 0 5 12.75a1.75 1.75 0 0 0-1-1.58V8.5c.4.32.9.5 1.5.5H9a1.5 1.5 0 0 0 1.5-1.5v-2.42a1.75 1.75 0 1 0-1.5 0V7.5H5.5A.5.5 0 0 1 5 7V4.83c.6-.3 1-.9 1-1.58z"/></svg>0</span>
            </div>
          </article>
          <article class="repo-card reveal">
            <div class="repo-head">
              <svg class="repo-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5A1 1 0 0 0 4 15h9.25a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 14zM4.5 1.5A1 1 0 0 0 3.5 2.5v9.05c.3-.05.6-.05.99-.05h8.26V1.5z"/></svg>
              <h3><a href="https://github.com/HuyNguyen260398/aws_resume_web_inf" target="_blank" rel="noopener noreferrer">aws_resume_web_inf</a></h3>
            </div>
            <p class="repo-desc">Cloudformation templates for aws resume web</p>
            <div class="repo-tags"><span class="tag">Python</span><span class="tag">PowerShell</span><span class="tag">Shell</span></div>
            <div class="repo-meta">
              <span class="repo-lang"><span class="lang-dot" style="background:#3572A5"></span>Python</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .25l2.4 4.85 5.35.78-3.87 3.77.91 5.33L8 12.42 3.21 15l.91-5.33L.25 5.88l5.35-.78z"/></svg>0</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.25a1.75 1.75 0 1 0-2.5 1.58v6.34A1.75 1.75 0 1 0 5 12.75a1.75 1.75 0 0 0-1-1.58V8.5c.4.32.9.5 1.5.5H9a1.5 1.5 0 0 0 1.5-1.5v-2.42a1.75 1.75 0 1 0-1.5 0V7.5H5.5A.5.5 0 0 1 5 7V4.83c.6-.3 1-.9 1-1.58z"/></svg>0</span>
            </div>
          </article>
          <article class="repo-card reveal">
            <div class="repo-head">
              <svg class="repo-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5A1 1 0 0 0 4 15h9.25a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 14zM4.5 1.5A1 1 0 0 0 3.5 2.5v9.05c.3-.05.6-.05.99-.05h8.26V1.5z"/></svg>
              <h3><a href="https://github.com/HuyNguyen260398/aws_resume_web_src" target="_blank" rel="noopener noreferrer">aws_resume_web_src</a></h3>
            </div>
            <p class="repo-desc">Source code of asw resume web</p>
            <div class="repo-tags"><span class="tag">HTML</span><span class="tag">CSS</span><span class="tag">JavaScript</span><span class="tag">PHP</span></div>
            <div class="repo-meta">
              <span class="repo-lang"><span class="lang-dot" style="background:#e34c26"></span>HTML</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .25l2.4 4.85 5.35.78-3.87 3.77.91 5.33L8 12.42 3.21 15l.91-5.33L.25 5.88l5.35-.78z"/></svg>0</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.25a1.75 1.75 0 1 0-2.5 1.58v6.34A1.75 1.75 0 1 0 5 12.75a1.75 1.75 0 0 0-1-1.58V8.5c.4.32.9.5 1.5.5H9a1.5 1.5 0 0 0 1.5-1.5v-2.42a1.75 1.75 0 1 0-1.5 0V7.5H5.5A.5.5 0 0 1 5 7V4.83c.6-.3 1-.9 1-1.58z"/></svg>0</span>
            </div>
          </article>
          <article class="repo-card reveal">
            <div class="repo-head">
              <svg class="repo-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5A1 1 0 0 0 4 15h9.25a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 14zM4.5 1.5A1 1 0 0 0 3.5 2.5v9.05c.3-.05.6-.05.99-.05h8.26V1.5z"/></svg>
              <h3><a href="https://github.com/HuyNguyen260398/aws-serverless-webapp" target="_blank" rel="noopener noreferrer">aws-serverless-webapp</a></h3>
            </div>
            <p class="repo-desc">A simple web app built on AWS Serverless Architecture</p>
            <div class="repo-tags"><span class="tag">TypeScript</span><span class="tag">HCL</span><span class="tag">JavaScript</span><span class="tag">CSS</span></div>
            <div class="repo-meta">
              <span class="repo-lang"><span class="lang-dot" style="background:#3178c6"></span>TypeScript</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .25l2.4 4.85 5.35.78-3.87 3.77.91 5.33L8 12.42 3.21 15l.91-5.33L.25 5.88l5.35-.78z"/></svg>0</span>
              <span class="repo-stat"><svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.25a1.75 1.75 0 1 0-2.5 1.58v6.34A1.75 1.75 0 1 0 5 12.75a1.75 1.75 0 0 0-1-1.58V8.5c.4.32.9.5 1.5.5H9a1.5 1.5 0 0 0 1.5-1.5v-2.42a1.75 1.75 0 1 0-1.5 0V7.5H5.5A.5.5 0 0 1 5 7V4.83c.6-.3 1-.9 1-1.58z"/></svg>0</span>
            </div>
          </article>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Append to `terminal.css`:**

```css
/* ---------- Experience: git log ---------- */
.git-log { list-style: none; position: relative; padding-left: 28px; }
.git-log::before { content: ''; position: absolute; left: 7px; top: 6px; bottom: 6px; width: 2px; background: var(--border); }
.commit { position: relative; padding-bottom: 40px; }
.commit:last-child { padding-bottom: 0; }
.commit::before {
  content: ''; position: absolute; left: -27px; top: 6px; width: 12px; height: 12px;
  border-radius: 50%; background: var(--bg); border: 2px solid var(--green);
}
.commit-line { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; font-family: var(--mono); font-size: 13px; margin-bottom: 6px; }
.hash { color: var(--amber); }
.ref { color: var(--purple); }
.commit-date { color: var(--text-dim); }
.commit h3 { color: var(--text-bright); font-size: 17px; margin-bottom: 2px; }
.commit .org { color: var(--text-dim); font-style: italic; font-size: 13px; margin-bottom: 8px; }
.commit ul { list-style: none; }
.commit ul li { padding-left: 18px; position: relative; }
.commit ul li::before { content: '-'; position: absolute; left: 0; color: var(--green); }
.commit .stat { color: var(--text-dim); font-family: var(--mono); font-size: 12px; margin-top: 8px; }
.commit .stat::before { content: '  '; }

/* ---------- Projects: repo cards ---------- */
.repo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.repo-card {
  background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 10px;
  padding: 20px 22px; display: flex; flex-direction: column; gap: 12px;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.repo-card:hover { border-color: var(--green); transform: translateY(-4px); box-shadow: 0 8px 28px var(--shadow); }
.repo-head { display: flex; align-items: center; gap: 8px; }
.repo-ic { width: 16px; height: 16px; color: var(--text-dim); }
.repo-head h3 { font-size: 15px; font-weight: 600; font-family: var(--mono); }
.repo-head a { color: var(--link); }
.repo-desc { font-size: 14px; flex: 1; }
.repo-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; color: var(--link); border: 1px solid var(--border); border-radius: 999px; padding: 1px 10px; font-family: var(--mono); }
.repo-meta { display: flex; align-items: center; gap: 18px; font-family: var(--mono); font-size: 12px; color: var(--text-dim); }
.repo-lang { display: inline-flex; align-items: center; gap: 6px; }
.lang-dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.repo-stat { display: inline-flex; align-items: center; gap: 4px; }
.mini-ic { width: 13px; height: 13px; }
```

- [ ] **Step 3: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'class="commit reveal"'
curl -s http://localhost:8080/ | grep -c 'repo-card'
kill %1
```
Expected: `11` commits, `5` repo cards. Browser: git-log timeline with green nodes, amber hashes, purple refs, `--stat` footers; 5 GitHub-style repo cards with language dot + star/fork counts.

- [ ] **Step 4: Commit**

```bash
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): git-log experience timeline and pinned-repo project cards"
```

---

### Task 4: `$ ls -la ~/blogs` (empty state) + `$ ./contact.exe`

**Files:**
- Modify: `src/aws-s3-web/index.html` (replace `<!-- @blogs+contact -->`)
- Modify: `src/aws-s3-web/assets/css/terminal.css` (append)

**Interfaces:**
- Consumes Task 1 classes: `.section`, `.section-head`, `.term*`, `.reveal`, `.prompt`, `.kv`, `.btn`, `.btn-primary`, `.code-*`, `.comment`.
- Produces: `.blogs-empty`, `.contact-grid`, `.contact-json`, `.term-form` (styling only — no JS hooks).

- [ ] **Step 1: Replace `<!-- @blogs+contact -->` in `index.html` with:**

```html
    <!-- Blogs: ls -la ~/blogs -->
    <section id="blogs" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2>$ ls -la ~/blogs</h2>
          <span class="comment"># pinned writing</span>
        </div>
        <div class="term reveal">
          <div class="term-bar">
            <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
            <span class="term-title">~/blogs</span>
          </div>
          <div class="term-body blogs-empty">
            <p class="prompt">ls -la ~/blogs</p>
            <p class="comment">total 0</p>
            <p class="comment"># No pinned blogs yet.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact: ./contact.exe -->
    <section id="contact" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2>$ ./contact.exe</h2>
          <span class="comment"># let's build something reliable together</span>
        </div>
        <div class="contact-grid">
          <div class="term reveal">
            <div class="term-bar">
              <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
              <span class="term-title">contact.json</span>
            </div>
            <pre class="contact-json"><code>{
  <span class="code-str">"email"</span>:    <span class="code-str">"huynguyen2603989@gmail.com"</span>,
  <span class="code-str">"github"</span>:   <span class="code-str">"@HuyNguyen260398"</span>,
  <span class="code-str">"linkedin"</span>: <span class="code-str">"huy-nguyen-966488189"</span>,
  <span class="code-str">"location"</span>: <span class="code-str">"Ho Chi Minh City, VN"</span>,
  <span class="code-str">"status"</span>:   <span class="code-str">"available"</span>
}</code></pre>
          </div>
          <div class="term reveal">
            <div class="term-bar">
              <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
              <span class="term-title">send-message.sh</span>
            </div>
            <div class="term-body">
              <form action="forms/contact.php" method="post" class="term-form">
                <label>&gt; name:
                  <input type="text" name="name" required>
                </label>
                <label>&gt; email:
                  <input type="email" name="email" required>
                </label>
                <label>&gt; subject:
                  <input type="text" name="subject" required>
                </label>
                <label>&gt; message:
                  <textarea name="message" rows="6" required></textarea>
                </label>
                <button type="submit" class="btn btn-primary">&gt; ./send-message.sh</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Append to `terminal.css`:**

```css
/* ---------- Blogs ---------- */
.blogs-empty { font-family: var(--mono); font-size: 14px; }
.blogs-empty .prompt { margin-bottom: 6px; }
.blogs-empty .comment + .comment { margin-top: 2px; }

/* ---------- Contact ---------- */
.contact-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 24px; align-items: start; }
.contact-json {
  padding: 22px; overflow-x: auto; font-family: var(--mono); font-size: 13px; line-height: 2; color: var(--text);
}
@media (max-width: 860px) { .contact-grid { grid-template-columns: 1fr; } }
.term-form { display: grid; gap: 16px; }
.term-form label { display: grid; gap: 6px; font-family: var(--mono); font-size: 13px; color: var(--link); }
.term-form input, .term-form textarea {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 10px 12px; color: var(--text-bright); font-family: var(--mono); font-size: 14px;
}
.term-form input:focus, .term-form textarea:focus { outline: none; border-color: var(--green); box-shadow: 0 0 10px var(--shadow); }
```

- [ ] **Step 3: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'No pinned blogs yet'
curl -s http://localhost:8080/ | grep -c 'forms/contact.php'
curl -s http://localhost:8080/ | grep -c 'certification\|certs'
kill %1
```
Expected: `1`, `1`, `0` (no certifications anywhere). Browser: blogs empty-state terminal; two-column contact (JSON block + terminal form).

- [ ] **Step 4: Commit**

```bash
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): blogs empty-state and contact.exe sections"
```

---

### Task 5: `terminal.js` — theme toggle, kernel boot, typed role, rail scroll-spy, reveals

**Files:**
- Create: `src/aws-s3-web/assets/js/terminal.js`

**Interfaces:**
- Consumes IDs/classes from Tasks 1–4: `theme-toggle`, `nav-toggle`, `nav-menu`, `rail` + `.rail-dot`, `typed-role`, `kernel`, `.reveal`, `scroll-top`, `year`, and the `no-js` class.
- Produces: removes `no-js`, adds `reduced-motion` when the media query matches (consumed by CSS). Tasks 6 and 7 append their IIFEs to this same file.

- [ ] **Step 1: Create `src/aws-s3-web/assets/js/terminal.js`:**

```js
/* Terminal portfolio interactions */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) root.classList.add('reduced-motion');

  /* ---------- Theme toggle ---------- */
  const themeBtn = document.getElementById('theme-toggle');
  const currentTheme = () => {
    const attr = root.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  };
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ---------- Kernel boot line ---------- */
  const kernel = document.getElementById('kernel');
  if (kernel && !reduced) {
    const dot = kernel.querySelector('.k-dot');
    const text = kernel.textContent.trim();
    kernel.textContent = '';
    if (dot) kernel.appendChild(dot);
    const tn = document.createTextNode('');
    kernel.appendChild(tn);
    let i = 0;
    const type = () => {
      tn.textContent = text.slice(0, i);
      if (i++ <= text.length) setTimeout(type, 22);
    };
    setTimeout(type, 300);
  }

  /* ---------- Typed rotating role ---------- */
  const roleEl = document.getElementById('typed-role');
  if (roleEl && !reduced) {
    const roles = ['DevOps Engineer', 'Cloud Engineer', 'Automation Engineer'];
    let r = 0, pos = roles[0].length, deleting = true;
    const tick = () => {
      const word = roles[r];
      roleEl.textContent = word.slice(0, pos);
      if (deleting) {
        pos -= 1;
        if (pos < 0) { deleting = false; r = (r + 1) % roles.length; pos = 0; }
        setTimeout(tick, 45);
      } else {
        pos += 1;
        if (pos > word.length) { deleting = true; setTimeout(tick, 2200); return; }
        setTimeout(tick, 85);
      }
    };
    setTimeout(tick, 2600);
  }

  /* ---------- Mobile nav ---------- */
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const open = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navMenu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Rail + mobile-nav scroll-spy ---------- */
  const railDots = Array.from(document.querySelectorAll('.rail-dot'));
  const menuLinks = Array.from(document.querySelectorAll('.nav-menu a'));
  const ids = railDots.map((d) => d.getAttribute('href'));
  const sections = ids.map((h) => document.querySelector(h)).filter(Boolean);
  const setActive = () => {
    if (!sections.length) return;
    const y = window.scrollY + 120;
    let current = sections[0];
    for (const s of sections) { if (s.offsetTop <= y) current = s; }
    const active = '#' + current.id;
    railDots.forEach((d) => d.classList.toggle('active', d.getAttribute('href') === active));
    menuLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === active));
  };
  setActive();
  window.addEventListener('scroll', setActive, { passive: true });

  /* ---------- Reveal on scroll ---------- */
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  }

  /* ---------- Scroll-to-top ---------- */
  const scrollTop = document.getElementById('scroll-top');
  if (scrollTop) {
    const toggleTop = () => scrollTop.classList.toggle('show', window.scrollY > 400);
    toggleTop();
    window.addEventListener('scroll', toggleTop, { passive: true });
  }

  /* ---------- Footer year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
```

- [ ] **Step 2: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/assets/js/terminal.js | grep -c "theme-toggle\|setActive\|typed-role"
kill %1
```
Expected: `≥ 3`. Browser: the sun/moon button flips the whole page between GitHub light and dark and survives a reload (localStorage); reload shows no flash; the right-rail dot highlights as you scroll; the hero role cycles; sections fade in.

- [ ] **Step 3: Commit**

```bash
git add src/aws-s3-web/assets/js/terminal.js
git commit -m "feat(web): terminal.js — theme toggle, kernel/typed effects, rail scroll-spy, reveals"
```

---

### Task 6: `terminal.js` — skills-universe drag physics

**Files:**
- Modify: `src/aws-s3-web/assets/js/terminal.js` (append a new IIFE)

**Interfaces:**
- Consumes from Task 2: `#skills-stage`, `.badge[data-color]`, `.skills-static`, and the `no-js`/`reduced-motion` classes.
- Produces: sets each badge's `--badge-c` custom property from `data-color`; runs a rAF physics loop with pointer drag. Under reduced-motion, converts the stage into a static wrapped grid instead.

- [ ] **Step 1: Append to `src/aws-s3-web/assets/js/terminal.js`:**

```js
/* Skills universe — drift + drag physics */
(() => {
  'use strict';
  const stage = document.getElementById('skills-stage');
  if (!stage) return;

  const badges = Array.from(stage.querySelectorAll('.badge'));
  badges.forEach((b) => { b.style.setProperty('--badge-c', b.dataset.color || ''); });

  const reduced = document.documentElement.classList.contains('reduced-motion');
  if (reduced) {
    // Static wrapped grid fallback: move badges into the static container.
    const staticBox = document.querySelector('.skills-static');
    if (staticBox) {
      const grid = document.createElement('div');
      grid.className = 'badge-grid';
      badges.forEach((b) => { b.style.left = b.style.top = ''; grid.appendChild(b); });
      staticBox.appendChild(grid);
      staticBox.classList.add('show');
    }
    return;
  }

  // Initialize physics state from CSS percentage positions.
  const rect0 = stage.getBoundingClientRect();
  const state = badges.map((b) => {
    const w = b.offsetWidth, h = b.offsetHeight;
    const x = (parseFloat(b.style.left) / 100) * (rect0.width - w) || Math.random() * (rect0.width - w);
    const y = (parseFloat(b.style.top) / 100) * (rect0.height - h) || Math.random() * (rect0.height - h);
    b.style.left = '0px'; b.style.top = '0px';
    return {
      el: b, w, h, x, y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      dragging: false,
    };
  });

  const apply = (s) => { s.el.style.transform = `translate(${s.x}px, ${s.y}px)`; };
  state.forEach(apply);

  let dragged = null, lastX = 0, lastY = 0, running = true;

  const onDown = (e) => {
    const s = state.find((st) => st.el === e.currentTarget);
    if (!s) return;
    dragged = s; s.dragging = true; s.vx = s.vy = 0;
    lastX = e.clientX; lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!dragged) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragged.x += dx; dragged.y += dy;
    dragged.vx = dx; dragged.vy = dy;
    lastX = e.clientX; lastY = e.clientY;
    apply(dragged);
  };
  const onUp = () => { if (dragged) { dragged.dragging = false; dragged = null; } };

  badges.forEach((b) => {
    b.addEventListener('pointerdown', onDown);
    b.addEventListener('pointermove', onMove);
    b.addEventListener('pointerup', onUp);
    b.addEventListener('pointercancel', onUp);
  });

  const step = () => {
    if (!running) return;
    const rect = stage.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    for (const s of state) {
      if (s.dragging) continue;
      // gentle drift + friction
      s.vx += (Math.random() - 0.5) * 0.04;
      s.vy += (Math.random() - 0.5) * 0.04;
      s.vx *= 0.99; s.vy *= 0.99;
      // clamp speed
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 2.4) { s.vx = (s.vx / sp) * 2.4; s.vy = (s.vy / sp) * 2.4; }
      s.x += s.vx; s.y += s.vy;
      // wall bounce
      if (s.x < 0) { s.x = 0; s.vx = Math.abs(s.vx); }
      if (s.x > W - s.w) { s.x = W - s.w; s.vx = -Math.abs(s.vx); }
      if (s.y < 0) { s.y = 0; s.vy = Math.abs(s.vy); }
      if (s.y > H - s.h) { s.y = H - s.h; s.vy = -Math.abs(s.vy); }
    }
    // soft mutual repulsion
    for (let i = 0; i < state.length; i++) {
      for (let j = i + 1; j < state.length; j++) {
        const a = state[i], b = state[j];
        const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        const dx = bx - ax, dy = by - ay;
        const dist = Math.hypot(dx, dy) || 1;
        const min = (a.w + b.w) / 2.4;
        if (dist < min) {
          const push = (min - dist) / dist * 0.5;
          if (!a.dragging) { a.x -= dx * push; a.y -= dy * push; }
          if (!b.dragging) { b.x += dx * push; b.y += dy * push; }
        }
      }
    }
    state.forEach(apply);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  // Pause when the stage is off-screen (perf).
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (en.isIntersecting && !running) { running = true; requestAnimationFrame(step); }
        else if (!en.isIntersecting) { running = false; }
      });
    }, { threshold: 0 });
    io.observe(stage);
  }
})();
```

- [ ] **Step 2: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/assets/js/terminal.js | grep -c "skills-stage\|requestAnimationFrame\|pointerdown"
kill %1
```
Expected: `≥ 3`. Browser (Skills section): badges drift gently and bounce off the stage edges; grab a badge and drag it — releasing flings it; badges softly push apart instead of stacking. In macOS Reduced Motion (System Settings → Accessibility → Display → Reduce motion), the stage is replaced by a static wrapped grid of badges.

- [ ] **Step 3: Commit**

```bash
git add src/aws-s3-web/assets/js/terminal.js
git commit -m "feat(web): draggable skills-universe drift physics"
```

---

### Task 7: Live projects — `pinned-repos.json` + fetch/render in `terminal.js`

**Files:**
- Create: `src/aws-s3-web/assets/data/pinned-repos.json`
- Modify: `src/aws-s3-web/assets/js/terminal.js` (append a new IIFE)

**Interfaces:**
- Consumes from Task 3: `#repo-grid`, and re-emits `.repo-card` markup identical in class names to the static fallback.
- Produces the JSON schema `{ generated_at, username, repos: [{ name, description, url, stars, forks, primaryLanguage, languages }] }` — the same schema Task 8's generator writes.

- [ ] **Step 1: Create `src/aws-s3-web/assets/data/pinned-repos.json`:**

```json
{
  "generated_at": "2026-07-05T00:00:00Z",
  "username": "HuyNguyen260398",
  "repos": [
    {
      "name": "devops-engineer-profile",
      "description": "devops-engineer-profile",
      "url": "https://github.com/HuyNguyen260398/devops-engineer-profile",
      "stars": 1,
      "forks": 0,
      "primaryLanguage": "HCL",
      "languages": ["HCL", "HTML", "Python", "PowerShell", "Vue", "CSS"]
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
```

- [ ] **Step 2: Append to `src/aws-s3-web/assets/js/terminal.js`:**

```js
/* Live projects — fetch pinned repos, fall back to static cards on failure */
(() => {
  'use strict';
  const grid = document.getElementById('repo-grid');
  if (!grid || !('fetch' in window)) return;

  const LANG_COLORS = {
    HCL: '#844FBA', HTML: '#e34c26', CSS: '#563d7c', Python: '#3572A5',
    PowerShell: '#012456', Vue: '#41b883', JavaScript: '#f1e05a', TypeScript: '#3178c6',
    Shell: '#89e051', PHP: '#4F5D95', Go: '#00ADD8', Java: '#b07219', Dockerfile: '#384d54'
  };

  const REPO_SVG = '<svg class="repo-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75H4.5A1 1 0 0 0 4 15h9.25a.75.75 0 0 1 0 1.5H4.5A2.5 2.5 0 0 1 2 14zM4.5 1.5A1 1 0 0 0 3.5 2.5v9.05c.3-.05.6-.05.99-.05h8.26V1.5z"/></svg>';
  const STAR_SVG = '<svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .25l2.4 4.85 5.35.78-3.87 3.77.91 5.33L8 12.42 3.21 15l.91-5.33L.25 5.88l5.35-.78z"/></svg>';
  const FORK_SVG = '<svg class="mini-ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.25a1.75 1.75 0 1 0-2.5 1.58v6.34A1.75 1.75 0 1 0 5 12.75a1.75 1.75 0 0 0-1-1.58V8.5c.4.32.9.5 1.5.5H9a1.5 1.5 0 0 0 1.5-1.5v-2.42a1.75 1.75 0 1 0-1.5 0V7.5H5.5A.5.5 0 0 1 5 7V4.83c.6-.3 1-.9 1-1.58z"/></svg>';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const card = (r) => {
    const langs = Array.isArray(r.languages) ? r.languages : [];
    const tags = langs.map((l) => `<span class="tag">${esc(l)}</span>`).join('');
    const primary = r.primaryLanguage || langs[0] || '';
    const color = LANG_COLORS[primary] || '#8b949e';
    const langHtml = primary
      ? `<span class="repo-lang"><span class="lang-dot" style="background:${color}"></span>${esc(primary)}</span>`
      : '';
    return `<article class="repo-card visible">
      <div class="repo-head">${REPO_SVG}
        <h3><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></h3>
      </div>
      <p class="repo-desc">${esc(r.description || '')}</p>
      <div class="repo-tags">${tags}</div>
      <div class="repo-meta">
        ${langHtml}
        <span class="repo-stat">${STAR_SVG}${esc(r.stars || 0)}</span>
        <span class="repo-stat">${FORK_SVG}${esc(r.forks || 0)}</span>
      </div>
    </article>`;
  };

  fetch('assets/data/pinned-repos.json', { cache: 'no-cache' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bad status'))))
    .then((data) => {
      if (!data || !Array.isArray(data.repos) || data.repos.length === 0) return;
      grid.innerHTML = data.repos.map(card).join('');
    })
    .catch(() => { /* keep the static fallback cards already in the DOM */ });
})();
```

- [ ] **Step 3: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
python3 -c "import json; json.load(open('assets/data/pinned-repos.json'))" && echo "JSON OK"
curl -s http://localhost:8080/assets/data/pinned-repos.json | grep -c 'devops-engineer-profile'
kill %1
```
Expected: `JSON OK`, then `1`. Browser: Projects cards render from the JSON (identical to fallback). Temporarily rename the file (`mv assets/data/pinned-repos.json /tmp/x.json`), reload → the static HTML cards still show (no empty section); then restore it (`mv /tmp/x.json assets/data/pinned-repos.json`).

- [ ] **Step 4: Commit**

```bash
git add src/aws-s3-web/assets/data/pinned-repos.json src/aws-s3-web/assets/js/terminal.js
git commit -m "feat(web): render projects live from pinned-repos.json with static fallback"
```

---

### Task 8: Pinned-repos generator + CI wiring

**Files:**
- Create: `ops/fetch_pinned_repos.py`
- Modify: `.github/workflows/aws-s3-web-sync-staging.yml`
- Modify: `.github/workflows/aws-s3-web-sync-prod.yml`

**Interfaces:**
- Consumes: env `GITHUB_TOKEN` (required), optional `GITHUB_USERNAME` (default `HuyNguyen260398`).
- Produces: overwrites `src/aws-s3-web/assets/data/pinned-repos.json` with the Task 7 schema. Non-zero exit + untouched file on any failure.

- [ ] **Step 1: Create `ops/fetch_pinned_repos.py`:**

```python
#!/usr/bin/env python3
"""Regenerate src/aws-s3-web/assets/data/pinned-repos.json from GitHub pinned repos.

Uses the GitHub GraphQL API (pinned repos are only exposed there). On any error
it exits non-zero WITHOUT touching the existing JSON, so the committed fallback
survives. Requires env GITHUB_TOKEN; optional GITHUB_USERNAME (default below).
Standard library only (urllib) — no pip dependency.
"""
import datetime
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_USER = "HuyNguyen260398"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO_ROOT, "src", "aws-s3-web", "assets", "data", "pinned-repos.json")

QUERY = """
query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name
          description
          url
          stargazerCount
          forkCount
          primaryLanguage { name }
          languages(first: 8, orderBy: {field: SIZE, direction: DESC}) { nodes { name } }
        }
      }
    }
  }
}
"""


def fail(msg):
    print(f"[fetch_pinned_repos] ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        fail("GITHUB_TOKEN is not set")
    user = os.environ.get("GITHUB_USERNAME", DEFAULT_USER)

    payload = json.dumps({"query": QUERY, "variables": {"login": user}}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.github.com/graphql",
        data=payload,
        headers={
            "Authorization": f"bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "huy-portfolio-pinned-fetch",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as exc:
        fail(f"request failed: {exc}")

    if body.get("errors"):
        fail(f"graphql errors: {body['errors']}")

    try:
        nodes = body["data"]["user"]["pinnedItems"]["nodes"]
    except (KeyError, TypeError):
        fail(f"unexpected response shape: {body}")

    repos = []
    for n in nodes:
        if not n:
            continue
        repos.append({
            "name": n.get("name", ""),
            "description": n.get("description") or "",
            "url": n.get("url", ""),
            "stars": n.get("stargazerCount", 0),
            "forks": n.get("forkCount", 0),
            "primaryLanguage": (n.get("primaryLanguage") or {}).get("name") or "",
            "languages": [x["name"] for x in (n.get("languages") or {}).get("nodes", [])],
        })

    if not repos:
        fail("no pinned repos returned; leaving existing file untouched")

    out = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "username": user,
        "repos": repos,
    }

    # Atomic write: temp then replace, so a crash mid-write can't corrupt the file.
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    tmp = OUT_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, OUT_PATH)
    print(f"[fetch_pinned_repos] wrote {len(repos)} repos to {OUT_PATH}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify the generator locally (uses your gh auth token)**

```bash
GITHUB_TOKEN="$(gh auth token)" python3 ops/fetch_pinned_repos.py
python3 -c "import json; d=json.load(open('src/aws-s3-web/assets/data/pinned-repos.json')); print(len(d['repos']), 'repos'); print(d['repos'][0]['name'])"
```
Expected: prints `[fetch_pinned_repos] wrote N repos …`, then a repo count (≥ 1) and the first repo name. Confirm `git diff` on the JSON is either empty or only the `generated_at` timestamp / real stat changes. Test the fail-safe: `GITHUB_TOKEN="" python3 ops/fetch_pinned_repos.py; echo "exit=$?"` → prints an error and `exit=1`, and `git status` shows the JSON unchanged.

- [ ] **Step 3: Add the refresh step + read permission to `.github/workflows/aws-s3-web-sync-staging.yml`**

Change the `permissions:` block from:
```yaml
permissions:
  id-token: write
```
to:
```yaml
permissions:
  id-token: write
  contents: read
```

Then insert this step immediately **before** the `- name: Sync aws-s3-web to S3 Bucket` step:
```yaml
      - name: Refresh pinned repos data
        continue-on-error: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: python ops/fetch_pinned_repos.py
```

- [ ] **Step 4: Add the refresh step, read permission, and daily schedule to `.github/workflows/aws-s3-web-sync-prod.yml`**

Change the `permissions:` block the same way (add `contents: read`).

Add a `schedule` trigger to the existing `on:` block (alongside `push`, `pull_request`, `workflow_dispatch`):
```yaml
  schedule:
    - cron: "0 18 * * *"
```

Insert the same refresh step immediately **before** the `- name: Sync aws-s3-web to S3 Bucket` step:
```yaml
      - name: Refresh pinned repos data
        continue-on-error: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: python ops/fetch_pinned_repos.py
```

- [ ] **Step 5: Verify the workflows are valid YAML and contain the new wiring**

```bash
python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in ['.github/workflows/aws-s3-web-sync-staging.yml','.github/workflows/aws-s3-web-sync-prod.yml']]; print('YAML OK')"
grep -c "Refresh pinned repos data" .github/workflows/aws-s3-web-sync-staging.yml .github/workflows/aws-s3-web-sync-prod.yml
grep -c "cron:" .github/workflows/aws-s3-web-sync-prod.yml
```
Expected: `YAML OK`; each workflow reports `1` refresh step; prod reports `1` cron. (If PyYAML isn't installed: `pip install pyyaml` first, or skip and rely on the grep checks.)

> **Token contingency (note for the implementer):** the default `GITHUB_TOKEN` can read public pinned items via GraphQL. If a CI run logs `no pinned repos returned` or a GraphQL permission error, create a read-only fine-grained PAT, add it as the repo secret `PINNED_REPOS_TOKEN`, and change the step's env to `GITHUB_TOKEN: ${{ secrets.PINNED_REPOS_TOKEN }}`. Because the step is `continue-on-error`, this never blocks a deploy — the committed fallback JSON ships meanwhile.

- [ ] **Step 6: Commit**

```bash
git add ops/fetch_pinned_repos.py .github/workflows/aws-s3-web-sync-staging.yml .github/workflows/aws-s3-web-sync-prod.yml src/aws-s3-web/assets/data/pinned-repos.json
git commit -m "feat(ci): regenerate pinned-repos.json from GitHub GraphQL on deploy + daily"
```

---

## Final Verification

- [ ] **Full-page smoke test**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c '# About.system\|# Skills.json\|git log --stat --oneline\|ls -la ~/projects\|ls -la ~/blogs\|./contact.exe'
curl -s http://localhost:8080/ | grep -c 'certification'
kill %1
```
Expected: `6` (all sections present, in order), `0` (certs gone). In the browser, walk the whole page in both light and dark: hero code card, About.system, draggable Skills universe + JSON block, git-log timeline, 5 live project cards, "No pinned blogs yet.", contact JSON + form. Confirm the theme toggle persists across reload with no flash, and the right rail tracks the active section.
```
```

## Notes for the Implementer

- The three `src/aws-s3-web/assets/js/terminal.js` IIFEs (Tasks 5–7) are independent and appended in order; keep them as separate `(() => { ... })();` blocks.
- Brand-logo SVG paths in the badges are simplified single-color glyphs (they inherit `--badge-c`); they are recognizable, not pixel-exact vendor marks — acceptable for a self-contained, no-external-request build.
- Do not delete the old template files (`index_bk.html`, `index_2.html`, `main.css`, `main.js`); they're out of scope.
