# Terminal-Style Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Bootstrap "MyResume" portfolio in `src/aws-s3-web/` with a from-scratch terminal/code-editor themed single-page site (dark theme, monospace, boot loader, typed hero, drag-to-explore skills universe, git-log experience timeline, repo-style project cards).

**Architecture:** One static page — `index.html` rewritten completely, one new stylesheet `assets/css/terminal.css`, one new script `assets/js/terminal.js`. No frameworks, no vendor libraries, no build step. Existing images are reused. Old template files are left in place (cleanup is out of scope).

**Tech Stack:** Vanilla HTML5/CSS3/ES2017 JS, Google Fonts (JetBrains Mono), Canvas 2D API, IntersectionObserver.

**Spec:** `docs/superpowers/specs/2026-07-05-terminal-portfolio-redesign-design.md`

## Global Constraints

- No external JS/CSS dependencies except the Google Fonts stylesheet for **JetBrains Mono** (fallback `monospace`).
- All existing content carries over verbatim (bio, resume items, projects, certifications, blogs, contact info) — the only allowed text changes are fixing the missing-space typos in the Bosch summary bullets and the footer name ("Alex Smith" → "Nguyen Gia Huy").
- Contact form keeps `action="forms/contact.php" method="post"` (unchanged behavior).
- CV PDF URL: `https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf`
- `prefers-reduced-motion: reduce` must skip the boot loader, typing effects, reveal animations, and the skills canvas (bars render pre-filled — final text is already in the HTML).
- With JS disabled, all content must be visible (`no-js` class pattern; loader hidden, reveals visible).
- Skill levels: AWS 90, Azure 60, Python 90, Linux 75, Terraform 75, Ansible 80, Docker 80, Kubernetes 70.
- Colors: bg `#0a0e14`, panel `#0f1420`, elevated `#141b2b`, border `#1e2a3d`, green `#22c55e`, green-dim `#16803c`, cyan `#22d3ee`, amber `#fbbf24`, red `#ef4444`, text `#9fb0c3`, bright `#e6edf3`, dim `#5b6b80`.
- Do NOT touch `.github/`, `inf/`, `gitops/`, `ops/`, or any other file in `src/aws-s3-web/` besides `index.html`, `assets/css/terminal.css`, `assets/js/terminal.js`.
- Commit after every task. Verification server: `python3 -m http.server 8080` run from `src/aws-s3-web/` (start in background, kill when done).
- Every commit message ends with the trailer line: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (add it with a blank line before it; the per-task commit commands below omit it for brevity).

---

### Task 1: Page scaffold — head, boot loader, nav, hero, footer + CSS foundation

**Files:**
- Modify (full rewrite): `src/aws-s3-web/index.html`
- Create: `src/aws-s3-web/assets/css/terminal.css`

**Interfaces:**
- Produces CSS classes consumed by every later task: `.container`, `.section`, `.section-head`, `.accent`, `.cyan`, `.cursor`, `.term`, `.term-bar`, `.dot`, `.dot-r`, `.dot-a`, `.dot-g`, `.term-title`, `.term-body`, `.term-body-flush`, `.prompt`, `.comment`, `.btn-cmd`, `.btn-primary`, `.kv`, `.reveal`.
- Produces IDs consumed by Task 5 (JS): `boot-loader`, `boot-lines`, `nav-toggle`, `nav-menu`, `typed-role`, `hero-boot`, `scroll-top`, `year`.
- `<html class="no-js">` — Task 5 JS removes this class on load.
- Tasks 2–4 insert their sections inside `<main>` replacing the HTML comment markers `<!-- @about+skills -->`, `<!-- @experience+projects -->`, `<!-- @certs+blog+contact -->`.

- [ ] **Step 1: Write `src/aws-s3-web/index.html` (complete file)**

```html
<!DOCTYPE html>
<html lang="en" class="no-js">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Huy Nguyen — DevOps Engineer</title>
  <meta name="description" content="Nguyen Gia Huy — DevOps Engineer portfolio: AWS, Azure, Kubernetes, Terraform, CI/CD, GitOps.">

  <!-- Favicons -->
  <link href="assets/img/favicon-main.png" rel="icon">
  <link href="assets/img/apple-touch-icon-main.png" rel="apple-touch-icon">

  <!-- Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">

  <link href="assets/css/terminal.css" rel="stylesheet">
</head>

<body>

  <!-- Boot loader (hidden when no-js / reduced-motion via CSS) -->
  <div id="boot-loader" aria-hidden="true">
    <div id="boot-lines" class="boot-lines"></div>
  </div>

  <header class="site-nav">
    <div class="container nav-inner">
      <a href="#home" class="brand"><span class="accent">huy@aws</span>:<span class="cyan">~</span>$</a>
      <button id="nav-toggle" class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">≡</button>
      <ul id="nav-menu" class="nav-menu">
        <li><a href="#home" class="active">~/home</a></li>
        <li><a href="#about">~/about</a></li>
        <li><a href="#skills">~/skills</a></li>
        <li><a href="#experience">~/experience</a></li>
        <li><a href="#projects">~/projects</a></li>
        <li><a href="#certs">~/certs</a></li>
        <li><a href="#blog">~/blog</a></li>
        <li><a href="#contact">~/contact</a></li>
      </ul>
    </div>
  </header>

  <main>

    <!-- Hero -->
    <section id="home" class="hero">
      <div class="container">
        <pre id="hero-boot" class="hero-boot" aria-hidden="true"></pre>
        <p class="hero-hello prompt">whoami</p>
        <h1 class="hero-name">Nguyen Gia Huy</h1>
        <p class="hero-role">I'm a <span id="typed-role" class="accent">DevOps Engineer</span><span class="cursor">_</span></p>
        <p class="hero-tagline"># Automating infrastructure · CI/CD · Cloud on AWS &amp; Azure</p>
        <div class="hero-social">
          <a class="btn-cmd" href="https://www.linkedin.com/in/huy-nguyen-966488189" target="_blank" rel="noopener noreferrer">./linkedin</a>
          <a class="btn-cmd" href="https://github.com/HuyNguyen260398" target="_blank" rel="noopener noreferrer">./github</a>
          <a class="btn-cmd" href="https://www.facebook.com/huy.nguyen.682" target="_blank" rel="noopener noreferrer">./facebook</a>
          <a class="btn-cmd" href="https://www.instagram.com/huynguyen2603989/" target="_blank" rel="noopener noreferrer">./instagram</a>
        </div>
      </div>
    </section>

    <!-- @about+skills -->

    <!-- @experience+projects -->

    <!-- @certs+blog+contact -->

  </main>

  <footer class="footer">
    <div class="container">
      <p class="prompt">exit 0</p>
      <p>© <span id="year">2026</span> Nguyen Gia Huy — DevOps Engineer</p>
      <div class="hero-social">
        <a class="btn-cmd" href="https://www.linkedin.com/in/huy-nguyen-966488189" target="_blank" rel="noopener noreferrer">./linkedin</a>
        <a class="btn-cmd" href="https://github.com/HuyNguyen260398" target="_blank" rel="noopener noreferrer">./github</a>
        <a class="btn-cmd" href="https://www.facebook.com/huy.nguyen.682" target="_blank" rel="noopener noreferrer">./facebook</a>
        <a class="btn-cmd" href="https://www.instagram.com/huynguyen2603989/" target="_blank" rel="noopener noreferrer">./instagram</a>
      </div>
    </div>
  </footer>

  <a href="#home" id="scroll-top" class="scroll-top" aria-label="Back to top">↑</a>

  <script src="assets/js/terminal.js"></script>
</body>

</html>
```

