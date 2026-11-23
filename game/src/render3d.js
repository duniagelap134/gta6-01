// SOLMAR v2 — the 3D chase renderer. Hand-rolled perspective: a
// camera rides behind Rico (or his car), every world object is a box,
// a billboard or a ground quad, projected with a near-plane clip and
// drawn far-to-near by painter's sort. No library, no network, fully
// deterministic from the seeded city — the same seed draws the same
// frame. The simulation underneath is unchanged from v1 (grid city,
// roads, traffic, police, missions); only the eye moved.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_W, SEA_X, BEACH_X, MARINA_X, CAM_DRIVE_DIST, CAM_DRIVE_HEIGHT, CAM_FOOT_DIST, CAM_FOOT_HEIGHT, CAM_PITCH, CAM_FOV_DEG } from './config.js';
import { shade, mixHex } from './city.js';
import { hash2 } from './rng.js';

const NEAR = 6;
const FAR = 1500;

// Sky / ground palettes by time of day. dayTime 0.30 is morning,
// 0.62 is golden hour, 0.93 is night.
function paletteFor(dayTime) {
  const day = {
    skyTop: '#3d7ac9', skyMid: '#7fb2e8', skyBot: '#cfe8f5', sun: '#fff3c4',
    ground: '#7fae5a', road: '#3d3f45', walk: '#b9b3a4', line: '#e8e4d2',
    warm: 0, dark: 0, night: false, sunY: 300,
  };
  const golden = {
    skyTop: '#5a3a7a', skyMid: '#e86a6a', skyBot: '#ffb347', sun: '#ffd98a',
    ground: '#8a9a4a', road: '#4a4038', walk: '#c9a98a', line: '#f2e2b8',
    warm: 14, dark: 0, night: false, sunY: 130,
  };
  const night = {
    skyTop: '#060a18', skyMid: '#0d1526', skyBot: '#1a2340', sun: '#e8ecf5',
    ground: '#1d2b1e', road: '#23242a', walk: '#3a3b42', line: '#8a7a3a',
    warm: 0, dark: 38, night: true, sunY: 220,
  };
  const mix = (a, b, t) => ({
    skyTop: mixHex(a.skyTop, b.skyTop, t), skyMid: mixHex(a.skyMid, b.skyMid, t),
    skyBot: mixHex(a.skyBot, b.skyBot, t), sun: mixHex(a.sun, b.sun, t),
    ground: mixHex(a.ground, b.ground, t), road: mixHex(a.road, b.road, t),
    walk: mixHex(a.walk, b.walk, t), line: mixHex(a.line, b.line, t),
    warm: a.warm + (b.warm - a.warm) * t, dark: a.dark + (b.dark - a.dark) * t,
    night: b.night, sunY: a.sunY + (b.sunY - a.sunY) * t,
  });
  if (dayTime < 0.45) return day;
  if (dayTime < 0.6) return mix(day, golden, (dayTime - 0.45) / 0.15);
  if (dayTime < 0.75) return golden;
  if (dayTime < 0.85) return mix(golden, night, (dayTime - 0.75) / 0.1);
  return night;
}

// The chase camera: rides behind the player (or the car) at a rigid
// offset along the smoothed heading, so the framing never lags behind
// a fast car. Only the yaw is smoothed — the position follows the
// player exactly, which keeps the car (or Rico) at a fixed size in
// the frame. Called from the update loop.
export function updateChaseCamera(game, dt) {
  const cam = game.camera;
  const driving = !game.player.onFoot;
  const dist = driving ? CAM_DRIVE_DIST : CAM_FOOT_DIST;
  const height = driving ? CAM_DRIVE_HEIGHT : CAM_FOOT_HEIGHT;
  if (cam.snap) {
    cam.yaw = game.player.angle;
    cam.snap = false;
  } else {
    let diff = game.player.angle - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cam.yaw += diff * Math.min(1, dt * 3.2);
  }
  // Rigid offset behind the player along the smoothed heading.
  cam.x = game.player.x - Math.cos(cam.yaw) * dist;
  cam.y = game.player.y - Math.sin(cam.yaw) * dist;
  cam.z = height;
  cam.pitch = CAM_PITCH;
  cam.dist = dist;
  cam.height = height;
}

