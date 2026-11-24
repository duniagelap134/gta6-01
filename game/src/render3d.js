// SOLMAR — the 3D chase renderer, hand-rolled on a 2D canvas: a camera
// rides behind Rico (or his car), every world object is a box, a
// billboard or a ground quad, projected with a near-plane clip and drawn
// far-to-near by painter's sort. Golden hour by default, night on
// demand. No library, no network, deterministic from the seed.
import { CFG } from './config.js';
import { groundQuads } from './city.js';

const FOCAL = 520;
const HORIZON = 330;
const EYE = 78;
const NEAR = 12;
const VIEW_W = 1280;
const VIEW_H = 800;

const PALETTES = {
  day: { top: '#3d7ac8', mid: '#8fc3e8', low: '#e8f2f2', ground: '#c9a06a', road: '#3d3a44', sun: '#fff3c4', sunY: 120, fog: 'rgba(232,242,242,0.25)' },
  dusk: { top: '#3a2a5e', mid: '#d95d6a', low: '#f9a55c', ground: '#b98a52', road: '#38343e', sun: '#ffb347', sunY: 215, fog: 'rgba(249,165,92,0.22)' },
  night: { top: '#060a1c', mid: '#101c3a', low: '#1d2f52', ground: '#5d4a38', road: '#232028', sun: '#e8ecf7', sunY: 90, fog: 'rgba(16,28,58,0.3)' },
};

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex, f) {
  const [r, g, b] = hexRgb(hex);
  const m = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

function toCam(cam, x, y, z) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  return { fwd: dx * c + dy * s, side: -dx * s + dy * c, z };
}

function toScreen(p) {
  return { x: VIEW_W / 2 + (p.side * FOCAL) / p.fwd, y: HORIZON - ((p.z - EYE) * FOCAL) / p.fwd, fwd: p.fwd };
}

function clipNear(poly) {
  let out = poly;
  const keep = (a, b) => {
    const res = [];
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const q = a[(i + 1) % a.length];
      const pin = p.fwd >= NEAR;
      const qin = q.fwd >= NEAR;
      if (pin && qin) res.push(q);
      else if (pin && !qin) {
        const t = (NEAR - p.fwd) / (q.fwd - p.fwd);
        res.push({ fwd: NEAR, side: p.side + (q.side - p.side) * t, z: p.z + (q.z - p.z) * t });
      } else if (!pin && qin) {
        const t = (NEAR - p.fwd) / (q.fwd - p.fwd);
        res.push({ fwd: NEAR, side: p.side + (q.side - p.side) * t, z: p.z + (q.z - p.z) * t });
        res.push(q);
      }
    }
    return res;
  };
  out = keep(out, null);
  return out;
}

function projectPoint(cam, x, y, z) {
  const p = toCam(cam, x, y, z);
  if (p.fwd < NEAR) return null;
  return toScreen(p);
}

function projectPoly(cam, pts) {
  const camPts = pts.map(([x, y, z]) => toCam(cam, x, y, z));
  const clipped = clipNear(camPts);
  if (clipped.length < 3) return null;
  return clipped.map(toScreen);
}

function fillPoly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawSky(ctx, game, pal) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, HORIZON + 40);
  // The sun hangs low in the west, so a chase heading west drives into it.
  const sunAng = Math.PI;
  let rel = sunAng - game.camera.yaw;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  if (Math.abs(rel) < 1.3) {
    const sx = VIEW_W / 2 + Math.tan(rel) * FOCAL;
    const sy = pal.sunY;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130);
    glow.addColorStop(0, pal.sun);
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 140, sy - 140, 280, 280);
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  if (game.timeOfDay === 'night') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 197.3) % VIEW_W;
      const sy = (i * 89.7) % 200;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }
  if (game.timeOfDay !== 'night') {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 271 + game.time * 3) % (VIEW_W + 240)) - 120;
      const cy = 56 + (i * 43) % 110;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 52, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Distant skyline silhouettes along the horizon.
  ctx.fillStyle = pal.top;
  for (let i = 0; i < 26; i++) {
    const bx = (i * 53) % VIEW_W;
    const bh = 24 + ((i * 37) % 60);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(bx, HORIZON + 34 - bh, 34, bh);
  }
  ctx.globalAlpha = 1;
}

