// SOLMAR — cars: what they are, how they drive, and how Rico steals
// them. A car is a plain object so the tests and the save file can read
// it straight off window.__game.cars.
import { CFG } from './config.js';
import { mulberry32, range, pick } from './rng.js';

export const CAR_NAMES = ['Vela GT', 'Corto', 'Marlin', 'Pelican', 'Tiburon', 'Dorado', 'Siroco'];
export const CAR_COLORS = ['#e8543d', '#3d7de8', '#e8b13d', '#7fb069', '#c96f8e', '#8fa8d8', '#e8e3d8'];

let nextCarId = 1;

export function makeCar(name, x, y, angle, driver, color) {
  return {
    id: nextCarId++,
    name,
    x,
    y,
    angle,
    speed: 0,
    condition: 100,
    driver: driver || 'parked',
    color: color || '#e8543d',
    marker: false,
    ramTimer: 0,
  };
}

// Parked cars at fixed spots: one near every mission start so a steal
// objective always has a car to take, plus a few on the boulevards.
export function spawnParkedCars() {
  const rng = mulberry32(CFG.seed + 77);
  const spots = [
    [760, 330, 0], [2150, 360, 0], [1560, 730, 0], [360, 1470, 0],
    [1160, 730, 0], [2360, 1130, 0], [700, 1240, Math.PI / 2],
    [1500, 360, 0], [1100, 1560, 0], [1900, 300, 0],
    [2300, 1560, 0], [300, 700, Math.PI / 2], [1900, 1100, 0],
    [1100, 300, 0],
  ];
  const cars = [];
  for (const [x, y, a] of spots) {
    cars.push(makeCar(pick(rng, CAR_NAMES), x, y, a, 'parked', pick(rng, CAR_COLORS)));
  }
  return cars;
}

export function nearestCar(cars, x, y, maxDist, driver) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    if (driver && c.driver !== driver) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Arcade driving: W accelerates along the nose, S brakes or reverses,
// A and D steer harder the faster the car goes. Speed is signed.
export function updateDriving(car, input, dt) {
  const c = CFG.car;
  if (input.down('KeyW') || input.down('ArrowUp')) car.speed += c.accel * dt;
  if (input.down('KeyS') || input.down('ArrowDown')) {
    car.speed -= (car.speed > 0 ? c.brake : c.accel * 0.6) * dt;
  }
  if (!input.down('KeyW') && !input.down('KeyS') && !input.down('ArrowUp') && !input.down('ArrowDown')) {
    const f = c.friction * dt;
    if (Math.abs(car.speed) <= f) car.speed = 0;
    else car.speed -= Math.sign(car.speed) * f;
  }
  car.speed = Math.max(-c.reverseMax, Math.min(c.maxSpeed, car.speed));
  const steer = (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0)
    + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 5) {
    car.angle += steer * c.turnRate * dt * Math.min(1, Math.abs(car.speed) / 140) * Math.sign(car.speed);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(80, Math.min(CFG.world.w - 80, car.x));
  car.y = Math.max(80, Math.min(CFG.world.h - 80, car.y));
  if (car.ramTimer > 0) car.ramTimer -= dt;
}

export function carScreenSpeed(car) {
  return Math.round(Math.abs(car.speed) * 0.42);
}
