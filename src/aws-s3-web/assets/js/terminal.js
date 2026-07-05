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