Note: the empty X/Twitter and Skype links from the old footer (they pointed to `#`/`""`) are intentionally dropped; a GitHub link is added since all projects live there.

- [ ] **Step 2: Create `src/aws-s3-web/assets/css/terminal.css` (foundation — later tasks append)**

```css
/* ============================================================
   Terminal portfolio — terminal.css
   ============================================================ */

:root {
  --bg: #0a0e14;
  --bg-panel: #0f1420;
  --bg-elev: #141b2b;
  --border: #1e2a3d;
  --green: #22c55e;
  --green-dim: #16803c;
  --cyan: #22d3ee;
  --amber: #fbbf24;
  --red: #ef4444;
  --text: #9fb0c3;
  --text-bright: #e6edf3;
  --text-dim: #5b6b80;
  --font: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; scroll-padding-top: 72px; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.7;
}

img { max-width: 100%; display: block; }
a { color: var(--cyan); text-decoration: none; }
a:hover { color: var(--green); text-decoration: underline; }
:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

.container { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
.section { padding: 88px 0; }
.accent { color: var(--green); }
.cyan { color: var(--cyan); }

/* Blinking cursor */
.cursor { display: inline-block; color: var(--green); animation: blink 1s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.reduced-motion .cursor { animation: none; }

/* Section heading */
.section-head { margin-bottom: 36px; }
.section-head h2 { color: var(--text-bright); font-size: 26px; font-weight: 700; }
.section-head h2 .accent { margin-right: 10px; }

/* Terminal window */
.term { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.term-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-elev); border-bottom: 1px solid var(--border); }
.dot { width: 12px; height: 12px; border-radius: 50%; }
.dot-r { background: var(--red); }
.dot-a { background: var(--amber); }
.dot-g { background: var(--green); }
.term-title { margin-left: 10px; font-size: 12px; color: var(--text-dim); }
.term-body { padding: 28px; }
.term-body-flush { padding: 0; }

/* Prompt + comment lines */
.prompt::before { content: 'huy@aws:~$ '; color: var(--green); font-weight: 600; }
.comment { color: var(--text-dim); }

/* Command-style buttons */
.btn-cmd {
  display: inline-block; padding: 9px 18px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-elev); color: var(--text-bright); font-family: inherit; font-size: 14px;
  cursor: pointer; transition: border-color .2s, color .2s, box-shadow .2s;
}
.btn-cmd::before { content: '$ '; color: var(--green); }
.btn-cmd:hover { border-color: var(--green); color: var(--green); text-decoration: none; box-shadow: 0 0 12px rgba(34, 197, 94, .25); }
.btn-primary { border-color: var(--green-dim); color: var(--green); }

/* Key-value list */
.kv div { display: flex; gap: 8px; }
.kv dt { color: var(--cyan); min-width: 88px; }
.kv dt::after { content: ':'; }
.kv dd { color: var(--text-bright); word-break: break-word; }

/* Scroll reveal */
.reveal { opacity: 0; transform: translateY(18px); transition: opacity .6s ease, transform .6s ease; }
.reveal.visible { opacity: 1; transform: none; }
.no-js .reveal, .reduced-motion .reveal { opacity: 1; transform: none; }

/* ---------- Boot loader ---------- */
#boot-loader {
  position: fixed; inset: 0; z-index: 9999; background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  transition: opacity .4s ease;
}
#boot-loader.done { opacity: 0; pointer-events: none; }
.boot-lines { width: min(520px, 90vw); font-size: 14px; }
.boot-lines .ok { color: var(--green); }
.no-js #boot-loader, .reduced-motion #boot-loader { display: none; }

/* ---------- Nav ---------- */
.site-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  background: rgba(10, 14, 20, .92); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.nav-inner { display: flex; align-items: center; justify-content: space-between; height: 60px; }
.brand { color: var(--text-bright); font-weight: 700; font-size: 16px; }
.brand:hover { text-decoration: none; }
.nav-menu { display: flex; gap: 4px; list-style: none; }
.nav-menu a { display: block; padding: 6px 10px; border-radius: 6px; color: var(--text); font-size: 13px; }
.nav-menu a:hover { color: var(--green); text-decoration: none; }
.nav-menu a.active { color: var(--green); background: rgba(34, 197, 94, .08); }
.nav-toggle { display: none; background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--text-bright); font-size: 20px; padding: 2px 10px; cursor: pointer; }

@media (max-width: 900px) {
  .nav-toggle { display: block; }
  .nav-menu {
    position: absolute; top: 60px; left: 0; right: 0;
    flex-direction: column; background: var(--bg-panel);
    border-bottom: 1px solid var(--border); padding: 12px 20px; display: none;
  }
  .nav-menu.open { display: flex; }
}

/* ---------- Hero ---------- */
.hero { min-height: 100vh; display: flex; align-items: center; padding-top: 60px; }
.hero-boot { color: var(--text-dim); font-size: 13px; min-height: 72px; margin-bottom: 28px; white-space: pre-wrap; font-family: inherit; }
.hero-name { color: var(--text-bright); font-size: clamp(34px, 7vw, 64px); font-weight: 700; letter-spacing: -1px; margin: 4px 0 10px; }
.hero-role { font-size: clamp(17px, 3vw, 24px); }
.hero-tagline { margin-top: 14px; color: var(--text-dim); }
.hero-social { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }

/* ---------- Footer / scroll top ---------- */
.footer { border-top: 1px solid var(--border); padding: 40px 0; text-align: center; color: var(--text-dim); font-size: 13px; }
.footer .hero-social { justify-content: center; margin-top: 18px; }
.scroll-top {
  position: fixed; right: 18px; bottom: 18px; width: 42px; height: 42px; z-index: 900;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); border-radius: 8px; background: var(--bg-elev);
  color: var(--green); font-size: 20px;
  opacity: 0; pointer-events: none; transition: opacity .3s;
}
.scroll-top.show { opacity: 1; pointer-events: auto; }
.scroll-top:hover { border-color: var(--green); text-decoration: none; }
.no-js .scroll-top { opacity: 1; pointer-events: auto; }
```

