// Multi-track operations timeline canvas (Sun, Power, Earth, DSN, DTE link).
import { fitCanvas } from './polarMap.js';

export function drawTimeline(canvas, scan, timeMs, config) {
  const { ctx, w, h } = fitCanvas(canvas);
  if (!ctx || w < 80 || h < 40 || !scan) return;
  ctx.clearRect(0, 0, w, h);
  const dark = document.documentElement.dataset.theme === 'dark';
  const C = dark ? { row: '#1b2130', text: '#c7c9d1', tick: '#8e93a0', cursor: '#ffffff' } : { row: '#f1f5f9', text: '#334155', tick: '#64748b', cursor: '#0f172a' };
  const pad = { l: 58, r: 10, t: 4, b: 18 };
  const pw = w - pad.l - pad.r;
  const rows = ['Sun', 'Power', 'Earth', 'DSN', 'DTE link'];
  const rowH = (h - pad.t - pad.b) / rows.length;
  const s = scan.series;
  const n = s.times.length;
  const colW = Math.max(1.2, pw / n + 0.5);
  const x = (ms) => pad.l + ((ms - scan.startMs) / (scan.endMs - scan.startMs)) * pw;

  ctx.font = '500 11px "Inter", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  rows.forEach((lbl, r) => {
    const y0 = pad.t + r * rowH;
    ctx.fillStyle = C.row;
    ctx.fillRect(pad.l, y0 + 2, pw, rowH - 4);
    ctx.fillStyle = C.text;
    ctx.textAlign = 'right';
    ctx.fillText(lbl, pad.l - 8, y0 + rowH / 2);
  });

  let maxW = (config?.power?.loadW || 120) * 1.3;
  for (let i = 0; i < n; i++) maxW = Math.max(maxW, s.watts[i]);

  for (let i = 0; i < n; i++) {
    const xx = x(s.times[i]);
    if (s.sunFrac[i] > 0) {
      ctx.fillStyle = `rgba(217, 119, 6, ${0.35 + 0.65 * s.sunFrac[i]})`;
      ctx.fillRect(xx, pad.t + 2, colW, rowH - 4);
    }
    const y1 = pad.t + rowH;
    const bh = ((rowH - 4) * s.watts[i]) / maxW;
    if (bh > 0) {
      ctx.fillStyle = s.watts[i] >= (config?.power?.loadW || 120) ? '#15803d' : '#d97706';
      ctx.fillRect(xx, y1 + rowH - 2 - bh, colW, bh);
    }
    if (s.visible[i]) {
      ctx.fillStyle = s.los[i] && s.earthClear[i] >= (config?.comms?.minClearanceDeg || 2) ? '#2563eb' : 'rgba(37, 99, 235, 0.35)';
      ctx.fillRect(xx, pad.t + 2 * rowH + 2, colW, rowH - 4);
    }
    if (s.dsnAny[i]) {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.fillRect(xx, pad.t + 3 * rowH + 2, colW, rowH - 4);
    }
    if (s.dte[i]) {
      ctx.fillStyle = '#15803d';
      ctx.fillRect(xx, pad.t + 4 * rowH + 2, colW, rowH - 4);
    }
  }

  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillStyle = C.tick; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const stepTicks = 6;
  for (let k = 0; k <= stepTicks; k++) {
    const ms = scan.startMs + (k / stepTicks) * (scan.endMs - scan.startMs);
    const xx = x(ms);
    ctx.fillText(new Date(ms).toISOString().slice(5, 10), xx, h - pad.b + 3);
  }

  if (timeMs >= scan.startMs && timeMs <= scan.endMs) {
    const cx = x(timeMs);
    ctx.strokeStyle = C.cursor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, h - pad.b); ctx.stroke();
  }
}
