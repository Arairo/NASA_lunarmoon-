// Main application bootstrap: Mission Explorer (Pro mode) and Scenario Compare.
import './tailwind.css';
import './styles.css';
import sitesData from './data/sites.js';
import { clamp, SITE_GROUPS, SITE_BADGES, SYNODIC_MONTH_DAYS } from './core/constants.js';
import { prepareSite, scanWindow, evaluate } from './core/analysis.js';
import { DEFAULT_COMMS_CONFIG } from './core/comms.js';
import { esc, fmtLatLon, fmtUtc } from './ui/format.js';
import { createGlobeRenderer } from './scene/globeRenderer.js';
import { createPolarMapRenderer, ramp } from './ui/polarMap.js';
import { drawTimeline } from './ui/timeline.js';
import { renderAssessmentPanel } from './ui/assessment.js';
import { addScenario, renderCompareTable, exportCompareCsv } from './ui/compare.js';
import { createTour, openGlossary, showToast } from './ui/modals.js';
import { initExperience } from './experience/index.js';

export const app = {
  mode: 'explorer',
  view: 'globe',
  sites: sitesData,
  site: sitesData[0],
  ctx: null,
  scan: null,
  lastNow: null,
  timeMs: Date.UTC(2026, 10, 16, 22, 0, 0),
  windowStartMs: Date.UTC(2026, 10, 16, 22, 0, 0),
  windowDays: 30,
  playing: false,
  speed: 3600,
  categoryFilter: 'all',
  learnExplain: false,
  engineerTelemetry: false,
  realLighting: true,
  polarOverlay: 'none',
  scenarios: [],
  config: {
    mastHeightM: 2.0,
    power: { mode: 'vertical_tracking', areaM2: 2.0, efficiency: 0.29, fixedAzDeg: 0, loadW: 120 },
    // Start from the engine defaults so the link budget has every term it needs
    // (losses, required Eb/N0, DSN minimum elevation).
    comms: { ...DEFAULT_COMMS_CONFIG, preset: 's_mga', minClearanceDeg: 2.0, targetMarginDb: 3.0, dataRateBps: 256000 },
  },
  ui: {
    siteCollapsed: false,
    resultsCollapsed: false,
    timelineCollapsed: false,
    focusMode: false,
  },
};

try {
  const savedUi = JSON.parse(localStorage.getItem('lsp.uiState') || '{}');
  if (typeof savedUi.siteCollapsed === 'boolean') app.ui.siteCollapsed = savedUi.siteCollapsed;
  if (typeof savedUi.resultsCollapsed === 'boolean') app.ui.resultsCollapsed = savedUi.resultsCollapsed;
  if (typeof savedUi.timelineCollapsed === 'boolean') app.ui.timelineCollapsed = savedUi.timelineCollapsed;
} catch {}

let globe = null;
let polar = null;
let xp = null;
const xpApi = { app, sites: sitesData, selectSite: (...a) => selectSite(...a), setTime: (...a) => setTime(...a), switchMode: (...a) => switchMode(...a), getGlobe: () => globe, setHint: () => {} };

export function onLayoutChange() {
  window.dispatchEvent(new Event('resize'));
  if (polar) polar.draw();
}

export function toggleSitePanel(forceCollapse = null) {
  const pane = document.getElementById('paneSite');
  const expandBtn = document.getElementById('expandSiteBtn');
  if (!pane) return;
  const shouldCollapse = forceCollapse !== null ? forceCollapse : !pane.classList.contains('is-collapsed');
  pane.classList.toggle('is-collapsed', shouldCollapse);
  if (expandBtn) expandBtn.classList.toggle('hidden', !shouldCollapse);
  app.ui.siteCollapsed = shouldCollapse;
  try { localStorage.setItem('lsp.uiState', JSON.stringify(app.ui)); } catch {}
  setTimeout(onLayoutChange, 260);
}

