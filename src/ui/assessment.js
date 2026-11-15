// Results / Assessment panel rendering site metrics, LOLA skyline, power, and DTE margin.
import { clamp, deg, esc, fmtDuration, fmtHours, fmtLatLon, fmtUtc, pct } from './format.js';
import { drawSkyPlot } from './skyplot.js';

export function findNextTransition(arr, times, nowMs, scan) {
  if (!arr || !times || !scan) return null;
  const idx = Math.max(0, Math.floor((nowMs - scan.startMs) / scan.stepMs));
  const cur = !!arr[Math.min(arr.length - 1, idx)];
  for (let i = idx + 1; i < arr.length; i++) {
    if (!!arr[i] !== cur) return times[i];
  }
  return null;
}

export function renderAssessmentPanel(container, app, callbacks = {}) {
  if (!container || !app.ctx || !app.scan || !app.lastNow) return;
  const now = app.lastNow;
  const st = app.scan.stats;
  const sunUp = now.sun.fraction > 0;
  const earthUp = now.earth.los;
  const nextSunMs = findNextTransition(app.scan.series.lit, app.scan.series.times, app.timeMs, app.scan);
  const nextEarthMs = findNextTransition(app.scan.series.los, app.scan.series.times, app.timeMs, app.scan);

  if (!app.uiCards) {
    app.uiCards = { instant: true, skyplot: true, summary: true };
    try {
      const saved = JSON.parse(localStorage.getItem('lsp.uiCards') || '{}');
      if (typeof saved.instant === 'boolean') app.uiCards.instant = saved.instant;
      if (typeof saved.skyplot === 'boolean') app.uiCards.skyplot = saved.skyplot;
      if (typeof saved.summary === 'boolean') app.uiCards.summary = saved.summary;
    } catch {}
  }

  const overallStatus =
    now.powerStatus === 'go' && now.commsStatus === 'go'
      ? { cls: 'bg-emerald-50 border-emerald-300 text-emerald-900', dot: 'bg-emerald-600', label: 'GO · Mission Ready at Current Time', desc: 'Solar array exceeds spacecraft load and direct-to-Earth radio link closes.' }
      : now.powerStatus === 'no-go' && now.commsStatus === 'no-go'
      ? { cls: 'bg-red-50 border-red-300 text-red-900', dot: 'bg-red-600', label: 'NO-GO · In Darkness & Radio Blackout', desc: 'Both the Sun and Earth are blocked by the local lunar horizon right now.' }
      : { cls: 'bg-amber-50 border-amber-300 text-amber-900', dot: 'bg-amber-600', label: 'CAUTION · Partial Constraint Active', desc: now.powerStatus !== 'go' ? 'Solar power is below continuous load; running on battery.' : (now.commsReasons[0] || 'Earth link is degraded or blocked by terrain.') };

  const glossBtn = (k) => `<button type="button" data-gloss="${k}" class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 border border-slate-300 text-[10px] font-bold ml-1" title="Definition">?</button>`;

  const allFolded = !app.uiCards.instant && !app.uiCards.skyplot && !app.uiCards.summary;

  container.innerHTML = `
    <div class="space-y-1.5">
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="text-base font-bold text-slate-900 leading-snug">${esc(app.site.name)}</h2>
          <p class="mono text-[11px] text-slate-500">${fmtLatLon(app.site.lat, app.site.lon)} · ${esc(app.ctx.horizon.source)} (${app.ctx.groundHeight >= 0 ? '+' : '−'}${Math.abs(app.ctx.groundHeight)} m) ${glossBtn('lola')}</p>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" id="toggleAllCardsBtn" class="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200" title="Fold or unfold all sections">
            ${allFolded ? 'Unfold All' : 'Fold All'}
          </button>
          <button type="button" id="collapseResultsBtn" class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs font-bold leading-none" title="Minimize Assessment panel" aria-label="Minimize Assessment panel">
            ▸
          </button>
        </div>
      </div>
      <div class="flex items-center gap-1.5 pt-0.5">
        <button type="button" id="panelAddCompareBtn" class="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">+ Add to Compare</button>
        <button type="button" id="panelCopyLinkBtn" class="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">Copy Link</button>
      </div>
    </div>

    <div class="p-2.5 rounded-xl border ${overallStatus.cls} space-y-0.5">
      <div class="flex items-center gap-2 font-bold text-xs">
        <span class="w-2.5 h-2.5 rounded-full ${overallStatus.dot}"></span>
        <span>${overallStatus.label}</span>
      </div>
      <p class="text-[11px] opacity-90 pl-4">${esc(overallStatus.desc)}</p>
    </div>

    ${app.site.note ? `<details ${app.noteOpen ? 'open' : ''} class="xp-note rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"><summary class="px-2.5 py-2 cursor-pointer font-semibold text-slate-800">About this site</summary><p class="px-2.5 pb-2.5 leading-relaxed">${esc(app.site.note)}</p></details>` : ''}

    ${app.learnExplain ? `
      <div class="p-2.5 rounded-xl bg-blue-50 border-l-4 border-blue-600 text-xs text-slate-800 space-y-1">
        <strong class="block text-blue-900">Plain-English explainer</strong>
        <p>${Math.abs(app.site.lat) > 80
          ? `Near ${Math.abs(app.site.lat).toFixed(1)}°S, the Moon’s 1.54° tilt keeps the Sun skimming just above the horizon. A ridge crest stays lit for weeks, while crater floors right next door never see the Sun.`
          : app.site.lon > 100 || app.site.lon < -100
          ? `This site is on the Moon’s far side. Because the Moon is tidally locked to Earth, Earth never rises here—missions require a relay satellite.`
          : `Away from the poles, a lunar day lasts ~14 Earth days followed by a freezing 14-day lunar night.`}</p>
      </div>
    ` : ''}

    <!-- CARD 1: INSTANT GAUGES (SOLAR & EARTH) -->
    <div class="p-3 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
      <div class="flex items-center justify-between cursor-pointer select-none" data-card-toggle="instant">
        <div class="flex items-center gap-1.5 font-bold text-xs text-slate-800">
          <span class="inline-flex items-center gap-1.5"><svg class="xp-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg> Solar &amp; Earth</span>
        </div>
        <div class="flex items-center gap-2">
          ${!app.uiCards.instant ? `<span class="mono text-[11px] text-slate-600 font-medium">${now.sun.watts.toFixed(0)}W · ${deg(now.earth.clearance, 1)}</span>` : ''}
          <button type="button" class="text-xs text-slate-400 hover:text-slate-700 p-0.5" title="Toggle section">
            ${app.uiCards.instant ? '▾' : '▸'}
          </button>
        </div>
      </div>

      ${app.uiCards.instant ? `
        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <div class="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
            <div class="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span class="inline-flex items-center gap-1" style="color:#ffb300"><svg class="xp-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg></span><span>Solar Power</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${now.powerStatus === 'go' ? 'bg-emerald-100 text-emerald-800' : now.powerStatus === 'marginal' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
                ${now.powerStatus === 'go' ? 'Meets load' : now.powerStatus === 'marginal' ? 'Below load' : '0 W Dark'}
              </span>
            </div>
            <div class="mono text-2xl font-bold text-slate-900">${now.sun.watts.toFixed(0)} W</div>
            <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full bg-amber-500" style="width:${clamp((now.sun.watts / Math.max(1, app.config.power.loadW * 4)) * 100, 0, 100)}%"></div>
            </div>
            <p class="text-[11px] text-slate-500">Load ${app.config.power.loadW} W · Sun ${deg(now.sun.el)} (${pct(now.sun.fraction)} disk) ${glossBtn('disk')}</p>
            <div class="pt-1 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between">
              <span>${sunUp ? 'Sunset in:' : 'Sunrise in:'}</span>
              <strong class="mono">${nextSunMs ? fmtDuration(nextSunMs - app.timeMs) : 'Over 30 d'}</strong>
            </div>
          </div>

          <div class="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1">
            <div class="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span class="inline-flex items-center gap-1" style="color:#38bdf8"><svg class="xp-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7 7c2 1 2 3 4 3s2 3 0 4-1 4 1 5M15 4c-1 2 1 3 3 3"/></svg></span><span>Earth Link</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${now.commsStatus === 'go' ? 'bg-emerald-100 text-emerald-800' : now.commsStatus === 'marginal' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
                ${now.commsStatus === 'go' ? 'Available' : now.commsStatus === 'marginal' ? 'Grazing' : 'Blocked'}
              </span>
            </div>
            <div class="mono text-2xl font-bold text-slate-900">${deg(now.earth.clearance, 1)}</div>
            <div class="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full bg-blue-600" style="width:${clamp(((now.earth.clearance + 4) / 14) * 100, 0, 100)}%"></div>
            </div>
            <p class="text-[11px] text-slate-500">Clearance · ${now.earth.lightTimeS.toFixed(2)}s 1-way ${glossBtn('dte')}</p>
            <div class="pt-1 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between">
              <span>${earthUp ? 'Earthset in:' : 'Earthrise in:'}</span>
              <strong class="mono">${nextEarthMs ? fmtDuration(nextEarthMs - app.timeMs) : (earthUp ? 'Stays up' : 'Stays down')}</strong>
            </div>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- CARD 2: 360° SKY & TERRAIN HORIZON SKYLINE -->
    <div class="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
      <div class="flex items-center justify-between cursor-pointer select-none" data-card-toggle="skyplot">
        <div class="flex items-center gap-1.5 font-bold text-xs text-slate-800">
          <span>360° Sky &amp; Terrain Horizon ${glossBtn('horizon')}</span>
        </div>
        <div class="flex items-center gap-2">
          ${!app.uiCards.skyplot ? `<span class="text-[10px] text-slate-500 font-mono">${esc(app.ctx.horizon.source)}</span>` : `<span class="text-[10px] text-slate-500">Sun &amp; Earth paths</span>`}
          <button type="button" class="text-xs text-slate-400 hover:text-slate-700 p-0.5" title="Toggle section">
            ${app.uiCards.skyplot ? '▾' : '▸'}
          </button>
        </div>
      </div>
      ${app.uiCards.skyplot ? `
        <canvas id="skyplotCanvas" class="w-full h-[175px] block rounded-lg border border-slate-200 bg-white mt-1"></canvas>
      ` : ''}
    </div>

    <!-- CARD 3: WINDOW SUMMARY -->
    <div class="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5">
      <div class="flex items-center justify-between cursor-pointer select-none" data-card-toggle="summary">
        <div>
          <h3 class="font-bold text-xs text-slate-800">Window Summary (${st.days} days)</h3>
          <p class="mono text-[10px] text-slate-500">${fmtUtc(app.scan.startMs).slice(0, 10)} → ${st.days} d</p>
        </div>
        <div class="flex items-center gap-2">
          ${!app.uiCards.summary ? `<span class="mono text-[11px] text-slate-600 font-semibold">${pct(st.litFraction, 0)} lit · ${fmtHours(st.longestDarkH)} dark</span>` : ''}
          <button type="button" class="text-xs text-slate-400 hover:text-slate-700 p-0.5" title="Toggle section">
            ${app.uiCards.summary ? '▾' : '▸'}
          </button>
        </div>
      </div>

      ${app.uiCards.summary ? `
        <div class="flex justify-end">
          <button type="button" id="toggleTelemetryBtn" class="px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${app.engineerTelemetry ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'}">
            ${app.engineerTelemetry ? 'Hide RF Details' : '+ Engineer Telemetry'}
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span class="text-[11px] text-slate-500 block">Time Sunlit</span>
            <strong class="mono text-sm text-slate-900">${pct(st.litFraction, 1)}</strong>
            <span class="text-[10px] text-slate-500 block">Avg ${st.avgPowerW.toFixed(0)} W</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span class="text-[11px] text-slate-500 block">Longest Night</span>
            <strong class="mono text-sm text-slate-900">${fmtHours(st.longestDarkH)}</strong>
            <span class="text-[10px] text-slate-500 block">Battery: ${st.batteryKWh.toFixed(1)} kWh</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span class="text-[11px] text-slate-500 block">Earth Visible</span>
            <strong class="mono text-sm text-slate-900">${pct(st.earthVisibleFraction, 1)}</strong>
            <span class="text-[10px] text-slate-500 block">DTE link: ${pct(st.dteFraction, 1)}</span>
          </div>
          <div class="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <span class="text-[11px] text-slate-500 block">Longest Blackout</span>
            <strong class="mono text-sm text-slate-900">${fmtHours(st.longestBlackoutH)}</strong>
            <span class="text-[10px] text-slate-500 block">No DTE contact</span>
          </div>
        </div>

        ${app.engineerTelemetry ? `
          <div class="pt-2 border-t border-slate-200 space-y-2 text-xs">
            <div class="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Full RF Link Budget &amp; DSN Stations ${glossBtn('dsn')} ${glossBtn('margin')}</div>
            <dl class="grid grid-cols-[1fr_auto] gap-y-1 text-[11px]">
              <dt class="text-slate-500">Range to Earth</dt><dd class="mono font-medium">${(now.earth.distM / 1000).toFixed(0)} km</dd>
              <dt class="text-slate-500">Sun elevation range</dt><dd class="mono font-medium">${deg(st.minSunEl, 1)} to ${deg(st.maxSunEl, 1)}</dd>
              <dt class="text-slate-500">Earth elevation range</dt><dd class="mono font-medium">${deg(st.minEarthEl, 1)} to ${deg(st.maxEarthEl, 1)}</dd>
              <dt class="text-slate-500">Free-space path loss</dt><dd class="mono font-medium">${now.link.fspl.toFixed(1)} dB</dd>
              <dt class="text-slate-500">Received C/N₀</dt><dd class="mono font-medium">${now.earth.los ? `${now.link.cn0.toFixed(1)} dB-Hz` : 'Blocked'}</dd>
              <dt class="text-slate-500">Link margin @ ${(app.config.comms.dataRateBps / 1000).toFixed(0)} kbps</dt><dd class="mono font-medium">${now.earth.los ? `${now.link.margin.toFixed(1)} dB` : 'Blocked'}</dd>
            </dl>
            <div class="flex flex-wrap gap-1 pt-1">
              ${now.dsn.map((d) => `<span class="mono text-[10px] px-2 py-0.5 rounded border ${d.visible ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-400'}">${d.name} ${deg(d.el, 0)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      ` : ''}
    </div>
  `;

  if (app.uiCards.skyplot) {
    const skyCanvas = container.querySelector('#skyplotCanvas');
    if (skyCanvas) drawSkyPlot(skyCanvas, app.ctx.horizon, app.scan, now);
  }

  container.querySelector('.xp-note')?.addEventListener('toggle', (e) => { app.noteOpen = e.currentTarget.open; });
  container.querySelector('#panelAddCompareBtn')?.addEventListener('click', () => {
    callbacks.onAddCompare?.();
  });
  container.querySelector('#panelCopyLinkBtn')?.addEventListener('click', () => {
    callbacks.onCopyLink?.();
  });
  container.querySelector('#collapseResultsBtn')?.addEventListener('click', () => {
    callbacks.onCollapseResults?.();
  });
  container.querySelector('#toggleAllCardsBtn')?.addEventListener('click', () => {
    const nextState = allFolded;
    app.uiCards.instant = nextState;
    app.uiCards.skyplot = nextState;
    app.uiCards.summary = nextState;
    try { localStorage.setItem('lsp.uiCards', JSON.stringify(app.uiCards)); } catch {}
    renderAssessmentPanel(container, app, callbacks);
  });
  container.querySelectorAll('[data-card-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const cardKey = el.dataset.cardToggle;
      if (cardKey && app.uiCards[cardKey] !== undefined) {
        app.uiCards[cardKey] = !app.uiCards[cardKey];
        try { localStorage.setItem('lsp.uiCards', JSON.stringify(app.uiCards)); } catch {}
        renderAssessmentPanel(container, app, callbacks);
      }
    });
  });
  container.querySelector('#toggleTelemetryBtn')?.addEventListener('click', () => {
    app.engineerTelemetry = !app.engineerTelemetry;
    renderAssessmentPanel(container, app, callbacks);
  });
  container.querySelectorAll('[data-gloss]').forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onOpenGlossary?.(btn.dataset.gloss));
  });
}
