// Find the two "best" landing spots for the current 30-day window:
//   1. best spot where a mission has already landed (flown sites), and
//   2. best spot overall: every curated site plus the brightest cells of the
//      2027 LOLA south-polar sunlight map.
// "Best" = largest share of the window with BOTH the Sun up (power) and
// Earth's centre above the terrain (direct-to-Earth geometry). Ties go to the
// shorter longest night. DSN coverage is left out because it is the same for
// every site on the Moon.

import { prepareSite, scan } from '../core/analysis.js';
import { fromSouthPolar } from '../core/geo.js';

// Missions that actually touched down (excludes targets, crashes and impacts).
export const FLOWN_IDS = ['a11', 'a12', 'a14', 'a15', 'a16', 'a17', 'luna9', 'ce3', 'ce4', 'ce5', 'ce6', 'ch3', 'slim', 'im1', 'im2', 'bg1'];

const DAY = 86400000;
let illumCache = null;

async function polarCandidates(count = 30) {
  try {
    if (!illumCache) {
      const res = await fetch(`${(import.meta.env?.BASE_URL ?? "/")}data/sp_illum_2027.json`);
      illumCache = await res.json();
    }
  } catch {
    return [];
  }
  const d = illumCache;
  const n = d.size;
  const cells = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = r * n + c;
      const score = (d.illum[k] / d.scale) * (d.earth[k] / d.scale);
      if (score > 0) cells.push({ r, c, score });
    }
  }
  cells.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const cell of cells) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.hypot(p.r - cell.r, p.c - cell.c) < 5)) continue; // ≥ 5 km apart
    picked.push(cell);
  }
  return picked.map((p, i) => {
    const x = -d.halfExtent + (p.c + 0.5) * d.cellSize;
    const y = d.halfExtent - (p.r + 0.5) * d.cellSize;
    const { lat, lon } = fromSouthPolar(x, y);
    return { id: `search-${i}`, name: `Search cell ${lat.toFixed(2)}°, ${lon.toFixed(1)}°`, short: 'LOLA search cell', lat, lon, group: 'computed', searched: true };
  });
}

function rate(site, startMs, config) {
  const ctx = prepareSite(site, null, config);
  const sc = scan(ctx, { startMs, endMs: startMs + 30 * DAY, stepMs: 3600000 }, config, { withDsn: false });
  const { lit, los } = sc.series;
  let both = 0;
  for (let i = 0; i < lit.length; i++) if (lit[i] && los[i]) both++;
  return {
    site,
    ops: both / lit.length,
    sun: sc.stats.litFraction,
    earth: sc.stats.earthCentreFraction,
    darkH: sc.stats.longestDarkH,
  };
}

const better = (a, b) => (a.ops !== b.ops ? a.ops > b.ops : a.darkH < b.darkH);

/**
 * Rate all candidates without blocking the page (one site per task).
 * Returns a cancel function; calls onDone({ flown, overall, count }).
 */
export function findBestSpots({ sites, startMs, config, onDone, onProgress }) {
  let cancelled = false;
  (async () => {
    const extra = await polarCandidates();
    const list = [...sites, ...extra];
    const results = [];
    let sliceStart = performance.now();
    for (let i = 0; i < list.length; i++) {
      if (cancelled) return;
      if (performance.now() - sliceStart > 25) {
        onProgress?.(i / list.length);
        await new Promise((r) => setTimeout(r, 0));
        sliceStart = performance.now();
      }
      try { results.push(rate(list[i], startMs, config)); } catch { /* skip a site that fails */ }
    }
    if (cancelled) return;
    let flown = null, overall = null;
    for (const r of results) {
      if (FLOWN_IDS.includes(r.site.id) && (!flown || better(r, flown))) flown = r;
      if (!overall || better(r, overall)) overall = r;
    }
    onDone({ flown, overall, count: list.length });
  })();
  return () => { cancelled = true; };
}