// Camera-space transform + projection for one frame.
function makeProjector(game) {
  const w = game.viewW;
  const h = game.viewH;
  const cam = game.camera;
  const f = (h * 0.5) / Math.tan((CAM_FOV_DEG * Math.PI) / 360);
  const horizonY = h * 0.5 - Math.tan(cam.pitch) * f;
  const cx = w / 2;
  const cosY = Math.cos(cam.yaw);
  const sinY = Math.sin(cam.yaw);
  // World point -> camera space {d, l, z}; d is forward depth.
  function toCam(x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    return { d: dx * cosY + dy * sinY, l: -dx * sinY + dy * cosY, z };
  }
  // Camera-space point -> screen point (after the near clip).
  function toScreen(p) {
    return { x: cx + (p.l * f) / p.d, y: horizonY - ((p.z - cam.z) * f) / p.d };
  }
  // Clip a camera-space polygon against the near plane; null if gone.
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const aIn = a.d >= NEAR;
      const bIn = b.d >= NEAR;
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (NEAR - a.d) / (b.d - a.d);
        out.push({ d: NEAR, l: a.l + (b.l - a.l) * t, z: a.z + (b.z - a.z) * t });
      }
    }
    return out.length >= 3 ? out : null;
  }
  // World polygon (array of [x, y, z]) -> screen polygon or null.
  function projectPoly(points) {
    const clipped = clipNear(points.map(([x, y, z]) => toCam(x, y, z)));
    if (!clipped) return null;
    return clipped.map(toScreen);
  }
  // Cheap frustum test for an object's centre.
  function visible(x, y, radius) {
    const c = toCam(x, y, 0);
    if (c.d > FAR || c.d < -140) return false;
    if (c.d > 0 && Math.abs(c.l) > c.d * 1.7 + radius) return false;
    return true;
  }
  function depthOf(x, y) {
    return toCam(x, y, 0).d;
  }
  function scaleAt(x, y) {
    const d = Math.max(NEAR, depthOf(x, y));
    return f / d;
  }
  return { w, h, f, horizonY, cx, cam, toCam, toScreen, clipNear, projectPoly, visible, depthOf, scaleAt };
}

// The ground point under a screen pixel (for mouse aim on foot).
export function screenToGround(game, sx, sy) {
  const p = makeProjector(game);
  if (sy <= p.horizonY + 1) return { x: game.camera.x + Math.cos(game.camera.yaw) * FAR, y: game.camera.y + Math.sin(game.camera.yaw) * FAR };
  const d = Math.max(NEAR, (game.camera.z * p.f) / (sy - p.horizonY));
  const l = ((sx - p.cx) * d) / p.f;
  const cosY = Math.cos(game.camera.yaw);
  const sinY = Math.sin(game.camera.yaw);
  return {
    x: game.camera.x + cosY * d - sinY * l,
    y: game.camera.y + sinY * d + cosY * l,
  };
}

