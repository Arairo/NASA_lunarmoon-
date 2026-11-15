// Physical constants, units, and shared lookup definitions.

export const MOON_RADIUS_M = 1737400; // IAU 2015 mean radius = LOLA reference sphere
export const EARTH_RADIUS_M = 6371000;
export const AU_M = 149597870700;
export const C_M_S = 299792458;
export const SOLAR_CONSTANT = 1361; // W/m^2 (TSI at 1 AU)
export const SUN_RADIUS_M = 695700e3;
export const SYNODIC_MONTH_DAYS = 29.530588;
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const wrap360 = (d) => ((d % 360) + 360) % 360;
export const wrap180 = (d) => wrap360(d + 180) - 180;

export const SITE_GROUPS = {
  computed: 'Best-Lit LOLA Peaks',
  south: 'South Pole Features & Targets',
  clps: 'CLPS & Commercial Landers',
  apollo: 'Apollo Surveyed Sites',
  intl: 'International Missions',
};

export const SITE_BADGES = {
  ridge: { text: '86% Sun / yr', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  'peak-shackleton': { text: 'High Massif', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  'best-0': { text: '#1 LOLA 2027', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  'best-1': { text: '#2 LOLA 2027', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  'best-2': { text: '#3 LOLA 2027', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  shackleton: { text: '0% Sun · Cold Trap', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  shoemaker: { text: 'Cold Trap', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  faustini: { text: 'Cold Trap', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  ce4: { text: 'Far Side · No Earth', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
  ce6: { text: 'Far Side · No Earth', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
  a11: { text: 'Apollo 1969', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  im1: { text: 'Landed 2024', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ch3: { text: 'ISRO 2023', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export const GLOSSARY = {
  horizon: {
    title: 'Terrain Horizon (LOLA)',
    text: 'The 360° skyline seen from the lander: in each compass direction, the steepest elevation angle where lunar mountains or crater rims block the sky. Computed from NASA Lunar Orbiter Laser Altimeter (LOLA) grids including lunar curvature.',
  },
  disk: {
    title: 'Visible Solar Disk Fraction',
    text: 'The Sun is a disk about 0.53° wide. Near the lunar south pole it skims the horizon, so ridges often hide part of the disk. Solar power scales with the unblocked fraction.',
  },
  dte: {
    title: 'Direct-to-Earth (DTE) Radio Link',
    text: 'Radio communication straight from the lander to Earth without a relay satellite. Requires Earth’s centre above the local terrain horizon, a Deep Space Network station with the Moon in view, and positive link margin.',
  },
  dsn: {
    title: 'NASA Deep Space Network (DSN)',
    text: 'Three antenna complexes spaced ~120° apart around Earth at Goldstone (California), Madrid (Spain), and Canberra (Australia) so at least one station can almost always see the Moon.',
  },
  lola: {
    title: 'NASA LRO LOLA Altimetry',
    text: 'Laser altimeter elevation grids from NASA’s Lunar Reconnaissance Orbiter (240 m resolution within 180 km of the south pole and 1 km resolution out to 75°S).',
  },
  margin: {
    title: 'Link Margin (dB)',
    text: 'How much stronger the received radio signal is than the minimum needed for the selected data rate. Above 3 dB is comfortable; below 0 dB the link drops.',
  },
};
