// Traffic cars and pedestrians: the city feels alive. Traffic cars
// cruise the road grid between intersections, slowing for the car
// ahead; pedestrians stroll the sidewalks and flee from gunfire, fast
// cars and police chases. Drawing moved to render3d.js.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_W } from './config.js';
import { makeCar, playerCar } from './vehicles.js';
import { onRoad, resolveCityCollision } from './city.js';

const PED_COLORS = ['#e8b64c', '#c94f3d', '#4a7fb5', '#7d6a9e', '#e8e4d2', '#5a8a6a', '#d2691e'];

export function spawnTraffic(game, carCount, pedCount) {
  for (let i = 0; i < carCount; i += 1) {
    const vertical = game.rng() < 0.5;
    const road = vertical
      ? V_ROADS[Math.floor(game.rng() * V_ROADS.length)]
      : H_ROADS[Math.floor(game.rng() * H_ROADS.length)];
    const along = 100 + game.rng() * (vertical ? WORLD_H - 200 : WORLD_W - 200);
    const x = vertical ? road + (game.rng() < 0.5 ? 22 : -22) : along;
    const y = vertical ? along : road + (game.rng() < 0.5 ? 22 : -22);
    if (Math.hypot(x - game.player.x, y - game.player.y) < 260) continue;
    const typeName = ['sedan', 'sedan', 'taxi', 'van', 'truck'][Math.floor(game.rng() * 5)];
    const car = makeCar(game, typeName, x, y, vertical ? Math.PI / 2 : 0, 'traffic');
    car.speed = 90 + game.rng() * 60;
    car.target = pickNextIntersection(game, car);
    game.cars.push(car);
  }
  for (let i = 0; i < pedCount; i += 1) {
    const vertical = game.rng() < 0.5;
    const road = vertical
      ? V_ROADS[Math.floor(game.rng() * V_ROADS.length)]
      : H_ROADS[Math.floor(game.rng() * H_ROADS.length)];
    const along = 120 + game.rng() * (vertical ? WORLD_H - 240 : WORLD_W - 240);
    const offset = ROAD_W / 2 + 14 + game.rng() * 10;
    const x = vertical ? road + (game.rng() < 0.5 ? offset : -offset) : along;
    const y = vertical ? along : road + (game.rng() < 0.5 ? offset : -offset);
    if (Math.hypot(x - game.player.x, y - game.player.y) < 180) continue;
    game.peds.push({
      x, y,
      angle: game.rng() * Math.PI * 2,
      speed: 45 + game.rng() * 35,
      kind: 'walker',
      flee: false,
      color: PED_COLORS[Math.floor(game.rng() * PED_COLORS.length)],
      radius: 11,
      target: null,
    });
  }
}

export function pickNextIntersection(game, car) {
  // Nearest intersection ahead-ish: any intersection within reach.
  const options = [];
  for (const rx of V_ROADS) {
    for (const ry of H_ROADS) {
      const d = Math.hypot(rx - car.x, ry - car.y);
      if (d > 120 && d < 900) options.push({ x: rx, y: ry, d });
    }
  }
  if (options.length === 0) return { x: V_ROADS[2], y: H_ROADS[1] };
  options.sort((a, b) => a.d - b.d);
  const pickFrom = options.slice(0, Math.min(4, options.length));
  return pickFrom[Math.floor(game.rng() * pickFrom.length)];
}

function carAhead(game, car) {
  let nearest = Infinity;
  for (const other of game.cars) {
    if (other === car || other.driver === 'player') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < 110 && side < 26) nearest = Math.min(nearest, forward);
  }
  return nearest;
}

