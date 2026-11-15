// South-Pole LOLA Canvas map renderer with WAC imagery and illumination overlays.
import compactIllumData from '../data/compactIllum.js';
import { clamp } from '../core/constants.js';
import { fromSouthPolar, toSouthPolar } from '../core/geo.js';

export const compactIllum = compactIllumData;

export function ramp(t) {
  const stops = [
    [0, [0, 34, 78]],
    [0.25, [53, 69, 108]],
    [0.5, [124, 123, 120]],
    [0.75, [188, 175, 111]],
    [1, [254, 232, 56]],
  ];
  const tc = clamp(t, 0, 1);
  for (let i = 1; i < stops.length; i++) {
    if (tc <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      const f = (tc - t0) / (t1 - t0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
    }
  }
  return stops[4][1];
}

export function fitCanvas(canvas) {
  if (!canvas) return { ctx: null, w: 0, h: 0 };
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.max(0, canvas.clientWidth || 0);
  const ch = Math.max(0, canvas.clientHeight || 0);
  if (cw < 24 || ch < 24) return { ctx: canvas.getContext('2d'), w: 0, h: 0 };
  const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cw, h: ch };
}

export function createPolarMapRenderer(canvas, onPickSite, getAppState, options = {}) {
  const imageUrl = options.imageUrl || `${import.meta.env.BASE_URL}data/spPolar.jpg`;
  const img = new Image();
  img.src = imageUrl;
  img.onload = () => draw();

  let view = { cx: 0, cy: 0, half: 115000 };
  let dragging = null;
  const overlayCache = {};

  function buildOverlay(kind) {
    const il = compactIllum;
    const n = il.size;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    const id = g.createImageData(n, n);
    const arr = il[kind];
    if (!arr) return c;
    for (let i = 0; i < n * n; i++) {
      const [r, gg, b] = ramp(arr[i] / il.scale);
      id.data[i * 4] = r; id.data[i * 4 + 1] = gg; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 205;
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  function toScreen(x, y, w, h) {
    const s = Math.max(1e-9, Math.min(w, h) / (2 * view.half));
    return [w / 2 + (x - view.cx) * s, h / 2 - (y - view.cy) * s, s];
  }

  function toWorld(px, py, w, h) {
    const s = Math.max(1e-9, Math.min(w, h) / (2 * view.half));
    return [view.cx + (px - w / 2) / s, view.cy - (py - h / 2) / s];
  }

  function draw() {
    if (!canvas || canvas.offsetParent === null) return;
    const { ctx, w, h } = fitCanvas(canvas);
    if (!ctx || w < 32 || h < 32) return;
    const app = getAppState();

    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);

    const IMAGE_HALF = 460000;
    const [ix, iy, s] = toScreen(-IMAGE_HALF, IMAGE_HALF, w, h);
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, ix, iy, 2 * IMAGE_HALF * s, 2 * IMAGE_HALF * s);
    }
    if (app.polarOverlay && app.polarOverlay !== 'none') {
      overlayCache[app.polarOverlay] = overlayCache[app.polarOverlay] || buildOverlay(app.polarOverlay);
      const il = compactIllum;
      const [ox, oy] = toScreen(-il.halfExtent, il.halfExtent, w, h);
      ctx.drawImage(overlayCache[app.polarOverlay], ox, oy, 2 * il.halfExtent * s, 2 * il.halfExtent * s);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px "IBM Plex Mono", monospace';
    const [cx, cy] = toScreen(0, 0, w, h);
    for (const lat of [-89, -88, -87, -86, -85, -84, -82, -80]) {
      const r = Math.hypot(toSouthPolar(lat, 0).x, toSouthPolar(lat, 0).y) * s;
      if (r < 18 || r > 3 * Math.max(w, h)) continue;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText(`${-lat}°S`, cx + 4, cy - r - 3);
    }

    ctx.font = '600 11px "Inter", sans-serif';
    const placed = [];
    const sites = app.sites || [];
    for (const site of sites) {
      if (site.lat > -74) continue;
      const p = toSouthPolar(site.lat, site.lon);
      const [sx, sy] = toScreen(p.x, p.y, w, h);
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
      const isSel = app.site && app.site.id === site.id;
      ctx.fillStyle = isSel ? '#fbbf24' : '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, isSel ? 6.5 : 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      const label = site.short || site.name;
      const bw = ctx.measureText(label).width;
      const box = { x: sx + 8, y: sy - 8, w: bw, h: 14 };
      const clash = placed.some((b) => box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h);
      if (clash && !isSel) continue;
      placed.push(box);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(label, sx + 8, sy + 4);
      ctx.fillStyle = isSel ? '#fde68a' : '#ffffff';
      ctx.fillText(label, sx + 8, sy + 4);
    }
  }

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.half = clamp(view.half * Math.exp(e.deltaY * 0.0015), 5000, 450000);
    draw();
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const s = Math.max(1e-9, Math.min(rect.width, rect.height) / (2 * view.half));
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragging.moved = true;
    view.cx = dragging.cx - dx / s;
    view.cy = dragging.cy + dy / s;
    draw();
  });

  canvas.addEventListener('pointerup', (e) => {
    const d = dragging;
    dragging = null;
    if (!d || d.moved) return;
    const rect = canvas.getBoundingClientRect();
    const [wx, wy] = toWorld(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
    const s = Math.max(1e-9, Math.min(rect.width, rect.height) / (2 * view.half));
    const app = getAppState();
    const sites = app.sites || [];
    for (const site of sites) {
      if (site.lat > -74) continue;
      const p = toSouthPolar(site.lat, site.lon);
      if (Math.hypot((p.x - wx) * s, (p.y - wy) * s) < 10) return onPickSite({ site });
    }
    const { lat, lon } = fromSouthPolar(wx, wy);
    if (lat < -74) onPickSite({ lat, lon });
  });

  return {
    draw,
    zoomBy(f) { view.half = clamp(view.half * f, 5000, 450000); draw(); },
    reset() { view = { cx: 0, cy: 0, half: 115000 }; draw(); },
  };
}
