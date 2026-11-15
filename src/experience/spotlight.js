// Spotlight guide: everything except one area is blurred and dimmed, the
// area stays sharp inside a glowing ring, and Lumi explains it in a bubble.

import { setLumi } from './lumi.js';

let root = null;

function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'xp-spot';
  root.innerHTML = `<div class="xp-spot-veil"></div><div class="xp-spot-ring"></div>
    <div class="xp-coach"><div class="lumi-slot"></div><div class="xp-bubble"></div></div>`;
  document.body.appendChild(root);
  return root;
}

function holeClip(r, pad) {
  const x1 = Math.max(0, r.left - pad), y1 = Math.max(0, r.top - pad);
  const x2 = Math.min(innerWidth, r.right + pad), y2 = Math.min(innerHeight, r.bottom + pad);
  // Outer rectangle, then the hole traced in reverse: a "donut" polygon.
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px)`;
}

function placeCoach(coach, r) {
  const cw = coach.offsetWidth || 380, ch = coach.offsetHeight || 220, m = 18;
  let left, top;
  if (!r) {
    left = (innerWidth - cw) / 2; top = (innerHeight - ch) / 2;
  } else if (innerWidth - r.right > cw + m * 2) {
    left = r.right + m; top = r.top + Math.min(40, r.height / 3);
  } else if (r.left > cw + m * 2) {
    left = r.left - cw - m; top = r.top + Math.min(40, r.height / 3);
  } else if (innerHeight - r.bottom > ch + m) {
    left = r.left + r.width / 2 - cw / 2; top = r.bottom + m;
  } else if (r.top > ch + m) {
    left = r.left + r.width / 2 - cw / 2; top = r.top - ch - m;
  } else {
    // Big target (for example the globe): sit inside its lower-left corner.
    left = r.left + 24; top = r.bottom - ch - 24;
  }
  coach.style.left = `${Math.round(Math.max(12, Math.min(innerWidth - cw - 12, left)))}px`;
  coach.style.top = `${Math.round(Math.max(12, Math.min(innerHeight - ch - 12, top)))}px`;
}

/**
 * steps: [{ target: selector | () => Element, title, body, why, mood, extra, before }]
 * Returns { start(), stop() }.
 */
export function createSpotlight(steps, { label = 'Guide', onDone } = {}) {
  let i = 0;
  let active = false;
  const onResize = () => active && show(i, false);
  const onKey = (e) => {
    if (!active) return;
    if (e.key === 'Escape') stop();
    else if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
  };

  function targetEl(step) {
    if (!step.target) return null;
    const el = typeof step.target === 'function' ? step.target() : document.querySelector(step.target);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 ? el : null;
  }

  function show(idx, animate = true) {
    const step = steps[idx];
    const r0 = ensureRoot();
    const veil = r0.querySelector('.xp-spot-veil');
    const ring = r0.querySelector('.xp-spot-ring');
    const coach = r0.querySelector('.xp-coach');
    const bubble = coach.querySelector('.xp-bubble');
    const el = targetEl(step);
    const pad = step.pad ?? 10;
    const r = el?.getBoundingClientRect();

    if (r) {
      veil.style.clipPath = holeClip(r, pad);
      Object.assign(ring.style, { display: 'block', left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    } else {
      veil.style.clipPath = 'none';
      ring.style.display = 'none';
    }

    if (animate) {
      const last = idx === steps.length - 1;
      bubble.innerHTML = `
        <div class="b-step">${label} · ${idx + 1} of ${steps.length}</div>
        <h4>${step.title}</h4>
        <p>${step.body}</p>
        ${step.extra || ''}
        ${step.why ? `<div class="b-why">${step.why}</div>` : ''}
        <div class="b-row">
          <div class="b-dots">${steps.map((_, k) => `<i class="${k === idx ? 'on' : ''}"></i>`).join('')}</div>
          <div style="display:flex;gap:6px;align-items:center">
            ${step.why ? '<button type="button" class="xp-link" data-a="why">Why?</button>' : ''}
            ${idx > 0 ? '<button type="button" class="xp-link" data-a="back">Back</button>' : '<button type="button" class="xp-link" data-a="skip">Skip</button>'}
            <button type="button" class="xp-btn xp-btn-primary" data-a="next">${last ? 'Done' : 'Next'}</button>
          </div>
        </div>`;
      bubble.style.animation = 'none'; void bubble.offsetWidth; bubble.style.animation = '';
      bubble.querySelector('[data-a="next"]').addEventListener('click', () => go(idx + 1));
      bubble.querySelector('[data-a="back"]')?.addEventListener('click', () => go(idx - 1));
      bubble.querySelector('[data-a="skip"]')?.addEventListener('click', stop);
      bubble.querySelector('[data-a="why"]')?.addEventListener('click', () => {
        bubble.querySelector('.b-why')?.classList.toggle('is-open');
        setLumi(coach.querySelector('.lumi-slot'), 'think', 'hop', 84);
        requestAnimationFrame(() => placeCoach(coach, r));
      });
      setLumi(coach.querySelector('.lumi-slot'), step.mood || 'happy', idx === steps.length - 1 ? 'cheer' : 'hop', 84);
      setTimeout(() => bubble.querySelector('[data-a="next"]')?.focus({ preventScroll: true }), 50);
    }
    requestAnimationFrame(() => placeCoach(coach, r));
  }

  function go(idx) {
    if (idx < 0) return;
    if (idx >= steps.length) return stop(true);
    i = idx;
    const step = steps[i];
    const wait = step.before ? step.before() : 0;
    setTimeout(() => show(i), typeof wait === 'number' ? wait : 0);
  }

  function start(from = 0) {
    ensureRoot();
    active = true;
    root.classList.add('is-on');
    addEventListener('resize', onResize);
    addEventListener('keydown', onKey);
    go(from);
  }

  function stop(done = false) {
    active = false;
    root?.classList.remove('is-on');
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onKey);
    if (done && onDone) onDone();
  }

  return { start, stop, get active() { return active; } };
}
