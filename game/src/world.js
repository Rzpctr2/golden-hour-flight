// The flight simulation: a prop plane chases rings through a terraced valley.
// World axes: z forward (metres flown), x lateral, y altitude above the valley
// floor. Everything deterministic from the seed: terrain, rings, stars, wind.
import { CORRIDOR, FUEL, LEVELS, PLANE, RING, STEP } from './config.js';
import { range } from './random.js';

export const EVENT_RING = 1;
export const EVENT_STAR = 2;
export const EVENT_FUEL = 4;
export const EVENT_CRASH = 8;
export const EVENT_LEVEL_CLEAR = 16;
export const EVENT_WIN = 32;
export const EVENT_MISS = 64;
export const EVENT_LOW_FUEL = 128;

export function createWorld(rand) {
  // Fixed terrain phases per seed: hills the plane must stay above.
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const p3 = rand() * Math.PI * 2;
  const windPhase = rand() * Math.PI * 2;

  const state = {
    status: 'flying', // flying | crashed | levelClear | won
    levelIndex: 0,
    time: 0,
    distance: 0,
    score: 0,
    plane: { x: 0, y: 80, z: 0, speed: 0, heading: 0, bank: 0, pitch: 0 },
    fuel: FUEL.start,
    rings: [],
    ringIndex: 0,
    ringsPassed: 0,
    ringsMissed: 0,
    stars: [],
    particles: [],
    messages: [],
    wind: 0,
    boosting: false,
    lowFuelWarned: false,
    crashCause: '',
    levelClearAt: 0,
  };

  function terrainHeight(z) {
    const h = 16 * Math.sin(z * 0.004 + p1) + 10 * Math.sin(z * 0.011 + p2) + 6 * Math.sin(z * 0.023 + p3);
    return Math.max(0, h);
  }

  function buildLevel(levelIndex) {
    const level = LEVELS[levelIndex];
    const rings = [];
    const stars = [];
    let z = 420;
    for (let i = 0; i < level.rings; i += 1) {
      z += range(rand, level.ringGapMin, level.ringGapMax);
      const radius = range(rand, RING.radiusMin, RING.radiusMax);
      const floor = terrainHeight(z);
      const y = Math.min(185, Math.max(floor + 32, range(rand, 45, 175)));
      rings.push({
        x: range(rand, -105, 105),
        y,
        z,
        radius,
        passed: false,
        missed: false,
        burst: 0,
      });
      // 2-4 stars scattered in the gap before this ring, one fuel orb sometimes.
      const count = 2 + Math.floor(rand() * 3);
      for (let s = 0; s < count; s += 1) {
        const sz = z - range(rand, 60, level.ringGapMin - 40);
        const isFuel = s === 0 && i % 3 === 2;
        stars.push({
          x: range(rand, -120, 120),
          y: Math.min(195, Math.max(terrainHeight(sz) + 25, range(rand, 40, 185))),
          z: sz,
          taken: false,
          fuel: isFuel,
          phase: rand() * Math.PI * 2,
        });
      }
    }
    state.levelIndex = levelIndex;
    state.rings = rings;
    state.stars = stars;
    state.ringIndex = 0;
    state.ringsPassed = 0;
    state.ringsMissed = 0;
    state.fuel = FUEL.start;
    state.lowFuelWarned = false;
    state.plane.x = 0;
    state.plane.y = 80;
    state.plane.z = 0;
    state.plane.speed = level.speed * 0.6;
    state.plane.heading = 0;
    state.plane.bank = 0;
    state.plane.pitch = 0;
    state.status = 'flying';
    state.particles = [];
    state.messages = [];
    state.time = 0;
  }

  function addMessage(text, dur = 1.4) {
    state.messages.push({ text, t: 0, dur });
    if (state.messages.length > 3) state.messages.shift();
  }

  function burst(x, y, z, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = rand() * Math.PI * 2;
      const b = rand() * Math.PI - Math.PI / 2;
      state.particles.push({
        x, y, z,
        vx: Math.cos(a) * Math.cos(b) * speed,
        vy: Math.sin(b) * speed,
        vz: Math.sin(a) * Math.cos(b) * speed,
        life: 0,
        maxLife: range(rand, 0.5, 0.9),
        color,
        size: range(rand, 2, 5),
      });
    }
  }

  function crash(cause) {
    if (state.status !== 'flying') return EVENT_CRASH;
    state.status = 'crashed';
    state.crashCause = cause;
    const { x, y, z } = state.plane;
    burst(x, y, z, '#ff9a3d', 26, 60);
    burst(x, y, z, '#f7e8c9', 14, 40);
    burst(x, y, z, '#8a5a3b', 10, 30);
    return EVENT_CRASH;
  }

  function step(dt, axes, audio) {
    if (state.status !== 'flying') {
      // Particles keep animating on the end screens.
      for (const pt of state.particles) {
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
      }
      state.particles = state.particles.filter((pt) => pt.life < pt.maxLife);
      return 0;
    }
    const level = LEVELS[state.levelIndex];
    const plane = state.plane;
    let events = 0;
    state.time += dt;
    state.boosting = axes.boost;

    // Wind: slow gusts that push the plane sideways.
    const gust = Math.sin(state.time * 0.35 + windPhase) * 0.5 + Math.sin(state.time * 0.13 + windPhase * 2) * 0.5;
    state.wind = level.wind * (0.7 + 0.6 * gust);

    // Speed eases toward its target (boost / brake / cruise).
    const targetSpeed = level.speed * (axes.boost ? PLANE.boostMult : axes.brake ? PLANE.brakeMult : 1);
    plane.speed += (targetSpeed - plane.speed) * Math.min(1, dt * 1.6);
    const prevZ = plane.z;
    plane.z += plane.speed * dt;

    // Lateral + vertical flight.
    plane.x += axes.x * PLANE.lateralSpeed * dt + state.wind * dt * 0.9;
    plane.y += axes.y * (axes.y > 0 ? PLANE.climbRate : PLANE.descendRate) * dt;
    if (state.fuel <= 0) plane.y -= 12 * dt; // engine out: sink
    plane.y = Math.max(CORRIDOR.minAlt, Math.min(CORRIDOR.maxAlt, plane.y));

    // Bank and pitch ease toward the input; heading follows the lateral drift.
    plane.bank += (axes.x * PLANE.bankMax - plane.bank) * Math.min(1, dt * 6);
    plane.pitch += (axes.y * 0.22 - plane.pitch) * Math.min(1, dt * 5);
    const lateralVel = axes.x * PLANE.lateralSpeed + state.wind * 0.9;
    const targetHeading = Math.max(-45, Math.min(45, lateralVel * 0.32));
    plane.heading += (targetHeading - plane.heading) * Math.min(1, dt * 3);

    // Fuel.
    const drain = axes.boost ? FUEL.drainBoost : axes.brake ? FUEL.drainBrake : FUEL.drainBase;
    state.fuel = Math.max(0, state.fuel - drain * dt);
    if (state.fuel <= FUEL.lowWarn && !state.lowFuelWarned) {
      state.lowFuelWarned = true;
      events |= EVENT_LOW_FUEL;
      addMessage('LOW FUEL!', 2);
    }

    // Score trickles in with distance.
    state.distance += plane.speed * dt;
    state.score += plane.speed * dt * 0.1;

    // Rings: the current one is judged when the plane crosses its z.
    const ring = state.rings[state.ringIndex];
    if (ring && prevZ < ring.z && plane.z >= ring.z) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ring.radius * PLANE.ringCatch) {
        ring.passed = true;
        ring.burst = 1;
        state.ringIndex += 1;
        state.ringsPassed += 1;
        state.score += RING.points;
        events |= EVENT_RING;
        burst(ring.x, ring.y, ring.z, '#ffcf5c', 18, 46);
        addMessage(`RING +${RING.points}`);
        if (audio) audio.ring();
        if (state.ringIndex >= state.rings.length) {
          if (state.levelIndex >= LEVELS.length - 1) {
            state.status = 'won';
            events |= EVENT_WIN;
            if (audio) audio.levelClear();
          } else {
            state.status = 'levelClear';
            state.levelClearAt = state.time;
            events |= EVENT_LEVEL_CLEAR;
            if (audio) audio.levelClear();
          }
        }
      } else {
        ring.missed = true;
        state.ringIndex += 1;
        state.ringsMissed += 1;
        // A missed ring costs fuel: drifting through the valley without
        // aiming is how you end up walking home.
        state.fuel = Math.max(0, state.fuel - 10);
        events |= EVENT_MISS;
        addMessage('RING MISSED −10 FUEL');
        if (state.ringIndex >= state.rings.length) {
          if (state.levelIndex >= LEVELS.length - 1) {
            state.status = 'won';
            events |= EVENT_WIN;
          } else {
            state.status = 'levelClear';
            state.levelClearAt = state.time;
            events |= EVENT_LEVEL_CLEAR;
          }
        }
      }
    }

    // Stars and fuel orbs.
    for (const star of state.stars) {
      if (star.taken) continue;
      if (prevZ < star.z && plane.z >= star.z) {
        const dx = plane.x - star.x;
        const dy = plane.y - star.y;
        if (Math.sqrt(dx * dx + dy * dy) < PLANE.starCatch) {
          star.taken = true;
          if (star.fuel) {
            state.fuel = Math.min(100, state.fuel + FUEL.orbGain);
            events |= EVENT_FUEL;
            addMessage(`FUEL +${FUEL.orbGain}`);
            if (audio) audio.fuel();
          } else {
            state.score += RING.starPoints;
            events |= EVENT_STAR;
            if (audio) audio.star();
          }
          burst(star.x, star.y, star.z, star.fuel ? '#7ee787' : '#fff6c9', 8, 26);
        }
      }
    }

    // Particles.
    for (const pt of state.particles) {
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life < pt.maxLife);
    for (const r of state.rings) if (r.burst > 0) r.burst = Math.max(0, r.burst - dt * 1.6);
    for (const m of state.messages) m.t += dt;
    state.messages = state.messages.filter((m) => m.t < m.dur);

    // Crash checks.
    if (Math.abs(plane.x) >= CORRIDOR.cliffX) {
      events |= crash('cliff');
      if (audio) audio.crash();
    } else if (plane.y <= terrainHeight(plane.z) + CORRIDOR.minAlt) {
      events |= crash('terrain');
      if (audio) audio.crash();
    }
    return events;
  }

  function reset(levelIndex = 0) {
    state.score = 0;
    state.distance = 0;
    buildLevel(levelIndex);
  }

  function nextLevel() {
    buildLevel(state.levelIndex + 1);
  }

  buildLevel(0);

  return {
    state,
    step,
    reset,
    nextLevel,
    buildLevel,
    terrainHeight,
    get level() {
      return LEVELS[state.levelIndex];
    },
    get levelCount() {
      return LEVELS.length;
    },
    /** The ring the player must fly through next (or null). */
    currentRing() {
      return state.rings[state.ringIndex] || null;
    },
    STEP,
  };
}