function drawBuilding(ctx, game, b, pal) {
  const cam = game.camera;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.d / 2;
  const cc = toCam(cam, cx, cy, 0);
  if (cc.fwd < NEAR || cc.fwd > 1500 || Math.abs(cc.side) / cc.fwd > 1.7) return;
  const x0 = b.x, x1 = b.x + b.w, y0 = b.y, y1 = b.y + b.d, h = b.h;
  const faces = [
    { pts: [[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]], shade: 1.0, ny: 1 },
    { pts: [[x1, y0, 0], [x0, y0, 0], [x0, y0, h], [x1, y0, h]], shade: 0.72, ny: -1 },
    { pts: [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], shade: 0.86, nx: 1 },
    { pts: [[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], shade: 0.86, nx: -1 },
  ];
  for (const f of faces) {
    const midX = (f.pts[0][0] + f.pts[1][0]) / 2;
    const midY = (f.pts[0][1] + f.pts[1][1]) / 2;
    const toward = (f.nx ? (cam.x - midX) * f.nx : 0) + (f.ny ? (cam.y - midY) * f.ny : 0);
    if (toward <= 0) continue;
    const sp = projectPoly(cam, f.pts);
    if (!sp) continue;
    fillPoly(ctx, sp, shade(b.wall, f.shade * (game.timeOfDay === 'night' ? 0.55 : 1)));
    // Lit windows: a seeded grid on the face, brighter at night.
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(2, Math.floor(h / 28));
    const litChance = game.timeOfDay === 'night' ? 0.75 : 0.42;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = (b.litSeed + r * 31 + c * 17) % 100;
        if (seed >= litChance * 100) continue;
        const u = (c + 0.5) / cols;
        const v = 0.22 + (r + 0.5) / rows * 0.68;
        const wx = f.pts[0][0] + (f.pts[1][0] - f.pts[0][0]) * u;
        const wy = f.pts[0][1] + (f.pts[1][1] - f.pts[0][1]) * u;
        const wz = h * v;
        const wp = toCam(cam, wx, wy, wz);
        if (wp.fwd < NEAR) continue;
        const s = toScreen(wp);
        const ws = Math.max(2, 8 * FOCAL / wp.fwd);
        ctx.fillStyle = game.timeOfDay === 'night' ? '#ffd76a' : '#ffe9a8';
        ctx.fillRect(s.x - ws / 2, s.y - ws / 2, ws, ws * 1.3);
      }
    }
  }
  const roof = projectPoly(cam, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]]);
  if (roof) fillPoly(ctx, roof, shade(b.roof, game.timeOfDay === 'night' ? 0.5 : 1));
}

function drawPalm(ctx, game, palm) {
  const cam = game.camera;
  const base = toCam(cam, palm.x, palm.y, 0);
  if (base.fwd < NEAR || base.fwd > 1200 || Math.abs(base.side) / base.fwd > 1.6) return;
  const s = toScreen(base);
  const top = toScreen(toCam(cam, palm.x + palm.lean * palm.h, palm.y, palm.h));
  const k = FOCAL / base.fwd;
  ctx.strokeStyle = '#7a5230';
  ctx.lineWidth = Math.max(1.5, 3.5 * k);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  ctx.strokeStyle = game.timeOfDay === 'night' ? '#1f4d2e' : '#2f8f4e';
  ctx.lineWidth = Math.max(1.5, 3 * k);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const len = 22 * k;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(top.x + Math.cos(a) * len, top.y + Math.sin(a) * len * 0.55 + 4);
    ctx.stroke();
  }
}