- [ ] **Step 3: Verify the page serves and contains the scaffold**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'nav-menu\|boot-loader\|hero-name\|terminal.css'
```
Expected: a number ≥ 5 (all key markers present). Then open `http://localhost:8080/` in a browser: dark page, fixed nav with `~/...` tabs, hero with name (boot loader stays visible for now — JS comes in Task 5, and `no-js` hides it: confirm the loader is NOT covering the page).

- [ ] **Step 4: Kill the server and commit**

```bash
kill %1
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): terminal redesign scaffold — nav, hero, boot loader, footer"
```

---

### Task 2: About + Skills sections (markup + CSS)

**Files:**
- Modify: `src/aws-s3-web/index.html` (replace the `<!-- @about+skills -->` marker)
- Modify: `src/aws-s3-web/assets/css/terminal.css` (append)

**Interfaces:**
- Consumes Task 1 classes: `.section`, `.section-head`, `.term*`, `.kv`, `.btn-cmd`, `.reveal`, `.prompt`, `.comment`, `.cursor`, `.accent`.
- Produces for Task 5/6 (JS): `#skills-canvas` (canvas element), `.skill-bar[data-level]` containing `.skill-track` and `.skill-val`, `.skill-grid` (reveal target that triggers bar animation), `.skills-universe` (wrapper hidden under no-js/reduced-motion).

- [ ] **Step 1: Replace `<!-- @about+skills -->` in `index.html` with:**

```html
    <!-- About -->
    <section id="about" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2><span class="accent">$</span>cat about.txt<span class="cursor">_</span></h2>
        </div>
        <div class="term reveal">
          <div class="term-bar">
            <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
            <span class="term-title">about.txt — ~/huy</span>
          </div>
          <div class="term-body about-grid">
            <div class="about-photo">
              <img src="assets/img/profile-img-main.jpg" alt="Portrait of Nguyen Gia Huy">
            </div>
            <div class="about-text">
              <p class="comment"># DevOps Engineer — Ho Chi Minh City, Viet Nam</p>
              <p>I am a DevOps Engineer with 5 years of hands-on experience in automating infrastructure, optimizing CI/CD pipelines, and ensuring scalable cloud deployments. I am skilled in bridging development and operations to deliver reliable, high-performing systems. I am seeking to leverage expertise in DevOps practices while driving innovation through AI implementation, with a focus on enhancing automation, predictive monitoring, and intelligent workflow optimization.</p>
              <dl class="kv">
                <div><dt>dob</dt><dd>1998-03-26</dd></div>
                <div><dt>phone</dt><dd>+84 903 336 493</dd></div>
                <div><dt>degree</dt><dd>Bachelor of Information Technology</dd></div>
                <div><dt>city</dt><dd>Ho Chi Minh City, Viet Nam</dd></div>
                <div><dt>email</dt><dd><a href="mailto:huynguyen2603989@gmail.com">huynguyen2603989@gmail.com</a></dd></div>
              </dl>
              <a class="btn-cmd btn-primary" href="https://d1k59jrf89m1h2.cloudfront.net/Nguyen-Gia-Huy-DevOps-Engineer.pdf" download="Nguyen-Gia-Huy-DevOps-Engineer.pdf" target="_blank" rel="noopener noreferrer">wget resume.pdf</a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Skills -->
    <section id="skills" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2><span class="accent">$</span>./skills --explore<span class="cursor">_</span></h2>
        </div>
        <div class="term skills-universe reveal">
          <div class="term-bar">
            <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
            <span class="term-title">skills-universe — drag to explore</span>
          </div>
          <div class="term-body term-body-flush">
            <canvas id="skills-canvas" role="img" aria-label="Interactive map of technical skills. Skill levels are listed below."></canvas>
            <p class="canvas-hint">&lt; drag to explore the skills universe &gt;</p>
          </div>
        </div>
        <div class="skill-grid reveal">
          <div class="skill-bar" data-level="90">
            <span class="skill-name">AWS</span>
            <span class="skill-track" aria-hidden="true">[█████████░]</span>
            <span class="skill-val">90%</span>
          </div>
          <div class="skill-bar" data-level="75">
            <span class="skill-name">Terraform</span>
            <span class="skill-track" aria-hidden="true">[████████░░]</span>
            <span class="skill-val">75%</span>
          </div>
          <div class="skill-bar" data-level="60">
            <span class="skill-name">Azure</span>
            <span class="skill-track" aria-hidden="true">[██████░░░░]</span>
            <span class="skill-val">60%</span>
          </div>
          <div class="skill-bar" data-level="80">
            <span class="skill-name">Ansible</span>
            <span class="skill-track" aria-hidden="true">[████████░░]</span>
            <span class="skill-val">80%</span>
          </div>
          <div class="skill-bar" data-level="90">
            <span class="skill-name">Python</span>
            <span class="skill-track" aria-hidden="true">[█████████░]</span>
            <span class="skill-val">90%</span>
          </div>
          <div class="skill-bar" data-level="80">
            <span class="skill-name">Docker</span>
            <span class="skill-track" aria-hidden="true">[████████░░]</span>
            <span class="skill-val">80%</span>
          </div>
          <div class="skill-bar" data-level="75">
            <span class="skill-name">Linux</span>
            <span class="skill-track" aria-hidden="true">[████████░░]</span>
            <span class="skill-val">75%</span>
          </div>
          <div class="skill-bar" data-level="70">
            <span class="skill-name">Kubernetes</span>
            <span class="skill-track" aria-hidden="true">[███████░░░]</span>
            <span class="skill-val">70%</span>
          </div>
        </div>
      </div>
    </section>
```

(Block counts use `Math.round(level / 10)`, so 75 renders 8 filled blocks — matches the JS in Task 5.)

- [ ] **Step 2: Append to `terminal.css`:**

