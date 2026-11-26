// The screenshot scenes behind ?shot=start|play|peak|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (aim at the next ring, climb when the terrain ahead
// is high), so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_CRASH, EVENT_LEVEL_CLEAR, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const PEAK_SECONDS = 22;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Steer toward the next ring; climb early when the terrain ahead is high. */
function autopilot(world, boost) {
  const state = world.state;
  const plane = state.plane;
  const ring = world.currentRing();
  if (!ring) return { x: 0, y: 0, boost: false, brake: false };
  const dx = ring.x - plane.x;
  const dy = ring.y - plane.y;
  const x = dx > 5 ? 1 : dx < -5 ? -1 : 0;
  // Look 260 m ahead: climb if the ground there is close to our altitude.
  const ahead = world.terrainHeight(plane.z + 260);
  let y = 0;
  if (plane.y < ahead + 26) y = 1;
  else if (dy > 5) y = 1;
  else if (dy < -5) y = -1;
  return { x, y, boost, brake: false };
}

/** Run the world forward with the autopilot until `seconds` pass or it ends. */
function simulate(world, seconds, boost, audio) {
  let events = 0;
  for (let t = 0; t < seconds / STEP; t += 1) {
    events |= world.step(STEP, autopilot(world, boost), audio);
    if (events & (EVENT_CRASH | EVENT_LEVEL_CLEAR | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. start: title over a staged flight. play: mid-flight
 * in level 1 with a ring ahead. peak: night level, boosting at a ring.
 * end: a hurried pilot that crashes, for the game-over screen.
 */
export function stageShot(name, world) {
  if (name === 'peak') {
    world.buildLevel(2);
    simulate(world, PEAK_SECONDS, true, null);
    return { screen: SCREEN_PLAY, best: Math.floor(world.state.score) };
  }
  if (name === 'end') {
    world.reset(0);
    // A hurried pilot: it chases rings for a while, then stops watching the
    // ground and sinks — the valley floor catches it, as it does a real one.
    let events = 0;
    for (let t = 0; t < END_LIMIT_SECONDS / STEP; t += 1) {
      const state = world.state;
      const ring = world.currentRing();
      const axes = { x: 0, y: 0, boost: false, brake: false };
      const elapsed = t * STEP;
      if (ring && elapsed < 15) {
        axes.x = ring.x - state.plane.x > 14 ? 1 : ring.x - state.plane.x < -14 ? -1 : 0;
        axes.y = ring.y - state.plane.y > 16 ? 1 : ring.y - state.plane.y < -16 ? -1 : 0;
      } else {
        axes.y = -1;
      }
      events |= world.step(STEP, axes, null);
      if (events & (EVENT_CRASH | EVENT_LEVEL_CLEAR | EVENT_WIN)) break;
    }
    return { screen: SCREEN_OVER, best: Math.floor(world.state.score) };
  }
  if (name === 'play') {
    world.reset(0);
    simulate(world, PLAY_SECONDS, false, null);
    return { screen: SCREEN_PLAY, best: Math.floor(world.state.score) };
  }
  world.reset(0);
  simulate(world, START_SECONDS, false, null);
  return { screen: SCREEN_TITLE, best: 0 };
}
