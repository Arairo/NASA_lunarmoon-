// Beginner mode: a calm, linear walk with Lumi. One question per screen,
// big Continue button, and a "Why does this happen?" drawer on every step.
// Uses the same engine as Pro mode (src/core), so every number is real.

import { prepareSite, scanWindow } from '../core/analysis.js';
import { horizonAt } from '../core/horizon.js';
import { SYNODIC_MONTH_DAYS, clamp } from '../core/constants.js';
import { esc, fmtLatLon, fmtHours } from '../ui/format.js';
import { setLumi } from './lumi.js';
import { play } from './sound.js';

const DAY = 86400000;
const FEATURED = [
  { id: 'ridge', title: 'The sunny ridge', blurb: 'A high rim beside Shackleton crater at the south pole.', tag: 'South pole · high ground', art: 'linear-gradient(160deg,#ffb300 0%,#ff7a00 35%,#1b2130 36%,#0b0f17 100%)' },
  { id: 'shackleton', title: 'Inside a deep crater', blurb: 'The floor of Shackleton crater, 4 km deep.', tag: 'South pole · crater floor', art: 'radial-gradient(circle at 50% 120%,#0b0f17 45%,#3a3f4b 46%,#1b2130 70%,#070a12 100%)' },
  { id: 'a11', title: 'Apollo 11', blurb: 'Where people first walked on the Moon, near the equator.', tag: 'Equator · 1969', art: 'linear-gradient(180deg,#070a12 0%,#070a12 40%,#8e93a0 41%,#5a606e 100%)' },
  { id: 'ce4', title: 'The far side', blurb: 'Chang’e 4’s landing spot, on the side that faces away from us.', tag: 'Far side · China', art: 'radial-gradient(circle at 80% 20%,#ffb300 0 8%,transparent 9%),linear-gradient(180deg,#070a12 55%,#4a4f5c 56%)' },
];
const DATES = [
  { label: 'This week', ms: Date.UTC(2026, 10, 16, 22) },
  { label: 'New Year 2027', ms: Date.UTC(2027, 0, 1, 0) },
  { label: 'April 2027', ms: Date.UTC(2027, 3, 1, 0) },
  { label: 'July 2027', ms: Date.UTC(2027, 6, 1, 0) },
];

export const RULES_NOTE = 'These traffic lights use our own rules of thumb, not an official NASA standard. Power: red if the Sun is down at landing; amber if it sets within 7 days or part of it is hidden; otherwise green. Earth: red if Earth’s centre is behind the terrain; amber if it sets within 3 days or sits less than 2° above the skyline; otherwise green.';

function nextChange(arr, times, idx = 0) {
  const cur = !!arr[idx];
  for (let i = idx + 1; i < arr.length; i++) if (!!arr[i] !== cur) return times[i];
  return null;
}

function verdicts(scan) {
  const s = scan.series, t0 = s.times[0];
  const sunUp = s.lit[0] === 1;
  const sunSet = sunUp ? nextChange(s.lit, s.times) : null;
  const fullDisk = s.sunFrac[0] >= 0.99;
  const power = !sunUp ? 'red' : (sunSet && sunSet - t0 < 7 * DAY) || !fullDisk ? 'amber' : 'green';
  const earthUp = s.los[0] === 1;
  const earthSet = earthUp ? nextChange(s.los, s.times) : null;
  const earth = !earthUp ? 'red' : (earthSet && earthSet - t0 < 3 * DAY) || s.earthClear[0] < 2 ? 'amber' : 'green';
  const overall = power === 'red' || earth === 'red' ? 'red' : power === 'amber' || earth === 'amber' ? 'amber' : 'green';
  const nextSunrise = sunUp ? null : nextChange(s.lit, s.times);
  const nextEarthrise = earthUp ? null : nextChange(s.los, s.times);
  return { power, earth, overall, sunSet, earthSet, nextSunrise, nextEarthrise, t0 };
}

const LIGHT = { green: ['GO', '✓'], amber: ['GO WITH CARE', '!'], red: ['NO GO', '✕'] };
const inDays = (ms, t0) => {
  if (!ms) return 'Not in the next 30 days';
  const d = (ms - t0) / DAY;
  return d < 2 ? `${Math.max(1, Math.round(d * 24))} hours` : `${d.toFixed(1)} days`;
};
const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtWhen = (ms) => { const iso = new Date(ms).toISOString(); return `${iso.slice(5, 10)} ${iso.slice(11, 16)} UTC`; };

