// Realistic landing spot ranking based on solar power generation (Watts),
// Direct-to-Earth radio link strength (Earth elevation & link margin in dB),
// and landing site realism.

import { prepareSite, scan } from '../core/analysis.js';
import { clamp } from '../core/constants.js';

// Missions that actually touched down
export const FLOWN_IDS = ['a11', 'a12', 'a14', 'a15', 'a16', 'a17', 'luna9', 'ce3', 'ce4', 'ce5', 'ce6', 'ch3', 'slim', 'im1', 'im2', 'bg1'];

const DAY = 86400000;

function rate(site, startMs, config) {
  const ctx = prepareSite(site, null, config);
  const sc = scan(ctx, { startMs, endMs: startMs + 30 * DAY, stepMs: 3600000 }, config, { withDsn: false });
  const { lit, los, margin } = sc.series;
  let both = 0;
  let sumMargin = 0, countMargin = 0;
  for (let i = 0; i < lit.length; i++) {
    if (lit[i] && los[i]) both++;
    if (los[i] && margin[i] > -50) {
      sumMargin += margin[i];
      countMargin++;
    }
  }
  const avgMargin = countMargin > 0 ? sumMargin / countMargin : -10;

  // Realism & performance factors:
  // 1. Solar power: average watts generated over load
  const powerFactor = clamp(sc.stats.avgPowerW / Math.max(1, config.power.loadW * 1.5), 0, 1);
  // 2. Link strength: Earth high in sky gives massive clear margin, no horizon multipath
  const earthElFactor = clamp(sc.stats.maxEarthEl / 45, 0, 1);
  const linkMarginFactor = clamp(avgMargin / 15, 0, 1);
  const linkScore = sc.stats.earthCentreFraction * 0.4 + earthElFactor * 0.35 + linkMarginFactor * 0.25;
  // 3. Operational overlap (both sun and earth up)
  const ops = both / lit.length;
  // 4. Realism & landing safety: proven flat maria / explored plains vs razor rims
  const realismBonus = (site.group === 'apollo' || site.group === 'clps' || site.group === 'intl') ? 0.22 :
                       (site.group === 'south' || site.id === 'ridge' ? 0.12 : 0.04);

  const score = (powerFactor * 0.35) + (linkScore * 0.35) + (ops * 0.18) + realismBonus;

  return {
    site,
    score,
    ops,
    avgPowerW: sc.stats.avgPowerW,
    energyKWh: sc.stats.energyKWh,
    maxEarthEl: sc.stats.maxEarthEl,
    avgMargin,
    sun: sc.stats.litFraction,
    earth: sc.stats.earthCentreFraction,
    darkH: sc.stats.longestDarkH,
  };
}

/**
 * Rate candidates with realism weighting.
 * Calls onDone({ overall, flown, polar, count }).
 */
export function findBestSpots({ sites, startMs, config, onDone, onProgress }) {
  let cancelled = false;
  (async () => {
    // Curated candidate sites across equatorial maria, mid-latitudes and polar regions
    const list = [...sites];
    const results = [];
    let sliceStart = performance.now();
    for (let i = 0; i < list.length; i++) {
      if (cancelled) return;
      if (performance.now() - sliceStart > 25) {
        onProgress?.(i / list.length);
        await new Promise((r) => setTimeout(r, 0));
        sliceStart = performance.now();
      }
      try {
        results.push(rate(list[i], startMs, config));
      } catch {
        /* skip site that fails */
      }
    }
    if (cancelled) return;

    let overall = null;
    let flown = null;
    let polar = null;

    for (const r of results) {
      if (!overall || r.score > overall.score) overall = r;
      if (FLOWN_IDS.includes(r.site.id) && (!flown || r.score > flown.score)) flown = r;
      if ((r.site.lat < -70 || r.site.group === 'south') && (!polar || r.score > polar.score)) polar = r;
    }

    onDone({ overall, flown, polar, count: list.length });
  })();

  return () => { cancelled = true; };
}
