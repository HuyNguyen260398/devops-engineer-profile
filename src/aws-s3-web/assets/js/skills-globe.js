/* Skills.json — rotating icon globe (Three.js global build via classic <script> CDN tags) */
(async () => {
  'use strict';

  const stage = document.getElementById('skills-stage');
  if (!stage) return;

  const badgeEls = Array.from(stage.querySelectorAll('.badge'));
  if (!badgeEls.length) return;

  const skills = badgeEls.map((b) => ({
    color: b.dataset.color || '#3fb950',
    label: (b.querySelector('span') && b.querySelector('span').textContent.trim()) || '',
    svg: (b.querySelector('svg') && b.querySelector('svg').outerHTML) || '',
  }));

  const showStaticFallback = () => {
    const staticBox = document.querySelector('.skills-static');
    if (!staticBox || staticBox.classList.contains('show')) return;
    const grid = document.createElement('div');
    grid.className = 'badge-grid';
    badgeEls.forEach((b) => { b.style.left = b.style.top = ''; grid.appendChild(b); });
    staticBox.appendChild(grid);
    staticBox.classList.add('show');
  };

  const reduced = document.documentElement.classList.contains('reduced-motion');
  if (reduced) { showStaticFallback(); return; }

  const THREE = window.THREE;
  const OrbitControls = THREE && THREE.OrbitControls;
  if (!THREE || !OrbitControls) { showStaticFallback(); return; }

  const cssVar = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };

  const svgToImage = (svgMarkup, color) => new Promise((resolve, reject) => {
    const colored = svgMarkup.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" style="color:${color}" `);
    const blob = new Blob([colored], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('icon load failed')); };
    img.src = url;
  });

  const fibonacciSphere = (n, radius) => {
    const pts = [];
    const offset = 2 / n;
    const increment = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = (i * offset) - 1 + offset / 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * increment;
      pts.push(new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(radius));
    }
    return pts;
  };

  let renderer, scene, camera, controls, wireMat, running = true;
  const sprites = [];

  try {
    const width = stage.clientWidth;
    const height = stage.clientHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Distance chosen so the sphere (radius 2.6) plus sprite half-height (~0.7) stays
    // inside the vertical frustum with margin — sprites were clipping near the poles at z=7.
    camera.position.set(0, 0, 9);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.className = 'skills-canvas';
    stage.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const icoGeo = new THREE.IcosahedronGeometry(2.1, 2);
    const wireGeo = new THREE.WireframeGeometry(icoGeo);
    wireMat = new THREE.LineBasicMaterial({
      color: cssVar('--green', '#3fb950'), transparent: true, opacity: 0.25,
    });
    group.add(new THREE.LineSegments(wireGeo, wireMat));

    const points = fibonacciSphere(skills.length, 2.6);
    const textColor = cssVar('--text-dim', '#8b949e');

    await Promise.all(skills.map(async (skill, i) => {
      const img = await svgToImage(skill.svg, skill.color).catch(() => null);
      if (!img) return;

      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size + 34;
      const ctx = canvas.getContext('2d');
      const pad = 10;
      ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
      ctx.font = '600 20px "JetBrains Mono", monospace';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.fillText(skill.label, size / 2, size + 24);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      const aspect = canvas.height / canvas.width;
      sprite.scale.set(1.1, 1.1 * aspect, 1);
      sprite.position.copy(points[i]);
      group.add(sprite);
      sprites.push({ sprite, canvas, ctx, img, label: skill.label });
    }));

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.1;
  } catch (e) {
    showStaticFallback();
    return;
  }

  const animate = () => {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);

  const onResize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize, { passive: true });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (en.isIntersecting && !running) { running = true; requestAnimationFrame(animate); }
        else if (!en.isIntersecting) { running = false; }
      });
    }, { threshold: 0 });
    io.observe(stage);
  }

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      setTimeout(() => {
        wireMat.color.set(cssVar('--green', '#3fb950'));
        const textColor2 = cssVar('--text-dim', '#8b949e');
        sprites.forEach(({ canvas, ctx, img, label, sprite }) => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const size = canvas.width, pad = 10;
          ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
          ctx.font = '600 20px "JetBrains Mono", monospace';
          ctx.fillStyle = textColor2;
          ctx.textAlign = 'center';
          ctx.fillText(label, size / 2, size + 24);
          sprite.material.map.needsUpdate = true;
        });
      }, 0);
    });
  }
})();
