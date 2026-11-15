// Duolingo-style Learning Map view, lesson modal, interactive quiz engine, and simulation runner.
import { ACADEMY_UNITS, ALL_ACADEMY_NODES } from './content.js';
import { mascotSvg } from './mascot.js';
import { clamp, deg, esc, fmtHours, pct } from '../ui/format.js';
import { horizonAt } from '../core/horizon.js';
import { prepareSite, scanWindow } from '../core/analysis.js';

export function panoramaSvgForLesson(ctx, scan, idx) {
  const W = 760, H = 230, top = 22, bottom = 195;
  const yMin = -6, yMax = 10;
  const x = (az) => (((az % 360) + 360) % 360) / 360 * W;
  const y = (el) => bottom - ((clamp(el, yMin, yMax) - yMin) / (yMax - yMin)) * (bottom - top);
  let ground = `M0 ${H} `;
  for (let k = 0; k <= 180; k++) {
    const az = k * 2;
    ground += `L${((az / 360) * W).toFixed(1)} ${y(horizonAt(ctx.horizon, az)).toFixed(1)} `;
  }
  ground += `L${W} ${H} Z`;
  const s = scan.series;
  const i = clamp(idx, 0, s.times.length - 1);
  const sunClear = s.sunEl[i] - horizonAt(ctx.horizon, s.sunAz[i]);
  const earthClear = s.earthEl[i] - horizonAt(ctx.horizon, s.earthAz[i]);
  let paths = '';
  for (let k = 0; k < s.times.length; k += 2) {
    paths += `<circle cx="${x(s.sunAz[k]).toFixed(1)}" cy="${y(s.sunEl[k]).toFixed(1)}" r="1.5" class="path-sun"/>`;
    paths += `<circle cx="${x(s.earthAz[k]).toFixed(1)}" cy="${y(s.earthEl[k]).toFixed(1)}" r="1.5" class="path-earth"/>`;
  }
  return `<svg class="panorama" viewBox="0 0 ${W} ${H}">
    <rect x="0" y="0" width="${W}" height="${H}" class="space"/>
    <line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="level"/>
    ${paths}
    <path d="${ground}" fill="#475569"/>
    <circle cx="${x(s.earthAz[i]).toFixed(1)}" cy="${y(s.earthEl[i]).toFixed(1)}" r="8" class="earth-disc ${earthClear < 0 ? 'hidden' : ''}"/>
    <text x="${Math.min(W - 90, x(s.earthAz[i]) + 12).toFixed(1)}" y="${(y(s.earthEl[i]) - 8).toFixed(1)}" class="body-label">Earth (${earthClear >= 0 ? 'Visible' : 'Blocked'})</text>
    <circle cx="${x(s.sunAz[i]).toFixed(1)}" cy="${y(s.sunEl[i]).toFixed(1)}" r="10" class="sun-disc ${sunClear < 0 ? 'hidden' : ''}"/>
    <text x="${Math.min(W - 90, x(s.sunAz[i]) + 14).toFixed(1)}" y="${(y(s.sunEl[i]) - 10).toFixed(1)}" class="body-label">Sun (${sunClear >= 0 ? 'Sunlit' : 'Blocked'})</text>
  </svg>`;
}

