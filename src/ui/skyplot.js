// 360° Sky azimuth-elevation plot with terrain skyline and Sun/Earth tracks.
import { clamp } from '../core/constants.js';
import { fitCanvas } from './polarMap.js';

export function drawSkyPlot(canvas, horizon, scan, now) {
  const { ctx, w, h } = fitCanvas(canvas);
  if (!ctx || w < 48 || h < 48 || !horizon) return;
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 32, r: 8, t: 8, b: 18 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;

  const elList = horizon.el180 || horizon.elevations;
  let maxHz = -90, minHz = 90;
  for (let i = 0; i < elList.length; i++) {
    const v = elList[i];
    maxHz = Math.max(maxHz, v);
    minHz = Math.min(minHz, v);
  }
  let top = Math.max(maxHz + 2.5, 5), bottom = Math.min(minHz - 1.5, -2.5);
  if (scan) {
    for (let i = 0; i < scan.series.times.length; i++) {
      top = Math.max(top, scan.series.sunEl[i] + 2, scan.series.earthEl[i] + 2);
    }
  }
  top = Math.min(top, 90);
  const y = (el) => pad.t + ((top - el) / (top - bottom)) * ph;
  const x = (az) => pad.l + (((((az + 180) % 360) + 360) % 360) / 360) * pw;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(pad.l, pad.t, pw, ph);

  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#64748b';
  const span = top - bottom;
  const stepEl = span > 50 ? 15 : span > 20 ? 5 : 2;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let e = Math.ceil(bottom / stepEl) * stepEl; e <= top; e += stepEl) {
    ctx.beginPath(); ctx.moveTo(pad.l, y(e)); ctx.lineTo(pad.l + pw, y(e));
    ctx.strokeStyle = e === 0 ? '#94a3b8' : '#e2e8f0'; ctx.stroke();
    ctx.fillText(`${e}°`, pad.l - 4, y(e));
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const [az, name] of [[180,'S'],[225,'SW'],[270,'W'],[315,'NW'],[0,'N'],[45,'NE'],[90,'E'],[135,'SE']]) {
    const xx = x(az);
    ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ph);
    ctx.strokeStyle = '#f1f5f9'; ctx.stroke();
    ctx.fillText(name, xx, pad.t + ph + 3);
  }

  if (scan) {
    const s = scan.series;
    ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
    for (let i = 0; i < s.times.length; i++) {
      const yy = y(s.sunEl[i]);
      if (yy >= pad.t && yy <= pad.t + ph) ctx.fillRect(x(s.sunAz[i]) - 1, yy - 1, 2, 2);
    }
    ctx.fillStyle = 'rgba(37, 99, 235, 0.45)';
    for (let i = 0; i < s.times.length; i++) {
      const yy = y(s.earthEl[i]);
      if (yy >= pad.t && yy <= pad.t + ph) ctx.fillRect(x(s.earthAz[i]) - 1, yy - 1, 2, 2);
    }
  }

  if (now) {
    const drawBody = (az, el, color, label) => {
      const bx = x(az), by = clamp(y(el), pad.t + 4, pad.t + ph - 4);
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '600 11px "Inter", sans-serif';
      ctx.fillStyle = '#0f172a'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(label, Math.min(pad.l + pw - 32, bx + 6), by - 3);
    };
    drawBody(now.sun.az, now.sun.el, '#d97706', 'Sun');
    drawBody(now.earth.az, now.earth.el, '#2563eb', 'Earth');
  }

  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + ph);
  const count = horizon.el180 ? 180 : 360;
  for (let k = 0; k <= count; k++) {
    const az = (180 + k * (360 / count)) % 360;
    const idx = Math.floor(az / (360 / count)) % count;
    const elVal = horizon.el180 ? horizon.el180[idx] : horizon.elevations[idx * 2];
    ctx.lineTo(pad.l + (k / count) * pw, Math.min(pad.t + ph, y(elVal)));
  }
  ctx.lineTo(pad.l + pw, pad.t + ph);
  ctx.closePath();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.48)';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(pad.l + 0.5, pad.t + 0.5, pw - 1, ph - 1);
}
