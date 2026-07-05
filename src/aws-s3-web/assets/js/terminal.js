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
    const cursor = document.createElement('span');
    cursor.className = 'boot-cursor';
    cursor.textContent = '_';
    const lines = [
      'mounting /dev/portfolio',
      'loading modules: aws terraform kubernetes',
      'starting ci-cd.service',
      'SYSTEM.KERNEL :: v1.0.0 ONLINE — welcome, visitor',
    ];
    lines.forEach((line, i) => {
      setTimeout(() => {
        const row = document.createElement('div');
        const ok = document.createElement('span');
        ok.className = 'ok';
        ok.textContent = '[ OK ]';
        row.appendChild(ok);
        row.appendChild(document.createTextNode(line));
        if (box) { box.appendChild(row); box.appendChild(cursor); }
      }, 250 + i * 350);
    });
    setTimeout(dismissLoader, 250 + lines.length * 350 + 500);
    setTimeout(dismissLoader, 3200); /* hard guarantee: never blocks content */
  } else {
    dismissLoader();
  }

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

/* Background grid canvas — GitHub-themed "caro" grid with cursor spotlight */
(() => {
  'use strict';
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  const CELL = 44;

  let w = 0, h = 0;
  let raf = null;

  const draw = () => {
    raf = null;
    ctx.clearRect(0, 0, w, h);

    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#30363d';

    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += CELL) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 0; y <= h; y += CELL) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const schedule = () => { if (raf === null) raf = requestAnimationFrame(draw); };

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    schedule();
  };

  window.addEventListener('resize', resize, { passive: true });

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', () => setTimeout(schedule, 0));

  resize();
})();
