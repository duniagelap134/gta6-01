// SOLMAR — the city itself, grown from the seed: every block between the
// roads gets buildings, every road gets palms, and the map is split into
// named districts so the HUD always knows where Rico is.
import { CFG } from './config.js';
import { mulberry32, range, rangeInt, pick } from './rng.js';

const BUILDING_HUES = [
  { wall: '#e8b04b', roof: '#b97f2e' },
  { wall: '#d97b5f', roof: '#a34d38' },
  { wall: '#7fb3a8', roof: '#4d7f74' },
  { wall: '#e8dcc8', roof: '#b3a586' },
  { wall: '#c96f8e', roof: '#96455f' },
  { wall: '#8fa8d8', roof: '#5d74a8' },
  { wall: '#f2e3c2', roof: '#c2a878' },
];

export function districtAt(x, y) {
  for (const d of CFG.districts) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'SOLMAR';
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];
  const xs = CFG.roadsX;
  const ys = CFG.roadsY;
  const half = CFG.roadWidth / 2 + 26;

  // One or two buildings per block, kept off the roads.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + half;
      const x1 = xs[i + 1] - half;
      const y0 = ys[j] + half;
      const y1 = ys[j + 1] - half;
      const count = rangeInt(rng, 1, 2);
      for (let k = 0; k < count; k++) {
        const w = range(rng, 90, Math.max(100, (x1 - x0) / count - 30));
        const d = range(rng, 80, Math.max(90, (y1 - y0) - 40));
        const bx = x0 + 10 + (k * (x1 - x0)) / count + range(rng, 0, 20);
        const by = y0 + 10 + range(rng, 0, Math.max(0, y1 - y0 - d - 20));
        const hue = pick(rng, BUILDING_HUES);
        buildings.push({
          x: Math.min(bx, x1 - w),
          y: Math.min(by, y1 - d),
          w,
          d,
          h: range(rng, 70, 230),
          wall: hue.wall,
          roof: hue.roof,
          litSeed: rangeInt(rng, 0, 99999),
        });
      }
    }
  }

  // Palms line both sides of every road, denser on the boulevards.
  for (const rx of xs) {
    for (let y = 140; y < CFG.world.h - 100; y += 130) {
      if (range(rng, 0, 1) < 0.75) palms.push({ x: rx - half - 18, y: y + range(rng, -20, 20), h: range(rng, 45, 70), lean: range(rng, -0.25, 0.25) });
      if (range(rng, 0, 1) < 0.75) palms.push({ x: rx + half + 18, y: y + 60 + range(rng, -20, 20), h: range(rng, 45, 70), lean: range(rng, -0.25, 0.25) });
    }
  }
  for (const ry of ys) {
    for (let x = 160; x < CFG.world.w - 100; x += 150) {
      if (range(rng, 0, 1) < 0.6) palms.push({ x: x + range(rng, -20, 20), y: ry - half - 18, h: range(rng, 45, 70), lean: range(rng, -0.25, 0.25) });
    }
  }

  return { buildings, palms, roadsX: xs, roadsY: ys };
}

// The ground is drawn as one sand-coloured slab plus road strips cut
// into segments between intersections, so the painter can sort them.
export function groundQuads() {
  const quads = [];
  const W = CFG.world.w;
  const H = CFG.world.h;
  const hw = CFG.roadWidth / 2;
  for (const rx of CFG.roadsX) {
    let prev = 100;
    for (const ry of [...CFG.roadsY, H - 100]) {
      quads.push({ kind: 'road', pts: [[rx - hw, prev], [rx + hw, prev], [rx + hw, ry], [rx - hw, ry]] });
      prev = ry;
    }
  }
  for (const ry of CFG.roadsY) {
    let prev = 100;
    for (const rx of [...CFG.roadsX, W - 100]) {
      quads.push({ kind: 'road', pts: [[prev, ry - hw], [rx, ry - hw], [rx, ry + hw], [prev, ry + hw]] });
      prev = rx;
    }
  }
  return quads;
}