function skyline(ctx, scan) {
  const s = scan.series;
  let maxEl = 8;
  for (let i = 0; i < s.times.length; i++) maxEl = Math.max(maxEl, s.sunEl[i], s.earthEl[i]);
  const W = 900, H = 300, top = 26, bottom = 250;
  const yMin = -8, yMax = clamp(Math.ceil(maxEl + 4), 12, 92);
  const x = (az) => ((((az % 360) + 360) % 360) / 360) * W;
  const y = (el) => bottom - ((clamp(el, yMin, yMax) - yMin) / (yMax - yMin)) * (bottom - top);
  let ground = `M0 ${H} `, edge = '';
  for (let k = 0; k <= 360; k += 2) {
    const pt = `${((k / 360) * W).toFixed(1)} ${y(horizonAt(ctx.horizon, k % 360)).toFixed(1)}`;
    ground += `L${pt} `; edge += `${k ? 'L' : 'M'}${pt} `;
  }
  ground += `L${W} ${H} Z`;
  let trails = '';
  for (let i = 0; i < s.times.length; i += 3) {
    trails += `<circle cx="${x(s.sunAz[i]).toFixed(1)}" cy="${y(s.sunEl[i]).toFixed(1)}" r="1.6" class="trail-sun"/>`;
    trails += `<circle cx="${x(s.earthAz[i]).toFixed(1)}" cy="${y(s.earthEl[i]).toFixed(1)}" r="1.6" class="trail-earth"/>`;
  }
  const compass = [['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([l, az]) => `<text x="${x(az) + 6}" y="${H - 14}" class="lbl">${l}</text><line x1="${x(az)}" x2="${x(az)}" y1="${H - 30}" y2="${H - 22}" stroke="#8e93a0"/>`).join('');
  const svg = `<svg class="w-sky" viewBox="0 0 ${W} ${H}" role="img" aria-label="360 degree skyline with the Sun and Earth">
    <defs><radialGradient id="wSunGlow"><stop offset="0" stop-color="#ffb300" stop-opacity="0.75"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" class="sky"/>
    <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="lvl"/>
    <text x="8" y="${y(0) - 6}" class="lbl">level (0°)</text>
    ${trails}
    <circle data-b="sunglow" r="34" fill="url(#wSunGlow)" class="body"/>
    <circle data-b="sun" r="11" fill="#ffb300" class="body"/>
    <circle data-b="earth" r="9" fill="#38bdf8" stroke="#bfe9ff" stroke-width="1.5" class="body"/>
    <path d="${ground}" class="ground"/><path d="${edge}" class="ground-edge"/>
    <text data-b="sunlbl" class="tag">Sun</text><text data-b="earthlbl" class="tag">Earth</text>
    ${compass}
    <text x="${W - 8}" y="18" class="lbl" text-anchor="end">Height stretched to show detail</text>
  </svg>`;
  const place = (root, i) => {
    const set = (k, attrs) => { const el = root.querySelector(`[data-b="${k}"]`); if (el) for (const a in attrs) el.setAttribute(a, attrs[a]); };
    const sx = x(s.sunAz[i]), sy = y(s.sunEl[i]), ex = x(s.earthAz[i]), ey = y(s.earthEl[i]);
    const sunHidden = s.lit[i] !== 1, earthHidden = s.los[i] !== 1;
    set('sun', { cx: sx, cy: sy, opacity: sunHidden ? 0.35 : 1 });
    set('sunglow', { cx: sx, cy: sy, opacity: sunHidden ? 0 : 1 });
    set('earth', { cx: ex, cy: ey, opacity: earthHidden ? 0.35 : 1 });
    set('sunlbl', { x: Math.min(W - 70, sx + 14), y: sy - 14 });
    set('earthlbl', { x: Math.min(W - 70, ex + 12), y: ey - 12 });
    root.querySelector('[data-b="sunlbl"]').textContent = sunHidden ? 'Sun (hidden)' : 'Sun';
    root.querySelector('[data-b="earthlbl"]').textContent = earthHidden ? 'Earth (hidden)' : 'Earth';
  };
  return { svg, place };
}

function describe(scan, i) {
  const s = scan.series;
  const sunClear = s.sunEl[i] - s.sunHorizon[i];
  const ec = s.earthClear[i];
  const sun = s.lit[i] !== 1
    ? `the Sun is hidden behind the terrain`
    : sunClear < 5 ? `the Sun is just skimming the hills, ${sunClear.toFixed(1)}° above them`
    : `the Sun is ${sunClear.toFixed(0)}° above the skyline`;
  const earth = s.los[i] !== 1
    ? 'Earth is out of sight, so there is no direct radio link'
    : ec < 2 ? `Earth is peeking just ${ec.toFixed(1)}° over the edge`
    : `Earth is ${ec.toFixed(0)}° up, clear for a radio call`;
  return `Right now ${sun}, and ${earth}.`;
}

export function createWalk({ app, sites, onOpenPro, onExit, onToggleTheme, onToggleSound }) {
  const st = { step: 0, site: null, startMs: DATES[0].ms, ctx: null, scan: null, v: null, idx: 0, playing: false, slips: null, other: null, otherRes: null };
  const root = document.createElement('section');
  root.id = 'xp-walk';
  root.setAttribute('aria-label', 'Beginner mode');
  root.innerHTML = `
    <div class="w-top">
      <div class="w-brand"><svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="8" r="2.5" fill="#ffb300"/></svg> Lunar Site Planner</div>
      <div class="w-progress" aria-hidden="true"><i></i></div>
      <button type="button" class="xp-chip xp-icon-btn" data-a="sound" data-sound-label aria-label="Mute sounds" title="Sound on / off">🔊</button>
      <button type="button" class="xp-chip xp-icon-btn" data-a="theme" data-theme-label aria-label="Switch light or dark mode" title="Light / dark">◐</button>
      <button type="button" class="xp-chip" data-a="pro">Professional mode</button>
    </div>
    <div class="w-main"><div class="w-scene"></div></div>
    <div class="w-dock"><div class="w-dock-inner">
      <button type="button" class="xp-btn xp-btn-ghost" data-a="back">Back</button>
      <button type="button" class="xp-btn xp-btn-primary" data-a="next">Continue</button>
    </div></div>`;
  document.body.appendChild(root);

  const scene = root.querySelector('.w-scene');
  const nextBtn = root.querySelector('[data-a="next"]');
  const backBtn = root.querySelector('[data-a="back"]');
  root.querySelector('[data-a="pro"]').addEventListener('click', () => onOpenPro(st.site, st.startMs, false));
  root.querySelector('[data-a="theme"]').addEventListener('click', onToggleTheme);
  root.querySelector('[data-a="sound"]').addEventListener('click', () => onToggleSound?.());
  backBtn.addEventListener('click', () => go(st.step - 1));
  nextBtn.addEventListener('click', () => STEPS[st.step].next ? STEPS[st.step].next() : go(st.step + 1));

  const why = (title, html) => `<details class="w-why"><summary><span>›</span> ${title}</summary><div class="why-body">${html}</div></details>`;
  const say = (h, ...ps) => `<div class="w-say"><h2>${h}</h2>${ps.map((p) => `<p>${p}</p>`).join('')}</div>`;

  function compute(done) {
    const cfg = app.config;
    setTimeout(() => {
      st.ctx = prepareSite(st.site, null, cfg);
      st.scan = scanWindow(st.ctx, st.startMs, 30, cfg);
      st.v = verdicts(st.scan);
      st.idx = 0;
      st.slips = null;
      st.other = null;
      st.otherRes = null;
      done();
    }, 30);
  }

  const STEPS = [
    {
      mood: 'happy',
      render: () => `${say('Hi, I’m Lumi.', 'Let’s find a good place to land on the Moon. It’s easier than it sounds.', 'A lander needs two things to survive: <b>sunlight</b> for its solar panels, and <b>Earth in view</b> so it can call home by radio. We’ll check both, one step at a time.')}
        <div class="w-content">${why('Why is the Moon’s south pole so popular?', 'Craters near the south pole hold ice that has stayed frozen for billions of years: water for drinking, air and rocket fuel. But the Sun there never climbs high, and Earth sits right on the horizon. That makes power and radio contact tricky, and that’s exactly what this tool helps you check.')}</div>`,
      cta: 'Let’s go',
    },
    {
      mood: 'think',
      render: () => `${say('Where shall we land?', 'Pick one. You can always come back and try another.')}
        <div class="w-content"><div class="w-cards">${FEATURED.map((f) => `
          <button type="button" class="w-card ${st.site?.id === f.id ? 'is-picked' : ''}" data-site="${f.id}">
            <div class="c-art" style="background:${f.art}"></div><h3>${f.title}</h3><p>${f.blurb}</p><span class="c-tag">${f.tag}</span>
          </button>`).join('')}</div>
          <div class="w-more"><label for="wSiteSel">Or choose from all ${sites.length} landing sites</label>
            <select id="wSiteSel" class="w-select" style="width:100%">
              <option value="">Choose a site…</option>
              ${sites.map((s) => `<option value="${esc(s.id)}" ${st.site?.id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
            </select></div></div>`,
      bind: () => {
        scene.querySelectorAll('[data-site]').forEach((b) => b.addEventListener('click', () => {
          pick(b.dataset.site);
          scene.querySelectorAll('[data-site]').forEach((c) => c.classList.toggle('is-picked', c === b));
          scene.querySelector('#wSiteSel').value = b.dataset.site;
        }));
        scene.querySelector('#wSiteSel').addEventListener('change', (e) => {
          pick(e.target.value);
          scene.querySelectorAll('[data-site]').forEach((c) => c.classList.toggle('is-picked', c.dataset.site === e.target.value));
        });
      },
      ready: () => !!st.site,
    },
    {
      mood: 'happy',
      render: () => `${say('When do we touch down?', `We’re landing at <b>${esc(st.site.name)}</b>. Now pick a day. A lunar day lasts about a month, so the date really matters.`)}
        <div class="w-content"><div class="w-row">${DATES.map((d) => `<button type="button" class="w-pill ${st.startMs === d.ms ? 'is-picked' : ''}" data-ms="${d.ms}">${d.label}<br><small style="font-weight:500;opacity:.7">${fmtDate(d.ms)}</small></button>`).join('')}</div>
          <div class="w-more"><label for="wDate">Or pick any date and time (UTC, the time used for space missions)</label>
            <input id="wDate" type="datetime-local" class="w-input" value="${new Date(st.startMs).toISOString().slice(0, 16)}"/>
            <p class="w-note">Your local time: ${new Date(st.startMs).toLocaleString()}</p></div></div>`,
      bind: () => {
        scene.querySelectorAll('[data-ms]').forEach((b) => b.addEventListener('click', () => {
          st.startMs = Number(b.dataset.ms);
          scene.querySelectorAll('[data-ms]').forEach((c) => c.classList.toggle('is-picked', c === b));
          scene.querySelector('#wDate').value = new Date(st.startMs).toISOString().slice(0, 16);
        }));
        scene.querySelector('#wDate').addEventListener('change', (e) => {
          const ms = Date.parse(e.target.value + ':00Z');
          if (Number.isFinite(ms)) { st.startMs = ms; scene.querySelectorAll('[data-ms]').forEach((c) => c.classList.remove('is-picked')); }
        });
      },
      next: () => { st.scan = null; go(3); },
      cta: 'Take me there',
    },
    {
      mood: 'wow',
      render: () => st.scan ? `${say('Let’s look around.', 'This is the whole skyline, all the way round. The ground shape is real NASA terrain data. Drag the slider to move through the next 30 days, or press play.')}
        <div class="w-content"><div class="w-panel"><div data-sky>${skyline(st.ctx, st.scan).svg}</div>
          <div class="w-controls"><button type="button" class="xp-btn xp-btn-primary w-play" data-a="play" aria-label="Play">▶</button>
            <input type="range" min="0" max="${st.scan.series.times.length - 1}" value="${st.idx}" aria-label="Time over the next 30 days"/>
            <span class="w-when"></span></div>
          <p class="w-live" aria-live="polite"></p></div>
          ${why('What am I looking at?', 'Imagine standing on the lander and turning in a full circle. Left to right is the compass direction (north, east, south, west). Up and down is how high something is above a level line. The grey shape is the real terrain around you, from NASA’s LOLA laser altimeter. The faint dotted trails show where the Sun (gold) and Earth (blue) travel over the month. When a trail dips under the grey shape, that body is hidden.')}</div>`
        : `${say('Taking you there…', 'Reading the terrain around the site and working out where the Sun and Earth will be.')}<div class="w-loading"><div class="w-spinner"></div>Calculating 30 days of sky</div>`,
      enter: () => { if (!st.scan) compute(() => render(3)); },
      bind: () => {
        if (!st.scan) return;
        const sk = skyline(st.ctx, st.scan);
        const holder = scene.querySelector('[data-sky]');
        const range = scene.querySelector('input[type=range]');
        const when = scene.querySelector('.w-when');
        const live = scene.querySelector('.w-live');
        const upd = () => { sk.place(holder, st.idx); when.textContent = fmtWhen(st.scan.series.times[st.idx]); live.textContent = describe(st.scan, st.idx); };
        range.addEventListener('input', () => { st.idx = Number(range.value); upd(); });
        const play = scene.querySelector('[data-a="play"]');
        let raf = 0, last = 0;
        const loop = (t) => {
          if (!st.playing || !root.isConnected || !scene.contains(range)) return;
          if (t - last > 70) { last = t; st.idx = (st.idx + 1) % st.scan.series.times.length; range.value = st.idx; upd(); }
          raf = requestAnimationFrame(loop);
        };
        play.addEventListener('click', () => {
          st.playing = !st.playing;
          play.textContent = st.playing ? '❚❚' : '▶';
          if (st.playing) raf = requestAnimationFrame(loop); else cancelAnimationFrame(raf);
        });
        upd();
      },
      ready: () => !!st.scan,
    },
    {
      mood: () => (st.v.power === 'red' ? 'worried' : st.v.power === 'amber' ? 'think' : 'happy'),
      render: () => {
        const v = st.v, ss = st.scan.stats;
        const head = v.power === 'green' ? 'Plenty of sunshine.' : v.power === 'amber' ? 'Sunny, but not for long.' : 'It’s dark when we land.';
        const line = v.power === 'red'
          ? `The Sun is below the skyline at touchdown, so the solar panels make nothing. ${v.nextSunrise ? `Sunrise comes in ${inDays(v.nextSunrise, v.t0)}.` : 'It doesn’t rise again in the next 30 days.'}`
          : v.sunSet ? `The Sun is up when we land. It sets in <b>${inDays(v.sunSet, v.t0)}</b>.` : 'The Sun is up when we land, and it <b>stays up for the whole next 30 days</b>.';
        return `${say('Check 1: Power', 'Solar panels only work when the Sun is above the skyline.')}
          <div class="w-content"><div class="w-verdict"><div class="w-light ${v.power}">${LIGHT[v.power][1]}</div><div><h3>${head}</h3><p>${line}</p></div></div>
          <div class="w-facts">
            <div class="w-fact"><div class="k">Sunlight over 30 days</div><div class="v">${Math.round(ss.litFraction * 100)}%</div></div>
            <div class="w-fact"><div class="k">Longest darkness</div><div class="v">${fmtHours(ss.longestDarkH)}${ss.longestDarkOpenEnded ? '+' : ''}</div></div>
            <div class="w-fact"><div class="k">Average power</div><div class="v">${ss.avgPowerW.toFixed(0)} W</div></div>
            <div class="w-fact"><div class="k">Highest Sun (above level)</div><div class="v">${ss.maxSunEl.toFixed(1)}°</div></div>
          </div>
          ${why('Why does the Sun behave like this?', 'The Moon’s axis is tilted only about 1.5°. Near the poles the Sun never climbs high: it circles the whole sky once every 29.5 days, skimming just a few degrees above the horizon. A crater rim or hill kilometres away can block it for days. That’s why missions aim for high ridges, and why some crater floors haven’t seen sunlight in billions of years. Near the equator it’s simpler: about two weeks of day, then two weeks of night.')}
          <p class="w-note">Power assumes ${app.config.power.areaM2} m² of panels at ${(app.config.power.efficiency * 100).toFixed(0)}% efficiency. ${RULES_NOTE.split('. Earth:')[0]}.</p></div>`;
      },
    },
    {
      mood: () => (st.v.earth === 'red' ? 'worried' : st.v.earth === 'amber' ? 'think' : 'happy'),
      render: () => {
        const v = st.v, ss = st.scan.stats;
        const head = v.earth === 'green' ? 'We can phone home.' : v.earth === 'amber' ? 'Earth is in view, just barely.' : 'Earth is out of sight.';
        const line = v.earth === 'red'
          ? (ss.earthCentreFraction === 0 ? 'Earth never rises above the skyline here, so a lander would need a relay satellite to talk to us.' : `Earth is behind the terrain at touchdown. ${v.nextEarthrise ? `It comes back in ${inDays(v.nextEarthrise, v.t0)}.` : ''}`)
          : v.earthSet ? `Earth is above the skyline at touchdown. It sets in <b>${inDays(v.earthSet, v.t0)}</b>.` : 'Earth is above the skyline at touchdown, and it <b>stays in view for the whole next 30 days</b>.';
        return `${say('Check 2: Talking to Earth', 'Radios need a clear line to Earth, with no hills in the way.')}
          <div class="w-content"><div class="w-verdict"><div class="w-light ${v.earth}">${LIGHT[v.earth][1]}</div><div><h3>${head}</h3><p>${line}</p></div></div>
          <div class="w-facts">
            <div class="w-fact"><div class="k">Earth in view, 30 days</div><div class="v">${Math.round(ss.earthCentreFraction * 100)}%</div></div>
            <div class="w-fact"><div class="k">Longest time hidden</div><div class="v">${ss.earthCentreFraction === 0 ? 'Always' : fmtHours(ss.longestEarthHiddenH)}</div></div>
            <div class="w-fact"><div class="k">Highest Earth</div><div class="v">${ss.maxEarthEl.toFixed(1)}°</div></div>
          </div>
          ${why('Why does Earth barely move?', 'The Moon always keeps the same face towards Earth, so from any spot Earth hangs in almost the same place in the sky. A slow wobble called libration makes it drift a few degrees. At the south pole Earth sits right on the horizon, so it bobs in and out of view roughly every two weeks. On the far side Earth never rises at all, which is why China’s Chang’e 4 needed a relay satellite.')}</div>`;
      },
    },
    {
      mood: () => (st.v.overall === 'red' ? 'worried' : st.v.overall === 'amber' ? 'think' : 'happy'),
      reaction: () => (st.v.overall === 'green' ? 'cheer' : 'hop'),
      render: () => {
        const v = st.v;
        const msg = v.overall === 'green' ? 'Sunlight for power and a clear line to Earth. This looks like a good landing.' : v.overall === 'amber' ? 'It can work, but the team would need to plan carefully around the short windows.' : 'At least one of the two essentials is missing at touchdown. Try another date or a nearby spot.';
        return `${say('Mission report', `${esc(st.site.name)}, ${fmtDate(st.startMs)}.`)}
          <div class="w-content"><div class="w-big"><div class="w-light ${v.overall}">${LIGHT[v.overall][1]}</div><h3>${LIGHT[v.overall][0]}</h3><p>${msg}</p>
            <div class="w-row" style="justify-content:center;margin-top:16px">
              <span class="w-pill" style="cursor:default">☀︎ Power: ${LIGHT[v.power][0]}</span>
              <span class="w-pill" style="cursor:default">🌍 Earth: ${LIGHT[v.earth][0]}</span>
            </div></div>
          ${why('How do we know these numbers are right?', `The Sun and Earth positions come from the same maths NASA uses. We checked them against NASA JPL Horizons:
            <table style="width:100%;margin-top:10px;font-size:13px;border-collapse:collapse">
              <tr style="text-align:left"><th>Check</th><th>Difference</th></tr>
              <tr><td>Sun at Apollo 11 landing, 1969</td><td>0.007°</td></tr>
              <tr><td>Earth from the Shackleton ridge, 2027</td><td>0.0001°</td></tr>
              <tr><td>Sun at Reiner Gamma, 2027</td><td>0.002°</td></tr>
            </table>
            <p style="margin-top:10px">The skyline is NASA LOLA terrain (south of about 75°S; a smooth Moon elsewhere). ${RULES_NOTE}</p>`)}</div>`;
      },
      cta: 'What if the launch slips?',
    },
    {
      mood: 'think',
      render: () => st.slips ? `${say('What if the launch slips?', 'Rockets get delayed all the time. Here’s the same site if we land one, two or three lunar months later.')}
          <div class="w-content"><div class="w-panel"><div class="w-slips">${st.slips.map((r) => `
            <div class="w-slip"><div><b>${r.label}</b><div class="lbl">${fmtDate(r.ms)}</div></div>
              <div><div class="lbl">Sunlight ${Math.round(r.sun * 100)}%</div><div class="bar"><i style="width:${r.sun * 100}%;background:#ffb300"></i></div></div>
              <div><div class="lbl">Earth in view ${Math.round(r.earth * 100)}%</div><div class="bar"><i style="width:${r.earth * 100}%;background:#38bdf8"></i></div></div>
              <span class="chip" style="background:var(--xp-${r.v === 'green' ? 'ok' : r.v === 'amber' ? 'warn' : 'bad'})">${LIGHT[r.v][0]}</span></div>`).join('')}</div></div>
          ${why('Why does a one-month delay change so much?', 'Earth’s wobble and the Sun’s path repeat only roughly from month to month, and the seasons slowly shift where the Sun skims the horizon. At the pole, a change of a degree or two decides whether the Sun clears a ridge. Professional mode can scan a full year to find the best window.')}</div>`
        : `${say('Checking later dates…', 'Running the same checks one, two and three lunar months later.')}<div class="w-loading"><div class="w-spinner"></div>Comparing four landing dates</div>`,
      enter: () => {
        if (st.slips) return;
        const rows = [];
        const run = (k) => {
          if (k > 3) { st.slips = rows; if (st.step === 7) render(7); return; }
          const ms = Math.round(st.startMs + k * SYNODIC_MONTH_DAYS * DAY);
          const sc = scanWindow(st.ctx, ms, 30, app.config);
          rows.push({ label: k === 0 ? 'As planned' : `+${k} month${k > 1 ? 's' : ''}`, ms, sun: sc.stats.litFraction, earth: sc.stats.earthCentreFraction, v: verdicts(sc).overall });
          setTimeout(() => run(k + 1), 10);
        };
        setTimeout(() => run(0), 40);
      },
      ready: () => !!st.slips,
    },
    {
      id: 'compare',
      mood: () => (st.otherRes ? 'wow' : 'think'),
      render: () => {
        if (!st.other) st.other = sites.find((x) => x.id === (st.site.id === 'ridge' ? 'shackleton' : 'ridge'));
        const choices = FEATURED.filter((f) => f.id !== st.site.id);
        const picker = `<div class="w-row" style="margin-bottom:14px">${choices.map((f) => `<button type="button" class="w-pill ${st.other?.id === f.id ? 'is-picked' : ''}" data-other="${f.id}">${f.title}</button>`).join('')}
          <select class="w-select" data-other-sel><option value="">Any other site…</option>${sites.filter((x) => x.id !== st.site.id).map((x) => `<option value="${esc(x.id)}" ${st.other?.id === x.id && !choices.some((c) => c.id === x.id) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>`;
        if (!st.otherRes) return `${say('Compare two places', 'Planners rarely look at one site alone. Pick a second place and I’ll check both on the same date.')}<div class="w-content">${picker}<div class="w-loading"><div class="w-spinner"></div>Checking ${esc(st.other.name)}</div></div>`;
        const A = { site: st.site, scan: st.scan, v: st.v }, B = st.otherRes;
        const rank = { green: 2, amber: 1, red: 0 };
        const sA = A.scan.stats, sB = B.scan.stats;
        const dSun = sA.litFraction - sB.litFraction, dEarth = sA.earthCentreFraction - sB.earthCentreFraction, dV = rank[A.v.overall] - rank[B.v.overall];
        const tol = 0.02;
        const aDom = dSun >= -tol && dEarth >= -tol && dV >= 0 && (dSun > tol || dEarth > tol || dV > 0);
        const bDom = dSun <= tol && dEarth <= tol && dV <= 0 && (dSun < -tol || dEarth < -tol || dV < 0);
        const win = aDom ? A : bDom ? B : null;
        const nm = (r) => esc(r.site.short || r.site.name);
        const pc = (f) => Math.round(f * 100) + '%';
        const col = (r) => `<div class="w-panel" style="${win === r ? 'border-color:var(--xp-ok);box-shadow:0 0 0 3px rgba(48,209,88,.25)' : ''}">
            <div style="display:flex;align-items:center;gap:12px"><div class="w-light ${r.v.overall}" style="width:52px;height:52px;font-size:20px">${LIGHT[r.v.overall][1]}</div>
              <div><div style="font:650 17px var(--xp-font)">${esc(r.site.name)}</div><div class="w-note" style="margin:0">${LIGHT[r.v.overall][0]} at touchdown${win === r ? ' · better on both' : ''}</div></div></div>
            <div class="w-facts" style="grid-template-columns:1fr 1fr">
              <div class="w-fact"><div class="k">Sunlight</div><div class="v">${Math.round(r.scan.stats.litFraction * 100)}%</div></div>
              <div class="w-fact"><div class="k">Earth in view</div><div class="v">${Math.round(r.scan.stats.earthCentreFraction * 100)}%</div></div>
              <div class="w-fact"><div class="k">Longest dark</div><div class="v">${fmtHours(r.scan.stats.longestDarkH)}</div></div>
              <div class="w-fact"><div class="k">Average power</div><div class="v">${r.scan.stats.avgPowerW.toFixed(0)} W</div></div>
            </div></div>`;
        let verdict;
        if (win) verdict = `<b>${nm(win)}</b> is better on both counts for this date.`;
        else if (Math.abs(dSun) <= tol && Math.abs(dEarth) <= tol) verdict = 'They come out about even for this date.';
        else {
          const sunW = dSun > 0 ? A : B, earthW = dEarth > 0 ? A : B;
          verdict = `It’s a trade-off: <b>${nm(sunW)}</b> gets more sunlight (${pc(Math.max(sA.litFraction, sB.litFraction))} vs ${pc(Math.min(sA.litFraction, sB.litFraction))}), but <b>${nm(earthW)}</b> keeps Earth in view longer (${pc(Math.max(sA.earthCentreFraction, sB.earthCentreFraction))} vs ${pc(Math.min(sA.earthCentreFraction, sB.earthCentreFraction))}).`;
        }
        return `${say('Compare two places', `Same date, two places. ${verdict}`)}<div class="w-content">${picker}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">${col(A)}${col(B)}</div>
          ${why('Why can two nearby places be so different?', 'At the pole the Sun is so low that a few hundred metres of height decides everything. A ridge top sees over the surrounding hills; a crater floor a few kilometres away sits in their shadow. The same goes for Earth, which hangs just above the horizon. That is why mission teams compare many candidate spots before choosing one.')}</div>`;
      },
      enter: () => { if (!st.otherRes) runOther(); },
      bind: () => {
        scene.querySelectorAll('[data-other]').forEach((b) => b.addEventListener('click', () => setOther(b.dataset.other)));
        scene.querySelector('[data-other-sel]')?.addEventListener('change', (e) => e.target.value && setOther(e.target.value));
      },
      ready: () => !!st.otherRes,
    },
    {
      mood: 'happy',
      reaction: 'cheer',
      render: () => `${say('You did it!', 'You just did what mission planners do: picked a site, checked power and radio, and tested a delay.', 'Want to go deeper? Professional mode has the 3D Moon, the full timeline and side-by-side comparison. I’ll show you around.')}
        <div class="w-content"><div class="w-row">
          <button type="button" class="xp-btn xp-btn-primary" data-a="openpro">Open this landing in Professional mode</button>
          <button type="button" class="xp-btn xp-btn-ghost" data-a="again">Try another place</button>
        </div></div>`,
      bind: () => {
        scene.querySelector('[data-a="openpro"]').addEventListener('click', () => onOpenPro(st.site, st.startMs, true));
        scene.querySelector('[data-a="again"]').addEventListener('click', () => { st.scan = null; go(1); });
      },
      cta: 'Start over',
      next: () => { st.scan = null; go(0); },
    },
  ];

  function runOther() {
    const other = st.other || sites.find((x) => x.id === (st.site.id === 'ridge' ? 'shackleton' : 'ridge'));
    st.other = other;
    setTimeout(() => {
      const ctx = prepareSite(other, null, app.config);
      const scan = scanWindow(ctx, st.startMs, 30, app.config);
      if (st.other !== other) return;
      st.otherRes = { site: other, scan, v: verdicts(scan) };
      if (st.step === COMPARE_STEP) render(COMPARE_STEP);
    }, 40);
  }
  function setOther(id) {
    const o = sites.find((x) => x.id === id);
    if (!o || o === st.other) return;
    st.other = o; st.otherRes = null;
    render(COMPARE_STEP); runOther();
  }
  const COMPARE_STEP = STEPS.findIndex((x) => x.id === 'compare');

  function pick(id) {
    st.site = sites.find((s) => s.id === id) || null;
    st.scan = null;
    nextBtn.disabled = !st.site;
  }

  function render(i) {
    const step = STEPS[i];
    const mood = typeof step.mood === 'function' ? step.mood() : step.mood;
    const reaction = typeof step.reaction === 'function' ? step.reaction() : step.reaction || 'hop';
    scene.innerHTML = `<div class="w-lumi" data-lumi></div><div>${step.render()}</div>`;
    setLumi(scene.querySelector('[data-lumi]'), mood, reaction, 140);
    step.bind?.();
    // Verdict screens get a matching chime (green / amber / red light).
    const light = scene.querySelector('.w-verdict .w-light, .w-big .w-light');
    if (light) setTimeout(() => play(light.classList.contains('green') ? 'go' : light.classList.contains('amber') ? 'care' : 'nogo'), 250);
    nextBtn.textContent = step.cta || 'Continue';
    nextBtn.disabled = step.ready ? !step.ready() : false;
    backBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
    root.querySelector('.w-progress i').style.width = `${(i / (STEPS.length - 1)) * 100}%`;
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length) return;
    st.playing = false;
    play('tick');
    const doIt = () => {
      st.step = i;
      render(i);
      STEPS[i].enter?.();
      root.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (scene.childElementCount) {
      scene.classList.add('is-out');
      setTimeout(() => { scene.classList.remove('is-out'); doIt(); }, 260);
    } else doIt();
  }

  return {
    open() { if (!scene.childElementCount) go(0); },
    root,
  };
}