```css
/* ---------- About ---------- */
.about-grid { display: grid; grid-template-columns: 260px 1fr; gap: 32px; align-items: start; }
.about-photo img { border-radius: 10px; border: 1px solid var(--green-dim); box-shadow: 0 0 24px rgba(34, 197, 94, .18); }
.about-text p + p { margin-top: 14px; }
.about-text .kv { margin: 20px 0 24px; display: grid; gap: 6px; }
@media (max-width: 760px) {
  .about-grid { grid-template-columns: 1fr; }
  .about-photo { max-width: 240px; }
}

/* ---------- Skills ---------- */
#skills-canvas { width: 100%; height: 380px; display: block; cursor: grab; touch-action: none; }
#skills-canvas.dragging { cursor: grabbing; }
.canvas-hint { text-align: center; color: var(--text-dim); font-size: 12px; padding: 10px 0 14px; }
.no-js .skills-universe, .reduced-motion .skills-universe { display: none; }

.skill-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 40px; margin-top: 36px; }
.skill-bar { display: flex; gap: 14px; align-items: baseline; font-size: 15px; }
.skill-name { color: var(--text-bright); min-width: 110px; }
.skill-track { color: var(--green); letter-spacing: 1px; flex: 1; }
.skill-val { color: var(--cyan); min-width: 44px; text-align: right; }
@media (max-width: 760px) { .skill-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'skill-bar'
curl -s http://localhost:8080/ | grep -c 'about-grid'
```
Expected: `8` skill bars, `1` about grid. In the browser: About terminal window with photo + key-value pairs; Skills section shows 8 pre-filled ASCII bars (canvas is a blank strip until Task 6 — its wrapper is hidden anyway because `no-js` is still on `<html>` until Task 5).

- [ ] **Step 4: Kill server and commit**

```bash
kill %1
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): about and skills sections in terminal style"
```

---

### Task 3: Experience (git log) + Projects (repo cards)

**Files:**
- Modify: `src/aws-s3-web/index.html` (replace the `<!-- @experience+projects -->` marker)
- Modify: `src/aws-s3-web/assets/css/terminal.css` (append)

**Interfaces:**
- Consumes Task 1 classes: `.section`, `.section-head`, `.reveal`, `.accent`, `.cursor`.
- Produces: `.git-log`/`.commit` and `.repo-grid`/`.repo-card` (styling only — no JS hooks).

- [ ] **Step 1: Replace `<!-- @experience+projects -->` in `index.html` with:**

```html
    <!-- Experience -->
    <section id="experience" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2><span class="accent">$</span>git log --career<span class="cursor">_</span></h2>
        </div>
        <ol class="git-log">
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">f4c3a9e</span><span class="ref">(HEAD -&gt; main)</span><span class="commit-date">Jan 2020 – Present</span></div>
            <h3>DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technologies Viet Nam</p>
            <ul>
              <li>DevOps engineer with a strong progression from automation development to large scale CI/CD infrastructure system to support multiple embedded teams.</li>
              <li>Skilled in building automation solutions using Jenkins, Groovy, Python, Helm, and Ansible, supporting domains such as Powertrain, Splunk, and Active Safety.</li>
              <li>Experienced in maintaining CI infrastructure on Azure Cloud with Kubernetes, ArgoCD and Terraform.</li>
              <li>Willingly and actively collaborating with teams in Germany, India, China, and Hungary, delivering reliable pipelines and scalable infrastructure.</li>
              <li>Proactive to research early adoption of agentic AI to enhance DevOps workflows.</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">e7d21b8</span><span class="commit-date">Oct 2025 – Dec 2025</span></div>
            <h3>AWS CloudOps Agent — Leader</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Leading development of an intelligent agentic AI system powered by AWS Bedrock AgentCore and AWS Strands Agent SDK for autonomous AWS cloud operations management</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">c9a54f3</span><span class="commit-date">Sep 2025 – Dec 2025</span></div>
            <h3>MCP Server for DevOps — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Conducting research and early implementation of agentic AI in DevOps</li>
              <li>Developing MCP server to explore intelligent automation capabilities</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">b3e8d17</span><span class="commit-date">Jun 2025 – Dec 2025</span></div>
            <h3>CI/CD Infrastructure in K8S — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Received knowledge transfer from Hungary team to operate and maintain Jenkins systems deployed on Azure Cloud</li>
              <li>Leveraged Kubernetes (K8s) and ArgoCD for GitOps-based deployments</li>
              <li>Maintained Azure cloud infrastructure using Terraform</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">a1f6c42</span><span class="commit-date">Jun 2024 – Dec 2025</span></div>
            <h3>Jenkins CI/CD Pipelines for DE ActiveSafety Team — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Enhanced Jenkins pipelines using custom Python libraries</li>
              <li>Implemented Jenkins Infrastructure as Code with Helm</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">98d3e5b</span><span class="commit-date">Jan 2024 – Jun 2024</span></div>
            <h3>Splunk &amp; CI Infrastructure — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Supported Splunk team in setting up and optimizing Jenkins pipelines for log analytics and monitoring solutions</li>
              <li>Maintained and improved CI infrastructure for German projects, including Jenkins, Grafana, and Prometheus</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">87c2f9a</span><span class="commit-date">Jan 2021 – Jun 2024</span></div>
            <h3>Jenkins CI/CD Pipelines for DE PowerTrain Team — DevOps Engineer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Transitioned into the DevOps team, working closely with colleagues in Germany to support large-scale automotive software development</li>
              <li>Designed and implemented CI/CD pipelines using Jenkins and Groovy, enabling automated build, test, and deployment workflows</li>
              <li>May 2023: Onsite trip to Bosch Abstatt to work closely with Germany colleagues</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">76b1e48</span><span class="commit-date">Apr 2020 – Jan 2021</span></div>
            <h3>KPI Dashboard — Automation Tool Developer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Collaborated with China-based software PCMs and managers to design and deliver KPI dashboards using PowerBI and SQL</li>
              <li>Improved visibility into project performance through data visualization</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">65a9d37</span><span class="commit-date">Apr 2020 – Jan 2021</span></div>
            <h3>Automation Tool Developer</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Developed automation applications using C# and Python to streamline workflow and process management on Jira</li>
              <li>Supported embedded teams in India and Germany</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">54f8c26</span><span class="commit-date">Jan 2020 – Apr 2020</span></div>
            <h3>Python Intern — Embedded Automation Tools</h3>
            <p class="org">Bosch Global Software Technology Vietnam</p>
            <ul>
              <li>Supported senior engineers in developing internal tools and improving code quality</li>
            </ul>
          </li>
          <li class="commit reveal">
            <div class="commit-line"><span class="hash">43e7b15</span><span class="ref">(tag: education)</span><span class="commit-date">2017 – 2020</span></div>
            <h3>Bachelor of Information Technology</h3>
            <p class="org">University of Greenwich, Viet Nam</p>
            <ul>
              <li>GPA: 3.6/4</li>
            </ul>
          </li>
        </ol>
      </div>
    </section>

    <!-- Projects -->
    <section id="projects" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2><span class="accent">$</span>ls ~/projects<span class="cursor">_</span></h2>
        </div>
        <div class="repo-grid">
          <article class="repo-card reveal">
            <div class="repo-head">
              <span class="repo-icon" aria-hidden="true">▣</span>
              <h3><a href="https://github.com/HuyNguyen260398/devops-engineer-profile" target="_blank" rel="noopener noreferrer">devops-engineer-profile</a></h3>
            </div>
            <p>Comprehensive DevOps platform featuring CI/CD pipelines, monitoring, and observability tools, orchestrated on Kubernetes with Terraform and Helm-based infrastructure management and GitOps practices.</p>
            <div class="tags">
              <span class="tag">AWS EKS</span><span class="tag">Helm</span><span class="tag">Terraform</span><span class="tag">Argo CD</span>
            </div>
          </article>
          <article class="repo-card reveal">
            <div class="repo-head">
              <span class="repo-icon" aria-hidden="true">▣</span>
              <h3><a href="https://github.com/HuyNguyen260398/aws_resume_web_inf" target="_blank" rel="noopener noreferrer">aws_resume_web_inf</a></h3>
            </div>
            <p>Serverless static website deployment on AWS with CloudFront, S3, and automated CI/CD pipelines for continuous updates.</p>
            <div class="tags">
              <span class="tag">AWS S3</span><span class="tag">CloudFront</span><span class="tag">Route53</span><span class="tag">ACM</span><span class="tag">Terraform</span><span class="tag">GitHub Actions</span>
            </div>
          </article>
          <article class="repo-card reveal">
            <div class="repo-head">
              <span class="repo-icon" aria-hidden="true">▣</span>
              <h3><a href="https://github.com/HuyNguyen260398/aws-cloudops-agent" target="_blank" rel="noopener noreferrer">aws-cloudops-agent</a></h3>
            </div>
            <p>An intelligent agentic AI system powered by AWS Bedrock AgentCore and AWS Strands Agent SDK for autonomous AWS cloud operations management.</p>
            <div class="tags">
              <span class="tag">Strands Agent</span><span class="tag">Bedrock AgentCore</span><span class="tag">Bedrock LLM</span><span class="tag">OpenSearch</span>
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
  content: ''; position: absolute; left: -27px; top: 6px;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--bg); border: 2px solid var(--green);
}
.commit-line { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; font-size: 13px; margin-bottom: 6px; }
.hash { color: var(--amber); }
.ref { color: var(--cyan); }
.commit-date { color: var(--text-dim); }
.commit h3 { color: var(--text-bright); font-size: 17px; margin-bottom: 2px; }
.commit .org { color: var(--text-dim); font-style: italic; font-size: 13px; margin-bottom: 8px; }
.commit ul { list-style: none; }
.commit ul li { padding-left: 18px; position: relative; }
.commit ul li::before { content: '-'; position: absolute; left: 0; color: var(--green); }

/* ---------- Projects: repo cards ---------- */
.repo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.repo-card {
  background: var(--bg-panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 24px; display: flex; flex-direction: column; gap: 12px;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.repo-card:hover { border-color: var(--green-dim); transform: translateY(-4px); box-shadow: 0 8px 28px rgba(0, 0, 0, .4); }
.repo-head { display: flex; align-items: center; gap: 10px; }
.repo-icon { color: var(--cyan); font-size: 18px; }
.repo-head h3 { font-size: 16px; font-weight: 600; }
.repo-head a { color: var(--text-bright); }
.repo-head a:hover { color: var(--green); }
.repo-card p { font-size: 14px; flex: 1; }
.tags { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { font-size: 12px; color: var(--green); border: 1px solid var(--green-dim); border-radius: 999px; padding: 2px 10px; }
```

