// Keyboard + mouse input. Arrows/WASD fly, Shift boosts, Space brakes,
// P pauses, M mutes, R restarts, Enter confirms. Mouse clicks the on-screen
// buttons (start, restart, mute); the canvas reports clicks in logical
// 1280x720 coordinates so the renderer and the input agree.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';

const KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
  Space: 'brake',
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  KeyM: ACTION_MUTE,
  KeyR: ACTION_RESTART,
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, boost: false, brake: false };
  const pressed = new Set();
  const clicks = [];

  function onKeyDown(event) {
    const action = KEYS[event.code];
    if (!action) return;
    event.preventDefault();
    if (event.repeat) return;
    if (action === ACTION_CONFIRM || action === ACTION_PAUSE || action === ACTION_MUTE || action === ACTION_RESTART) {
      pressed.add(action);
    } else {
      held[action] = true;
    }
  }

  function onKeyUp(event) {
    const action = KEYS[event.code];
    if (!action) return;
    if (action !== ACTION_CONFIRM && action !== ACTION_PAUSE && action !== ACTION_MUTE && action !== ACTION_RESTART) {
      held[action] = false;
    }
  }

  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * FIELD.width;
    const y = ((event.clientY - rect.top) / rect.height) * FIELD.height;
    clicks.push({ x, y });
  }

  function onBlur() {
    held.up = held.down = held.left = held.right = held.boost = held.brake = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('click', onClick);

  return {
    held,
    /** One-shot actions pressed since the last read; reading clears them. */
    takePressed() {
      const out = [...pressed];
      pressed.clear();
      return out;
    },
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
    /** -1 (left) .. 1 (right), -1 (down) .. 1 (up) from held keys. */
    axes() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.up ? 1 : 0) - (held.down ? 1 : 0),
        boost: held.boost,
        brake: held.brake,
      };
    },
  };
}
