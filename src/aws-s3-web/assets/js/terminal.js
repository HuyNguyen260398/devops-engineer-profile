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
