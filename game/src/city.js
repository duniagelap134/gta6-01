// SOLMAR's map: roads, blocks, buildings, parks, beach and marina.
// The city is generated once from a seed, so every session plays the
// same streets. Buildings are drawn with a fake 2.5D extrusion (roof
// shifted up, sunlit south and east faces) over a top-down plan.
import { WORLD_W, WORLD_H, ROAD_W, V_ROADS, H_ROADS, SEA_X, BEACH_X, MARINA_X, PALETTE } from './config.js';
import { mulberry32, pick, range, rangeInt } from './rng.js';

const ROOFS = [
  [PALETTE.roofA, PALETTE.wallA],
  [PALETTE.roofB, PALETTE.wallB],
  [PALETTE.roofC, PALETTE.wallC],
  [PALETTE.roofD, PALETTE.wallD],
  [PALETTE.roofE, PALETTE.wallE],
];
const DISTRICTS = [
  { name: 'Old Port', x0: 190, y0: 0, x1: 700, y1: 1800 },
  { name: 'Downtown', x0: 700, y0: 0, x1: 1500, y1: 1800 },
  { name: 'Palms', x0: 1500, y0: 700, x1: 2480, y1: 1800 },
  { name: 'Marina', x0: 1500, y0: 0, x1: 2480, y1: 700 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmar';
}

export function buildCity(seed) {
  const random = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  // One building (or a park) per block between roads.
  for (let vi = 0; vi < V_ROADS.length - 1; vi += 1) {
    for (let hi = 0; hi < H_ROADS.length - 1; hi += 1) {
      const x0 = V_ROADS[vi] + ROAD_W / 2 + 14;
      const x1 = V_ROADS[vi + 1] - ROAD_W / 2 - 14;
      const y0 = H_ROADS[hi] + ROAD_W / 2 + 14;
      const y1 = H_ROADS[hi + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (random() < 0.2) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 9, 15) });
        }
        continue;
      }
      const count = rangeInt(random, 1, 2);
      for (let b = 0; b < count; b += 1) {
        const w = range(random, 90, (x1 - x0) / count - 24);
        const h = range(random, 70, y1 - y0 - 24);
        const x = x0 + (b * (x1 - x0)) / count + range(random, 6, 20);
        const y = y0 + range(random, 6, Math.max(7, y1 - y0 - h - 6));
        const colors = pick(random, ROOFS);
        buildings.push({
          x, y, w, h,
          height: range(random, 26, 110),
          roof: colors[0],
          wall: colors[1],
          name: '',
        });
      }
      if (random() < 0.5) {
        trees.push({ x: range(random, x0 + 16, x1 - 16), y: range(random, y0 + 16, y1 - 16), r: range(random, 9, 14) });
      }
    }
  }
  // Landmarks: the Solmar Tower downtown, the stadium in Palms, the
  // casino on the marina strip. Tallest roofs in the city.
  const tower = { x: 1180, y: 780, w: 150, h: 120, height: 190, roof: '#e8e2d2', wall: '#7d7462', name: 'Solmar Tower' };
  buildings.push(tower);
  buildings.push({ x: 2050, y: 1250, w: 220, h: 150, height: 46, roof: '#c9d6c2', wall: '#5f7a58', name: 'Solmar Stadium' });
  buildings.push({ x: 1980, y: 330, w: 190, h: 110, height: 84, roof: '#e8b64c', wall: '#8a6a24', name: 'Marina Casino' });
  // Palm-lined beach promenade.
  for (let y = 60; y < WORLD_H; y += 130) {
    trees.push({ x: 205, y, r: 12 });
  }
  return { seed, buildings, parks, trees, tower };
}

export function onRoad(x, y) {
  for (const rx of V_ROADS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of H_ROADS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of V_ROADS) {
    for (const ry of H_ROADS) {
      const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
      if (d < bestD) {
        bestD = d;
        best = { x: rx, y: ry };
      }
    }
  }
  return best;
}

// Circle (x, y, r) against buildings, sea, marina water and the map edge.
export function collidesWithCity(city, x, y, r) {
  if (x < SEA_X + r || x > MARINA_X - r || y < r || y > WORLD_H - r) return true;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Push a circle out of whatever it overlaps; returns true if it hit.
export function resolveCityCollision(city, body, r) {
  let hit = false;
  if (body.x < SEA_X + r) { body.x = SEA_X + r; hit = true; }
  if (body.x > MARINA_X - r) { body.x = MARINA_X - r; hit = true; }
  if (body.y < r) { body.y = r; hit = true; }
  if (body.y > WORLD_H - r) { body.y = WORLD_H - r; hit = true; }
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * r;
        body.y = cy + (dy / d) * r;
      } else {
        body.y = b.y + b.h + r;
      }
    }
  }
  return hit;
}