function drawCarBox(ctx, game, car, isPlayer) {
  const cam = game.camera;
  const cc = toCam(cam, car.x, car.y, 0);
  if (cc.fwd < NEAR || cc.fwd > 1300 || Math.abs(cc.side) / cc.fwd > 1.6) return;
  const L = 34;
  const Wd = 16;
  const H = 20;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const px = -fy;
  const py = fx;
  const corners = (z) => [
    [car.x + fx * L + px * Wd, car.y + fy * L + py * Wd, z],
    [car.x + fx * L - px * Wd, car.y + fy * L - py * Wd, z],
    [car.x - fx * L - px * Wd, car.y - fy * L - py * Wd, z],
    [car.x - fx * L + px * Wd, car.y - fy * L + py * Wd, z],
  ];
  const body = car.driver === 'police' ? '#e8e8e8' : car.color;
  const bottom = corners(2);
  const top = corners(H);
  // Side faces: front, left, right — whichever face the camera sees.
  const faces = [
    { pts: [bottom[0], bottom[1], top[1], top[0]], shade: 1.0 },
    { pts: [bottom[1], bottom[2], top[2], top[1]], shade: 0.78 },
    { pts: [bottom[2], bottom[3], top[3], top[2]], shade: 0.85 },
    { pts: [bottom[3], bottom[0], top[0], top[3]], shade: 0.72 },
  ];
  for (const f of faces) {
    const sp = projectPoly(cam, f.pts);
    if (sp) fillPoly(ctx, sp, shade(body, f.shade));
  }
  const roof = projectPoly(cam, [[car.x + fx * 16 + px * 12, car.y + fy * 16 + py * 12, H + 8], [car.x + fx * 16 - px * 12, car.y + fy * 16 - py * 12, H + 8], [car.x - fx * 18 - px * 12, car.y - fy * 18 - py * 12, H + 8], [car.x - fx * 18 + px * 12, car.y - fy * 18 + py * 12, H + 8]]);
  if (roof) fillPoly(ctx, roof, shade(body, 1.12));
  // Rear window: a dark band across the roof's back half.
  const rearWin = projectPoly(cam, [[car.x - fx * 6 + px * 11, car.y - fy * 6 + py * 11, H + 9], [car.x - fx * 6 - px * 11, car.y - fy * 6 - py * 11, H + 9], [car.x - fx * 18 - px * 11, car.y - fy * 18 - py * 11, H + 9], [car.x - fx * 18 + px * 11, car.y - fy * 18 + py * 11, H + 9]]);
  if (rearWin) fillPoly(ctx, rearWin, '#1c2733');
  // Windshield: a darker quad on the nose.
  const shield = projectPoly(cam, [[car.x + fx * L + px * Wd, car.y + fy * L + py * Wd, 6], [car.x + fx * L - px * Wd, car.y + fy * L - py * Wd, 6], [car.x + fx * (L - 12) - px * Wd, car.y + fy * (L - 12) - py * Wd, H], [car.x + fx * (L - 12) + px * Wd, car.y + fy * (L - 12) + py * Wd, H]]);
  if (shield) fillPoly(ctx, shield, '#1c2733');
  // Taillights: two red quads on the rear face.
  for (const s of [-0.55, 0.55]) {
    const rcx = car.x - fx * L + px * Wd * s;
    const rcy = car.y - fy * L + py * Wd * s;
    const light = projectPoly(cam, [[rcx - px * 5, rcy - py * 5, 8], [rcx + px * 5, rcy + py * 5, 8], [rcx + px * 5, rcy + py * 5, 14], [rcx - px * 5, rcy - py * 5, 14]]);
    if (light) fillPoly(ctx, light, '#e83a3a');
  }
  // Wheels: small dark blocks at the four bottom corners.
  for (const [wx, wy] of [[L * 0.68, Wd], [L * 0.68, -Wd], [-L * 0.68, Wd], [-L * 0.68, -Wd]]) {
    const wcx = car.x + fx * wx + px * wy;
    const wcy = car.y + fy * wx + py * wy;
    const wp = toCam(cam, wcx, wcy, 5);
    if (wp.fwd < NEAR) continue;
    const sp = toScreen(wp);
    const ws = Math.max(2, 4.5 * FOCAL / wp.fwd);
    ctx.fillStyle = '#14141a';
    ctx.fillRect(sp.x - ws / 2, sp.y - ws / 2, ws, ws * 0.7);
  }
  if (car.driver === 'police') {
    const bar = projectPoly(cam, [[car.x - px * 10, car.y - py * 10, H + 9], [car.x + px * 10, car.y + py * 10, H + 9], [car.x + px * 10, car.y + py * 10, H + 14], [car.x - px * 10, car.y - py * 10, H + 14]]);
    if (bar) fillPoly(ctx, bar, Math.floor(game.time * 6) % 2 === 0 ? '#e83a3a' : '#3a6fe8');
  }
  if (isPlayer) {
    const s = toScreen(cc);
    ctx.strokeStyle = 'rgba(255,215,106,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 10, Math.max(10, 30 * FOCAL / cc.fwd), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (car.marker) {
    const s = toScreen(toCam(cam, car.x, car.y, 60));
    const bob = Math.sin(game.time * 3) * 6;
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼', s.x, s.y + bob - 18);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('STEAL', s.x, s.y + bob - 40);
  }
}

