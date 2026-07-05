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