export function renderAcademy(container, app, onJump) {
  if (!container) return;
  const ac = app.academy;
  const xpBadge = document.getElementById('headerXpBadge');
  if (xpBadge) xpBadge.textContent = `${ac.xp} XP`;

  if (ac.activeNodeId) {
    const node = ALL_ACADEMY_NODES.find((n) => n.id === ac.activeNodeId);
    if (node) return renderAcademyLesson(container, app, node, onJump);
  }

  const doneCount = ac.completed.length;
  const pctDone = Math.round((doneCount / ALL_ACADEMY_NODES.length) * 100);

  container.innerHTML = `
    <div class="space-y-6 pb-10">
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-4">
          <div class="flex-none bg-amber-50 border border-amber-200 rounded-2xl p-2">${mascotSvg('happy', 76)}</div>
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-blue-600 mono">Lunar Academy · Interactive Learning Map</span>
            <h2 class="display-font text-xl font-extrabold text-slate-900">Master Lunar Mission Planning with Lumi</h2>
            <p class="text-xs text-slate-600 max-w-xl">Follow the Duolingo-style path below! Each level teaches one core concept using real NASA LOLA terrain &amp; ephemeris data, and lets you jump straight to that control in the Explorer.</p>
          </div>
        </div>
        <div class="flex items-center gap-2.5">
          <div class="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center">
            <div class="display-font font-extrabold text-base text-amber-900">⚡ ${ac.xp} XP</div>
            <div class="text-[10px] font-semibold text-amber-700 uppercase">Total Score</div>
          </div>
          <div class="px-3.5 py-2 rounded-xl bg-orange-50 border border-orange-200 text-center">
            <div class="display-font font-extrabold text-base text-orange-900">🔥 ${ac.streak} Day</div>
            <div class="text-[10px] font-semibold text-orange-700 uppercase">Streak</div>
          </div>
          <div class="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <div class="display-font font-extrabold text-base text-emerald-900">👑 ${doneCount}/${ALL_ACADEMY_NODES.length}</div>
            <div class="text-[10px] font-semibold text-emerald-700 uppercase">Levels (${pctDone}%)</div>
          </div>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        <div class="flex-1 min-w-[200px] flex items-center gap-3">
          <span class="text-xs font-bold text-slate-700">Course Progress</span>
          <div class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div class="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all" style="width:${pctDone}%"></div>
          </div>
          <span class="mono text-xs font-bold text-slate-700">${pctDone}%</span>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <label class="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
            <input type="checkbox" id="acadUnlockAllChk" ${ac.unlockAll ? 'checked' : ''} class="rounded" />
            <span>Unlock all levels</span>
          </label>
          <button type="button" id="acadBackExplorerBtn" class="px-3 py-1 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800">Return to 3D Explorer →</button>
        </div>
      </div>

      <div class="space-y-6">
        ${ACADEMY_UNITS.map((unit) => `
          <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div class="bg-gradient-to-r ${unit.bannerCls} text-white px-5 py-3.5 flex items-center justify-between gap-2">
              <div>
                <div class="mono text-[10px] font-bold uppercase tracking-wider opacity-90">Unit ${unit.number}</div>
                <h3 class="display-font text-base font-extrabold">${esc(unit.title)}</h3>
                <p class="text-xs opacity-90">${esc(unit.subtitle)}</p>
              </div>
              <span class="mono text-xs font-bold bg-white/20 px-3 py-1 rounded-full">
                ${unit.nodes.filter((n) => ac.completed.includes(n.id)).length} / ${unit.nodes.length} Completed
              </span>
            </div>
            <div class="py-7 px-4 flex flex-col items-center gap-6 bg-gradient-to-b from-slate-50/70 to-white">
              ${unit.nodes.map((node) => {
                const done = ac.completed.includes(node.id);
                const unlocked = ac.unlockAll || node.idx === 0 || ac.completed.includes(ALL_ACADEMY_NODES[node.idx - 1].id);
                const current = !done && unlocked;
                const cls = done ? 'done' : current ? 'current' : 'locked';
                return `
                  <div class="flex items-center gap-4 w-full max-w-lg" style="transform:translateX(${node.offset}px)">
                    <button type="button" data-open-node="${node.id}" ${!unlocked ? 'disabled' : ''} class="duo-node ${cls} flex-none">
                      ${current ? '<span class="start-float-badge">START</span>' : ''}
                      <span>${done ? '✓' : unlocked ? node.icon : '🔒'}</span>
                    </button>
                    <div class="flex-1 bg-white border ${current ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} rounded-2xl p-3.5 shadow-sm">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-slate-900 text-xs sm:text-sm">Level ${node.idx + 1}: ${esc(node.title)}</span>
                        <span class="mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">+${node.xp} XP</span>
                      </div>
                      <p class="text-xs text-slate-500 mt-0.5 mb-2.5">${esc(node.subtitle)}</p>
                      <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" data-open-node="${node.id}" ${!unlocked ? 'disabled' : ''} class="px-3 py-1 rounded-lg text-xs font-semibold ${current ? 'bg-blue-600 text-white hover:bg-blue-700' : done ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-400'}">
                          ${done ? 'Replay Lesson ✓' : unlocked ? 'Start Lesson' : 'Locked'}
                        </button>
                        <button type="button" data-jump-node="${node.id}" class="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100">
                          ${esc(node.jumpLabel)} →
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelector('#acadUnlockAllChk')?.addEventListener('change', (e) => {
    ac.unlockAll = e.target.checked;
    renderAcademy(container, app, onJump);
  });
  container.querySelector('#acadBackExplorerBtn')?.addEventListener('click', () => {
    onJump({ mode: 'explorer' });
  });
  container.querySelectorAll('[data-open-node]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ac.activeNodeId = btn.dataset.openNode;
      ac.quizOpt = null;
      ac.quizAnswered = false;
      renderAcademy(container, app, onJump);
    });
  });
  container.querySelectorAll('[data-jump-node]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const node = ALL_ACADEMY_NODES.find((n) => n.id === btn.dataset.jumpNode);
      if (node) onJump({ node });
    });
  });
}

export function renderAcademyLesson(container, app, node, onJump) {
  const ac = app.academy;
  let contentHtml = '';

  if (node.type === 'basics' || node.type === 'tilt') {
    const isBasics = node.type === 'basics';
    const qPrompt = isBasics
      ? 'At the Moon’s south pole, how high does the Sun climb in the sky?'
      : 'Your lander sits at the bottom of a deep crater near the pole. What is the problem?';
    const qOpts = isBasics
      ? ['Straight overhead (90°)', 'About halfway up the sky (45°)', 'Only a few degrees above the horizon (2°–7°)']
      : ['It is too hot to operate', 'The crater walls block the low Sun and Earth', 'There is no problem at all'];
    const qAns = isBasics ? 2 : 1;
    const qExplain = isBasics
      ? 'Because the Moon’s axis is tilted only 1.54°, near the south pole the Sun skims right along the horizon and circles all 360° around the sky once every 29.5 days.'
      : 'With the Sun and Earth only a few degrees above the horizon, a crater wall or ridge a few kilometres away blocks sunlight and radio contact for days or permanently.';

    contentHtml = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
          <span class="text-xs font-bold text-amber-900">☀️ 1. Sunlight for Power</span>
          <p class="text-xs text-slate-700">Solar panels power the lander and charge its batteries. When a mountain blocks the Sun, the lander must survive on battery power at −170 °C to −200 °C.</p>
        </div>
        <div class="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
          <span class="text-xs font-bold text-blue-900">🌍 2. Earth Line-of-Sight</span>
          <p class="text-xs text-slate-700">Without a relay satellite, the lander can only radio home when Earth’s centre clears the local terrain horizon and a DSN dish on Earth sees the Moon.</p>
        </div>
        <div class="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
          <span class="text-xs font-bold text-emerald-900">🧊 3. Polar Cold Traps</span>
          <p class="text-xs text-slate-700">Deep south-polar craters never see sunlight, trapping ancient water ice—while adjacent mountain ridges stay sunlit over 85% of the month!</p>
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div class="flex items-center gap-3">
          ${mascotSvg(ac.quizAnswered ? (ac.quizOpt === qAns ? 'happy' : 'worried') : 'happy', 64)}
          <div class="bg-white border border-blue-200 rounded-xl p-3 flex-1 text-xs sm:text-sm font-semibold text-slate-800 shadow-sm">
            Quick Check: ${esc(qPrompt)}
          </div>
        </div>
        <div class="space-y-2">
          ${qOpts.map((opt, idx) => {
            const chosen = ac.quizOpt === idx;
            const cls = ac.quizAnswered
              ? (idx === qAns ? 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold' : chosen ? 'bg-red-100 border-red-400 text-red-900' : 'bg-white border-slate-200 text-slate-600')
              : 'bg-white border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 text-slate-800';
            return `<button type="button" data-quiz-opt="${idx}" class="w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition ${cls}">${esc(opt)}</button>`;
          }).join('')}
        </div>
        ${ac.quizAnswered ? `
          <div class="p-3 rounded-xl ${ac.quizOpt === qAns ? 'bg-emerald-50 border border-emerald-300 text-emerald-900' : 'bg-amber-50 border border-amber-300 text-amber-900'} text-xs">
            <strong>${ac.quizOpt === qAns ? 'Spot on! +XP unlocked:' : 'Here is the key insight:'}</strong> ${esc(qExplain)}
          </div>
        ` : ''}
      </div>
    `;
  } else if (node.type === 'skyline') {
    const ridgeSite = app.sites.find((s) => s.id === 'ridge') || app.sites[0];
    const rCtx = prepareSite(ridgeSite, app.config);
    const rScan = scanWindow(rCtx, app.windowStartMs, 30, app.config);
    const maxI = rScan.series.times.length - 1;
    const idx = clamp(ac.simIdx, 0, maxI);
    const svg = panoramaSvgForLesson(rCtx, rScan, idx);
    contentHtml = `
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          ${mascotSvg('happy', 60)}
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 flex-1 text-xs text-slate-800">
            <strong>Interactive 360° LOLA Skyline Simulator:</strong> Drag the slider below to move through a 30-day lunar month at <strong>Shackleton Connecting Ridge</strong>. Watch the Sun circle all 360° while Earth bobs in the southeast!
          </div>
        </div>
        ${svg}
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
          <div class="flex justify-between text-xs font-semibold">
            <span>Scrub Mission Day: Day ${Math.round((idx / Math.max(1, maxI)) * 30)} of 30</span>
            <span class="mono">Sun ${deg(rScan.series.sunEl[idx], 1)} · Earth ${deg(rScan.series.earthEl[idx], 1)}</span>
          </div>
          <input id="acadSkySlider" type="range" min="0" max="${maxI}" value="${idx}" class="w-full" />
        </div>
      </div>
    `;
  } else if (node.type === 'showdown') {
    const compareIds = ['ridge', 'shackleton', 'ce4', 'a11'];
    const chosenSite = app.sites.find((s) => s.id === ac.simSiteId) || app.sites[0];
    const sCtx = prepareSite(chosenSite, app.config);
    const sScan = scanWindow(sCtx, app.windowStartMs, 30, app.config);
    const st = sScan.stats;
    contentHtml = `
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          ${mascotSvg(st.litFraction > 0.5 && st.earthVisibleFraction > 0.3 ? 'happy' : 'ok', 60)}
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 flex-1 text-xs text-slate-800">
            <strong>Live Site Showdown:</strong> Click each famous lunar site below to run the LOLA terrain engine and see why site selection makes or breaks a mission!
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${compareIds.map((cid) => {
            const cs = app.sites.find((x) => x.id === cid);
            if (!cs) return '';
            const active = ac.simSiteId === cid;
            return `
              <button type="button" data-sim-site="${cid}" class="p-2.5 rounded-xl border text-left transition ${active ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-100' : 'bg-white border-slate-200 hover:bg-slate-50'}">
                <div class="font-bold text-xs text-slate-900">${esc(cs.short || cs.name)}</div>
                <div class="mono text-[10px] text-slate-500">${cs.lat.toFixed(1)}°, ${cs.lon.toFixed(1)}°</div>
              </button>
            `;
          }).join('')}
        </div>
        <div class="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <div>
            <span class="text-[11px] text-slate-500 block">Time Sunlit (30d)</span>
            <strong class="mono text-lg text-slate-900">${pct(st.litFraction, 1)}</strong>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Earth Visible (30d)</span>
            <strong class="mono text-lg text-slate-900">${pct(st.earthVisibleFraction, 1)}</strong>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Longest Darkness</span>
            <strong class="mono text-lg text-slate-900">${fmtHours(st.longestDarkH)}</strong>
          </div>
        </div>
      </div>
    `;
  } else {
    contentHtml = `
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          ${mascotSvg('happy', 64)}
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-1 text-xs text-slate-800">
            <strong>Mission Operations &amp; Launch Slip Strategy:</strong> Use the 5-row Operations Timeline to scrub any window from 15 days to 1 year, and use the <strong>Compare Lab</strong> to test 1–3 month launch slips or scan within 5 km for better-lit peaks!
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <strong class="text-slate-900">🚀 Schedule Slip ×3</strong>
            <p class="text-slate-600">Automatically tests your landing site delayed by 1, 2, and 3 synodic months (29.5 days each) to verify if libration or seasonal shadows break the mission.</p>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <strong class="text-slate-900">🔍 5 km Nearby Terrain Search</strong>
            <p class="text-slate-600">Samples concentric rings up to 5 km around your target on the LOLA DEM and ranks the top 3 nearby coordinates for solar power and Earth visibility.</p>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div class="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-3">
        <button type="button" id="lessonBackBtn" class="px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50">← Back to Skill Map</button>
        <span class="mono text-xs font-bold text-blue-600">Level ${node.idx + 1} of ${ALL_ACADEMY_NODES.length} · +${node.xp} XP</span>
        <button type="button" id="lessonJumpBtn" class="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100">${esc(node.jumpLabel)} →</button>
      </div>
      <div>
        <h2 class="display-font text-lg font-extrabold text-slate-900">${node.icon} ${esc(node.title)}</h2>
        <p class="text-xs text-slate-500">${esc(node.subtitle)}</p>
      </div>
      ${contentHtml}
      <div class="flex items-center justify-between pt-3 border-t border-slate-100">
        <button type="button" id="lessonPrevNodeBtn" ${node.idx === 0 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 disabled:opacity-40">← Previous</button>
        <button type="button" id="lessonCompleteBtn" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm">
          ${ac.completed.includes(node.id) ? 'Completed ✓ · Next Level →' : `Complete Level & Claim +${node.xp} XP →`}
        </button>
      </div>
    </div>
  `;

  container.querySelector('#lessonBackBtn')?.addEventListener('click', () => {
    ac.activeNodeId = null;
    renderAcademy(container, app, onJump);
  });
  container.querySelector('#lessonJumpBtn')?.addEventListener('click', () => {
    if (!ac.completed.includes(node.id)) {
      ac.completed.push(node.id);
      ac.xp += node.xp;
    }
    ac.activeNodeId = null;
    onJump({ node });
  });
  container.querySelectorAll('[data-quiz-opt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ac.quizOpt = Number(btn.dataset.quizOpt);
      ac.quizAnswered = true;
      renderAcademyLesson(container, app, node, onJump);
    });
  });
  container.querySelector('#acadSkySlider')?.addEventListener('input', (e) => {
    ac.simIdx = Number(e.target.value);
    renderAcademyLesson(container, app, node, onJump);
  });
  container.querySelectorAll('[data-sim-site]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ac.simSiteId = btn.dataset.simSite;
      renderAcademyLesson(container, app, node, onJump);
    });
  });
  container.querySelector('#lessonPrevNodeBtn')?.addEventListener('click', () => {
    if (node.idx > 0) {
      ac.activeNodeId = ALL_ACADEMY_NODES[node.idx - 1].id;
      ac.quizOpt = null;
      ac.quizAnswered = false;
      renderAcademy(container, app, onJump);
    }
  });
  container.querySelector('#lessonCompleteBtn')?.addEventListener('click', () => {
    if (!ac.completed.includes(node.id)) {
      ac.completed.push(node.id);
      ac.xp += node.xp;
      try {
        localStorage.setItem('lsp.academyProgress', JSON.stringify({ completed: ac.completed, xp: ac.xp }));
      } catch {}
    }
    if (node.idx + 1 < ALL_ACADEMY_NODES.length) {
      ac.activeNodeId = ALL_ACADEMY_NODES[node.idx + 1].id;
      ac.quizOpt = null;
      ac.quizAnswered = false;
    } else {
      ac.activeNodeId = null;
    }
    renderAcademy(container, app, onJump);
  });
}
