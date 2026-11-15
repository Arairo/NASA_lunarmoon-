// Experience layer bootstrap: theme, cinematic intro, mode switching,
// dynamic notch, Pro-mode spotlight tour and Creo-style globe controls.

import './experience.css';
import './theme-pro.css';
import { mountIntro } from './intro.js';
import { mountNotch, notchBusy, notchUpdate } from './notch.js';
import { createSpotlight } from './spotlight.js';
import { createWalk } from './walk.js';
import { findBestSpots } from './bestSpots.js';
import { prepareSite, evaluate } from '../core/analysis.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.set('lsp.theme', theme);
  document.querySelectorAll('[data-theme-label]').forEach((b) => { b.textContent = theme === 'dark' ? '☀︎' : '☾'; });
  window.dispatchEvent(new Event('lsp-theme'));
}
export const toggleTheme = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

// Apply the saved theme before anything paints.
applyTheme(store.get('lsp.theme') || 'dark');

const GESTURES = `<div class="xp-gestures">
  <div class="xp-gesture"><div class="xp-mouse m-mid"><span class="w"></span></div><b>Spin</b>Middle-drag<br><span class="xp-key">or left-drag</span></div>
  <div class="xp-gesture"><div class="xp-mouse m-mid"><span class="w"></span></div><b>Pan</b><span class="xp-key">Shift</span> + middle-drag<br><span class="xp-key">or right-drag</span></div>
  <div class="xp-gesture"><div class="xp-mouse m-mid"><span class="w"></span></div><b>Zoom</b>Scroll wheel<br><span class="xp-key">Ctrl</span> + middle-drag</div>
</div>`;

