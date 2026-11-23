// Cars: types, spawning, driving physics, entering / exiting and
// stealing. A car is a rotated rectangle with speed; traffic and police
// cars reuse the same shape with a different driver tag. Cars now
// carry a condition (100 = showroom, lower after hard hits) that the
// HUD shows and Milo's Quick Fix restores; a battered car loses a
// little top speed. Drawing moved to render3d.js.
import { WORLD_W, WORLD_H, CAR_ENTER_RADIUS, HEAT_STEAL_CAR } from './config.js';
import { isDown, wasPressed } from './input.js';
import { resolveCityCollision, onRoad, nearestRoadPoint } from './city.js';
import { playCrash } from './audio.js';

export const CAR_TYPES = {
  sedan: { name: 'Solmar Sedan', length: 46, width: 22, topSpeed: 420, accel: 300, grip: 3.2, colors: ['#c94f3d', '#3d6fc9', '#d8d3c3', '#4a4a52'] },
  taxi: { name: 'Solmar Cab', length: 46, width: 22, topSpeed: 400, accel: 280, grip: 3.2, colors: ['#e8b64c'] },
  sport: { name: 'Vela GT', length: 48, width: 22, topSpeed: 560, accel: 420, grip: 4.2, colors: ['#d21f3c', '#f2f2f2', '#1f6fd2'] },
  truck: { name: 'Harbor Hauler', length: 62, width: 26, topSpeed: 320, accel: 200, grip: 2.6, colors: ['#7a5a3a', '#5a6a7a'] },
  van: { name: 'Costa Van', length: 54, width: 24, topSpeed: 360, accel: 240, grip: 2.9, colors: ['#8a94a6', '#c9c2b2'] },
  police: { name: 'Solmar PD Interceptor', length: 48, width: 22, topSpeed: 520, accel: 400, grip: 4.0, colors: ['#20242c'] },
};

let nextCarId = 1;

export function makeCar(game, typeName, x, y, angle, driver) {
  const type = CAR_TYPES[typeName];
  const color = type.colors[Math.floor(game.rng() * type.colors.length)];
  return {
    id: nextCarId++,
    type: typeName,
    name: type.name,
    x, y, angle,
    speed: 0,
    color,
    driver: driver || 'parked', // parked | traffic | police | player | none
    length: type.length,
    width: type.width,
    topSpeed: type.topSpeed,
    accel: type.accel,
    grip: type.grip,
    condition: 100, // wear from hard hits; Quick Fix (X) restores it
    target: null, // traffic waypoint {x,y}
    wait: 0,
    siren: false,
    brakeLight: false,
    stolen: false,
    marker: false, // mission target car
  };
}

export function spawnParkedCars(game, count) {
  const placed = [];
  let guard = 0;
  while (placed.length < count && guard < 400) {
    guard += 1;
    const road = game.rng() < 0.5
      ? { x: game.cityV[Math.floor(game.rng() * game.cityV.length)], y: 150 + game.rng() * (WORLD_H - 300) }
      : { x: 150 + game.rng() * (WORLD_W - 300), y: game.cityH[Math.floor(game.rng() * game.cityH.length)] };
    const alongRoad = game.rng() < 0.5;
    const x = alongRoad ? road.x + (game.rng() < 0.5 ? 34 : -34) : road.x;
    const y = alongRoad ? road.y : road.y + (game.rng() < 0.5 ? 34 : -34);
    if (placed.some((c) => Math.hypot(c.x - x, c.y - y) < 120)) continue;
    if (Math.hypot(x - game.player.x, y - game.player.y) < 200) continue;
    const typeName = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'truck'][Math.floor(game.rng() * 6)];
    const car = makeCar(game, typeName, x, y, alongRoad ? 0 : Math.PI / 2, 'parked');
    game.cars.push(car);
    placed.push(car);
  }
  return placed;
}

