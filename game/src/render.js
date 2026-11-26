// Pseudo-3D chase-view renderer: golden-hour sky, a volcano on the horizon,
// terraced rice paddies scrolling under the plane, glowing target rings, and
// a lit HUD. All art is drawn in code; all animation is a function of the
// simulation time, so a staged scene always paints the same frame.
import { CORRIDOR, FIELD, PALETTES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const CX = FIELD.width / 2;
const HORIZON = 296;
const CAM_DEPTH = 320;
const SX = 1.6; // lateral projection factor
const SY = 1.1; // vertical projection factor
const VALLEY_HALF = 150;
const FAR = 2600;

/** Deterministic 0..1 hash of an integer (decor placement, no Math.random). */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const buttons = { start: null, restart: null, mute: null };

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
  }

  function project(x, y, z, cam) {
    const d = z - cam.z;
    if (d < 4) return null;
    const scale = CAM_DEPTH / d;
    return {
      x: CX + (x - cam.x) * scale * SX,
      y: HORIZON + (cam.y - y) * scale * SY,
      scale,
      depth: d,
    };
  }

  function drawSky(pal, levelName, time, heading) {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 60);
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(0.55, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, HORIZON + 60);
    if (levelName === 'MALAM') {
      // Star field, fixed to the sky (not the world).
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i += 1) {
        const sx = hash(i * 3 + 1) * FIELD.width;
        const sy = hash(i * 3 + 2) * 240;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.7 + i));
        ctx.globalAlpha = tw * (0.35 + hash(i) * 0.5);
        ctx.fillRect(sx, sy, hash(i * 7) > 0.85 ? 2.4 : 1.4, hash(i * 7) > 0.85 ? 2.4 : 1.4);
      }
      ctx.globalAlpha = 1;
    }
    // Low sun (or moon at night), drifting with the heading.
    const sunX = CX + 430 - heading * 4;
    const sunY = levelName === 'MALAM' ? 150 : 238;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 190);
    glow.addColorStop(0, pal.sunGlow);
    glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, levelName === 'MALAM' ? 30 : 44, 0, Math.PI * 2);
    ctx.fill();
    if (levelName === 'MALAM') {
      ctx.fillStyle = 'rgba(44, 62, 99, 0.55)';
      ctx.beginPath();
      ctx.arc(sunX - 12, sunY - 8, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawVolcano(pal, heading) {
    const vx = CX + 180 - heading * 6;
    const baseY = HORIZON + 8;
    ctx.fillStyle = pal.volcano;
    ctx.beginPath();
    ctx.moveTo(vx - 300, baseY);
    ctx.lineTo(vx - 60, baseY - 190);
    ctx.lineTo(vx + 40, baseY - 190);
    ctx.lineTo(vx + 290, baseY);
    ctx.closePath();
    ctx.fill();
    // Crater cap: snow by day, lava glow by night.
    ctx.fillStyle = pal.volcanoSnow;
    ctx.beginPath();
    ctx.moveTo(vx - 60, baseY - 190);
    ctx.lineTo(vx + 40, baseY - 190);
    ctx.lineTo(vx + 12, baseY - 158);
    ctx.lineTo(vx - 28, baseY - 158);
    ctx.closePath();
    ctx.fill();
    // Smoke plume, slow curls.
    ctx.fillStyle = pal.cloud;
    for (let i = 0; i < 4; i += 1) {
      const t = (i * 0.28 + 0.05) % 1;
      const px = vx - 10 + Math.sin(i * 2.1) * 14 + t * 46;
      const py = baseY - 196 - t * 74;
      ctx.globalAlpha = 0.55 * (1 - t);
      ctx.beginPath();
      ctx.ellipse(px, py, 16 + t * 22, 9 + t * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(pal, camZ, time) {
    ctx.fillStyle = pal.cloud;
    for (let i = 0; i < 9; i += 1) {
      const baseZ = hash(i * 11 + 5) * 3800 + 400;
      const z = 400 + ((baseZ - camZ) % 3800 + 3800) % 3800;
      const d = z;
      const scale = CAM_DEPTH / d;
      const cx = CX + (hash(i * 11 + 6) * 2 - 1) * 620 * scale + Math.sin(time * 0.05 + i) * 12;
      const cy = 60 + hash(i * 11 + 7) * 170 - scale * 40;
      const s = (30 + hash(i * 11 + 8) * 60) * (0.4 + scale);
      ctx.globalAlpha = 0.28 + scale * 0.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s, s * 0.34, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s * 0.5, cy + 4, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s * 0.55, cy + 5, s * 0.55, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Terraced valley: depth slices from far to near, floor + hillsides. */
  function drawTerrain(pal, cam, levelName) {
    const slices = [];
    let d = 30;
    while (d < FAR) {
      slices.push(d);
      d *= 1.28;
    }
    // Far to near so near slices paint over far ones.
    for (let i = slices.length - 1; i >= 0; i -= 1) {
      const d0 = slices[i];
      const d1 = i + 1 < slices.length ? slices[i + 1] : FAR;
      const s0 = CAM_DEPTH / d0;
      const s1 = CAM_DEPTH / d1;
      const y0 = HORIZON + cam.y * s0 * SY;
      const y1 = HORIZON + cam.y * s1 * SY;
      const hw0 = VALLEY_HALF * s0 * SX;
      const hw1 = VALLEY_HALF * s1 * SX;
      const band = Math.floor((cam.z + d0) / 90);
      const color = pal.terrain[((band % pal.terrain.length) + pal.terrain.length) % pal.terrain.length];
      // Valley floor trapezoid.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(CX - hw1, y1);
      ctx.lineTo(CX + hw1, y1);
      ctx.lineTo(CX + hw0, y0);
      ctx.lineTo(CX - hw0, y0);
      ctx.closePath();
      ctx.fill();
      // Terrace lip: thin darker line at the near edge of each band.
      ctx.strokeStyle = 'rgba(40, 30, 20, 0.35)';
      ctx.lineWidth = Math.max(1, 2.4 * s0);
      ctx.beginPath();
      ctx.moveTo(CX - hw0, y0);
      ctx.lineTo(CX + hw0, y0);
      ctx.stroke();
      // Hillsides: darker slopes rising from the valley edges.
      const rise = 130 * s0;
      ctx.fillStyle = pal.hill;
      ctx.beginPath();
      ctx.moveTo(CX - hw1, y1);
      ctx.lineTo(CX - hw0, y0);
      ctx.lineTo(CX - hw0 - rise * 1.4, y0 + rise * 0.35);
      ctx.lineTo(CX - hw1 - rise * 1.4, y1 + rise * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(CX + hw1, y1);
      ctx.lineTo(CX + hw0, y0);
      ctx.lineTo(CX + hw0 + rise * 1.4, y0 + rise * 0.35);
      ctx.lineTo(CX + hw1 + rise * 1.4, y1 + rise * 0.35);
      ctx.closePath();
      ctx.fill();
      // Contour terrace lines on the slopes.
      ctx.strokeStyle = 'rgba(20, 25, 15, 0.28)';
      ctx.lineWidth = Math.max(1, 1.4 * s0);
      ctx.beginPath();
      ctx.moveTo(CX - hw0 - rise * 0.7, y0 + rise * 0.18);
      ctx.lineTo(CX - hw0, y0);
      ctx.moveTo(CX + hw0, y0);
      ctx.lineTo(CX + hw0 + rise * 0.7, y0 + rise * 0.18);
      ctx.stroke();
      // Decor: a tree or a hut on some bands, placed by hash (deterministic).
      if (s0 > 0.16 && hash(band * 13 + 2) > 0.62) {
        const side = hash(band * 13 + 3) > 0.5 ? 1 : -1;
        const tx = CX + side * (hw0 + rise * 0.7);
        const ty = y0 + rise * 0.16;
        const ts = 7 * s0 + 3;
        if (hash(band * 13 + 4) > 0.5) {
          // Tree: triangle + trunk.
          ctx.fillStyle = levelName === 'MALAM' ? '#16241f' : '#3f6b34';
          ctx.beginPath();
          ctx.moveTo(tx, ty - ts * 2.2);
          ctx.lineTo(tx - ts, ty);
          ctx.lineTo(tx + ts, ty);
          ctx.closePath();
          ctx.fill();
        } else {
          // Hut: walls + terracotta roof.
          ctx.fillStyle = '#e8dcc0';
          ctx.fillRect(tx - ts * 0.8, ty - ts, ts * 1.6, ts);
          ctx.fillStyle = '#c65f3a';
          ctx.beginPath();
          ctx.moveTo(tx - ts, ty - ts);
          ctx.lineTo(tx, ty - ts * 1.8);
          ctx.lineTo(tx + ts, ty - ts);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Distance haze over the far valley.
    const haze = ctx.createLinearGradient(0, HORIZON - 40, 0, HORIZON + 130);
    haze.addColorStop(0, pal.haze);
    haze.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, HORIZON - 40, FIELD.width, 170);
  }

  function drawRing(pal, ring, cam, time, isNext) {
    const p = project(ring.x, ring.y, ring.z, cam);
    if (!p) return;
    const rx = ring.radius * p.scale * SX;
    const ry = ring.radius * p.scale * SY;
    if (rx < 1.5) return;
    const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 5) : 1;
    ctx.save();
    ctx.globalAlpha = pulse * (ring.missed ? 0.45 : 1);
    ctx.strokeStyle = ring.missed ? '#8a8a8a' : ring.passed ? '#7ee787' : pal.ring;
    ctx.lineWidth = Math.max(2, 7 * p.scale);
    ctx.shadowColor = pal.ringGlow;
    ctx.shadowBlur = isNext ? 18 : 8;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Beacon lamp on top of the ring.
    ctx.fillStyle = ring.missed ? '#888' : pal.ring;
    ctx.beginPath();
    ctx.arc(p.x, p.y - ry, Math.max(2, 4 * p.scale), 0, Math.PI * 2);
    ctx.fill();
    // Burst flash when just passed.
    if (ring.burst > 0) {
      ctx.globalAlpha = ring.burst;
      ctx.strokeStyle = '#fff6c9';
      ctx.lineWidth = Math.max(2, 10 * p.scale);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * (1 + (1 - ring.burst) * 0.7), ry * (1 + (1 - ring.burst) * 0.7), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStar(pal, star, cam, time) {
    const p = project(star.x, star.y, star.z, cam);
    if (!p || star.taken) return;
    const s = Math.max(1.5, 7 * p.scale);
    const tw = 0.6 + 0.4 * Math.sin(time * 4 + star.phase);
    ctx.save();
    ctx.globalAlpha = tw;
    ctx.fillStyle = star.fuel ? pal.fuel : pal.star;
    ctx.shadowColor = star.fuel ? '#7ee787' : '#fff6c9';
    ctx.shadowBlur = 12;
    if (star.fuel) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b2b12';
      ctx.font = `bold ${Math.max(8, s * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', p.x, p.y + 0.5);
    } else {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.6);
      ctx.lineTo(p.x + s * 0.45, p.y - s * 0.45);
      ctx.lineTo(p.x + s * 1.6, p.y);
      ctx.lineTo(p.x + s * 0.45, p.y + s * 0.45);
      ctx.lineTo(p.x, p.y + s * 1.6);
      ctx.lineTo(p.x - s * 0.45, p.y + s * 0.45);
      ctx.lineTo(p.x - s * 1.6, p.y);
      ctx.lineTo(p.x - s * 0.45, p.y - s * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles(state, cam) {
    for (const pt of state.particles) {
      const p = project(pt.x, pt.y, pt.z, cam);
      if (!p) continue;
      ctx.globalAlpha = Math.max(0, 1 - pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, pt.size * p.scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** The prop plane, rear chase view, banking with the turn. */
  function drawPlane(state, time, boosting) {
    const plane = state.plane;
    const px = CX + plane.bank * 260;
    const py = 528 + plane.pitch * 90;
    const propAngle = time * (18 + plane.speed * 0.35);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(plane.bank * 0.9);
    const s = 1 + plane.pitch * 0.12;
    ctx.scale(s, s);
    // Speed streaks while boosting.
    if (boosting) {
      ctx.strokeStyle = 'rgba(255, 246, 201, 0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const yy = -70 + i * 28 + hash(i + Math.floor(time * 30)) * 10;
        const xx = (hash(i * 7 + 3) > 0.5 ? 1 : -1) * (150 + hash(i) * 60);
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx + (xx > 0 ? 42 : -42), yy);
        ctx.stroke();
      }
    }
    // Tail fin.
    ctx.fillStyle = '#b65c3a';
    ctx.beginPath();
    ctx.moveTo(-6, -34);
    ctx.lineTo(0, -62);
    ctx.lineTo(8, -34);
    ctx.closePath();
    ctx.fill();
    // Wings.
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-118, 14);
    ctx.lineTo(-112, 30);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -6);
    ctx.lineTo(118, 14);
    ctx.lineTo(112, 30);
    ctx.lineTo(10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d97b54';
    ctx.fillRect(-118, 20, 108, 5);
    ctx.fillRect(10, 20, 108, 5);
    // Fuselage.
    ctx.fillStyle = '#f7e8c9';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d97b54';
    ctx.fillRect(-20, -8, 40, 7);
    // Cockpit glass, lit dusty teal.
    ctx.fillStyle = '#5f8a8b';
    ctx.beginPath();
    ctx.ellipse(0, -18, 11, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.ellipse(-3, -23, 4, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: spinning blades + hub.
    ctx.save();
    ctx.translate(0, 52);
    ctx.rotate(propAngle);
    ctx.fillStyle = 'rgba(60, 40, 25, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -26, 5, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 26, 5, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#8a5a3b';
    ctx.beginPath();
    ctx.arc(0, 52, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.arc(0, 52, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(state, levelName, levelIndex, levelCount, time) {
    const plane = state.plane;
    const level = state.levelIndex;
    const ring = state.rings[state.ringIndex] || null;
    const distKm = (plane.z / 1000).toFixed(1);
    const hdg = ((Math.round(plane.heading) % 360) + 360) % 360;
    const spdKmh = Math.round(plane.speed * 3.6);
    ctx.save();
    // Top bar.
    ctx.fillStyle = 'rgba(16, 14, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, 64);
    ctx.fillStyle = '#f7e8c9';
    ctx.textBaseline = 'middle';
    // Left: instruments.
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(255, 207, 92, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(`ALT ${Math.round(plane.y)} m`, 18, 22);
    ctx.fillText(`SPD ${spdKmh} km/h`, 18, 48);
    ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, 250, 22);
    // Compass tape.
    const tapeX = 250;
    const tapeY = 48;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(247, 232, 201, 0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -60; d <= 60; d += 15) {
      const deg = ((Math.round(plane.heading) + d) % 360 + 360) % 360;
      const x = tapeX + 150 + d * 2.4;
      ctx.fillRect(x - 0.5, tapeY - 8, 1, d % 45 === 0 ? 12 : 6);
      if (labels[deg] !== undefined) ctx.fillText(labels[deg], x, tapeY + 12);
    }
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.moveTo(tapeX + 150, tapeY - 10);
    ctx.lineTo(tapeX + 144, tapeY - 18);
    ctx.lineTo(tapeX + 156, tapeY - 18);
    ctx.closePath();
    ctx.fill();
    // Right: score / rings / distance / level.
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(255, 207, 92, 0.9)';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`SCORE ${Math.floor(state.score)}`, FIELD.width - 18, 22);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`RING ${state.ringsPassed}/${state.rings.length}   DIST ${distKm} km   ${levelName} ${level + 1}/${levelCount}`, FIELD.width - 18, 48);
    ctx.shadowBlur = 0;
    // Fuel bar, bottom left.
    const fx = 18;
    const fy = FIELD.height - 44;
    const fw = 230;
    ctx.fillStyle = 'rgba(16, 14, 20, 0.55)';
    ctx.fillRect(fx - 8, fy - 20, fw + 16, 40);
    ctx.fillStyle = '#f7e8c9';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FUEL', fx, fy - 10);
    const low = state.fuel <= 25;
    if (low && Math.sin(time * 8) > 0) ctx.fillStyle = '#ff5a4e';
    else ctx.fillStyle = state.fuel > 50 ? '#7ee787' : '#ffcf5c';
    ctx.fillRect(fx, fy, fw * (state.fuel / 100), 12);
    ctx.strokeStyle = 'rgba(247, 232, 201, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fx, fy, fw, 12);
    // Wind, bottom right.
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#f7e8c9';
    const windArrow = state.wind >= 0 ? '→' : '←';
    ctx.fillText(`WIND ${windArrow} ${Math.abs(Math.round(state.wind))} m/s`, FIELD.width - 18, FIELD.height - 26);
    // Next-ring beacon.
    if (ring && state.status === 'flying') {
      const dz = Math.max(0, ring.z - plane.z);
      const dx = ring.x - plane.x;
      const arrow = dx > 12 ? '▶' : dx < -12 ? '◀' : '▲';
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillStyle = '#ffcf5c';
      ctx.shadowColor = 'rgba(255, 207, 92, 0.9)';
      ctx.shadowBlur = 10;
      ctx.fillText(`${arrow} RING ${state.ringIndex + 1} · ${Math.round(dz)} m`, CX, 92);
      ctx.shadowBlur = 0;
    }
    // Pop-up messages, centre.
    ctx.textAlign = 'center';
    state.messages.forEach((m, i) => {
      ctx.globalAlpha = Math.max(0, 1 - m.t / m.dur);
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillStyle = '#fff6c9';
      ctx.shadowColor = 'rgba(255, 180, 60, 0.95)';
      ctx.shadowBlur = 14;
      ctx.fillText(m.text, CX, 150 + i * 38);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawAttitude(state) {
    const plane = state.plane;
    const cx = FIELD.width - 92;
    const cy = FIELD.height - 92;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(16, 14, 20, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(247, 232, 201, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.rotate(-plane.bank);
    ctx.translate(0, plane.pitch * 60);
    ctx.fillStyle = '#5f8a8b';
    ctx.fillRect(-52, -52, 104, 52);
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(-52, 0, 104, 52);
    ctx.fillStyle = '#f7e8c9';
    ctx.fillRect(-52, -1, 104, 2);
    ctx.restore();
    ctx.fillStyle = '#ffcf5c';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-7, 4);
    ctx.lineTo(7, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function button(x, y, w, h, label, accent) {
    ctx.fillStyle = accent ? '#d97b54' : 'rgba(16, 14, 20, 0.6)';
    ctx.strokeStyle = '#f7e8c9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7e8c9';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    return { x, y, w, h };
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(20, 12, 18, 0.42)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff6c9';
    ctx.shadowColor = 'rgba(255, 180, 60, 0.95)';
    ctx.shadowBlur = 22;
    ctx.font = 'bold 74px system-ui, sans-serif';
    ctx.fillText('GOLDEN HOUR', CX, 168);
    ctx.fillText('FLIGHT', CX, 248);
    ctx.shadowBlur = 0;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#f7e8c9';
    ctx.fillText('Terbang melewati ring di atas sawah terasering dan gunung berapi', CX, 300);
    ctx.fillText('saat golden hour. Kumpulkan bintang, jaga bahan bakar.', CX, 330);
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText('↑↓ naik / turun      ←→ belok      SHIFT boost      SPASI rem', CX, 384);
    ctx.fillText('Lewati semua ring untuk naik level: Senja → Jingga → Malam', CX, 412);
    if (best > 0) {
      ctx.fillStyle = '#ffcf5c';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(`SKOR TERBAIK: ${best}`, CX, 452);
    }
    buttons.start = button(CX - 130, 560, 260, 56, '▶  MULAI TERBANG', true);
    buttons.mute = button(CX - 130, 628, 260, 40, 'SUARA: NYALA', false);
    buttons.restart = null;
  }

  function drawOver(state, best, won) {
    ctx.fillStyle = 'rgba(20, 12, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#7ee787' : '#ff8a7a';
    ctx.shadowColor = won ? 'rgba(126, 231, 135, 0.9)' : 'rgba(255, 90, 78, 0.9)';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 58px system-ui, sans-serif';
    ctx.fillText(won ? 'PENERBANGAN SELESAI!' : 'JATUH!', CX, 200);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f7e8c9';
    ctx.font = '20px system-ui, sans-serif';
    if (!won) {
      const cause = state.crashCause === 'cliff' ? 'Sayap menghantam tebing.' : 'Pesawat menghantam tanah.';
      ctx.fillText(cause, CX, 252);
    } else {
      ctx.fillText('Ketiga level — Senja, Jingga, Malam — berhasil dilewati.', CX, 252);
    }
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#ffcf5c';
    ctx.fillText(`SKOR ${Math.floor(state.score)}`, CX, 312);
    ctx.fillStyle = '#f7e8c9';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText(`Ring dilewati: ${state.ringsPassed}   Jarak: ${(state.distance / 1000).toFixed(2)} km   Terbaik: ${Math.floor(Math.max(best, state.score))}`, CX, 352);
    buttons.restart = button(CX - 130, 402, 260, 56, '↻  TERBANG LAGI', true);
    buttons.start = null;
    buttons.mute = button(CX - 130, 470, 260, 40, 'SUARA', false);
  }

  function drawClear(state) {
    ctx.fillStyle = 'rgba(20, 12, 18, 0.35)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.shadowColor = 'rgba(126, 231, 135, 0.9)';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('LEVEL SELESAI!', CX, 260);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f7e8c9';
    ctx.font = '22px system-ui, sans-serif';
    const next = ['JINGGA', 'MALAM'][state.levelIndex] || 'MALAM';
    ctx.fillText(`Lanjut ke level ${next} — lebih cepat, angin lebih kencang.`, CX, 312);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffcf5c';
    ctx.fillText(`SKOR ${Math.floor(state.score)}`, CX, 356);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(20, 12, 18, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f7e8c9';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('JEDA', CX, 300);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Tekan P atau klik untuk lanjut', CX, 352);
    buttons.start = button(CX - 130, 392, 260, 52, '▶  LANJUT', true);
    buttons.restart = null;
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(CX, FIELD.height / 2, FIELD.height * 0.45, CX, FIELD.height / 2, FIELD.height * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10, 8, 14, 0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function draw(state, screen, best) {
    fit();
    const levelName = ['SENJA', 'JINGGA', 'MALAM'][state.levelIndex];
    const pal = PALETTES[levelName];
    const time = state.time;
    const cam = { x: state.plane.x, y: state.plane.y, z: state.plane.z };
    buttons.start = null;
    buttons.restart = null;
    buttons.mute = null;
    drawSky(pal, levelName, time, state.plane.heading);
    drawVolcano(pal, state.plane.heading);
    drawClouds(pal, cam.z, time);
    drawTerrain(pal, cam, levelName);
    // Rings far-to-near, then stars, then particles, then the plane.
    const rings = [...state.rings].sort((a, b) => b.z - a.z);
    for (const ring of rings) {
      if (ring.z < cam.z) continue;
      drawRing(pal, ring, cam, time, ring === state.rings[state.ringIndex]);
    }
    for (const star of state.stars) drawStar(pal, star, cam, time);
    drawParticles(state, cam);
    if (state.status !== 'crashed') drawPlane(state, time, state.status === 'flying' && state.boosting);
    drawVignette();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_CLEAR) {
      drawHud(state, levelName, state.levelIndex, 3, time);
      drawAttitude(state);
    }
    if (screen === SCREEN_TITLE) {
      drawHud(state, levelName, state.levelIndex, 3, time);
      drawTitle(state, best);
    } else if (screen === SCREEN_OVER) {
      drawHud(state, levelName, state.levelIndex, 3, time);
      drawOver(state, best, state.status === 'won');
    } else if (screen === SCREEN_WIN) {
      drawHud(state, levelName, state.levelIndex, 3, time);
      drawOver(state, best, true);
    } else if (screen === SCREEN_CLEAR) {
      drawClear(state);
    } else if (screen === SCREEN_PAUSED) {
      drawPaused();
    }
    return buttons;
  }

  return { draw, buttons, fit };
}