- [ ] **Step 3: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'class="commit reveal"'
curl -s http://localhost:8080/ | grep -c 'repo-card'
```
Expected: `11` commits, `3` repo cards. Browser: timeline with green dots + vertical line, amber hashes; 3 hoverable project cards with pill tags.

- [ ] **Step 4: Kill server and commit**

```bash
kill %1
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): git-log experience timeline and repo-style project cards"
```

---

### Task 4: Certifications + Blog + Contact sections

**Files:**
- Modify: `src/aws-s3-web/index.html` (replace the `<!-- @certs+blog+contact -->` marker)
- Modify: `src/aws-s3-web/assets/css/terminal.css` (append)

**Interfaces:**
- Consumes Task 1 classes: `.section`, `.section-head`, `.term*`, `.reveal`, `.prompt`, `.kv`, `.btn-cmd`, `.btn-primary`.
- Produces: `.cert-grid`, `.blog-list`, `.contact-grid`, `.term-form` (styling only — no JS hooks).

- [ ] **Step 1: Replace `<!-- @certs+blog+contact -->` in `index.html` with:**

```html
    <!-- Certifications -->
    <section id="certs" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2><span class="accent">$</span>ls ~/certifications<span class="cursor">_</span></h2>
        </div>
        <div class="term reveal">
          <div class="term-bar">
            <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
            <span class="term-title">~/certifications</span>
          </div>
          <div class="term-body">
            <p class="prompt">ls -la ~/certifications/</p>
            <div class="cert-grid">
              <a href="https://www.credly.com/badges/a9c87043-fa06-49bb-8570-d08a3fb7883c/public_url" target="_blank" rel="noopener noreferrer" class="cert" title="AWS Certified Cloud Practitioner">
                <img src="assets/img/certifications/aws-certified-cloud-practitioner.png" alt="AWS Certified Cloud Practitioner badge" loading="lazy">
                <span>cloud-practitioner.cert</span>
              </a>
              <a href="https://www.credly.com/badges/39219854-bc9b-43a0-942e-9e86064151d6/public_url" target="_blank" rel="noopener noreferrer" class="cert" title="AWS Certified Solutions Architect - Associate">
                <img src="assets/img/certifications/aws-certified-solutions-architect-associate.png" alt="AWS Certified Solutions Architect - Associate badge" loading="lazy">
                <span>solutions-architect.cert</span>
              </a>
              <a href="https://www.credly.com/badges/75544d8f-9193-4505-8634-238a8925fd86/public_url" target="_blank" rel="noopener noreferrer" class="cert" title="AWS Certified SysOps Administrator - Associate">
                <img src="assets/img/certifications/aws-certified-sysops-administrator-associate.png" alt="AWS Certified SysOps Administrator - Associate badge" loading="lazy">
                <span>sysops-admin.cert</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Blog -->
    <section id="blog" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2><span class="accent">$</span>ls ~/blog<span class="cursor">_</span></h2>
        </div>
        <div class="blog-list">
          <article class="blog-entry reveal">
            <div class="blog-line">
              <span class="perm" aria-hidden="true">-rw-r--r--</span>
              <span class="blog-date">2026-01-15</span>
              <a class="blog-file" href="https://kubernetes.io/blog/" target="_blank" rel="noopener noreferrer">pod-security-standards.md</a>
            </div>
            <h3>Kubernetes Security Best Practices: Pod Security Standards</h3>
            <p>Learn how to implement Pod Security Standards to enhance your Kubernetes cluster security. This comprehensive guide covers the latest security controls and best practices for production environments.</p>
            <p class="blog-meta">source: <a href="https://kubernetes.io/blog/" target="_blank" rel="noopener noreferrer">Kubernetes Blog</a></p>
          </article>
          <article class="blog-entry reveal">
            <div class="blog-line">
              <span class="perm" aria-hidden="true">-rw-r--r--</span>
              <span class="blog-date">2026-01-12</span>
              <a class="blog-file" href="https://github.blog/" target="_blank" rel="noopener noreferrer">cicd-pipeline-optimization.md</a>
            </div>
            <h3>Optimizing CI/CD Pipelines: From Commit to Production in Minutes</h3>
            <p>Discover strategies to optimize your CI/CD pipelines using GitHub Actions. Learn caching techniques, parallel jobs, and workflow optimization to reduce deployment time by up to 60%.</p>
            <p class="blog-meta">source: <a href="https://github.blog/" target="_blank" rel="noopener noreferrer">GitHub Blog</a></p>
          </article>
          <article class="blog-entry reveal">
            <div class="blog-line">
              <span class="perm" aria-hidden="true">-rw-r--r--</span>
              <span class="blog-date">2026-01-08</span>
              <a class="blog-file" href="https://www.hashicorp.com/blog/" target="_blank" rel="noopener noreferrer">terraform-aws-iac.md</a>
            </div>
            <h3>Infrastructure as Code: Managing AWS Resources with Terraform</h3>
            <p>Master Infrastructure as Code with Terraform. This guide covers module design, state management, and best practices for managing large-scale AWS infrastructure with confidence.</p>
            <p class="blog-meta">source: <a href="https://www.hashicorp.com/blog/" target="_blank" rel="noopener noreferrer">HashiCorp Blog</a></p>
          </article>
          <article class="blog-entry reveal">
            <div class="blog-line">
              <span class="perm" aria-hidden="true">-rw-r--r--</span>
              <span class="blog-date">2026-01-05</span>
              <a class="blog-file" href="https://www.datadoghq.com/blog/" target="_blank" rel="noopener noreferrer">observability-pillars.md</a>
            </div>
            <h3>Building Observability: Metrics, Logs, and Traces in Modern Systems</h3>
            <p>Understand the three pillars of observability and how to implement comprehensive monitoring strategies using OpenTelemetry, Prometheus, and modern observability platforms.</p>
            <p class="blog-meta">source: <a href="https://www.datadoghq.com/blog/" target="_blank" rel="noopener noreferrer">Datadog Blog</a></p>
          </article>
          <article class="blog-entry reveal">
            <div class="blog-line">
              <span class="perm" aria-hidden="true">-rw-r--r--</span>
              <span class="blog-date">2025-12-28</span>
              <a class="blog-file" href="https://www.docker.com/blog/" target="_blank" rel="noopener noreferrer">container-supply-chain-security.md</a>
            </div>
            <h3>Docker and Container Security: Securing Your Container Supply Chain</h3>
            <p>Secure your containerized applications from build to production. Learn image scanning, runtime security, and vulnerability management techniques for a hardened container environment.</p>
            <p class="blog-meta">source: <a href="https://www.docker.com/blog/" target="_blank" rel="noopener noreferrer">Docker Blog</a></p>
          </article>
          <article class="blog-entry reveal">
            <div class="blog-line">
              <span class="perm" aria-hidden="true">-rw-r--r--</span>
              <span class="blog-date">2025-12-20</span>
              <a class="blog-file" href="https://www.cncf.io/blog/" target="_blank" rel="noopener noreferrer">gitops-declarative-infra.md</a>
            </div>
            <h3>GitOps: The Future of Declarative Infrastructure Management</h3>
            <p>Explore GitOps principles and tools like ArgoCD and Flux. Learn how to manage your infrastructure and applications declaratively using Git as the single source of truth.</p>
            <p class="blog-meta">source: <a href="https://www.cncf.io/blog/" target="_blank" rel="noopener noreferrer">CNCF Blog</a></p>
          </article>
        </div>
      </div>
    </section>

    <!-- Contact -->
    <section id="contact" class="section">
      <div class="container">
        <div class="section-head reveal">
          <h2><span class="accent">$</span>./contact.sh<span class="cursor">_</span></h2>
        </div>
        <div class="contact-grid">
          <div class="term reveal">
            <div class="term-bar">
              <span class="dot dot-r"></span><span class="dot dot-a"></span><span class="dot dot-g"></span>
              <span class="term-title">whois — huy</span>
            </div>
            <div class="term-body">
              <p class="prompt">whois huy</p>
              <dl class="kv contact-kv">
                <div><dt>address</dt><dd>91 Tran Tan Street, Ho Chi Minh City, Viet Nam</dd></div>
                <div><dt>phone</dt><dd>+84 903 336 493</dd></div>
                <div><dt>email</dt><dd><a href="mailto:huynguyen2603989@gmail.com">huynguyen2603989@gmail.com</a></dd></div>
                <div><dt>status</dt><dd><span class="accent">● online</span> — open to opportunities</dd></div>
              </dl>
            </div>
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
                <button type="submit" class="btn-cmd btn-primary">./send-message.sh</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