function drawBuilding(ctx, b, night) {
  const lift = b.height * 0.45;
  const dx = -lift * 0.25;
  const dy = -lift;
  // Shadow on the ground.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x + 6, b.y + b.h - 4, b.w, 10);
  // South face and east face (darker), then the sunlit roof.
  ctx.fillStyle = b.wall;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.h);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.w + dx, b.y + b.h + dy);
  ctx.lineTo(b.x + dx, b.y + b.h + dy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(b.wall, -18);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.lineTo(b.x + b.w + dx, b.y + b.h + dy);
  ctx.lineTo(b.x + b.w + dx, b.y + dy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = night ? shade(b.roof, -35) : b.roof;
  ctx.fillRect(b.x + dx, b.y + dy, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + dx, b.y + dy, b.w, b.h);
  // Roof details: a lighter inner slab and, at night, lit windows.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(b.x + dx + 8, b.y + dy + 8, b.w - 16, Math.max(6, b.h * 0.25));
  if (night) {
    ctx.fillStyle = 'rgba(255,214,120,0.85)';
    for (let wx = b.x + dx + 14; wx < b.x + dx + b.w - 14; wx += 26) {
      for (let wy = b.y + dy + 14; wy < b.y + dy + b.h - 14; wy += 26) {
        if ((wx * 7 + wy * 13) % 5 < 2) ctx.fillRect(wx, wy, 7, 9);
      }
    }
  }
  if (b.name) {
    ctx.fillStyle = night ? '#e8e2d2' : '#2b2b2b';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, b.x + b.w / 2 + dx, b.y + dy - 8);
    ctx.textAlign = 'left';
  }
}

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

export function drawCity(ctx, city, cam, night) {
  const x0 = cam.x - 40;
  const y0 = cam.y - 40;
  const x1 = cam.x + cam.w + 40;
  const y1 = cam.y + cam.h + 40;
  // Ground.
  ctx.fillStyle = night ? '#1d2b1e' : PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Sea (west) and marina (east).
  ctx.fillStyle = night ? '#0e2a44' : PALETTE.sea;
  ctx.fillRect(x0, y0, Math.max(0, SEA_X - x0), y1 - y0);
  ctx.fillRect(Math.max(x0, MARINA_X), y0, Math.max(0, x1 - Math.max(x0, MARINA_X)), y1 - y0);
  ctx.fillStyle = night ? '#123a5e' : PALETTE.seaDeep;
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.fillRect(x0, y, Math.max(0, SEA_X - 30 - x0), 4);
  }
  // Beach sand.
  ctx.fillStyle = night ? '#8a7a55' : PALETTE.sand;
  ctx.fillRect(Math.max(x0, SEA_X), y0, Math.min(x1, BEACH_X) - Math.max(x0, SEA_X), y1 - y0);
  // Parks.
  for (const p of city.parks) {
    if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
    ctx.fillStyle = night ? '#24401f' : PALETTE.grassDark;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Roads: asphalt, sidewalk border, centre dashes.
  ctx.fillStyle = night ? '#23242a' : PALETTE.asphalt;
  for (const rx of V_ROADS) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const ry of H_ROADS) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
  ctx.strokeStyle = night ? '#3a3b42' : PALETTE.sidewalk;
  ctx.lineWidth = 6;
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2, y0); ctx.lineTo(rx - ROAD_W / 2, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2, y0); ctx.lineTo(rx + ROAD_W / 2, y1); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(x0, ry - ROAD_W / 2); ctx.lineTo(x1, ry - ROAD_W / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, ry + ROAD_W / 2); ctx.lineTo(x1, ry + ROAD_W / 2); ctx.stroke();
  }
  ctx.strokeStyle = night ? '#8a7a3a' : PALETTE.line;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(rx, y0); ctx.lineTo(rx, y1); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = night ? '#55565e' : '#e8e4d2';
  for (const rx of V_ROADS) {
    for (const ry of H_ROADS) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(rx + i * 12 - 4, ry - ROAD_W / 2 + 6, 8, 14);
        ctx.fillRect(rx + i * 12 - 4, ry + ROAD_W / 2 - 20, 8, 14);
      }
    }
  }
  // Buildings, sorted so taller southern ones draw over northern ones.
  const visible = city.buildings.filter((b) => b.x < x1 && b.x + b.w > x0 && b.y < y1 + 220 && b.y + b.h > y0 - 220);
  visible.sort((a, b) => a.y - b.y);
  for (const b of visible) drawBuilding(ctx, b, night);
  // Trees (palm dots with a shadow).
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = night ? '#1e4a26' : '#2f7a3d';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = night ? '#2c5c31' : '#4a9a4d';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  // City labels.
  ctx.fillStyle = night ? 'rgba(232,226,210,0.75)' : 'rgba(43,43,43,0.6)';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('OLD PORT', 330, 190);
  ctx.fillText('DOWNTOWN', 1080, 190);
  ctx.fillText('MARINA', 2050, 190);
  ctx.fillText('PALMS', 1700, 1620);
  ctx.fillText('SOLMAR BEACH', 40, 1620);
}
