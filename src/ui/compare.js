// Scenario Comparison Lab: multi-site & launch-slip evaluation and CSV export.
import { esc, fmtHours, fmtLatLon, pct } from './format.js';
import { SYNODIC_MONTH_DAYS } from '../core/constants.js';
import { prepareSite, scanWindow } from '../core/analysis.js';

export const COLUMNS = [
  { key: 'litFraction', label: 'Sunlit', fmt: (v) => pct(v, 1), better: 'high', tol: 0.03 },
  { key: 'avgPowerW', label: 'Avg power', fmt: (v) => `${v.toFixed(0)} W`, better: 'high', tolRel: 0.05 },
  { key: 'longestDarkH', label: 'Longest dark', fmt: fmtHours, better: 'low', tol: 12, open: 'longestDarkOpenEnded' },
  { key: 'batteryKWh', label: 'Battery', fmt: (v) => `${v.toFixed(1)} kWh`, better: 'low', tolRel: 0.1, tol: 0.2, open: 'batteryOpenEnded' },
  { key: 'earthCentreFraction', label: 'Earth in view', fmt: (v) => pct(v, 1), better: 'high', tol: 0.03 },
  { key: 'dteFraction', label: 'DTE link', fmt: (v) => pct(v, 1), better: 'high', tol: 0.03 },
  { key: 'longestBlackoutH', label: 'Longest blackout', fmt: fmtHours, better: 'low', tol: 12, open: 'longestBlackoutOpenEnded' },
];

// Illustrative screening thresholds
export const CRITERIA = {
  minLit: 0.5,
  maxDarkH: 120,
  minDte: 0.4,
  maxBlackoutH: 168,
};

export function verdictFor(stats) {
  const powerOk = stats.litFraction >= CRITERIA.minLit && stats.longestDarkH <= CRITERIA.maxDarkH;
  const commsOk = stats.dteFraction >= CRITERIA.minDte && stats.longestBlackoutH <= CRITERIA.maxBlackoutH;
  if (powerOk && commsOk) return { status: 'go', text: 'Meets both' };
  if (stats.dteFraction === 0) return { status: 'no-go', text: 'No DTE link' };
  if (stats.litFraction < 0.2) return { status: 'no-go', text: 'Too dark' };
  if (powerOk) return { status: 'marginal', text: 'Comms-limited' };
  if (commsOk) return { status: 'marginal', text: 'Power-limited' };
  return { status: 'no-go', text: 'Neither' };
}

let scenarioSeq = 0;

export function addScenario(app, site, startMs, label) {
  const dup = app.scenarios.find((s) => s.site.id === site.id && s.site.lat === site.lat && s.site.lon === site.lon && s.startMs === startMs && s.windowDays === app.windowDays);
  if (dup) return dup;
  const ctx = prepareSite(site, app.config);
  const sc = scanWindow(ctx, startMs, app.windowDays, app.config);
  const item = { id: `sc-${++scenarioSeq}`, site, startMs, windowDays: app.windowDays, label, scan: sc };
  app.scenarios.push(item);
  const countEl = document.getElementById('headerCompareCount');
  if (countEl) countEl.textContent = String(app.scenarios.length);
  return item;
}