```

- [ ] **Step 2: Append to `terminal.css`:**

```css
/* ---------- Certifications ---------- */
.cert-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 24px; justify-items: center; margin-top: 18px; }
.cert { display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 12px; color: var(--text); transition: transform .2s; }
.cert:hover { transform: scale(1.05); text-decoration: none; color: var(--green); }
.cert img { width: 140px; height: auto; }

/* ---------- Blog ---------- */
.blog-list { display: grid; gap: 16px; }
.blog-entry { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; transition: border-color .2s; }
.blog-entry:hover { border-color: var(--green-dim); }
.blog-line { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; margin-bottom: 8px; }
.perm { color: var(--text-dim); }
.blog-date { color: var(--amber); }
.blog-file { color: var(--cyan); word-break: break-all; }
.blog-entry h3 { color: var(--text-bright); font-size: 16px; margin-bottom: 6px; }
.blog-entry p { font-size: 14px; }
.blog-meta { margin-top: 10px; font-size: 13px; color: var(--text-dim); }

/* ---------- Contact ---------- */
.contact-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 24px; align-items: start; }
.contact-kv { display: grid; gap: 8px; margin-top: 14px; }
.contact-kv dt { min-width: 76px; }
@media (max-width: 860px) { .contact-grid { grid-template-columns: 1fr; } }
.term-form { display: grid; gap: 16px; }
.term-form label { display: grid; gap: 6px; font-size: 13px; color: var(--cyan); }
.term-form input, .term-form textarea {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 10px 12px; color: var(--text-bright); font-family: inherit; font-size: 14px;
}
.term-form input:focus, .term-form textarea:focus { outline: none; border-color: var(--green); box-shadow: 0 0 10px rgba(34, 197, 94, .2); }
```

- [ ] **Step 3: Verify**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/ | grep -c 'blog-entry'
curl -s http://localhost:8080/ | grep -c 'class="cert"'
curl -s http://localhost:8080/ | grep -c 'forms/contact.php'
```
Expected: `6`, `3`, `1`. Browser: cert badges render (3 PNGs), blog file listing, two-column contact with terminal form.

