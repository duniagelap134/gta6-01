// SOLMAR — the city breathing: traffic cars cruise the road grid and
// pedestrians stroll the sidewalks. All of it is seeded and driven by
// the fixed timestep, so the same moment always looks the same.
import { CFG } from './config.js';
import { mulberry32, range, pick, rangeInt } from './rng.js';
import { makeCar, CAR_NAMES, CAR_COLORS } from './vehicles.js';

export function makeTraffic(seed) {
  const rng = mulberry32(seed);
  const cars = [];
  const peds = [];
  for (let i = 0; i < 11; i++) {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? CFG.roadsX : CFG.roadsY);
    const along = range(rng, 150, (vertical ? CFG.world.h : CFG.world.w) - 150);
    const car = makeCar(pick(rng, CAR_NAMES), vertical ? road : along, vertical ? along : road, vertical ? Math.PI / 2 : 0, 'traffic', pick(rng, CAR_COLORS));
    car.speed = range(rng, 90, 135);
    car.cruise = car.speed;
    car.vertical = vertical;
    car.road = road;
    cars.push(car);
  }
  const shirts = ['#e8e3d8', '#7fb069', '#d97b5f', '#8fa8d8', '#e8b13d', '#c96f8e'];
  for (let i = 0; i < 18; i++) {
    const road = pick(rng, CFG.roadsX);
    peds.push({
      x: road + (rng() < 0.5 ? -68 : 68),
      y: range(rng, 150, CFG.world.h - 150),
      dir: rng() < 0.5 ? -1 : 1,
      speed: range(rng, 26, 48),
      shirt: pick(rng, shirts),
      phase: range(rng, 0, Math.PI * 2),
    });
  }
  return { cars, peds };
}

export function updateTraffic(traffic, dt, playerCar) {
  for (const c of traffic.cars) {
    if (c.vertical) {
      c.y += c.speed * dt;
      if (c.y > CFG.world.h - 90) c.y = 90;
    } else {
      c.x += c.speed * dt;
      if (c.x > CFG.world.w - 90) c.x = 90;
    }
    // Never overlap Rico's car: push a traffic car out to a clean
    // gap and slow it, so the chase frame never shows two cars inside
    // each other.
    if (playerCar) {
      const dx = c.x - playerCar.x;
      const dy = c.y - playerCar.y;
      const d = Math.hypot(dx, dy);
      if (d < 85 && d > 0.01) {
        c.x = playerCar.x + (dx / d) * 85;
        c.y = playerCar.y + (dy / d) * 85;
        c.speed = Math.min(c.speed, 60);
      }
    }
  }
  for (const p of traffic.peds) {
    p.y += p.dir * p.speed * dt;
    p.phase += dt * 6;
    if (p.y > CFG.world.h - 120) p.dir = -1;
    if (p.y < 120) p.dir = 1;
  }
}
