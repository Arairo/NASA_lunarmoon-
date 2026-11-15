// Cinematic opening: light ribbons, the Moon rising out of black, the title,
// then Start splits into the two modes (Beginner / Professional).

import * as THREE from 'three';
import { play, soundOn, toggleSound } from './sound.js';

const RIBBON_COLOURS = ['#ffb300', '#ff7a00', '#ffd60a', '#38bdf8', '#2997ff', '#ffffff', '#ff453a', '#bf5af2'];

function ribbonsHtml(count = 34) {
  let html = '';
  for (let i = 0; i < count; i++) {
    const c = RIBBON_COLOURS[i % RIBBON_COLOURS.length];
    const w = 2 + Math.round(Math.random() * 14);
    const x = Math.round((Math.random() - 0.5) * 140) + 'vw';
    const r = Math.round((Math.random() - 0.5) * 16) + 'deg';
    const d = (Math.random() * 0.7).toFixed(2) + 's';
    const b = (1 + Math.random() * 5).toFixed(1) + 'px';
    html += `<i class="xp-ribbon" style="--c:${c};--w:${w}px;--x:${x};--r:${r};--d:${d};--b:${b}"></i>`;
  }
  return html;
}

/**
 * A real 3D Moon that is "flicked": it starts spinning fast and coasts to a
 * stop, like a desk globe. Angle follows total * (1 - e^(-t/tau)), so the
 * speed decays smoothly. Returns a function that frees the WebGL context.
 */
function spinMoon(canvas, base) {
  const still = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    canvas.style.background = `center / cover url('${base}data/moonGlobal.jpg')`;
    canvas.style.borderRadius = '50%';
    return () => {};
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 4.1);
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(4, 1.6, 2.2); // upper right, like the golden glow behind it
  scene.add(sun);
  const loader = new THREE.TextureLoader();
  let ready = false;
  const tex = loader.load(`${base}data/moonGlobal.jpg`, () => { ready = true; });
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
  moon.rotation.z = 0.12;
  scene.add(moon);
  loader.load(`${base}data/moon_wac_global_4k.jpg`, (hi) => {
    if ('colorSpace' in hi) hi.colorSpace = THREE.SRGBColorSpace;
    mat.map = hi; mat.needsUpdate = true;
  });
  const TOTAL = still ? 0 : Math.PI * 7; // three and a half turns
  const TAU = 1.15; // seconds; the spin is ~99% done after 5*TAU
  const END = -Math.PI / 2; // stop with the near side (the face we see from Earth) toward us
  // Spin time only advances once the image is in and at most 1/30 s per frame,
  // so a busy page (the app booting behind the intro) cannot skip the spin.
  let raf = 0, last = 0, s = 0, alive = true;
  const frame = (t) => {
    if (!alive) return;
    const dt = last ? Math.min(0.033, (t - last) / 1000) : 0;
    last = t;
    if (ready) s += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && (canvas.width !== Math.round(w * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    moon.rotation.y = END - TOTAL * Math.exp(-s / TAU);
    renderer.render(scene, camera);
    if (s < TAU * 7) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    mat.map?.dispose(); mat.dispose(); moon.geometry.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
  };
}

export function mountIntro({ onChoose, onVideo, siteCount = 29 }) {
  const base = import.meta.env.BASE_URL;
  const el = document.createElement('div');
  el.id = 'xp-intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Welcome to Lunar Site Planner');
  el.innerHTML = `
    <div class="xp-ribbons">${ribbonsHtml()}</div>
    <div class="xp-corner"><button type="button" class="xp-skip xp-sound" data-sound-label aria-pressed="${soundOn()}" aria-label="${soundOn() ? 'Mute sounds' : 'Turn sounds on'}">${soundOn() ? '🔊' : '🔇'}</button><button type="button" class="xp-skip">Skip intro</button></div>
    <div class="xp-stage">
      <div class="xp-moon-wrap">
        <div class="xp-moon-glow"></div>
        <canvas class="xp-moon xp-moon3d" aria-hidden="true"></canvas>
      </div>
      <div class="xp-eyebrow">NASA Space Apps 2026 · Lunar south pole</div>
      <h1 class="xp-title">Lunar Site Planner</h1>
      <p class="xp-tagline">Find where the Sun keeps your lander powered and Earth stays in view to call home.</p>
      <div class="xp-modes-wrap">
        <div class="xp-cta"><button type="button" class="xp-btn xp-btn-light xp-start">Start</button></div>
        <div class="xp-modes" role="group" aria-label="Choose a mode">
          <button type="button" class="xp-mode" data-mode="beginner">
            <div class="xp-mode-icon" style="background:linear-gradient(135deg,#ffb300,#ff7a00)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>
            </div>
            <h3>Beginner</h3>
            <p>A calm walk with Lumi. One question at a time, with the “why” whenever you want it.</p>
            <span class="xp-go">Take the walk →</span>
          </button>
          <button type="button" class="xp-mode" data-mode="pro">
            <div class="xp-mode-icon" style="background:linear-gradient(135deg,#2997ff,#5e5ce6)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M3 20h18M6 16l4-6 4 3 5-8"/></svg>
            </div>
            <h3>Professional</h3>
            <p>The full planner: 3D Moon, LOLA terrain horizons, power, DSN links and scenario comparison.</p>
            <span class="xp-go">Open planner →</span>
          </button>
        </div>
      </div>
      <button type="button" class="xp-tourlink">▶ Watch the 85-second tour</button>
      <div class="xp-stats">
      <span class="xp-stat"><b>${siteCount}</b> landing sites</span>
      <span class="xp-stat"><b>NASA LOLA</b> terrain horizons</span>
      <span class="xp-stat">Matches <b>JPL Horizons</b> to &lt; 0.01°</span>
    </div>
    </div>`;
  document.body.appendChild(el);

  const stopSpin = spinMoon(el.querySelector('.xp-moon3d'), base);
  const start = el.querySelector('.xp-start');
  const modes = el.querySelector('.xp-modes');
  const cta = el.querySelector('.xp-cta');

  const split = () => {
    if (modes.classList.contains('is-open')) return;
    play('tadum');
    start.classList.add('is-splitting');
    setTimeout(() => {
      cta.style.display = 'none';
      el.classList.add('is-choosing');
      modes.classList.add('is-open');
      modes.querySelector('.xp-mode')?.focus();
    }, 260);
  };

  start.addEventListener('click', split);
  el.querySelector('.xp-tourlink').addEventListener('click', () => onVideo?.());
  el.querySelector('.xp-sound').addEventListener('click', toggleSound);
  el.querySelector('.xp-skip:not(.xp-sound)').addEventListener('click', (e) => {
    el.classList.add('is-fast');
    e.currentTarget.remove();
  });
  modes.querySelectorAll('.xp-mode').forEach((b) => {
    b.addEventListener('click', () => {
      try { localStorage.setItem('lsp.introSeen', '1'); } catch {}
      play('whoosh');
      el.classList.add('is-leaving');
      onChoose(b.dataset.mode);
      setTimeout(() => { stopSpin(); el.remove(); }, 850);
    });
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement === start) split();
  });
  // The full intro plays on every visit (Skip intro is always there).
  setTimeout(() => start.focus({ preventScroll: true }), 2600);
  return el;
}