- [ ] **Step 4: Kill server and commit**

```bash
kill %1
git add src/aws-s3-web/index.html src/aws-s3-web/assets/css/terminal.css
git commit -m "feat(web): certifications, blog listing, and contact sections"
```

---

### Task 5: terminal.js — boot loader, typing, nav, reveal, skill bars

**Files:**
- Create: `src/aws-s3-web/assets/js/terminal.js`

**Interfaces:**
- Consumes IDs/classes from Tasks 1–2: `boot-loader`, `boot-lines`, `hero-boot`, `typed-role`, `nav-toggle`, `nav-menu`, `.nav-menu a`, `.reveal`, `.skill-grid`, `.skill-bar[data-level]`, `.skill-track`, `.skill-val`, `scroll-top`, `year`, and the `no-js` class on `<html>`.
- Produces: adds `reduced-motion` class to `<html>` when the media query matches (consumed by CSS from Tasks 1–2); Task 6 appends the skills-universe IIFE to this same file.

- [ ] **Step 1: Create `src/aws-s3-web/assets/js/terminal.js`:**

```js
/* Terminal portfolio interactions */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.remove('no-js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) root.classList.add('reduced-motion');

  /* ---------- Boot loader ---------- */
  const loader = document.getElementById('boot-loader');
  const dismissLoader = () => { if (loader) loader.classList.add('done'); };
  if (loader && !reduced) {
    const box = document.getElementById('boot-lines');
    const lines = [
      'mounting /dev/portfolio',
      'loading modules: aws terraform kubernetes',
      'starting ci-cd.service',
      'SYSTEM ONLINE — welcome, visitor',
    ];
    lines.forEach((line, i) => {
      setTimeout(() => {
        const row = document.createElement('div');
        const ok = document.createElement('span');
        ok.className = 'ok';
        ok.textContent = '[ OK ] ';
        row.appendChild(ok);
        row.appendChild(document.createTextNode(line));
        box.appendChild(row);
      }, 250 + i * 350);
    });
    setTimeout(dismissLoader, 250 + lines.length * 350 + 450);
    setTimeout(dismissLoader, 3000); /* hard guarantee: never blocks content */
  } else {
    dismissLoader();
  }

  /* ---------- Hero boot lines ---------- */
  const heroBoot = document.getElementById('hero-boot');
  const heroBootText = '$ ssh visitor@portfolio\n$ systemctl status career\n  ● active (running) since Jan 2020 — 5+ years';
  if (heroBoot && !reduced) {
    let i = 0;
    const typeBoot = () => {
      heroBoot.textContent = heroBootText.slice(0, i);
      if (i++ <= heroBootText.length) setTimeout(typeBoot, 16);
    };
    setTimeout(typeBoot, 900);
  } else if (heroBoot) {
    heroBoot.textContent = heroBootText;
  }

  /* ---------- Typed rotating role ---------- */
  const roleEl = document.getElementById('typed-role');
  if (roleEl && !reduced) {
    const roles = ['DevOps Engineer', 'Developer', 'Freelancer'];
    let r = 0;
    let pos = roles[0].length;
    let deleting = true;
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
    setTimeout(tick, 3400);
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

  /* ---------- Active nav link on scroll ---------- */
  const navLinks = Array.from(document.querySelectorAll('.nav-menu a'));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);
  const setActive = () => {
    if (!sections.length) return;
    const y = window.scrollY + 90;
    let current = sections[0];
    for (const s of sections) { if (s.offsetTop <= y) current = s; }
    navLinks.forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
    });
  };
  setActive();
  window.addEventListener('scroll', setActive, { passive: true });

  /* ---------- Reveal on scroll + skill bar animation ---------- */
  const animateBar = (bar) => {
    const level = parseInt(bar.dataset.level, 10) || 0;
    const track = bar.querySelector('.skill-track');
    const val = bar.querySelector('.skill-val');
    if (!track || !val) return;
    let pct = 0;
    const draw = () => {
      const filled = Math.round(pct / 10);
      track.textContent = '[' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ']';
      val.textContent = pct + '%';
      if (pct < level) { pct = Math.min(level, pct + 3); setTimeout(draw, 30); }
    };
    draw();
  };

  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        if (entry.target.classList.contains('skill-grid')) {
          entry.target.querySelectorAll('.skill-bar').forEach(animateBar);
        }
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  }

  /* ---------- Scroll-to-top button ---------- */
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

- [ ] **Step 2: Syntax-check**

```bash
node --check src/aws-s3-web/assets/js/terminal.js
```
Expected: no output (exit 0).

- [ ] **Step 3: Verify in browser**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
curl -s http://localhost:8080/assets/js/terminal.js | head -2
```
Expected: the file header comment. In the browser (hard refresh): boot loader types 4 `[ OK ]` lines then fades (< 3 s); hero terminal lines type out; role text cycles DevOps Engineer → Developer → Freelancer; sections fade in on scroll; skill bars animate from 0; nav highlights the current section; scroll-top button appears after scrolling; at < 900 px width the ≡ button toggles the menu. Also verify with DevTools "Emulate CSS prefers-reduced-motion: reduce" + reload: no loader, no typing, everything visible immediately.

- [ ] **Step 4: Kill server and commit**

```bash
kill %1
git add src/aws-s3-web/assets/js/terminal.js
git commit -m "feat(web): terminal.js — boot loader, typing effects, nav, reveals, skill bars"
```

---

### Task 6: Skills universe canvas (drag to explore)

**Files:**
- Modify: `src/aws-s3-web/assets/js/terminal.js` (append a second IIFE at end of file)