export function toggleResultsPanel(forceCollapse = null) {
  const pane = document.getElementById('paneResults');
  const expandBtn = document.getElementById('expandResultsBtn');
  if (!pane) return;
  const shouldCollapse = forceCollapse !== null ? forceCollapse : !pane.classList.contains('is-collapsed');
  pane.classList.toggle('is-collapsed', shouldCollapse);
  if (expandBtn) expandBtn.classList.toggle('hidden', !shouldCollapse);
  app.ui.resultsCollapsed = shouldCollapse;
  try { localStorage.setItem('lsp.uiState', JSON.stringify(app.ui)); } catch {}
  setTimeout(onLayoutChange, 260);
}

export function toggleTimeline(forceCollapse = null) {
  const wrap = document.getElementById('timelineWrap');
  const canvas = document.getElementById('timelineCanvas');
  const icon = document.getElementById('timelineToggleIcon');
  const label = document.getElementById('timelineToggleLabel');
  if (!wrap) return;
  const shouldCollapse = forceCollapse !== null ? forceCollapse : !wrap.classList.contains('is-collapsed');
  wrap.classList.toggle('is-collapsed', shouldCollapse);
  if (canvas) canvas.classList.toggle('hidden', shouldCollapse);
  if (icon) icon.textContent = shouldCollapse ? '▴' : '▾';
  if (label) label.textContent = shouldCollapse ? 'Maximize' : 'Minimize';
  app.ui.timelineCollapsed = shouldCollapse;
  try { localStorage.setItem('lsp.uiState', JSON.stringify(app.ui)); } catch {}
  setTimeout(onLayoutChange, 260);
}

export function toggleFocusMode() {
  app.ui.focusMode = !app.ui.focusMode;
  const label = document.getElementById('focusModeLabel');
  if (label) label.textContent = app.ui.focusMode ? 'Restore View' : 'Maximize';
  if (app.ui.focusMode) {
    toggleSitePanel(true);
    toggleResultsPanel(true);
    toggleTimeline(true);
    showToast('Focus Mode: sidebars & timeline minimized');
  } else {
    toggleSitePanel(false);
    toggleResultsPanel(false);
    toggleTimeline(false);
    showToast('Restored standard layout');
  }
}

export function selectSite(site, fly = false) {
  if (!site) return;
  app.site = site;
  xp?.busy();
  app.ctx = prepareSite(site, null, app.config);
  app.scan = scanWindow(app.ctx, app.windowStartMs, app.windowDays, app.config);
  const heading = document.getElementById('timelineHeading');
  if (heading) heading.textContent = `Operations timeline · ${site.short || site.name}`;
  renderSiteList();
  updateCurrentTime(true);
  if (fly && globe) globe.flyToSite(site);
  if (polar) polar.draw();
}

export function updateCurrentTime(recompute = false) {
  if (!app.ctx) return;
  if (recompute || app.timeMs < app.scan.startMs || app.timeMs > app.scan.endMs) {
    app.scan = scanWindow(app.ctx, app.windowStartMs, app.windowDays, app.config);
  }
  app.lastNow = evaluate(app.timeMs, app.ctx, app.config, { withDsn: true });
  const dtInput = document.getElementById('datetimeInput');
  if (dtInput) dtInput.value = new Date(app.timeMs).toISOString().slice(0, 16);
  if (globe) {
    globe.setVectors(app.lastNow.state);
    globe.setSite(app.site);
  }
  renderAssessmentPanel(document.getElementById('assessmentRoot'), app, {
    onAddCompare: () => {
      addScenario(app, app.site, app.windowStartMs, `${app.site.short || app.site.name}`);
      showToast('Added current site & window to Compare Lab');
      switchMode('compare');
    },
    onCopyLink: () => {
      showToast(`Scenario saved: ${app.site.name} (${fmtUtc(app.windowStartMs)})`);
    },
    onOpenGlossary: (k) => openGlossary(k),
    onCollapseResults: () => toggleResultsPanel(true),
  });
  drawTimeline(document.getElementById('timelineCanvas'), app.scan, app.timeMs, app.config);
  xp?.update();
}

export function setTime(ms, reanchor = false) {
  app.timeMs = ms;
  if (reanchor || ms < app.windowStartMs || ms > app.windowStartMs + app.windowDays * 86400000) {
    app.windowStartMs = ms;
    updateCurrentTime(true);
  } else {
    updateCurrentTime(false);
  }
}