function drawFigure(ctx, game, x, y, shirt, scaleMul) {
  const cam = game.camera;
  const base = toCam(cam, x, y, 0);
  if (base.fwd < NEAR || base.fwd > 900 || Math.abs(base.side) / base.fwd > 1.6) return;
  const s = toScreen(base);
  const k = (FOCAL / base.fwd) * (scaleMul || 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, 11 * k, 4 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.fillRect(s.x - 5.5 * k, s.y - 30 * k, 11 * k, 20 * k);
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(s.x, s.y - 35 * k, 6 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#232028';
  ctx.fillRect(s.x - 5.5 * k, s.y - 10 * k, 4.5 * k, 10 * k);
  ctx.fillRect(s.x + 1 * k, s.y - 10 * k, 4.5 * k, 10 * k);
}

function drawHeli(ctx, game) {
  const heli = game.police.heli;
  if (!heli.active) return;
  const cam = game.camera;
  const hp = toCam(cam, heli.x, heli.y, 300);
  if (hp.fwd < NEAR) return;
  const s = toScreen(hp);
  const k = Math.max(0.5, FOCAL / hp.fwd / 14);
  // Spotlight cone down to Rico.
  const ground = toScreen(toCam(cam, game.player.x, game.player.y, 0));
  ctx.fillStyle = 'rgba(255,240,170,0.20)';
  ctx.beginPath();
  ctx.moveTo(s.x - 8 * k, s.y + 6 * k);
  ctx.lineTo(ground.x - 70, ground.y);
  ctx.lineTo(ground.x + 70, ground.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,170,0.35)';
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, 62, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body and spinning rotor.
  ctx.fillStyle = '#22303e';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, 26 * k, 10 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34,48,62,0.9)';
  ctx.lineWidth = 3 * k;
  const ra = heli.angle;
  ctx.beginPath();
  ctx.moveTo(s.x - Math.cos(ra) * 44 * k, s.y - Math.sin(ra) * 6 * k);
  ctx.lineTo(s.x + Math.cos(ra) * 44 * k, s.y + Math.sin(ra) * 6 * k);
  ctx.stroke();
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold ${Math.round(13 * k)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('AIR ONE', s.x, s.y - 18 * k);
}

export function renderScene(ctx, game) {
  const pal = PALETTES[game.timeOfDay] || PALETTES.dusk;
  const cam = game.camera;
  drawSky(ctx, game, pal);

  // The ground slab: the whole city floor, sand under everything.
  const slab = projectPoly(cam, [[100, 100, 0], [2500, 100, 0], [2500, 1700, 0], [100, 1700, 0]]);
  if (slab) fillPoly(ctx, slab, pal.ground);

  const items = [];
  for (const q of groundQuads()) {
    const cx = (q.pts[0][0] + q.pts[2][0]) / 2;
    const cy = (q.pts[0][1] + q.pts[2][1]) / 2;
    const cc = toCam(cam, cx, cy, 0);
    if (cc.fwd < NEAR || cc.fwd > 1500 || Math.abs(cc.side) / cc.fwd > 1.7) continue;
    items.push({
      d: cc.fwd,
      fn: () => {
        const sp = projectPoly(cam, q.pts.map(([x, y]) => [x, y, 0]));
        if (!sp) return;
        fillPoly(ctx, sp, pal.road);
        // Dashed centre line: the longer axis of the quad, drawn in three dashes.
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const ab = [mid(q.pts[0], q.pts[1]), mid(q.pts[2], q.pts[3])];
        const cd = [mid(q.pts[3], q.pts[0]), mid(q.pts[1], q.pts[2])];
        const dab = Math.hypot(ab[0][0] - ab[1][0], ab[0][1] - ab[1][1]);
        const dcd = Math.hypot(cd[0][0] - cd[1][0], cd[0][1] - cd[1][1]);
        const axis = dab >= dcd ? ab : cd;
        const p0 = projectPoint(cam, axis[0][0], axis[0][1], 1);
        const p1 = projectPoint(cam, axis[1][0], axis[1][1], 1);
        if (p0 && p1) {
          ctx.strokeStyle = 'rgba(247,201,72,0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([14, 18]);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      },
    });
  }
  for (const b of game.city.buildings) {
    const cc = toCam(cam, b.x + b.w / 2, b.y + b.d / 2, 0);
    if (cc.fwd < NEAR || cc.fwd > 1500 || Math.abs(cc.side) / cc.fwd > 1.7) continue;
    items.push({ d: cc.fwd, fn: () => drawBuilding(ctx, game, b, pal) });
  }
  for (const palm of game.city.palms) {
    const cc = toCam(cam, palm.x, palm.y, 0);
    if (cc.fwd < NEAR || cc.fwd > 1200 || Math.abs(cc.side) / cc.fwd > 1.6) continue;
    items.push({ d: cc.fwd, fn: () => drawPalm(ctx, game, palm) });
  }
  const allCars = [...game.cars, ...game.traffic.cars];
  for (const car of allCars) {
    const cc = toCam(cam, car.x, car.y, 0);
    if (cc.fwd < 90 || cc.fwd > 1300 || Math.abs(cc.side) / cc.fwd > 1.6) continue;
    items.push({ d: cc.fwd, fn: () => drawCarBox(ctx, game, car, car.id === game.player.carId) });
  }
  for (const ped of game.traffic.peds) {
    const cc = toCam(cam, ped.x, ped.y, 0);
    if (cc.fwd < NEAR || cc.fwd > 900 || Math.abs(cc.side) / cc.fwd > 1.6) continue;
    items.push({ d: cc.fwd, fn: () => drawFigure(ctx, game, ped.x, ped.y, ped.shirt, 0.9) });
  }
  if (game.player.onFoot) {
    const cc = toCam(cam, game.player.x, game.player.y, 0);
    if (cc.fwd >= NEAR) items.push({ d: cc.fwd, fn: () => drawFigure(ctx, game, game.player.x, game.player.y, '#e8543d', 1.15) });
  }
  // The next mission's marker floats over its start point.
  if (!game.mission && game.missionsDone < 8) {
    const next = game.missionDefs[game.missionsDone];
    const first = next.objectives[0];
    const cc = toCam(cam, first.x, first.y, 0);
    if (cc.fwd >= NEAR && cc.fwd < 1400) {
      items.push({
        d: cc.fwd,
        fn: () => {
          const s = toScreen(toCam(cam, first.x, first.y, 130 + Math.sin(game.time * 2.5) * 10));
          ctx.fillStyle = '#ffd76a';
          ctx.font = 'bold 30px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('M', s.x, s.y);
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 4;
          ctx.strokeText('M', s.x, s.y);
          ctx.fillStyle = '#ffd76a';
          ctx.fillText('M', s.x, s.y);
        },
      });
    }
  }
  for (const b of game.combat.bullets) {
    const cc = toCam(cam, b.x, b.y, 0);
    if (cc.fwd < NEAR) continue;
    items.push({
      d: cc.fwd,
      fn: () => {
        const s = toScreen(cc);
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      },
    });
  }

  items.sort((a, b) => b.d - a.d);
  for (const it of items) it.fn();

  drawHeli(ctx, game);

  // A warm haze over the horizon so the far city melts into the sky.
  const haze = ctx.createLinearGradient(0, HORIZON - 60, 0, HORIZON + 90);
  haze.addColorStop(0, 'rgba(255,255,255,0)');
  haze.addColorStop(1, pal.fog);
  ctx.fillStyle = haze;
  ctx.fillRect(0, HORIZON - 60, VIEW_W, 150);
}
