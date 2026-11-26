// GOLDEN HOUR FLIGHT — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
// Palet khas TSULACE: toasted brown, cream, dusty teal, soft terracotta.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Flight corridor: metres. x is lateral, y is altitude above the valley floor. */
export const CORRIDOR = { halfWidth: 140, cliffX: 150, minAlt: 6, maxAlt: 220 };

export const PLANE = {
  /** m/s, base cruise per level is in LEVELS. */
  climbRate: 34,
  descendRate: 40,
  lateralSpeed: 95,
  boostMult: 1.6,
  brakeMult: 0.55,
  /** Degrees of bank shown per unit of lateral input. */
  bankMax: 0.55,
  /** Radius (m) used when checking a ring pass. */
  // Flying through the visible ring counts: the catch is a touch wider than
  // the drawn ring, so a pass that looks like a pass is a pass.
  ringCatch: 1.05,
  starCatch: 9,
};

/** Fuel: 100 at start of a level, refilled between levels. */
export const FUEL = {
  start: 100,
  drainBase: 0.9,
  drainBoost: 2.2,
  drainBrake: 0.5,
  orbGain: 20,
  lowWarn: 25,
};

export const RING = { points: 100, starPoints: 25, radiusMin: 20, radiusMax: 28 };

/** One level: name, palette key, rings to pass, base speed, wind. */
export const LEVELS = [
  { name: 'SENJA', rings: 8, speed: 55, wind: 4, ringGapMin: 340, ringGapMax: 480 },
  { name: 'JINGGA', rings: 10, speed: 68, wind: 8, ringGapMin: 320, ringGapMax: 450 },
  { name: 'MALAM', rings: 12, speed: 80, wind: 12, ringGapMin: 300, ringGapMax: 430 },
];

/**
 * Golden-hour palettes per level. sky is [top, mid, horizon]; sun is the disc
 * colour; terrain lists the terrace band colours (cycled); haze is the
 * distance fog colour; ring is the target-ring colour.
 */
export const PALETTES = {
  SENJA: {
    sky: ['#ffd9a0', '#f2a35e', '#c96a52'],
    sun: '#fff3c4',
    sunGlow: 'rgba(255, 190, 90, 0.55)',
    volcano: '#7c4a4a',
    volcanoSnow: '#f7e8c9',
    terrain: ['#7d9b5e', '#a8a05c', '#8a6b45', '#6f8f5a', '#c9a24b'],
    hill: '#5d7a4a',
    haze: 'rgba(242, 163, 94, 0.35)',
    ring: '#ffcf5c',
    ringGlow: 'rgba(255, 207, 92, 0.8)',
    star: '#fff6c9',
    fuel: '#7ee787',
    ground: '#6b4a2f',
    cloud: 'rgba(255, 236, 200, 0.75)',
  },
  JINGGA: {
    sky: ['#ffb347', '#e86a33', '#8e3b46'],
    sun: '#ffe9a8',
    sunGlow: 'rgba(255, 140, 60, 0.6)',
    volcano: '#5e2f36',
    volcanoSnow: '#f2c98a',
    terrain: ['#8a7a3e', '#b3763a', '#7a5a30', '#96703a', '#d98a3d'],
    hill: '#4f5a33',
    haze: 'rgba(232, 106, 51, 0.4)',
    ring: '#ffd23e',
    ringGlow: 'rgba(255, 210, 62, 0.85)',
    star: '#ffe9a8',
    fuel: '#7ee787',
    ground: '#54331f',
    cloud: 'rgba(255, 200, 140, 0.7)',
  },
  MALAM: {
    sky: ['#141d33', '#2c3e63', '#4a2c4f'],
    sun: '#f4ead2',
    sunGlow: 'rgba(220, 210, 190, 0.35)',
    volcano: '#1c1426',
    volcanoSnow: '#8a7a9e',
    terrain: ['#2e4a44', '#3d5a4a', '#24383a', '#46543f', '#5a6b52'],
    hill: '#1f2f2b',
    haze: 'rgba(44, 62, 99, 0.45)',
    ring: '#ffb347',
    ringGlow: 'rgba(255, 179, 71, 0.9)',
    star: '#ffe9a8',
    fuel: '#7ee787',
    ground: '#241a20',
    cloud: 'rgba(140, 150, 190, 0.35)',
  },
};

export const BEST_KEY = 'golden-hour-flight-best';
export const MUTE_KEY = 'golden-hour-flight-muted';
