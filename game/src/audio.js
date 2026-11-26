// Synthesized sound, Web Audio only: no audio files, no network.
// Engine hum (two detuned saws + filtered noise, pitch follows speed),
// ring ding, star chime, boost whoosh, crash thud, UI click.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let muted = false;
  try {
    muted = window.localStorage.getItem('golden-hour-flight-muted') === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, filterFreq, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    get muted() {
      return muted;
    },
    /** Call from a user gesture (start click / keypress). */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (engineOsc1) return;
      engineOsc1 = ctx.createOscillator();
      engineOsc2 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc2.type = 'sawtooth';
      engineOsc1.frequency.value = 55;
      engineOsc2.frequency.value = 55 * 1.007;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc1.start();
      engineOsc2.start();
    },
    /** speed 0..1 (cruise..boost), called every frame while flying. */
    engine(speed, boosting) {
      if (!ctx || !engineOsc1 || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      const t = ctx.currentTime;
      const freq = 52 + speed * 68 + (boosting ? 26 : 0);
      engineOsc1.frequency.setTargetAtTime(freq, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(freq * 1.007, t, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + speed * 900, t, 0.1);
      engineGain.gain.setTargetAtTime(0.05 + speed * 0.05, t, 0.1);
    },
    engineOff() {
      if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    },
    ring() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318, 0.5, 'sine', 0.16);
    },
    star() {
      tone(1175, 0.18, 'triangle', 0.14);
      tone(1568, 0.28, 'triangle', 0.1);
    },
    fuel() {
      tone(660, 0.15, 'sine', 0.16);
      tone(990, 0.3, 'sine', 0.14);
    },
    boost() {
      noiseBurst(0.5, 0.2, 2400, 300);
    },
    crash() {
      noiseBurst(0.7, 0.35, 900, 90);
      tone(70, 0.6, 'sine', 0.3, 30);
    },
    levelClear() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.16), i * 110));
    },
    click() {
      tone(700, 0.07, 'square', 0.08);
    },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem('golden-hour-flight-muted', muted ? '1' : '0');
      } catch {
        // Storage can be off: mute then lasts this visit only.
      }
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
      return muted;
    },
  };
}