export function updateTraffic(game, dt) {
  for (const car of game.cars) {
    if (car.driver !== 'traffic') continue;
    if (!car.target || Math.hypot(car.target.x - car.x, car.target.y - car.y) < 60) {
      car.target = pickNextIntersection(game, car);
    }
    const desired = Math.atan2(car.target.y - car.y, car.target.x - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const ahead = carAhead(game, car);
    const cruise = ahead < 110 ? 0 : 120 + (car.topSpeed - 320) * 0.15;
    if (car.speed < cruise) car.speed += 120 * dt;
    if (car.speed > cruise) car.speed -= 220 * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keep traffic on the map; nudge back at the edges.
    if (car.x < 140 || car.x > WORLD_W - 140 || car.y < 60 || car.y > WORLD_H - 60) {
      car.target = pickNextIntersection(game, car);
      car.angle = Math.atan2(car.target.y - car.y, car.target.x - car.x);
    }
  }
  // Pedestrians.
  const player = game.player;
  const pcar = playerCar(game);
  const threatX = pcar ? pcar.x : player.x;
  const threatY = pcar ? pcar.y : player.y;
  const threatSpeed = pcar ? Math.abs(pcar.speed) : 0;
  for (const ped of game.peds) {
    if (ped.kind === 'driver' || ped.flee) {
      // Flee away from the threat.
      ped.angle = Math.atan2(ped.y - threatY, ped.x - threatX);
      ped.speed = 170;
    } else {
      const dThreat = Math.hypot(ped.x - threatX, ped.y - threatY);
      if ((dThreat < 130 && (threatSpeed > 200 || game.gunfireTimer > 0)) || dThreat < 45) {
        ped.flee = true;
      }
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
        ped.target = randomSidewalkPoint(game);
      }
      ped.angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    // Never walk through a building: slide along its walls instead.
    resolveCityCollision(game.city, ped, ped.radius);
    if (ped.x < 200) ped.x = 200;
    if (ped.x > WORLD_W - 120) ped.x = WORLD_W - 120;
    if (ped.y < 40) ped.y = 40;
    if (ped.y > WORLD_H - 40) ped.y = WORLD_H - 40;
    if (ped.flee && Math.hypot(ped.x - threatX, ped.y - threatY) > 320) {
      ped.flee = false;
      ped.speed = 45 + game.rng() * 35;
    }
  }
  if (game.gunfireTimer > 0) game.gunfireTimer -= dt;
}

function randomSidewalkPoint(game) {
  const vertical = game.rng() < 0.5;
  const road = vertical
    ? V_ROADS[Math.floor(game.rng() * V_ROADS.length)]
    : H_ROADS[Math.floor(game.rng() * H_ROADS.length)];
  const along = 120 + game.rng() * (vertical ? WORLD_H - 240 : WORLD_W - 240);
  const offset = ROAD_W / 2 + 14;
  return vertical
    ? { x: road + (game.rng() < 0.5 ? offset : -offset), y: along }
    : { x: along, y: road + (game.rng() < 0.5 ? offset : -offset) };
}

// A fast car hitting a pedestrian: the ped goes down, heat rises.
// Only the player's own car counts — traffic cars never raise the
// player's wanted level for their own accidents.
export function checkPedCarHits(game) {
  const pcar = game.cars.find((c) => c.id === game.player.carId);
  if (!pcar || Math.abs(pcar.speed) < 130) return;
  const car = pcar;
  for (let i = game.peds.length - 1; i >= 0; i -= 1) {
    const ped = game.peds[i];
    if (ped.kind === 'driver') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < car.length / 2) {
      game.peds.splice(i, 1);
      game.heat += 0.7;
      game.stats.pedsHit += 1;
      game.addMessage('You hit a pedestrian! Wanted level rising.');
      for (let p = 0; p < 10; p += 1) {
        game.particles.push({
          x: ped.x, y: ped.y, vx: (game.rng() - 0.5) * 200, vy: (game.rng() - 0.5) * 200,
          life: 0.6, max: 0.6, size: 4, color: '#e8e4d2',
        });
      }
      // Respawn a fresh walker elsewhere so the streets stay busy.
      const fresh = { x: 0, y: 0, angle: 0, speed: 60, kind: 'walker', flee: false, color: '#e8b64c', radius: 11, target: null };
      const pt = randomSidewalkPoint(game);
      fresh.x = pt.x;
      fresh.y = pt.y;
      game.peds.push(fresh);
    }
  }
}