// Clock from the day cycle: dayTime 0 is 06:00, a full cycle is 18 h.
export function worldClock(game) {
  const total = (6 + game.dayTime * 18) % 24;
  const hh = Math.floor(total);
  const mm = Math.floor((total - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function fillPoly(ctx, pts, fill) {
  if (!pts || pts.length < 3) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function strokePoly(ctx, pts, stroke, width) {
  if (!pts || pts.length < 3) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();
}

// One frame of the world: sky, ground, roads, buildings, palms, cars,
// people, helicopter, markers, bullets, pickups — far to near.
export function renderWorld(ctx, game) {
  const pal = paletteFor(game.dayTime);
  const P = makeProjector(game);
  const { w, h } = P;
  // Two paint lists: the ground (sea, sand, roads, dashes) always
  // draws first, in insertion order, so a road quad can never paint
  // over a car or a person standing on it; the objects (buildings,
  // palms, cars, people, heli, markers) then paint far to near.
  const draws = [];
  const ground = [];
  const add = (depth, fn) => { draws.push({ depth, fn }); };
  const addGround = (depth, fn) => { ground.push({ depth, fn }); };

  // ---- Sky: gradient, sun or moon, drifting clouds, night stars.
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, P.horizonY + 60));
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(0.55, pal.skyMid);
  sky.addColorStop(1, pal.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, P.horizonY + 60);
  // Sun sits west (-x); its screen x follows the camera yaw.
  const sunDirX = -1;
  const sunDirY = 0.3;
  const sunD = sunDirX * Math.cos(P.cam.yaw) + sunDirY * Math.sin(P.cam.yaw);
  const sunL = -sunDirX * Math.sin(P.cam.yaw) + sunDirY * Math.cos(P.cam.yaw);
  if (sunD > 0.15) {
    const sunX = P.cx + (sunL / sunD) * P.f * 0.85;
    const sunY = P.horizonY - pal.sunY;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
    glow.addColorStop(0, pal.sun);
    glow.addColorStop(0.35, 'rgba(255,180,90,0.35)');
    glow.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, pal.night ? 26 : 40, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pal.night) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i += 1) {
      const sx = (((hash2(i, 7) * w + game.camera.yaw * 40) % w) + w) % w;
      const sy = hash2(i, 13) * P.horizonY * 0.8;
      ctx.fillRect(sx, sy, 2, 2);
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (let i = 0; i < 6; i += 1) {
      const cxp = ((((hash2(i, 3) * 1.4 + game.camera.yaw * 0.12) % 1.4) + 1.4) % 1.4) * w - w * 0.2;
      const cyp = 40 + hash2(i, 5) * (P.horizonY * 0.45);
      ctx.beginPath();
      ctx.ellipse(cxp, cyp, 90 + hash2(i, 9) * 70, 14 + hash2(i, 11) * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Ground base: everything below the horizon starts as grass.
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, P.horizonY, w, h - P.horizonY);

  // ---- Ground quads: sea, sand, marina, parks, roads, sidewalks.
  const groundQuad = (x0, y0, x1, y1, fill, depthBias) => {
    const cxq = (x0 + x1) / 2;
    const cyq = (y0 + y1) / 2;
    const d = P.depthOf(cxq, cyq);
    if (d > FAR || d < -300) return;
    addGround(d + (depthBias || 0), () => {
      fillPoly(ctx, P.projectPoly([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]]), fill);
    });
  };
  const seaCol = pal.night ? '#0e2a44' : '#2f7fb8';
  const sandCol = pal.night ? '#8a7a55' : '#e8d29a';
  for (let y = 0; y < WORLD_H; y += 400) {
    groundQuad(0, y, SEA_X, Math.min(WORLD_H, y + 400), seaCol, 0);
    groundQuad(SEA_X, y, BEACH_X, Math.min(WORLD_H, y + 400), sandCol, 0);
    groundQuad(MARINA_X, y, WORLD_W, Math.min(WORLD_H, y + 400), seaCol, 0);
  }
  for (const park of game.city.parks) {
    groundQuad(park.x, park.y, park.x + park.w, park.y + park.h, pal.night ? '#24401f' : '#6f9c4c', 0);
  }
  // Roads: split into 300-unit segments so the near clip stays honest.
  // `width` is the quad's width across the road (96 for asphalt, 14
  // for a sidewalk strip).
  const roadSeg = (x0, y0, x1, y1, fill, width) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / 300));
    for (let i = 0; i < n; i += 1) {
      const ax0 = x0 + ((x1 - x0) * i) / n;
      const ay0 = y0 + ((y1 - y0) * i) / n;
      const ax1 = x0 + ((x1 - x0) * (i + 1)) / n;
      const ay1 = y0 + ((y1 - y0) * (i + 1)) / n;
      const d = P.depthOf((ax0 + ax1) / 2, (ay0 + ay1) / 2);
      if (d > FAR || d < -200) continue;
      // Expand the segment slightly across its width so the quad is a
      // rectangle perpendicular to the road, not a sliver.
      const perp = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? [0, 1] : [1, 0];
      const hw = width / 2;
      const px = perp[0] * hw;
      const py = perp[1] * hw;
      addGround(d, () => {
        fillPoly(ctx, P.projectPoly([
          [ax0 - px, ay0 - py, 0], [ax1 - px, ay1 - py, 0],
          [ax1 + px, ay1 + py, 0], [ax0 + px, ay0 + py, 0],
        ]), fill);
      });
    }
  };
  for (const rx of V_ROADS) roadSeg(rx, 0, rx, WORLD_H, pal.road, ROAD_W);
  for (const ry of H_ROADS) roadSeg(0, ry, WORLD_W, ry, pal.road, ROAD_W);
  // Sidewalk strips along each road.
  for (const rx of V_ROADS) {
    roadSeg(rx - ROAD_W / 2 - 7, 0, rx - ROAD_W / 2 - 7, WORLD_H, pal.walk, 14);
    roadSeg(rx + ROAD_W / 2 + 7, 0, rx + ROAD_W / 2 + 7, WORLD_H, pal.walk, 14);
  }
  for (const ry of H_ROADS) {
    roadSeg(0, ry - ROAD_W / 2 - 7, WORLD_W, ry - ROAD_W / 2 - 7, pal.walk, 14);
    roadSeg(0, ry + ROAD_W / 2 + 7, WORLD_W, ry + ROAD_W / 2 + 7, pal.walk, 14);
  }
  // Centre dashes on the road ahead: small quads every 60 units.
  const dash = (x, y, vertical) => {
    const d = P.depthOf(x, y);
    if (d < 0 || d > 1100) return;
    const hw = vertical ? 2 : 13;
    const hh = vertical ? 13 : 2;
    addGround(d, () => {
      fillPoly(ctx, P.projectPoly([
        [x - hw, y - hh, 0], [x + hw, y - hh, 0],
        [x + hw, y + hh, 0], [x - hw, y + hh, 0],
      ]), pal.line);
    });
  };
  for (const rx of V_ROADS) {
    for (let y = 60; y < WORLD_H; y += 60) dash(rx, y, true);
  }
  for (const ry of H_ROADS) {
    for (let x = 60; x < WORLD_W; x += 60) dash(x, ry, false);
  }

  // ---- Buildings: boxes with sunlit/shaded walls, roof, lit windows.
  const camPos = { x: P.cam.x, y: P.cam.y, z: P.cam.z };
  const litWindows = [];
  for (const b of game.city.buildings) {
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    if (!P.visible(bcx, bcy, Math.max(b.w, b.h))) continue;
    const depth = P.depthOf(bcx, bcy);
    const base = [
      [b.x, b.y, 0], [b.x + b.w, b.y, 0], [b.x + b.w, b.y + b.h, 0], [b.x, b.y + b.h, 0],
    ];
    const top = base.map(([x, y]) => [x, y, b.height]);
    // Faces: [corners, outward normal, kind].
    const faces = [
      { pts: [base[2], base[3], top[3], top[2]], n: [0, 1], kind: 'wall' }, // south
      { pts: [base[0], base[1], top[1], top[0]], n: [0, -1], kind: 'wall' }, // north
      { pts: [base[1], base[2], top[2], top[1]], n: [1, 0], kind: 'wall' }, // east
      { pts: [base[0], base[3], top[3], top[0]], n: [-1, 0], kind: 'wall' }, // west
      { pts: top, n: [0, 0], kind: 'roof' },
    ];
    for (const face of faces) {
      const fcx = (face.pts[0][0] + face.pts[2][0]) / 2;
      const fcy = (face.pts[0][1] + face.pts[2][1]) / 2;
      if (face.kind === 'wall') {
        const toCam = [(fcx - camPos.x) * face.n[0] + (fcy - camPos.y) * face.n[1], 0];
        if (toCam[0] > 0) continue; // facing away
        // Sun comes from the west: west walls warm, east walls cool.
        const sunSide = face.n[0] < 0 ? 16 : face.n[0] > 0 ? -14 : 0;
        const col = shade(b.wall, pal.dark * -1 + pal.warm + sunSide - (pal.night ? 20 : 0));
        const fdepth = P.depthOf(fcx, fcy);
        add(fdepth, () => {
          fillPoly(ctx, P.projectPoly(face.pts), col);
          strokePoly(ctx, P.projectPoly(face.pts), 'rgba(0,0,0,0.18)', 1);
        });
        // Lit windows on this wall, near enough to see. Low buildings
        // still get one row so no face is ever a bare slab.
        if (fdepth < 850) {
          const u0 = face.pts[0];
          const u1 = face.pts[1];
          const wallLen = Math.hypot(u1[0] - u0[0], u1[1] - u0[1]);
          const cols = Math.max(0, Math.floor((wallLen - 24) / 26));
          const rows = b.height > 30 ? Math.max(1, Math.floor((b.height - 16) / 22)) : 0;
          for (let ci = 0; ci < cols; ci += 1) {
            for (let ri = 0; ri < rows; ri += 1) {
              if (cols * rows > 14 && (ci + ri) % 2 === 1) continue;
              const u = (16 + ci * 26 + 8) / wallLen;
              const v = 14 + ri * 22;
              const wx0 = u0[0] + (u1[0] - u0[0]) * u;
              const wy0 = u0[1] + (u1[1] - u0[1]) * u;
              const wx1 = u0[0] + (u1[0] - u0[0]) * Math.min(1, u + 10 / wallLen);
              const wy1 = u0[1] + (u1[1] - u0[1]) * Math.min(1, u + 10 / wallLen);
              const lit = hash2(b.wseed, ci * 31 + ri * 7) < (pal.night ? 0.6 : 0.55);
              const winCol = lit ? '#ffd98a' : '#4a5a78';
              litWindows.push({ pts: [[wx0, wy0, v], [wx1, wy1, v], [wx1, wy1, v + 10], [wx0, wy0, v + 10]], col: winCol, depth: fdepth - 2 });
            }
          }
        }
      } else {
        const col = shade(b.roof, pal.dark * -1 + pal.warm + (pal.night ? -30 : 8));
        add(depth - 1, () => {
          fillPoly(ctx, P.projectPoly(face.pts), col);
          strokePoly(ctx, P.projectPoly(face.pts), 'rgba(0,0,0,0.2)', 1);
        });
      }
    }
    if (b.name) litWindows.push({ label: b.name, x: bcx, y: bcy, z: b.height + 14, depth: depth - 3 });
  }
  for (const win of litWindows) {
    if (win.label) {
      add(win.depth, () => {
        const s = P.toScreen(P.toCam(win.x, win.y, win.z));
        ctx.fillStyle = pal.night ? '#e8e2d2' : 'rgba(43,43,43,0.85)';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(win.label, s.x, s.y);
        ctx.textAlign = 'left';
      });
    } else {
      add(win.depth, () => fillPoly(ctx, P.projectPoly(win.pts), win.col));
    }
  }

  // ---- Palms: trunk + frond fan, with a ground shadow. Palms closer
  // than ~45 units would blow up across the frame, so skip them.
  for (const t of game.city.trees) {
    if (!P.visible(t.x, t.y, 30)) continue;
    const d = P.depthOf(t.x, t.y);
    if (d < 45) continue;
    const scale = P.scaleAt(t.x, t.y);
    const base = P.toScreen(P.toCam(t.x, t.y, 0));
    const topPt = P.toScreen(P.toCam(t.x, t.y, 30));
    add(d, () => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(base.x + 4, base.y + 2, Math.max(3, 8 * scale * 0.3), Math.max(2, 3 * scale * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.night ? '#4a3524' : '#7a5a3a';
      ctx.lineWidth = Math.max(2, Math.min(14, 3 * scale));
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(topPt.x, topPt.y);
      ctx.stroke();
      ctx.strokeStyle = pal.night ? '#1e4a26' : '#2f7a3d';
      ctx.lineWidth = Math.max(1.5, Math.min(8, 2.2 * scale));
      for (let f = 0; f < 6; f += 1) {
        const a = -Math.PI * 0.92 + (f * Math.PI) / 5.4;
        const len = Math.min(24 * scale, 320);
        ctx.beginPath();
        ctx.moveTo(topPt.x, topPt.y);
        ctx.lineTo(topPt.x + Math.cos(a) * len, topPt.y + Math.sin(a) * len * 0.55);
        ctx.stroke();
      }
    });
  }

  // ---- Cars: body box + cabin, police livery, lights, shadows.
  const drawCar3d = (car) => {
    const d = P.depthOf(car.x, car.y);
    if (d > FAR || d < 8) return; // behind the camera: nothing to draw
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const px = -fy;
    const py = fx;
    const L = car.length;
    const Wd = car.width;
    const corner = (along, side, z) => [
      car.x + fx * along + px * side,
      car.y + fy * along + py * side,
      z,
    ];
    const body = 12;
    const cabLen = L * 0.42;
    const cabOff = -L * 0.04;
    const cabW = Wd * 0.78;
    // Ground shadow first (slightly farther so the body draws over it).
    add(d + 6, () => {
      fillPoly(ctx, P.projectPoly([
        corner(-L / 2 - 3, -Wd / 2 - 3, 0.4), corner(L / 2 + 3, -Wd / 2 - 3, 0.4),
        corner(L / 2 + 3, Wd / 2 + 3, 0.4), corner(-L / 2 - 3, Wd / 2 + 3, 0.4),
      ]), 'rgba(0,0,0,0.28)');
    });
    const bodyCol = pal.night ? shade(car.color, -25) : car.color;
    const faces = [
      { pts: [corner(-L / 2, -Wd / 2, body), corner(L / 2, -Wd / 2, body), corner(L / 2, Wd / 2, body), corner(-L / 2, Wd / 2, body)], col: shade(bodyCol, pal.dark * -1 + 14), kind: 'top' },
      { pts: [corner(L / 2, -Wd / 2, 0), corner(L / 2, Wd / 2, 0), corner(L / 2, Wd / 2, body), corner(L / 2, -Wd / 2, body)], col: shade(bodyCol, pal.dark * -1 - 6), kind: 'front' },
      { pts: [corner(-L / 2, Wd / 2, 0), corner(-L / 2, -Wd / 2, 0), corner(-L / 2, -Wd / 2, body), corner(-L / 2, Wd / 2, body)], col: shade(bodyCol, pal.dark * -1 - 16), kind: 'rear' },
      { pts: [corner(-L / 2, -Wd / 2, 0), corner(L / 2, -Wd / 2, 0), corner(L / 2, -Wd / 2, body), corner(-L / 2, -Wd / 2, body)], col: shade(bodyCol, pal.dark * -1 - 10), kind: 'side' },
      { pts: [corner(L / 2, Wd / 2, 0), corner(-L / 2, Wd / 2, 0), corner(-L / 2, Wd / 2, body), corner(L / 2, Wd / 2, body)], col: shade(bodyCol, pal.dark * -1 - 10), kind: 'side' },
    ];
    for (const face of faces) {
      const fcx = (face.pts[0][0] + face.pts[2][0]) / 2;
      const fcy = (face.pts[0][1] + face.pts[2][1]) / 2;
      const fd = P.depthOf(fcx, fcy);
      add(fd, () => fillPoly(ctx, P.projectPoly(face.pts), face.col));
    }
    // Cabin: glass box on top — top, windshield, rear window, sides.
    const cabTop = body + 9;
    const cabFaces = [
      { pts: [corner(cabOff - cabLen / 2, -cabW / 2, cabTop), corner(cabOff + cabLen / 2, -cabW / 2, cabTop), corner(cabOff + cabLen / 2, cabW / 2, cabTop), corner(cabOff - cabLen / 2, cabW / 2, cabTop)], col: 'rgba(20,26,34,0.9)' },
      { pts: [corner(cabOff + cabLen / 2, -cabW / 2, body), corner(cabOff + cabLen / 2, cabW / 2, body), corner(cabOff + cabLen / 2, cabW / 2, cabTop), corner(cabOff + cabLen / 2, -cabW / 2, cabTop)], col: 'rgba(140,190,220,0.55)' },
      { pts: [corner(cabOff - cabLen / 2, cabW / 2, body), corner(cabOff - cabLen / 2, -cabW / 2, body), corner(cabOff - cabLen / 2, -cabW / 2, cabTop), corner(cabOff - cabLen / 2, cabW / 2, cabTop)], col: 'rgba(20,26,34,0.9)' },
      { pts: [corner(cabOff - cabLen / 2, -cabW / 2, body), corner(cabOff + cabLen / 2, -cabW / 2, body), corner(cabOff + cabLen / 2, -cabW / 2, cabTop), corner(cabOff - cabLen / 2, -cabW / 2, cabTop)], col: 'rgba(30,40,52,0.9)' },
      { pts: [corner(cabOff + cabLen / 2, cabW / 2, body), corner(cabOff - cabLen / 2, cabW / 2, body), corner(cabOff - cabLen / 2, cabW / 2, cabTop), corner(cabOff + cabLen / 2, cabW / 2, cabTop)], col: 'rgba(30,40,52,0.9)' },
    ];
    for (const face of cabFaces) {
      const fcx = (face.pts[0][0] + face.pts[2][0]) / 2;
      const fcy = (face.pts[0][1] + face.pts[2][1]) / 2;
      add(P.depthOf(fcx, fcy) - 1, () => fillPoly(ctx, P.projectPoly(face.pts), face.col));
    }
    // Taillights + plate on the rear face, so the car reads as a car
    // from the chase camera (dim red, bright red when braking).
    const tailCol = car.brakeLight ? '#ff2a22' : '#a01818';
    for (const side of [-1, 1]) {
      const tail = [
        corner(-L / 2 - 0.6, side * (Wd / 2 - 8), 4), corner(-L / 2 - 0.6, side * (Wd / 2 - 2), 4),
        corner(-L / 2 - 0.6, side * (Wd / 2 - 2), 8), corner(-L / 2 - 0.6, side * (Wd / 2 - 8), 8),
      ];
      add(d - 2, () => fillPoly(ctx, P.projectPoly(tail), tailCol));
    }
    const plate = [
      corner(-L / 2 - 0.6, -6, 2), corner(-L / 2 - 0.6, 6, 2),
      corner(-L / 2 - 0.6, 6, 5), corner(-L / 2 - 0.6, -6, 5),
    ];
    add(d - 2, () => fillPoly(ctx, P.projectPoly(plate), '#e8e4d2'));
    if (car.brakeLight) {
      const brake = [
        corner(-L / 2 - 1, -Wd / 2 + 2, 5), corner(-L / 2 - 1, Wd / 2 - 2, 5),
        corner(-L / 2 - 1, Wd / 2 - 2, 9), corner(-L / 2 - 1, -Wd / 2 + 2, 9),
      ];
      add(d - 2, () => fillPoly(ctx, P.projectPoly(brake), '#ff2a22'));
    }
    if (car.type === 'police') {
      // White door band on the flank facing the camera, light bar, glow.
      const side = P.toCam(car.x, car.y, 0).l >= 0 ? 1 : -1;
      const band = [
        corner(-L * 0.3, side * Wd / 2, 3), corner(L * 0.28, side * Wd / 2, 3),
        corner(L * 0.28, side * Wd / 2, 9), corner(-L * 0.3, side * Wd / 2, 9),
      ];
      add(d - 1, () => fillPoly(ctx, P.projectPoly(band), '#e8e4d2'));
      const flash = Math.floor(game.time * 3) % 2 === 0;
      const barCol = flash ? '#ff2a3c' : '#2a6bff';
      const bar = [
        corner(-6, -8, cabTop + 1), corner(6, -8, cabTop + 1),
        corner(6, 8, cabTop + 1), corner(-6, 8, cabTop + 1),
      ];
      add(d - 2, () => {
        fillPoly(ctx, P.projectPoly(bar), barCol);
        const s = P.toScreen(P.toCam(car.x, car.y, cabTop + 6));
        const glow = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 46);
        glow.addColorStop(0, flash ? 'rgba(255,42,60,0.5)' : 'rgba(42,107,255,0.5)');
        glow.addColorStop(1, 'rgba(255,42,60,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(s.x - 48, s.y - 48, 96, 96);
      });
    }
    if (pal.night) {
      // Headlight cones on the road ahead.
      const cone = [
        corner(L / 2, -Wd / 2 + 3, 1), corner(L / 2, Wd / 2 - 3, 1),
        corner(L / 2 + 150, Wd / 2 + 26, 0.4), corner(L / 2 + 150, -Wd / 2 - 26, 0.4),
      ];
      add(d - 3, () => fillPoly(ctx, P.projectPoly(cone), 'rgba(255,240,180,0.10)'));
    }
    if (car.marker) {
      add(d - 4, () => {
        const s = P.toScreen(P.toCam(car.x, car.y, 0));
        const sc = P.scaleAt(car.x, car.y);
        ctx.strokeStyle = '#ffd21f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 34 * sc * 0.4 + 10, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
  };
  for (const car of game.cars) drawCar3d(car);

  // ---- People: billboards (peds, rivals, cops, Rico on foot).
  const drawFigure = (x, y, color, opts) => {
    const d = P.depthOf(x, y);
    if (d > FAR || d < 8) return;
    const scale = P.scaleAt(x, y);
    const foot = P.toScreen(P.toCam(x, y, 0));
    add(d, () => {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(foot.x, foot.y, 9 * scale * 0.3, 3.5 * scale * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      const bw = 15 * scale * 0.8;
      const bh = 22 * scale * 0.8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(foot.x - bw / 2, foot.y - bh - 6 * scale * 0.8, bw, bh, 4);
      ctx.fill();
      // Legs, so the figure reads as a person at close range.
      ctx.fillStyle = '#23232e';
      const lw = 5 * scale * 0.8;
      ctx.fillRect(foot.x - bw / 2 + 1, foot.y - 6 * scale * 0.8, lw, 6 * scale * 0.8);
      ctx.fillRect(foot.x + bw / 2 - 1 - lw, foot.y - 6 * scale * 0.8, lw, 6 * scale * 0.8);
      ctx.fillStyle = '#e8e4d2';
      ctx.beginPath();
      ctx.arc(foot.x, foot.y - bh - 10 * scale * 0.8, 5.5 * scale * 0.8, 0, Math.PI * 2);
      ctx.fill();
      if (opts && opts.gun) {
        const aim = P.toScreen(P.toCam(x + Math.cos(opts.angle) * 26, y + Math.sin(opts.angle) * 26, 12));
        ctx.strokeStyle = '#1c1c1c';
        ctx.lineWidth = Math.max(2, 3 * scale * 0.4);
        ctx.beginPath();
        ctx.moveTo(foot.x, foot.y - bh * 0.6);
        ctx.lineTo(aim.x, aim.y);
        ctx.stroke();
      }
      if (opts && opts.healthBar) {
        const hbw = Math.min(30 * scale * 0.8, 60);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(foot.x - hbw / 2, foot.y - bh - 20 * scale * 0.8, hbw, 5);
        ctx.fillStyle = '#ff5a4e';
        ctx.fillRect(foot.x - hbw / 2, foot.y - bh - 20 * scale * 0.8, hbw * Math.max(0, opts.healthBar), 5);
      }
    });
  };
  for (const ped of game.peds) drawFigure(ped.x, ped.y, pal.night ? '#8a8a8a' : ped.color, null);
  for (const e of game.enemies) {
    drawFigure(e.x, e.y, e.color, { gun: true, angle: e.angle, healthBar: e.health / (e.kind === 'brute' ? 120 : 70) });
  }
  for (const cop of game.cops) {
    drawFigure(cop.x, cop.y, '#20242c', null);
    if (cop.arrestTimer > 0.1) {
      const d = P.depthOf(cop.x, cop.y);
      const scale = P.scaleAt(cop.x, cop.y);
      const foot = P.toScreen(P.toCam(cop.x, cop.y, 0));
      add(d - 1, () => {
        ctx.strokeStyle = '#ffd21f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(foot.x, foot.y - 22 * scale * 0.42, 14 * scale * 0.42, -Math.PI / 2, -Math.PI / 2 + (cop.arrestTimer / 1.4) * Math.PI * 2);
        ctx.stroke();
      });
    }
  }
  if (game.player.onFoot && !game.player.dead) {
    drawFigure(game.player.x, game.player.y, pal.night ? '#1e6f6a' : '#2aa198', { gun: true, angle: game.player.angle });
  }

  // ---- Helicopter with a spotlight cone (wanted 2+ or staged).
  const heli = game.heli;
  if (heli && heli.active) {
    const d = P.depthOf(heli.x, heli.y);
    if (d > FAR && d < -100) { /* out of view */ } else {
      const scale = P.scaleAt(heli.x, heli.y);
      const body = P.toScreen(P.toCam(heli.x, heli.y, heli.z));
      const ground = P.toScreen(P.toCam(heli.x, heli.y, 0));
      add(d - 10, () => {
        // Spotlight cone + bright pool on the street.
        ctx.fillStyle = 'rgba(255,244,190,0.09)';
        ctx.beginPath();
        ctx.moveTo(body.x - 8, body.y + 6);
        ctx.lineTo(ground.x - 70 * scale * 0.3, ground.y);
        ctx.lineTo(ground.x + 70 * scale * 0.3, ground.y);
        ctx.closePath();
        ctx.fill();
        const pool = ctx.createRadialGradient(ground.x, ground.y, 2, ground.x, ground.y, 80 * scale * 0.3);
        pool.addColorStop(0, 'rgba(255,244,190,0.5)');
        pool.addColorStop(1, 'rgba(255,244,190,0)');
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.ellipse(ground.x, ground.y, 80 * scale * 0.3, 26 * scale * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rotor, body, tail.
        const rotorA = game.time * 9;
        ctx.strokeStyle = 'rgba(20,22,28,0.9)';
        ctx.lineWidth = Math.max(2, 3 * scale * 0.3);
        ctx.beginPath();
        ctx.moveTo(body.x - Math.cos(rotorA) * 46 * scale * 0.35, body.y - 10 * scale * 0.35 - Math.sin(rotorA) * 6);
        ctx.lineTo(body.x + Math.cos(rotorA) * 46 * scale * 0.35, body.y - 10 * scale * 0.35 + Math.sin(rotorA) * 6);
        ctx.stroke();
        ctx.fillStyle = '#20242c';
        ctx.beginPath();
        ctx.ellipse(body.x, body.y, 30 * scale * 0.35, 11 * scale * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(140,190,220,0.8)';
        ctx.beginPath();
        ctx.ellipse(body.x + 12 * scale * 0.35, body.y - 2, 10 * scale * 0.35, 5 * scale * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#20242c';
        ctx.lineWidth = Math.max(2, 4 * scale * 0.3);
        ctx.beginPath();
        ctx.moveTo(body.x - 28 * scale * 0.35, body.y);
        ctx.lineTo(body.x - 58 * scale * 0.35, body.y - 8 * scale * 0.35);
        ctx.stroke();
      });
    }
  }

  // ---- Mission markers: pulsing ring, light beam, floating star / M.
  const step = game.mission ? game.mission.def.steps[game.mission.step] : null;
  const markerAt = (x, y, label) => {
    const d = P.depthOf(x, y);
    if (d > FAR || d < -40) return;
    const scale = P.scaleAt(x, y);
    const s = P.toScreen(P.toCam(x, y, 0));
    const top = P.toScreen(P.toCam(x, y, 170));
    const pulse = 1 + Math.sin(game.time * 5) * 0.15;
    add(d - 5, () => {
      ctx.fillStyle = 'rgba(255,210,31,0.14)';
      ctx.beginPath();
      ctx.moveTo(s.x - 12 * scale * 0.4, s.y);
      ctx.lineTo(top.x - 12 * scale * 0.4, top.y);
      ctx.lineTo(top.x + 12 * scale * 0.4, top.y);
      ctx.lineTo(s.x + 12 * scale * 0.4, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffd21f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 42 * pulse * scale * 0.4 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd21f';
      ctx.font = `bold ${Math.max(14, 22 * scale * 0.4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, s.x, s.y + 7);
      ctx.textAlign = 'left';
    });
  };
  if (step) markerAt(step.x, step.y, '★');
  // main.js keeps game.startMarker current (the next mission's M).
  const start = game.startMarker;
  if (start) markerAt(start.x, start.y, 'M');

  // ---- Bullets (tracers) and pickups.
  for (const b of game.bullets) {
    const d = P.depthOf(b.x, b.y);
    if (d > FAR || d < -40) continue;
    const a = P.toScreen(P.toCam(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12, 6));
    const c = P.toScreen(P.toCam(b.x, b.y, 6));
    add(d, () => {
      ctx.strokeStyle = '#ffd21f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    });
  }
  for (const p of game.pickups) {
    const d = P.depthOf(p.x, p.y);
    if (d > FAR || d < -40) continue;
    const scale = P.scaleAt(p.x, p.y);
    const s = P.toScreen(P.toCam(p.x, p.y + Math.sin(p.bob) * 2, 10));
    add(d, () => {
      ctx.fillStyle = p.kind === 'health' ? '#e8e4d2' : p.kind === 'ammo' ? '#2f2f2f' : '#3d6fc9';
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.min(11 * scale * 0.4, 20), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.kind === 'health' ? '#d21f3c' : '#ffd21f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = p.kind === 'health' ? '#d21f3c' : '#ffd21f';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.kind === 'health' ? '+' : p.kind === 'ammo' ? 'A' : 'S', s.x, s.y + 4);
      ctx.textAlign = 'left';
    });
  }

  // ---- Paint: ground first (insertion order), then objects far to
  // near. Items with equal depth keep insertion order.
  for (const item of ground) item.fn(ctx);
  draws.sort((a, b) => b.depth - a.depth);
  for (const item of draws) item.fn(ctx);

  // Night wash over the world (the HUD stays bright, drawn later).
  if (pal.night) {
    ctx.fillStyle = 'rgba(8,12,34,0.22)';
    ctx.fillRect(0, 0, w, h);
  }
}