export function nearestCar(game, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of game.cars) {
    const d = (car.x - x) * (car.x - x) + (car.y - y) * (car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function playerCar(game) {
  if (!game.player.carId) return null;
  return game.cars.find((c) => c.id === game.player.carId) || null;
}

// E near a car: get in. If it has a driver, the driver flees on foot and
// the theft raises the wanted heat. E while driving: get out.
export function tryEnterOrExitCar(game) {
  const player = game.player;
  if (!player.onFoot) {
    const car = playerCar(game);
    if (car) {
      car.driver = 'parked';
      car.speed = 0;
    }
    player.carId = null;
    player.onFoot = true;
    player.x += Math.cos(player.angle + Math.PI / 2) * 30;
    player.y += Math.sin(player.angle + Math.PI / 2) * 30;
    return 'exit';
  }
  const car = nearestCar(game, player.x, player.y, CAR_ENTER_RADIUS);
  if (!car) return null;
  if (car.driver === 'traffic') {
    game.heat += HEAT_STEAL_CAR;
    game.stats.carsStolen += 1;
    car.stolen = true;
    spawnFleeingDriver(game, car);
    game.addMessage(`Stole a ${car.name}! The law noticed.`);
  } else if (car.driver === 'police') {
    return null; // cannot jack a police car with its officer inside
  } else if (car.marker) {
    game.stats.carsStolen += 1;
  }
  car.driver = 'player';
  player.carId = car.id;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return 'enter';
}

function spawnFleeingDriver(game, car) {
  const ped = {
    x: car.x + 30, y: car.y + 30, angle: game.rng() * Math.PI * 2,
    speed: 150, kind: 'driver', flee: true, color: '#e8e4d2', radius: 11,
  };
  game.peds.push(ped);
}

function damageCondition(car, amount) {
  car.condition = Math.max(25, car.condition - amount);
}

function collideCarsWithCity(game, car, dt) {
  const hit = resolveCityCollision(game.city, car, car.length / 2 - 4);
  if (!hit) return;
  // The push-out already stops penetration; the speed penalty fires at
  // most once per 0.3 s so a car wedged on a wall can still slide along
  // it and steer away instead of grinding to a halt.
  if (car.bumpTimer === undefined) car.bumpTimer = 0;
  if (car.bumpTimer > 0) return;
  if (Math.abs(car.speed) > 120) {
    playCrash(game.audio);
    game.addShake(Math.min(7, Math.abs(car.speed) / 60));
    damageCondition(car, 2);
    for (let i = 0; i < 8; i += 1) {
      game.particles.push({
        x: car.x, y: car.y, vx: (game.rng() - 0.5) * 160, vy: (game.rng() - 0.5) * 160,
        life: 0.5, max: 0.5, size: 4, color: '#f2c14e',
      });
    }
  }
  car.speed *= 0.85;
  car.bumpTimer = 0.3;
}

export function updatePlayerDriving(game, dt) {
  const player = game.player;
  const car = playerCar(game);
  if (!car) {
    player.onFoot = true;
    return;
  }
  const input = game.input;
  const forward = isDown(input, 'KeyW', 'ArrowUp') ? 1 : 0;
  const brake = isDown(input, 'KeyS', 'ArrowDown') ? 1 : 0;
  const steer = (isDown(input, 'KeyA', 'ArrowLeft') ? -1 : 0) + (isDown(input, 'KeyD', 'ArrowRight') ? 1 : 0);
  const handbrake = isDown(input, 'Space');
  if (forward) car.speed += car.accel * dt;
  if (brake) {
    car.speed -= car.speed > 10 ? car.accel * 1.4 * dt : car.accel * 0.6 * dt;
  }
  if (!forward && !brake) car.speed -= Math.sign(car.speed) * 60 * dt;
  if (handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  // A battered car loses top end: 100% condition is full speed, 25%
  // condition caps at about 78%.
  const topSpeed = car.topSpeed * (0.7 + 0.3 * (car.condition / 100));
  car.speed = Math.max(-topSpeed * 0.4, Math.min(topSpeed, car.speed));
  if (Math.abs(car.speed) < 4 && !forward && !brake) car.speed = 0;
  const steerAmount = steer * car.grip * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * (handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = brake || handbrake;
  collideCarsWithCity(game, car, dt);
  // Bumping other cars shoves them apart; the speed penalty fires at
  // most once per 0.3 s per bump, so a police car riding your bumper
  // cannot grind you to a halt frame by frame.
  if (car.bumpTimer === undefined) car.bumpTimer = 0;
  car.bumpTimer -= dt;
  for (const other of game.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = (car.length + other.length) / 2 - 6;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      other.x += nx * push;
      other.y += ny * push;
      car.x -= nx * push;
      car.y -= ny * push;
      if (car.bumpTimer <= 0) {
        if (Math.abs(car.speed) > 150) {
          playCrash(game.audio);
          damageCondition(car, 1.5);
        }
        car.speed *= 0.85;
        other.speed *= 0.7;
        car.bumpTimer = 0.3;
      }
    }
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
}

export function shadeColor(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
