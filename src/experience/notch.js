// Apple-style "dynamic island" status pill for Pro mode.
// Shows scanning activity, then the live verdict with rolling numbers that
// flash green when a value rises and red when it falls.

let el = null;
let last = { watts: null, clear: null };
let busyTimer = null;

export function mountNotch() {
  el = document.createElement('div');
  el.id = 'xp-notch';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<span class="n-dot"></span><span class="n-top">Ready</span>';
  document.body.appendChild(el);
  return el;
}

export function notchBusy(text = 'Scanning LOLA terrain', sub = 'Ray-marching the horizon') {
  if (!el) return;
  clearTimeout(busyTimer);
  el.classList.add('is-busy', 'is-wide');
  el.style.setProperty('--c', '#ffb300');
  el.innerHTML = `<span class="n-dot"></span><span class="n-top">${text}</span><span class="n-sep"></span><span class="n-sub">${sub}</span>`;
}

function flashVal(span, prev, next, fmt) {
  span.textContent = fmt(next);
  if (prev == null || Math.abs(next - prev) < 1e-3) return;
  span.classList.remove('up', 'down', 'roll');
  void span.offsetWidth;
  span.classList.add(next > prev ? 'up' : 'down', 'roll');
  setTimeout(() => span.classList.remove('up', 'down'), 900);
}

export function notchUpdate(now, { playing = false } = {}) {
  if (!el || !now) return;
  const apply = () => {
    el.classList.remove('is-busy');
    el.classList.add('is-wide');
    const p = now.powerStatus, c = now.commsStatus;
    const state = p === 'go' && c === 'go' ? ['GO', '#30d158'] : p === 'no-go' && c === 'no-go' ? ['NO-GO', '#ff453a'] : ['CAUTION', '#ffd60a'];
    el.style.setProperty('--c', state[1]);
    if (!el.querySelector('[data-k="w"]')) {
      el.innerHTML = `<span class="n-dot"></span><span class="n-top" data-k="s"></span><span class="n-sep"></span>
        <span class="n-sub">☀︎</span><span class="n-val" data-k="w"></span><span class="n-sep"></span>
        <span class="n-sub">Earth</span><span class="n-val" data-k="e"></span>`;
    }
    el.querySelector('[data-k="s"]').textContent = playing ? `${state[0]} · live` : state[0];
    flashVal(el.querySelector('[data-k="w"]'), last.watts, now.sun.watts, (v) => `${v.toFixed(0)} W`);
    flashVal(el.querySelector('[data-k="e"]'), last.clear, now.earth.clearance, (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}°`);
    last = { watts: now.sun.watts, clear: now.earth.clearance };
  };
  if (el.classList.contains('is-busy')) {
    clearTimeout(busyTimer);
    busyTimer = setTimeout(apply, 650);
  } else apply();
}
