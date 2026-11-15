// Formatting and escaping helper functions.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const pct = (f, d = 0) => `${(f * 100).toFixed(d)}%`;
export const deg = (v, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}°`;
export const fmtLatLon = (lat, lon, d = 2) => `${Math.abs(lat).toFixed(d)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(d)}°${lon < 0 ? 'W' : 'E'}`;
export const fmtUtc = (ms) => { const iso = new Date(ms).toISOString(); return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`; };
export const fmtHours = (h) => (h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h.toFixed(0)} h`);
export const fmtDuration = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return 'Over 30 days';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} d ${h} h` : `${h} h`;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);

export function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function fromLocalInputValue(v) {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}