export function switchMode(mode) {
  app.mode = mode;
  document.getElementById('explorerView')?.classList.toggle('hidden', mode !== 'explorer');
  document.getElementById('compareView')?.classList.toggle('hidden', mode !== 'compare');

  const setBtn = (id, active) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.className = active
      ? 'px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 bg-white text-slate-900 shadow-sm'
      : 'px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 text-slate-600 hover:text-slate-900';
  };
  setBtn('modeExplorerBtn', mode === 'explorer');
  setBtn('modeCompareBtn', mode === 'compare');

  if (mode === 'compare') {
    renderCompareTable(document.getElementById('compareTableContainer'), app, (sc) => {
      app.windowStartMs = sc.startMs;
      app.timeMs = sc.startMs;
      selectSite(sc.site, true);
      switchMode('explorer');
    });
  } else {
    requestAnimationFrame(() => {
      globe?.render();
      polar?.draw();
      updateCurrentTime(false);
    });
  }
}

export function switchSubView(view) {
  app.view = view;
  const isPolar = view === 'polar';
  document.getElementById('globeViewport')?.classList.toggle('hidden', isPolar);
  document.getElementById('polarViewport')?.classList.toggle('hidden', !isPolar);
  const tabGlobeBtn = document.getElementById('tabGlobeBtn');
  const tabPolarBtn = document.getElementById('tabPolarBtn');
  if (tabGlobeBtn) {
    tabGlobeBtn.className = !isPolar
      ? 'px-3 py-1 rounded-md text-xs font-semibold bg-slate-900 text-white shadow-sm'
      : 'px-3 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900';
  }
  if (tabPolarBtn) {
    tabPolarBtn.className = isPolar
      ? 'px-3 py-1 rounded-md text-xs font-semibold bg-slate-900 text-white shadow-sm'
      : 'px-3 py-1 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900';
  }
  requestAnimationFrame(() => {
    if (isPolar) polar?.draw();
    else globe?.render();
  });
}

