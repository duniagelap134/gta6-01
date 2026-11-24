// SOLMAR — Rico Vale on foot: WASD walks him in world directions, and E
// gets him in and out of cars. While he drives, his position rides with
// the car, so missions, the camera and the HUD all read one place.
import { CFG } from './config.js';
import { nearestCar } from './vehicles.js';

export function makePlayer() {
  return {
    x: 1300,
    y: 900,
    angle: -Math.PI / 2,
    onFoot: true,
    carId: null,
    health: CFG.player.health,
    armor: CFG.player.armor,
    ammo: CFG.player.ammo,
    money: CFG.player.money,
    dead: false,
    weapon: 2,
  };
}

export function updateOnFoot(player, input, dt) {
  let mx = 0;
  let my = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const sp = CFG.player.walkSpeed;
    player.x += (mx / len) * sp * dt;
    player.y += (my / len) * sp * dt;
    player.angle = Math.atan2(my, mx);
  }
  player.x = Math.max(80, Math.min(CFG.world.w - 80, player.x));
  player.y = Math.max(80, Math.min(CFG.world.h - 80, player.y));
}

// E next to a parked car steals it; E while driving steps back out
// beside it. Stealing a car is a crime: it warms the wanted level.
export function tryEnterCar(game) {
  const p = game.player;
  if (p.onFoot) {
    const car = nearestCar(game.cars, p.x, p.y, 70, 'parked');
    if (!car) return false;
    p.onFoot = false;
    p.carId = car.id;
    car.driver = 'player';
    if (car.marker) game.missionStealTaken = true;
    game.heat = Math.min(3, game.heat + CFG.wanted.stealHeat);
    game.audio.blip(220, 0.08, 'square', 0.05);
    return true;
  }
  const car = game.cars.find((c) => c.id === p.carId);
  if (car) {
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 46;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 46;
    car.driver = 'parked';
    car.speed = 0;
  }
  p.onFoot = true;
  p.carId = null;
  return true;
}
