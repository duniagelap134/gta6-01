// Screenshot staging (?shot=chase|foot|drive|night): each scene plays
// the real game forward from a fresh world with a fixed seed, steered
// by the autopilot in main.js, so the frame is what a short session
// really looks like — never a posed mock-up.
import { makeCar } from './vehicles.js';
import { startMission, updateMissions } from './missions.js';
import { spawnEnemy, spawnPickup } from './combat.js';

function putPlayerInCar(game, typeName, x, y, angle, color) {
  const car = makeCar(game, typeName, x, y, angle, 'player');
  if (color) car.color = color;
  game.cars.push(car);
  game.player.carId = car.id;
  game.player.onFoot = false;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  car.speed = 120;
  return car;
}

function addPoliceTail(game, positions) {
  for (const [x, y] of positions) {
    const car = makeCar(game, 'police', x, y, 0, 'police');
    car.siren = true;
    car.speed = 300;
    game.cars.push(car);
  }
  game.policeSpawnTimer = 999;
}

function addTrafficAhead(game, positions) {
  for (const [x, y, angle] of positions) {
    const car = makeCar(game, 'sedan', x, y, angle || 0, 'traffic');
    car.speed = 130;
    game.cars.push(car);
  }
}

// Move any spawned traffic car out of the escape lane so the staged
// chase has a clear road ahead of the player.
function clearEscapeLane(game, roadY, minX) {
  for (const car of game.cars) {
    if (car.driver === 'traffic' && Math.abs(car.y - roadY) < 70 && car.x > minX) {
      // Shift it one road over (roadY + 400 is always another road).
      car.y = roadY + 400;
      car.x = Math.min(car.x, 2300);
    }
  }
}

function stageChase(game) {
  // Cover: police chase, wanted 3 stars, minimap + mission objective.
  game.dayTime = 0.35;
  startMission(game, 0);
  game.player.x = 700;
  game.player.y = 300;
  updateMissions(game, 0); // picks up Mara, advances to the escape leg
  const car = putPlayerInCar(game, 'sport', 700, 1100, 0, '#d21f3c');
  car.speed = 200;
  game.heat = 2.2; // 3 stars
  addPoliceTail(game, [[450, 1100], [380, 1100], [520, 1052]]);
  addTrafficAhead(game, [[1200, 722, 0]]); // cross-street traffic only; the escape lane stays clear
  clearEscapeLane(game, 1100, 600);
  return { seconds: 1.5, driveTarget: { x: 2400, y: 1100 } };
}

function stageFoot(game) {
  // On-foot mission: the Vela job, rivals closing in, pistol out.
  game.dayTime = 0.4;
  startMission(game, 1);
  game.player.x = 2150;
  game.player.y = 300;
  updateMissions(game, 0); // reaches the casino, the Vela GT appears
  game.player.x = 1900;
  game.player.y = 520;
  game.player.angle = Math.atan2(300 - 520, 2150 - 1900);
  game.player.ammo = 12;
  spawnEnemy(game, 1900, 700, 'rival');
  spawnEnemy(game, 2200, 700, 'rival');
  spawnEnemy(game, 2150, 340, 'brute');
  spawnPickup(game, 1900, 420, 'health');
  game.heat = 0.6; // 1 star: the casino called it in
  return { seconds: 1, driveTarget: null };
}

function stageDrive(game) {
  // Daytime drive through downtown traffic, mission marker ahead.
  game.dayTime = 0.3;
  const car = putPlayerInCar(game, 'sedan', 700, 700, 0, '#3d6fc9');
  car.speed = 260;
  // Cross-traffic on the vertical roads, one car to overtake ahead.
  addTrafficAhead(game, [[1100, 300, Math.PI / 2], [1500, 1100, -Math.PI / 2], [1900, 300, Math.PI / 2], [1800, 722, 0]]);
  game.addMessage('Welcome to Solmar. Find the yellow M to start Mission 1.');
  return { seconds: 5, driveTarget: { x: 2000, y: 700 } };
}

function stageNight(game) {
  // Night: the Bridge Job escape, wanted 3, sirens and headlights.
  game.dayTime = 0.93;
  startMission(game, 2);
  game.player.x = 1500;
  game.player.y = 700;
  updateMissions(game, 0); // grabs the package, wanted jumps to 3
  const car = putPlayerInCar(game, 'sport', 1500, 700, 0, '#f2f2f2');
  car.speed = 200;
  game.heat = 2.4;
  addPoliceTail(game, [[1300, 700], [1220, 700], [1350, 652]]);
  addTrafficAhead(game, [[1850, 722, 0], [2050, 678, 0]]);
  clearEscapeLane(game, 700, 1400);
  return { seconds: 1.5, driveTarget: { x: 2400, y: 700 } };
}

// Set `game` to the named scene and describe how long the autopilot
// should play it forward. Unknown names fall back to the drive scene.
export function stageShot(name, game) {
  if (name === 'chase') return stageChase(game);
  if (name === 'foot') return stageFoot(game);
  if (name === 'night') return stageNight(game);
  return stageDrive(game);
}