export function renderSiteList() {
  const q = (document.getElementById('siteFilterInput')?.value || '').trim().toLowerCase();
  const cat = app.categoryFilter;
  const groups = {};
  for (const s of app.sites) {
    if (cat !== 'all' && s.group !== cat) continue;
    if (q && !s.name.toLowerCase().includes(q)) continue;
    (groups[s.group] = groups[s.group] || []).push(s);
  }
  const order = ['computed', 'south', 'clps', 'apollo', 'intl'];
  const container = document.getElementById('siteListContainer');
  if (!container) return;

  container.innerHTML = order
    .filter((g) => groups[g] && groups[g].length)
    .map((g) => `
      <div>
        <h3 class="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">${esc(SITE_GROUPS[g])}</h3>
        <div class="space-y-1">
          ${groups[g].map((s) => {
            const isSel = app.site && app.site.id === s.id;
            const badge = SITE_BADGES[s.id];
            return `
              <button type="button" data-pick-site="${esc(s.id)}" class="w-full text-left px-2.5 py-2 rounded-xl border transition flex items-center justify-between gap-2 ${isSel ? 'bg-blue-50/90 border-blue-600 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}">
                <div class="min-w-0">
                  <div class="font-semibold text-xs text-slate-900 truncate">${esc(s.name)}</div>
                  <div class="mono text-[10px] text-slate-500">${s.lat.toFixed(1)}°, ${s.lon.toFixed(1)}°</div>
                </div>
                ${badge ? `<span class="flex-none text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.cls}">${esc(badge.text)}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('') || `<p class="text-xs text-slate-400 p-3 text-center">No matching lunar sites found.</p>`;

  container.querySelectorAll('[data-pick-site]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = app.sites.find((s) => s.id === btn.dataset.pickSite);
      if (target) selectSite(target, true);
    });
  });
}

function boot() {
  const rampBar = document.getElementById('polarRampBar');
  if (rampBar) {
    rampBar.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => `rgb(${ramp(t).join(',')})`).join(', ')})`;
  }

  globe = createGlobeRenderer(document.getElementById('globeCanvas'), (pick) => {
    const custom = {
      id: `custom-${pick.lat.toFixed(2)}`,
      name: `Custom point ${fmtLatLon(pick.lat, pick.lon, 2)}`,
      short: 'Custom point',
      lat: pick.lat,
      lon: pick.lon,
      group: 'computed',
    };
    selectSite(custom, false);
  }, { onHint: (t) => xpApi.setHint(t) });

  polar = createPolarMapRenderer(document.getElementById('polarCanvas'), (pick) => {
    if (pick.site) return selectSite(pick.site, true);
    const custom = {
      id: `custom-${pick.lat.toFixed(2)}`,
      name: `Custom point ${fmtLatLon(pick.lat, pick.lon, 2)}`,
      short: 'Custom point',
      lat: pick.lat,
      lon: pick.lon,
      group: 'computed',
    };
    selectSite(custom, false);
  }, () => app);

  document.getElementById('modeExplorerBtn')?.addEventListener('click', () => switchMode('explorer'));
  document.getElementById('modeCompareBtn')?.addEventListener('click', () => switchMode('compare'));

  document.getElementById('tabGlobeBtn')?.addEventListener('click', () => switchSubView('globe'));
  document.getElementById('tabPolarBtn')?.addEventListener('click', () => switchSubView('polar'));

  document.getElementById('camPoleBtn')?.addEventListener('click', () => { switchSubView('globe'); globe?.southPole(); });
  document.getElementById('camSiteBtn')?.addEventListener('click', () => { switchSubView('globe'); globe?.flyToSite(app.site); });
  document.getElementById('camWholeBtn')?.addEventListener('click', () => { switchSubView('globe'); globe?.overview(); });
  document.getElementById('camSystemBtn')?.addEventListener('click', () => { switchSubView('globe'); globe?.earthMoon(); });
  document.getElementById('camStandSunBtn')?.addEventListener('click', () => {
    switchSubView('globe');
    globe?.flyToSite(app.site);
    showToast(`Looking toward Sun: Az ${app.lastNow?.sun.az.toFixed(0)}°, El ${app.lastNow?.sun.el.toFixed(1)}°`);
  });
  document.getElementById('camStandEarthBtn')?.addEventListener('click', () => {
    switchSubView('globe');
    globe?.flyToSite(app.site);
    showToast(`Looking toward Earth: Az ${app.lastNow?.earth.az.toFixed(0)}°, El ${app.lastNow?.earth.el.toFixed(1)}°`);
  });
  document.getElementById('lightingModeBtn')?.addEventListener('click', (e) => {
    app.realLighting = !app.realLighting;
    e.currentTarget.setAttribute('aria-pressed', String(app.realLighting));
    e.currentTarget.innerHTML = `<span class="inline-flex items-center gap-1">${app.realLighting ? `<svg class="xp-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg> Real Sunlight` : `<svg class="xp-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg> Even Light`}</span>`;
    globe?.setLighting(app.realLighting);
  });

  document.getElementById('globeZoomInBtn')?.addEventListener('click', () => globe?.zoomBy(0.75));
  document.getElementById('globeZoomOutBtn')?.addEventListener('click', () => globe?.zoomBy(1.32));
  document.getElementById('polarZoomInBtn')?.addEventListener('click', () => polar?.zoomBy(0.68));
  document.getElementById('polarZoomOutBtn')?.addEventListener('click', () => polar?.zoomBy(1.45));
  document.getElementById('polarResetBtn')?.addEventListener('click', () => polar?.reset());

  document.querySelectorAll('input[name="polarOverlay"]').forEach((r) => {
    r.addEventListener('change', () => {
      app.polarOverlay = r.value;
      document.getElementById('polarScaleBarWrap')?.classList.toggle('hidden', r.value === 'none');
      polar?.draw();
    });
  });

  document.getElementById('siteFilterInput')?.addEventListener('input', renderSiteList);
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.categoryFilter = btn.dataset.cat;
      document.querySelectorAll('.cat-btn').forEach((b) => {
        b.className = b === btn
          ? 'cat-btn px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white'
          : 'cat-btn px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200';
      });
      renderSiteList();
    });
  });

  document.getElementById('toggleCustomCoordBtn')?.addEventListener('click', () => {
    document.getElementById('coordForm')?.classList.toggle('hidden');
  });
  document.getElementById('coordForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = document.getElementById('coordInput').value.trim();
    const m = raw.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
    const errEl = document.getElementById('coordError');
    if (!m || Math.abs(Number(m[1])) > 90 || Math.abs(Number(m[2])) > 180) {
      if (errEl) {
        errEl.textContent = 'Enter valid degrees, e.g. -89.45, -137.3';
        errEl.classList.remove('hidden');
      }
      return;
    }
    if (errEl) errEl.classList.add('hidden');
    const lat = Number(m[1]), lon = Number(m[2]);
    selectSite({ id: `custom-${lat.toFixed(2)}`, name: `Custom point ${fmtLatLon(lat, lon, 2)}`, short: 'Custom point', lat, lon, group: 'computed' }, true);
  });

  document.getElementById('datetimeInput')?.addEventListener('change', (e) => {
    const ms = Date.parse(e.target.value + ':00Z');
    if (Number.isFinite(ms)) setTime(ms, true);
  });
  document.getElementById('stepBackDayBtn')?.addEventListener('click', () => setTime(app.timeMs - 86400000));
  document.getElementById('stepBackHourBtn')?.addEventListener('click', () => setTime(app.timeMs - 3600000));
  document.getElementById('stepFwdHourBtn')?.addEventListener('click', () => setTime(app.timeMs + 3600000));
  document.getElementById('stepFwdDayBtn')?.addEventListener('click', () => setTime(app.timeMs + 86400000));
  document.getElementById('speedSelect')?.addEventListener('change', (e) => { app.speed = Number(e.target.value); });
  document.getElementById('nowBtn')?.addEventListener('click', () => setTime(Date.UTC(2026, 10, 16, 22, 0, 0), true));

  let lastTick = 0;
  function playLoop(t) {
    if (!app.playing) return;
    const dt = lastTick ? Math.min(0.25, (t - lastTick) / 1000) : 0;
    lastTick = t;
    setTime(app.timeMs + dt * app.speed * 1000);
    requestAnimationFrame(playLoop);
  }
  document.getElementById('playPauseBtn')?.addEventListener('click', (e) => {
    app.playing = !app.playing;
    e.currentTarget.textContent = app.playing ? 'Pause' : 'Play';
    lastTick = 0;
    if (app.playing) requestAnimationFrame(playLoop);
  });

  document.querySelectorAll('.win-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.windowDays = Number(btn.dataset.win);
      document.querySelectorAll('.win-btn').forEach((b) => {
        b.className = b === btn
          ? 'win-btn px-2 py-0.5 text-[11px] font-semibold bg-slate-900 text-white'
          : 'win-btn px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100';
      });
      updateCurrentTime(true);
    });
  });

  const tlCanvas = document.getElementById('timelineCanvas');
  if (tlCanvas) {
    let scrubbing = false;
    const scrubAt = (clientX) => {
      const rect = tlCanvas.getBoundingClientRect();
      const f = clamp((clientX - rect.left - 58) / Math.max(1, rect.width - 68), 0, 1);
      setTime(Math.round(app.scan.startMs + f * (app.scan.endMs - app.scan.startMs)));
    };
    tlCanvas.addEventListener('pointerdown', (e) => {
      scrubbing = true;
      tlCanvas.setPointerCapture(e.pointerId);
      scrubAt(e.clientX);
    });
    tlCanvas.addEventListener('pointermove', (e) => {
      if (scrubbing) scrubAt(e.clientX);
    });
    tlCanvas.addEventListener('pointerup', () => {
      scrubbing = false;
    });
  }

  document.getElementById('learnToggleBtn')?.addEventListener('click', (e) => {
    app.learnExplain = !app.learnExplain;
    e.currentTarget.setAttribute('aria-pressed', String(app.learnExplain));
    e.currentTarget.classList.toggle('bg-blue-50', app.learnExplain);
    e.currentTarget.classList.toggle('border-blue-500', app.learnExplain);
    renderAssessmentPanel(document.getElementById('assessmentRoot'), app, {
      onAddCompare: () => { addScenario(app, app.site, app.windowStartMs, `${app.site.short || app.site.name}`); switchMode('compare'); },
      onCopyLink: () => { showToast(`Scenario saved: ${app.site.name}`); },
      onOpenGlossary: openGlossary,
      onCollapseResults: () => toggleResultsPanel(true),
    });
  });

  const tour = createTour([
    {
      title: '1. Clean Workspace & Mode Switcher',
      body: 'Switch between the 3D Mission Explorer and the Scenario Compare Lab from the top header.',
      action: () => switchMode('explorer'),
    },
    {
      title: '2. South Pole Contrast: Crater vs. Ridge',
      body: 'Click any landing site on the left—or filter by Best-Lit, South Pole, CLPS, or Apollo. Let’s inspect Shackleton Crater Floor (a permanently shadowed cold trap).',
      action: () => selectSite(app.sites.find((s) => s.id === 'shackleton'), true),
    },
    {
      title: '3. Compare with Shackleton Connecting Ridge',
      body: 'Just a few kilometres higher on the crater rim, Shackleton Connecting Ridge stays in sunlight over 85% of the lunar month!',
      action: () => selectSite(app.sites.find((s) => s.id === 'ridge'), true),
    },
    {
      title: '4. 2D South-Pole LOLA Illumination Map',
      body: 'Switch to the South-Pole Map and turn on the 2027 Solar Disk overlay to see sunlit ridges across the entire polar region.',
      action: () => {
        switchSubView('polar');
        app.polarOverlay = 'illum';
        const radio = document.querySelector('input[name="polarOverlay"][value="illum"]');
        if (radio) radio.checked = true;
        document.getElementById('polarScaleBarWrap')?.classList.remove('hidden');
        polar?.draw();
      },
    },
  ]);

  document.getElementById('tourStartBtn')?.addEventListener('click', () => tour.start());

  document.getElementById('settingsOpenBtn')?.addEventListener('click', () => document.getElementById('settingsModal')?.classList.remove('hidden'));
  document.getElementById('settingsCloseX')?.addEventListener('click', () => document.getElementById('settingsModal')?.classList.add('hidden'));
  document.getElementById('settingsCancelBtn')?.addEventListener('click', () => document.getElementById('settingsModal')?.classList.add('hidden'));
  document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    app.config.power.mode = f.mode.value;
    app.config.power.areaM2 = Math.max(0.1, Number(f.areaM2.value) || 2);
    app.config.power.efficiency = clamp((Number(f.efficiency.value) || 29) / 100, 0.05, 0.45);
    app.config.power.loadW = Math.max(5, Number(f.loadW.value) || 120);
    app.config.mastHeightM = clamp(Number(f.mastHeightM.value) || 2, 0.5, 50);
    app.config.comms.preset = f.preset.value;
    app.config.comms.dataRateBps = Math.max(1, Number(f.dataRateKbps.value) || 256) * 1000;
    app.config.comms.minClearanceDeg = clamp(Number(f.minClearanceDeg.value) || 2, 0, 15);
    document.getElementById('settingsModal')?.classList.add('hidden');
    selectSite(app.site, false);
    showToast('Updated spacecraft assumptions');
  });

  document.getElementById('glossaryCloseBtn')?.addEventListener('click', () => document.getElementById('glossaryModal')?.classList.add('hidden'));

  document.getElementById('cmpAddCurrentBtn')?.addEventListener('click', () => {
    addScenario(app, app.site, app.windowStartMs, `${app.site.short || app.site.name}`);
    showToast('Added current site & window to Compare Lab');
    renderCompareTable(document.getElementById('compareTableContainer'), app, (sc) => {
      app.windowStartMs = sc.startMs;
      app.timeMs = sc.startMs;
      selectSite(sc.site, true);
      switchMode('explorer');
    });
  });

  document.getElementById('cmpSlipBtn')?.addEventListener('click', () => {
    const base = app.windowStartMs;
    addScenario(app, app.site, base, `${app.site.short || app.site.name} · planned`);
    for (let k = 1; k <= 3; k++) {
      addScenario(app, app.site, Math.round(base + k * SYNODIC_MONTH_DAYS * 86400000), `${app.site.short || app.site.name} · slip +${k} mo`);
    }
    showToast('Added baseline + 3 synodic month launch slips');
    renderCompareTable(document.getElementById('compareTableContainer'), app, (sc) => {
      app.windowStartMs = sc.startMs;
      app.timeMs = sc.startMs;
      selectSite(sc.site, true);
      switchMode('explorer');
    });
  });

  document.getElementById('cmpNearbyBtn')?.addEventListener('click', () => {
    ['best-0', 'best-1', 'peak-shackleton'].forEach((id) => {
      const s = app.sites.find((x) => x.id === id);
      if (s) addScenario(app, s, app.windowStartMs, `Alt: ${s.short || s.name}`);
    });
    showToast('Added top nearby LOLA sunlit terrain alternatives');
    renderCompareTable(document.getElementById('compareTableContainer'), app, (sc) => {
      app.windowStartMs = sc.startMs;
      app.timeMs = sc.startMs;
      selectSite(sc.site, true);
      switchMode('explorer');
    });
  });

  document.getElementById('cmpClearBtn')?.addEventListener('click', () => {
    app.scenarios = [];
    const countEl = document.getElementById('headerCompareCount');
    if (countEl) countEl.textContent = '0';
    renderCompareTable(document.getElementById('compareTableContainer'), app, (sc) => {
      app.windowStartMs = sc.startMs;
      app.timeMs = sc.startMs;
      selectSite(sc.site, true);
      switchMode('explorer');
    });
  });

  document.getElementById('cmpExportBtn')?.addEventListener('click', () => {
    const ok = exportCompareCsv(app.scenarios);
    if (!ok) showToast('Add scenarios first to export CSV');
  });

  document.querySelectorAll('[data-mob]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.mob;
      switchMode('explorer');
      document.getElementById('paneSite')?.classList.toggle('hidden', m !== 'site');
      document.getElementById('paneView')?.classList.toggle('hidden', m !== 'view');
      document.getElementById('paneResults')?.classList.toggle('hidden', m !== 'results');
      document.querySelectorAll('[data-mob]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('text-blue-600', on);
        b.classList.toggle('border-t-2', on);
        b.classList.toggle('border-blue-600', on);
        b.classList.toggle('text-slate-600', !on);
      });
      if (m === 'view') setTimeout(onLayoutChange, 50);
    });
  });

  // Panel minimize / maximize controls
  document.getElementById('collapseSiteBtn')?.addEventListener('click', () => toggleSitePanel(true));
  document.getElementById('expandSiteBtn')?.addEventListener('click', () => toggleSitePanel(false));
  document.getElementById('expandResultsBtn')?.addEventListener('click', () => toggleResultsPanel(false));
  document.getElementById('toggleTimelineBtn')?.addEventListener('click', () => toggleTimeline());
  document.getElementById('focusModeBtn')?.addEventListener('click', () => toggleFocusMode());

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      document.getElementById('playPauseBtn')?.click();
    } else if (e.key === '[' || (e.altKey && e.key === '1')) {
      e.preventDefault();
      toggleSitePanel();
    } else if (e.key === ']' || (e.altKey && e.key === '3')) {
      e.preventDefault();
      toggleResultsPanel();
    } else if (e.key === 't' || (e.altKey && e.key === '2')) {
      e.preventDefault();
      toggleTimeline();
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFocusMode();
    }
  });

  // Restore saved panel states
  if (app.ui.siteCollapsed) toggleSitePanel(true);
  if (app.ui.resultsCollapsed) toggleResultsPanel(true);
  if (app.ui.timelineCollapsed) toggleTimeline(true);

  // On phones the panes are tabs: start on the Moon view, matching the highlighted tab.
  if (window.matchMedia?.('(max-width: 1023px)').matches) {
    document.querySelector('[data-mob="view"]')?.click();
    if (!app.ui.timelineCollapsed) toggleTimeline(true);
  }
  xp = initExperience(xpApi);
  window.addEventListener('lsp-theme', () => updateCurrentTime(false));
  selectSite(app.sites[0], true);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
