// SOLMAR's map: roads, blocks, buildings, parks, beach and marina.
// The city is generated once from a seed, so every session plays the
// same streets. Buildings are boxes (footprint + height) with a roof
// and wall colour; the 3D renderer in render3d.js turns each box into
// perspective faces with lit windows, and the palms into trunks with
// fronds. Collision and the road grid are unchanged from v1.
import { WORLD_W, WORLD_H, ROAD_W, V_ROADS, H_ROADS, SEA_X, BEACH_X, MARINA_X, PALETTE, DISTRICTS } from './config.js';
import { mulberry32, pick, range, rangeInt } from './rng.js';

const ROOFS = [
  [PALETTE.roofA, PALETTE.wallA],
  [PALETTE.roofB, PALETTE.wallB],
  [PALETTE.roofC, PALETTE.wallC],
  [PALETTE.roofD, PALETTE.wallD],
  [PALETTE.roofE, PALETTE.wallE],
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return { name: 'Solmar', street: 'Coast Road' };
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
          // A stable per-building seed for the renderer's lit windows.
          wseed: Math.floor(random() * 100000),
        });
      }
      if (random() < 0.5) {
        trees.push({ x: range(random, x0 + 16, x1 - 16), y: range(random, y0 + 16, y1 - 16), r: range(random, 9, 14) });
      }
    }
  }
  // Landmarks: the Solmar Tower downtown, the stadium in Palms, the
  // casino on the marina strip. Tallest roofs in the city.
  const tower = { x: 1180, y: 780, w: 150, h: 120, height: 190, roof: '#e8e2d2', wall: '#7d7462', name: 'Solmar Tower', wseed: 11 };
  buildings.push(tower);
  buildings.push({ x: 2050, y: 1250, w: 220, h: 150, height: 46, roof: '#c9d6c2', wall: '#5f7a58', name: 'Solmar Stadium', wseed: 23 });
  buildings.push({ x: 1980, y: 330, w: 190, h: 110, height: 84, roof: '#e8b64c', wall: '#8a6a24', name: 'Marina Casino', wseed: 37 });
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

// Shade a hex colour by an amount (-255..255). Used by the renderer
// to light the sun side of a wall and darken the shaded side.
export function shade(hex, amount) {
  // Accepts '#rrggbb' and the 'rgb(r,g,b)' a previous shade() call
  // returns — shading an rgb() string used to produce NaN and paint
  // the car black at night.
  let r;
  let g;
  let b;
  if (hex.startsWith('rgb')) {
    [r, g, b] = hex.slice(4, -1).split(',').map((v) => parseInt(v.trim(), 10));
  } else {
    const n = parseInt(hex.slice(1), 16);
    r = n >> 16;
    g = (n >> 8) & 0xff;
    b = n & 0xff;
  }
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return `rgb(${r},${g},${b})`;
}

// Blend two hex colours by t (0 = a, 1 = b). The renderer tints the
// whole city warm at golden hour and cold at night.
export function mixHex(a, b, t) {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const r = Math.round(((na >> 16) & 0xff) + (((nb >> 16) & 0xff) - ((na >> 16) & 0xff)) * t);
  const g = Math.round(((na >> 8) & 0xff) + (((nb >> 8) & 0xff) - ((na >> 8) & 0xff)) * t);
  const bl = Math.round((na & 0xff) + ((nb & 0xff) - (na & 0xff)) * t);
  return `rgb(${r},${g},${bl})`;
}