export function renderCompareTable(container, app, onOpenScenario) {
  if (!container) return;
  if (!app.scenarios.length) {
    container.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">No scenarios added yet. Click <strong>+ Add Current Site &amp; Date</strong>, <strong>Schedule Slip ×3</strong>, or <strong>Find Nearby Alternatives</strong> above to compare trade-offs!</div>`;
    return;
  }
  container.innerHTML = `
    <table class="w-full text-xs border-collapse">
      <thead>
        <tr class="border-b border-slate-200 text-slate-500 text-right">
          <th class="text-left py-2 px-2">Scenario</th>
          <th class="py-2 px-2">Sunlit %</th>
          <th class="py-2 px-2">Avg Power</th>
          <th class="py-2 px-2">Longest Dark</th>
          <th class="py-2 px-2">Battery Est.</th>
          <th class="py-2 px-2" title="Earth's centre above the terrain">Earth in view</th>
          <th class="py-2 px-2">DTE Link</th>
          <th class="py-2 px-2">Screening</th>
          <th class="py-2 px-2"></th>
        </tr>
      </thead>
      <tbody>
        ${app.scenarios.map((s) => {
          const st = s.scan.stats;
          const v = verdictFor(st);
          const badgeClass = v.status === 'go' ? 'bg-emerald-100 text-emerald-800'
                           : v.status === 'marginal' ? 'bg-amber-100 text-amber-800'
                           : 'bg-red-100 text-red-800';
          const lat = s.site.lat != null ? s.site.lat : 0;
          const lon = s.site.lon != null ? s.site.lon : 0;
          const darkGe = st.longestDarkOpenEnded && st.longestDarkH > 0 ? '≥ ' : '';
          const batGe = st.batteryOpenEnded && st.batteryKWh > 0 ? '≥ ' : '';
          return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 text-right mono">
              <td class="text-left py-2.5 px-2 font-sans">
                <button type="button" data-open-sc="${s.id}" class="font-bold text-blue-600 hover:underline text-left">${esc(s.label)}</button>
                <div class="mono text-[10px] text-slate-400">${fmtLatLon(lat, lon, 2)} · ${new Date(s.startMs).toISOString().slice(0, 10)} · ${s.windowDays}d</div>
              </td>
              <td class="py-2 px-2">${pct(st.litFraction, 1)}</td>
              <td class="py-2 px-2">${st.avgPowerW.toFixed(0)} W</td>
              <td class="py-2 px-2">${darkGe}${fmtHours(st.longestDarkH)}</td>
              <td class="py-2 px-2">${batGe}${st.batteryKWh.toFixed(1)} kWh</td>
              <td class="py-2 px-2">${pct(st.earthCentreFraction, 1)}</td>
              <td class="py-2 px-2">${pct(st.dteFraction, 1)}</td>
              <td class="py-2 px-2 font-sans"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}">${v.text}</span></td>
              <td class="py-2 px-2 font-sans"><button type="button" data-rm-sc="${s.id}" class="text-slate-400 hover:text-red-600">✕</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('[data-open-sc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sc = app.scenarios.find((x) => x.id === btn.dataset.openSc);
      if (sc) onOpenScenario(sc);
    });
  });

  container.querySelectorAll('[data-rm-sc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.scenarios = app.scenarios.filter((x) => x.id !== btn.dataset.rmSc);
      const countEl = document.getElementById('headerCompareCount');
      if (countEl) countEl.textContent = String(app.scenarios.length);
      renderCompareTable(container, app, onOpenScenario);
    });
  });
}

export function scenariosToCsv(scenarios) {
  const OPEN = COLUMNS.filter((c) => c.open);
  const head = ['label', 'lat', 'lon', 'window_start_utc', 'window_days', ...COLUMNS.map((c) => c.key), ...OPEN.map((c) => `${c.key}_cut_by_window`), 'screening'];
  const rows = scenarios.map((s) => [
    `"${s.label.replace(/"/g, '""')}"`,
    (s.site.lat ?? 0).toFixed(5),
    (s.site.lon ?? 0).toFixed(5),
    new Date(s.startMs).toISOString(),
    s.windowDays,
    ...COLUMNS.map((c) => (+s.scan.stats[c.key]).toFixed(4)),
    ...OPEN.map((c) => (s.scan.stats[c.open] && s.scan.stats[c.key] > 0 ? 'yes' : 'no')),
    verdictFor(s.scan.stats).text,
  ]);
  return [head.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function exportCompareCsv(scenarios) {
  if (!scenarios || !scenarios.length) return false;
  const csv = scenariosToCsv(scenarios);
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lunar-site-scenarios.csv';
  a.click();
  return true;
}
