// Compact South-Polar DEM height sampling.
import compactDemData from '../data/compactDem.js';
import { clamp, MOON_RADIUS_M } from './constants.js';
import { toSouthPolar } from './geo.js';

export const compactDem = compactDemData;

/** Bilinearly interpolate height (m) from the south-polar DEM grid, or null outside bounds. */
export function sampleDemHeight(lat, lon, dem = compactDem) {
  if (lat > -73.5) return null;
  const { x, y } = toSouthPolar(lat, lon);
  if (Math.abs(x) >= dem.halfExtent - dem.cellSize || Math.abs(y) >= dem.halfExtent - dem.cellSize) return null;
  const fc = clamp((x + dem.halfExtent) / dem.cellSize - 0.5, 0, dem.size - 2);
  const fr = clamp((dem.halfExtent - y) / dem.cellSize - 0.5, 0, dem.size - 2);
  const c0 = Math.floor(fc), r0 = Math.floor(fr);
  const tc = fc - c0, tr = fr - r0;
  const i = r0 * dem.size + c0;
  const h00 = dem.data[i], h01 = dem.data[i + 1], h10 = dem.data[i + dem.size], h11 = dem.data[i + dem.size + 1];
  return (h00 * (1 - tc) + h01 * tc) * (1 - tr) + (h10 * (1 - tc) + h11 * tc) * tr;
}