export function initExperience(api) {
  const { app, sites, selectSite, setTime, switchMode, getGlobe } = api;
  const notch = mountNotch();
  document.getElementById('globeViewport')?.appendChild(notch);

  // ---------- Header tools (Pro mode) ----------
  const headerRight = document.querySelector('header > div:last-child');
  if (headerRight) {
    const tools = document.createElement('div');
    tools.className = 'xp-headtools';
    tools.innerHTML = `
      <button type="button" class="xp-chip" data-x="beginner" title="Switch to the guided Beginner walk">Beginner</button>
      <a class="xp-chip" href="./planner.html" title="CesiumJS planner with LOLA 3D terrain, video tutorial and full-precision tools">3D terrain (Cesium)</a>
      <button type="button" class="xp-chip xp-icon-btn" data-x="theme" data-theme-label aria-label="Switch light or dark mode" title="Light / dark"></button>`;
    headerRight.prepend(tools);
    tools.querySelector('[data-x="beginner"]').addEventListener('click', () => setMode('beginner'));
    tools.querySelector('[data-x="theme"]').addEventListener('click', toggleTheme);
    applyTheme(document.documentElement.dataset.theme);
  }

  // ---------- Globe view cluster + gesture hint ----------
  const gv = document.getElementById('globeViewport');
  if (gv) {
    document.getElementById('globeZoomInBtn')?.parentElement?.remove();
    const cube = document.createElement('div');
    cube.className = 'xp-viewcube';
    cube.innerHTML = `
      <button type="button" data-v="in" title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" data-v="out" title="Zoom out" aria-label="Zoom out">−</button>
      <hr>
      <button type="button" data-v="front" title="Front view (near side)" aria-label="Front view">F</button>
      <button type="button" data-v="top" title="Top view (north pole)" aria-label="Top view">T</button>
      <button type="button" data-v="bottom" title="Bottom view (south pole)" aria-label="Bottom view">B</button>
      <button type="button" data-v="reset" title="Reset view" aria-label="Reset view">⟲</button>
      <hr>
      <button type="button" data-v="help" title="How to move the Moon" aria-label="How to move the Moon">?</button>`;
    gv.appendChild(cube);
    const hint = document.createElement('div');
    hint.className = 'xp-mode-hint';
    gv.appendChild(hint);
    api.setHint = (txt) => { hint.textContent = txt || ''; hint.classList.toggle('is-on', !!txt); };
    cube.addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      const g = getGlobe();
      if (!v || !g) return;
      if (v === 'in') g.zoomBy(0.75);
      else if (v === 'out') g.zoomBy(1.32);
      else if (v === 'reset') g.reset();
      else if (v === 'help') controlsCoach.start();
      else g.view(v);
    });
  }

  const controlsCoach = createSpotlight([
    {
      target: '#globeViewport', pad: 0, mood: 'wow',
      title: 'Move the Moon like a CAD model',
      body: 'The controls work like PTC Creo. No middle button? Left-drag and right-drag do the same jobs.',
      extra: GESTURES,
      why: 'Engineers spend hours in CAD tools like Creo, so we copied their mouse layout. The buttons on the right jump to standard views: F (front, the side facing Earth), T (top, north pole), B (bottom, south pole) and ⟲ to reset.',
    },
  ], { label: 'Controls', onDone: () => store.set('lsp.controlsSeen', '1') });

  // ---------- Pro-mode tour ----------
  const proTour = createSpotlight([
    { target: null, mood: 'happy', title: 'Welcome to Professional mode', body: 'Everything a mission planner needs is on one screen. I’ll walk you round it in under a minute.' },
    { target: '#paneSite', mood: 'think', title: 'Pick a landing site', body: 'Choose from Apollo, CLPS, Chandrayaan-3, Chang’e and computed best-lit spots, or type your own coordinates with “+ Coords”.', why: 'Sites marked “computed” were found by scanning NASA LOLA terrain for the places that see the most Sun in 2027.' },
    { target: '#globeViewport', pad: 0, mood: 'wow', title: 'The 3D Moon', body: 'Gold is the direction of the Sun from your site; blue is Earth. Click anywhere on the surface to test that exact spot.', extra: GESTURES },
    { target: '#xp-notch', pad: 8, mood: 'happy', title: 'Live status', body: 'This pill tells you, at a glance, whether you have power and a radio link right now. The numbers flash green when they rise and red when they fall.' },
    { target: '#clockToolbar', mood: 'think', title: 'Travel through time', body: 'Change the date (UTC), step by hours or days, or press Play to watch the Sun circle the sky.', why: 'At the south pole the Sun circles the whole horizon once every 29.5 days. Play at 6 h/s to watch it skim the ridges.' },
    { target: '#timelineWrap', mood: 'happy', title: 'The operations timeline', body: 'Each row is a resource over the window: sunlight, power, Earth in view, Deep Space Network coverage and the direct-to-Earth link. Drag across it to scrub time.' },
    { target: '#paneResults', mood: 'think', title: 'The assessment', body: 'GO / CAUTION / NO-GO now, the terrain skyline, time to sunset and Earthset, battery size and link margin.', why: 'Power and link figures depend on the spacecraft assumptions (⚙ Spacecraft): panel area, efficiency, load, mast height and radio.' },
    { target: '#modeCompareBtn', mood: 'wow', title: 'Compare scenarios', body: 'Add the current site and date, then test launch slips of 1–3 months or nearby sunnier spots side by side, and export to CSV.' },
    { target: '.xp-headtools', mood: 'happy', title: 'Make it yours', body: 'Switch between light and dark, or hop back to the Beginner walk any time. Press ? on the globe to see the controls again.' },
  ], { label: 'Tour' });

  // Replace the old tour button with the spotlight tour.
  const oldTour = document.getElementById('tourStartBtn');
  if (oldTour) {
    const fresh = oldTour.cloneNode(true);
    fresh.textContent = 'Guide me';
    oldTour.replaceWith(fresh);
    fresh.addEventListener('click', () => proTour.start());
  }

  // ---------- Beginner walk ----------
  const walk = createWalk({
    app, sites,
    onToggleTheme: toggleTheme,
    onOpenPro: (site, ms, withTour) => {
      if (site) {
        app.windowStartMs = ms;
        app.timeMs = ms;
        selectSite(site, true);
        setTime(ms, true);
      }
      setMode('pro', { tour: withTour });
    },
  });

  function setMode(mode, { tour = false } = {}) {
    document.body.dataset.mode = mode;
    if (location.hash !== `#${mode}`) history.replaceState(null, '', `#${mode}`);
    if (mode === 'beginner') {
      walk.open();
      return;
    }
    switchMode('explorer');
    document.body.classList.remove('xp-enter'); void document.body.offsetWidth;
    document.body.classList.add('xp-enter');
    setTimeout(() => document.body.classList.remove('xp-enter'), 1400);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      if (tour) proTour.start();
      else if (!store.get('lsp.controlsSeen')) controlsCoach.start();
    }, 500);
  }

  applyTheme(document.documentElement.dataset.theme);

  // ---------- Best landing spots (friend's idea #1) ----------
  const best = { key: '', cancel: null, timer: 0, spots: [] };
  const card = document.createElement('div');
  card.className = 'xp-best';
  card.innerHTML = '<div class="b-head"><span>Best spots · next 30 days</span><button type="button" class="b-x" aria-label="Hide best spots" title="Hide">–</button></div><div class="b-body"></div>';
  document.getElementById('globeViewport')?.appendChild(card);
  card.querySelector('.b-x').addEventListener('click', () => card.classList.toggle('is-min'));
  const pctTxt = (f) => `${Math.round(f * 100)}%`;
  function renderBest(state, progress = 0) {
    const body = card.querySelector('.b-body');
    if (state === 'busy') { body.innerHTML = `<div class="b-busy"><span class="w-spinner" style="width:14px;height:14px;border-width:2px"></span> Searching ${Math.round(progress * 100)}%</div>`; return; }
    body.innerHTML = best.spots.map((sp, i) => `
      <button type="button" class="b-row" data-i="${i}">
        <i style="background:${sp.color}"></i>
        <span class="b-txt"><b>${sp.title}</b><span>${sp.r.site.short && sp.r.site.searched ? 'LOLA search cell' : sp.r.site.name}</span></span>
        <span class="b-num" title="Share of the window with the Sun up AND Earth in view">${pctTxt(sp.r.ops)}</span>
      </button>`).join('') + `<p class="b-note">Ranked by time with both sunlight and Earth in view · ${best.count} candidates</p>`;
    body.querySelectorAll('.b-row').forEach((b) => b.addEventListener('click', () => {
      const sp = best.spots[Number(b.dataset.i)];
      selectSite(sp.r.site, true);
    }));
  }
  function refreshBest() {
    const key = `${app.windowStartMs}|${JSON.stringify(app.config)}`;
    if (key === best.key) return;
    best.key = key;
    clearTimeout(best.timer);
    best.cancel?.();
    renderBest('busy');
    best.timer = setTimeout(() => {
      best.cancel = findBestSpots({
        sites, startMs: app.windowStartMs, config: app.config,
        onProgress: (f) => renderBest('busy', f),
        onDone: ({ flown, overall, count }) => {
          best.count = count;
          best.spots = [];
          if (overall) best.spots.push({ r: overall, color: '#30d158', title: 'Best overall' });
          if (flown && flown.site.id !== overall?.site.id) best.spots.push({ r: flown, color: '#bf5af2', title: 'Best flown site' });
          best.spots.forEach((sp) => { sp.ctx = prepareSite(sp.r.site, null, app.config); });
          getGlobe()?.setHighlights(best.spots.map((sp) => ({ lat: sp.r.site.lat, lon: sp.r.site.lon, color: sp.color, title: sp.title, sub: `${pctTxt(sp.r.ops)} power + Earth` })));
          renderBest('done');
          updateBestLinks();
        },
      });
    }, 350);
  }
  function updateBestLinks() {
    if (!best.spots.length) return;
    getGlobe()?.setHighlightEarth(best.spots.map((sp) => evaluate(app.timeMs, sp.ctx, app.config, { withDsn: false }).earth.los));
  }

  // ---------- Entry ----------
  window.addEventListener('hashchange', () => {
    const m = location.hash.replace('#', '');
    if ((m === 'pro' || m === 'beginner') && document.body.dataset.mode !== m) setMode(m);
  });
  const hashMode = location.hash.replace('#', '');
  if (hashMode === 'pro' || hashMode === 'beginner') {
    setMode(hashMode);
  } else {
    document.body.dataset.mode = 'intro';
    mountIntro({ siteCount: sites.length, onChoose: (m) => setMode(m) });
  }

  return {
    busy: () => notchBusy(),
    update: () => { notchUpdate(app.lastNow, { playing: app.playing }); refreshBest(); updateBestLinks(); },
    proTour, controlsCoach, setMode,
  };
}
