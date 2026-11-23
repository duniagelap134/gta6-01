// Screenshot staging (?shot=chase|foot|drive|night): each scene plays
// the real game forward from a fresh world with a fixed seed, steered
// by the autopilot in main.js, so the frame is what a short session
// really looks like — never a posed mock-up. The 3D chase camera does
// the rest: every cover is mid-chase at golden hour or at night, with
// the helicopter overhead, police behind, wanted stars lit and the
// dense HUD reading live state.
import { makeCar } from './vehicles.js';
import { startMission, updateMissions } from './missions.js';
import { spawnEnemy } from './combat.js';

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
  // Staged units drive straight at their set speed (see police.js):
  // place them flanking/ahead so they are still in frame when the
  // autopilot finishes, not behind the camera.
  for (const [x, y, angle, speed] of positions) {
    const car = makeCar(game, 'police', x, y, angle || 0, 'police');
    car.siren = true;
    car.speed = speed || 300;
    car.staged = true;
    car.unitName = ['PATROL-07', 'INTERCEPTOR-04', 'PATROL-19'][game.cars.filter((c) => c.driver === 'police').length % 3];
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
  // Cover: golden-hour police chase on the Palms strip — wanted 3,
  // HAWK-1 overhead, the Bridge Job's escape leg, Vera on the radio.
  game.dayTime = 0.62;
  startMission(game, 2);
  game.player.x = 1500;
  game.player.y = 700;
  updateMissions(game, 0); // grabs the package, wanted jumps to 3
  const car = putPlayerInCar(game, 'sport', 700, 1100, 0, '#d21f3c');
  car.speed = 200;
  game.player.money = 12780;
  game.heat = 2.2; // 3 stars
  addPoliceTail(game, [[1200, 1100, 0, 300], [1150, 1032, 0, 320], [1250, 1176, 0, 320]]);
  addTrafficAhead(game, [[1200, 722, 0]]); // cross-street traffic only; the escape lane stays clear
  clearEscapeLane(game, 1100, 600);
  return { seconds: 2, driveTarget: { x: 2400, y: 1100 } };
}

function stageFoot(game) {
  // On-foot mission: the Vela job at the Marina Casino, rivals closing
  // in, pistol out, Vera's line on the dialogue box. Rico approaches
  // from the east along the casino road (the casino itself sits south
  // of the road west of the Vela — approaching from the west puts its
  // corner 50 units from the camera and it fills the frame), the
  // cherry Vela parked just off the road ahead, rivals guarding it,
  // one patrol car arriving from the west.
  game.dayTime = 0.4;
  startMission(game, 1);
  game.player.x = 2150;
  game.player.y = 300;
  updateMissions(game, 0); // reaches the casino, the Vela GT appears
  game.player.x = 2400;
  game.player.y = 330;
  game.player.angle = Math.atan2(334 - 330, 2230 - 2400);
  game.player.ammo = 12;
  game.player.money = 9340;
  // Rivals guard the Vela from a distance: they chase Rico, so staging
  // them close puts one on top of the camera by the time the frame is
  // taken. The faceAngle pins Rico toward the Vela (see main.js).
  spawnEnemy(game, 2150, 300, 'rival');
  spawnEnemy(game, 2200, 360, 'rival');
  spawnEnemy(game, 2100, 340, 'brute');
  game.heat = 0.6; // 1 star: the casino called it in
  // No random traffic near Rico, and no police spawn rushing him:
  // one staged patrol car arrives on the road instead.
  game.cars = game.cars.filter((c) => c.driver !== 'traffic'
    || Math.hypot(c.x - game.player.x, c.y - game.player.y) > 400);
  addPoliceTail(game, [[1900, 300, 0, 200]]);
  return { seconds: 1.5, driveTarget: null, faceAngle: Math.atan2(334 - 330, 2230 - 2400) };
}

function stageDrive(game) {
  // Daytime drive through downtown traffic in the Vela GT — the
  // Pickup's escape leg, Mara in the car, a 1-star tail behind, the
  // Palms safehouse marker straight ahead on the same road.
  game.dayTime = 0.3;
  startMission(game, 0);
  game.player.x = 700;
  game.player.y = 300;
  updateMissions(game, 0); // picks up Mara, advances to the escape leg
  const car = putPlayerInCar(game, 'sport', 700, 1100, 0, '#1f6fd2');
  car.speed = 260;
  game.player.money = 5410;
  addPoliceTail(game, [[1150, 1032, 0, 240]]);
  // Cross-traffic on the vertical roads, one car to overtake ahead.
  addTrafficAhead(game, [[1100, 300, Math.PI / 2], [1500, 700, -Math.PI / 2], [1900, 300, Math.PI / 2], [1800, 722, 0]]);
  return { seconds: 2, driveTarget: { x: 1900, y: 1100 } };
}

function stageNight(game) {
  // Night: the King Tide finale, wanted 3, HAWK-1 spotlight, sirens
  // and headlights on the Marina Gate run.
  game.dayTime = 0.93;
  startMission(game, 7);
  game.player.x = 1100;
  game.player.y = 1100;
  updateMissions(game, 0); // grabs the package, wanted jumps to 3
  const car = putPlayerInCar(game, 'sport', 1500, 700, 0, '#f2f2f2');
  car.speed = 200;
  game.player.money = 18230;
  game.heat = 2.4;
  addPoliceTail(game, [[1750, 700, 0, 300], [1850, 632, 0, 320], [1950, 776, 0, 320]]);
  addTrafficAhead(game, [[1850, 722, 0], [2050, 678, 0]]);
  clearEscapeLane(game, 700, 1400);
  return { seconds: 2, driveTarget: { x: 2400, y: 700 } };
}

// Set `game` to the named scene and describe how long the autopilot
// should play it forward. Unknown names fall back to the drive scene.
export function stageShot(name, game) {
  if (name === 'chase') return stageChase(game);
  if (name === 'foot') return stageFoot(game);
  if (name === 'night') return stageNight(game);
  return stageDrive(game);
}
