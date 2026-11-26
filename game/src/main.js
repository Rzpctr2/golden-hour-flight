// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. Screens: title, play, paused, level-clear,
// game over, win.
//
// ?seed=N fixes the flight pattern. ?shot=start|play|peak|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, MUTE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CRASH,
  EVENT_LEVEL_CLEAR,
  EVENT_LOW_FUEL,
  EVENT_WIN,
  createWorld,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
const CLEAR_PAUSE = 2.6;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function announce(text) {
  if (status) status.textContent = text;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clearAt = 0;
  let muted = audio.muted;

  function startGame() {
    audio.unlock();
    audio.click();
    world.reset(0);
    screen = SCREEN_PLAY;
    announce('Terbang! Lewati ring, kumpulkan bintang, jaga bahan bakar.');
  }

  function backToTitle() {
    world.reset(0);
    screen = SCREEN_TITLE;
  }

  function hitButton(clicks, rect) {
    if (!rect) return false;
    return clicks.some((c) => c.x >= rect.x && c.x <= rect.x + rect.w && c.y >= rect.y && c.y <= rect.y + rect.h);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const pressed = input.takePressed();
    const clicks = input.takeClicks();
    const buttons = renderer.buttons;

    if (pressed.includes(ACTION_MUTE)) {
      muted = audio.toggleMute();
      announce(muted ? 'Suara mati.' : 'Suara nyala.');
    }

    if (screen === SCREEN_TITLE) {
      if (pressed.includes(ACTION_CONFIRM) || hitButton(clicks, buttons.start)) startGame();
      else if (hitButton(clicks, buttons.mute)) {
        muted = audio.toggleMute();
        announce(muted ? 'Suara mati.' : 'Suara nyala.');
      }
      world.step(STEP, { x: 0, y: 0, boost: false, brake: false }, null);
      if (world.state.status !== 'flying') world.reset(0);
      renderer.draw(world.state, SCREEN_TITLE, best);
      return;
    }

    if (screen === SCREEN_PAUSED) {
      if (pressed.includes(ACTION_PAUSE) || pressed.includes(ACTION_CONFIRM) || hitButton(clicks, buttons.start)) {
        screen = SCREEN_PLAY;
        announce('Lanjut terbang.');
      } else if (pressed.includes(ACTION_RESTART)) {
        startGame();
      }
      renderer.draw(world.state, SCREEN_PAUSED, best);
      return;
    }

    if (screen === SCREEN_CLEAR) {
      if (now - clearAt > CLEAR_PAUSE * 1000) {
        world.nextLevel();
        screen = SCREEN_PLAY;
        announce(`Level ${['SENJA', 'JINGGA', 'MALAM'][world.state.levelIndex]} — lebih cepat, angin lebih kencang.`);
      }
      renderer.draw(world.state, SCREEN_CLEAR, best);
      return;
    }

    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (pressed.includes(ACTION_RESTART) || pressed.includes(ACTION_CONFIRM) || hitButton(clicks, buttons.restart)) {
        startGame();
      } else if (hitButton(clicks, buttons.mute)) {
        muted = audio.toggleMute();
      }
      world.step(STEP, { x: 0, y: 0, boost: false, brake: false }, null);
      renderer.draw(world.state, screen, best);
      return;
    }

    // SCREEN_PLAY.
    if (pressed.includes(ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      audio.engineOff();
      announce('Jeda.');
      renderer.draw(world.state, SCREEN_PAUSED, best);
      return;
    }
    if (pressed.includes(ACTION_RESTART)) {
      startGame();
      return;
    }
    const axes = input.axes();
    accumulator += dt;
    let events = 0;
    while (accumulator >= STEP) {
      events |= world.step(STEP, axes, audio);
      accumulator -= STEP;
    }
    const flying = world.state.status === 'flying';
    if (flying) audio.engine(world.state.plane.speed / 110, axes.boost);
    else audio.engineOff();
    if (events & EVENT_CRASH) {
      const finalScore = Math.floor(world.state.score);
      if (finalScore > best) {
        best = finalScore;
        saveBest(best);
      }
      screen = SCREEN_OVER;
      announce(`Jatuh! Skor ${finalScore}. Tekan R untuk terbang lagi.`);
    } else if (events & EVENT_WIN) {
      const finalScore = Math.floor(world.state.score);
      if (finalScore > best) {
        best = finalScore;
        saveBest(best);
      }
      screen = SCREEN_WIN;
      announce(`Penerbangan selesai! Skor ${finalScore}.`);
    } else if (events & EVENT_LEVEL_CLEAR) {
      clearAt = now;
      screen = SCREEN_CLEAR;
      announce('Level selesai!');
    } else if (events & EVENT_LOW_FUEL) {
      announce('Bahan bakar menipis! Cari orb hijau.');
    }
    renderer.draw(world.state, SCREEN_PLAY, best);
  }

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
