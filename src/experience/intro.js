// Cinematic opening: light ribbons, the Moon rising out of black, the title,
// then Start splits into the two modes (Beginner / Professional).

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

export function mountIntro({ onChoose, siteCount = 29 }) {
  const seen = (() => { try { return localStorage.getItem('lsp.introSeen') === '1'; } catch { return false; } })();
  const base = import.meta.env.BASE_URL;
  const el = document.createElement('div');
  el.id = 'xp-intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Welcome to Lunar Site Planner');
  if (seen) el.classList.add('is-fast');
  el.innerHTML = `
    <div class="xp-ribbons">${ribbonsHtml()}</div>
    <button type="button" class="xp-skip">Skip intro</button>
    <div class="xp-stage">
      <div class="xp-moon-wrap">
        <div class="xp-moon-glow"></div>
        <div class="xp-moon" style="background-image:url('${base}data/moonGlobal.jpg')"></div>
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
    </div>
    <div class="xp-stats">
      <span class="xp-stat"><b>${siteCount}</b> landing sites</span>
      <span class="xp-stat"><b>NASA LOLA</b> terrain horizons</span>
      <span class="xp-stat">Matches <b>JPL Horizons</b> to &lt; 0.01°</span>
    </div>`;
  document.body.appendChild(el);

  const start = el.querySelector('.xp-start');
  const modes = el.querySelector('.xp-modes');
  const cta = el.querySelector('.xp-cta');

  const split = () => {
    if (modes.classList.contains('is-open')) return;
    start.classList.add('is-splitting');
    setTimeout(() => {
      cta.style.display = 'none';
      el.classList.add('is-choosing');
      modes.classList.add('is-open');
      modes.querySelector('.xp-mode')?.focus();
    }, 260);
  };

  start.addEventListener('click', split);
  el.querySelector('.xp-skip').addEventListener('click', () => {
    el.classList.add('is-fast');
    el.querySelector('.xp-skip').remove();
  });
  modes.querySelectorAll('.xp-mode').forEach((b) => {
    b.addEventListener('click', () => {
      try { localStorage.setItem('lsp.introSeen', '1'); } catch {}
      el.classList.add('is-leaving');
      onChoose(b.dataset.mode);
      setTimeout(() => el.remove(), 850);
    });
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement === start) split();
  });
  setTimeout(() => start.focus({ preventScroll: true }), seen ? 300 : 2600);
  return el;
}