**Interfaces:**
- Consumes from Task 2: `#skills-canvas` (CSS gives it `width: 100%; height: 380px; touch-action: none`), `.dragging` class styling.
- Produces: self-contained; nothing downstream consumes it.

- [ ] **Step 1: Append to `src/aws-s3-web/assets/js/terminal.js`:**

```js
/* Skills universe — draggable constellation canvas */
(() => {
  'use strict';

  const canvas = document.getElementById('skills-canvas');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canvas || reduced || !canvas.getContext) return;

  const skills = [
    { name: 'AWS', level: 90 }, { name: 'Python', level: 90 },
    { name: 'Jenkins', level: 85 }, { name: 'Git', level: 85 },
    { name: 'Ansible', level: 80 }, { name: 'Docker', level: 80 },
    { name: 'Groovy', level: 80 }, { name: 'Linux', level: 75 },
    { name: 'Terraform', level: 75 }, { name: 'Helm', level: 75 },
    { name: 'GitHub Actions', level: 75 }, { name: 'Kubernetes', level: 70 },
    { name: 'ArgoCD', level: 70 }, { name: 'Grafana', level: 65 },
    { name: 'Prometheus', level: 65 }, { name: 'Azure', level: 60 },
  ];

  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const WORLD = { w: 2200, h: 1200 };
  let W = 0;
  let H = 0;
  let camX = 0;
  let camY = 0;

  const nodes = skills.map((s, i) => ({
    name: s.name,
    x: Math.random() * WORLD.w,
    y: Math.random() * WORLD.h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: 8 + s.level * 0.22,
    color: i % 2 ? '#22d3ee' : '#22c55e',
  }));

  const resize = () => {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  resize();
  camX = (WORLD.w - W) / 2;
  camY = (WORLD.h - H) / 2;
  window.addEventListener('resize', resize);

  const mod = (v, m) => ((v % m) + m) % m;

  /* Drag to pan */
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    camX -= e.clientX - lastX;
    camY -= e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => { dragging = false; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* Render loop (runs only while canvas is on screen) */
  let running = false;
  let rafId = 0;
  const MARGIN = 150;
  const LINK_DIST = 190;

  const frame = () => {
    ctx.clearRect(0, 0, W, H);

    const pts = nodes.map((n) => {
      n.x = mod(n.x + n.vx, WORLD.w);
      n.y = mod(n.y + n.vy, WORLD.h);
      const sx = mod(n.x - camX + MARGIN, WORLD.w) - MARGIN;
      const sy = mod(n.y - camY + MARGIN, WORLD.h) - MARGIN;
      const vis = sx > -MARGIN && sx < W + MARGIN && sy > -MARGIN && sy < H + MARGIN;
      return { n, sx, sy, vis };
    });

    /* constellation lines */
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const a = pts[i];
        const b = pts[j];
        if (!a.vis || !b.vis) continue;
        const d = Math.hypot(a.sx - b.sx, a.sy - b.sy);
        if (d < LINK_DIST) {
          ctx.strokeStyle = 'rgba(34, 197, 94, ' + (0.25 * (1 - d / LINK_DIST)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
    }

    /* nodes + labels */
    for (const p of pts) {
      if (!p.vis) continue;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(15, 20, 32, 0.9)';
      ctx.strokeStyle = p.n.color;
      ctx.shadowColor = p.n.color;
      ctx.shadowBlur = 14;
      ctx.arc(p.sx, p.sy, p.n.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e6edf3';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.n.name, p.sx, p.sy + p.n.r + 16);
    }

    if (running) rafId = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !running) {
        running = true;
        rafId = requestAnimationFrame(frame);
      } else if (!entry.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    });
  }, { threshold: 0.05 });
  io.observe(canvas);
})();
```

- [ ] **Step 2: Syntax-check**

```bash
node --check src/aws-s3-web/assets/js/terminal.js
```
Expected: no output (exit 0).

- [ ] **Step 3: Verify in browser**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
```
Open `http://localhost:8080/#skills`: glowing green/cyan nodes drift slowly with faint connecting lines; dragging pans the field (cursor becomes grabbing); nodes wrap around; labels readable. Scroll the canvas off-screen and confirm CPU drops (rAF paused — check via DevTools Performance monitor if in doubt). Test touch-drag via DevTools device emulation.

- [ ] **Step 4: Kill server and commit**

```bash
kill %1
git add src/aws-s3-web/assets/js/terminal.js
git commit -m "feat(web): drag-to-explore skills universe canvas"
```

---

### Task 7: Full-site audit — assets, links, responsive, accessibility

**Files:**
- Modify (only if audit finds issues): `src/aws-s3-web/index.html`, `src/aws-s3-web/assets/css/terminal.css`, `src/aws-s3-web/assets/js/terminal.js`

**Interfaces:**
- Consumes: the completed site from Tasks 1–6. Produces: verified, deployable site.

- [ ] **Step 1: Verify every local asset referenced by the page exists**

```bash
cd src/aws-s3-web
grep -o 'assets/[a-zA-Z0-9/._-]*' index.html | sort -u | while read -r f; do
  [ -f "$f" ] || echo "MISSING: $f"
done
```
Expected: no output. Fix any `MISSING:` line by correcting the path in `index.html`.

- [ ] **Step 2: Verify all external links respond**

```bash
cd src/aws-s3-web
grep -o 'https://[^"]*' index.html | sort -u | while read -r u; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -L "$u")
  echo "$code $u"
done
```
Expected: every line starts with 2xx or 3xx (Credly/LinkedIn may return 403/999 to curl — verify those two manually in the browser instead; that is acceptable).

- [ ] **Step 3: Confirm no leftover template references**

```bash
grep -n 'bootstrap\|BootstrapMade\|Alex Smith\|vendor/' src/aws-s3-web/index.html
```
Expected: no output.

- [ ] **Step 4: Responsive + accessibility pass in browser**

```bash
cd src/aws-s3-web && python3 -m http.server 8080 &
sleep 1
```
In the browser check, at 375 px, 768 px, and ≥ 1200 px widths:
- No horizontal scrollbar at any width.
- Mobile menu opens/closes; every nav link scrolls to its section and highlights.
- Tab through the page: focus outlines visible on links, buttons, and form fields.
- Emulate `prefers-reduced-motion: reduce`: no loader, no canvas, no typing, bars pre-filled, all content visible.
- Disable JavaScript (DevTools → Settings → Debugger): loader hidden, all sections visible, bars pre-filled.

Fix anything that fails, re-check, then:

- [ ] **Step 5: Kill server and commit any fixes**

```bash
kill %1
git status --short
# if fixes were made:
git add src/aws-s3-web
git commit -m "fix(web): audit fixes — responsive/a11y/link corrections"
```
