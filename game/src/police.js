// Wanted level and the Solmar PD. Heat (0..5) maps to 0..5 stars.
// Police cars spawn off-screen and chase; at 2+ stars foot officers
// join and try to arrest Rico on foot, and the HAWK-1 helicopter
// circles overhead with a spotlight. Heat decays when no officer can
// see him; getting busted costs cash and clears the heat.
//
// Every police unit carries a callsign the HUD's dispatch panel shows
// with its live distance and status: PATROL cars, INTERCEPTORs, the
// HAWK-1 air unit, and ROADBLOCK when a unit holds the road ahead.
import { WANTED_THRESHOLDS, HEAT_DECAY_PER_SECOND } from './config.js';
import { makeCar, playerCar } from './vehicles.js';
import { nearestRoadPoint, resolveCityCollision } from './city.js';
import { damagePlayer } from './player.js';
import { setSiren } from './audio.js';

const UNIT_NAMES = ['PATROL-07', 'PATROL-19', 'PATROL-23', 'INTERCEPTOR-04', 'INTERCEPTOR-11', 'PATROL-31'];

export function wantedStars(game) {
  let stars = 0;
  for (let i = 0; i < WANTED_THRESHOLDS.length; i += 1) {
    if (game.heat >= WANTED_THRESHOLDS[i]) stars = i + 1;
  }
  return stars;
}

export function addHeat(game, amount) {
  game.heat = Math.min(5, game.heat + amount);
}

function spawnPoliceCar(game) {
  const point = nearestRoadPoint(game.player.x + (game.rng() - 0.5) * 1400, game.player.y + (game.rng() - 0.5) * 1000);
  const car = makeCar(game, 'police', point.x, point.y, game.rng() * Math.PI * 2, 'police');
  car.speed = 200;
  car.siren = true;
  car.unitName = UNIT_NAMES[game.cars.filter((c) => c.driver === 'police').length % UNIT_NAMES.length];
  game.cars.push(car);
  return car;
}

function spawnFootCop(game) {
  const angle = game.rng() * Math.PI * 2;
  const dist = 420 + game.rng() * 200;
  game.cops.push({
    x: game.player.x + Math.cos(angle) * dist,
    y: game.player.y + Math.sin(angle) * dist,
    angle: 0,
    speed: 200,
    radius: 13,
    arrestTimer: 0,
    color: '#20242c',
    unitName: 'OFFICER-' + (10 + game.cops.length),
  });
}

// The dispatch feed for the HUD: every active unit with its live
// distance and a status tag derived from where it is relative to Rico.
export function dispatchUnits(game) {
  const player = game.player;
  const units = [];
  for (const car of game.cars) {
    if (car.driver !== 'police') continue;
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    const closing = Math.hypot(player.x - (car.x + Math.cos(car.angle) * 40), player.y - (car.y + Math.sin(car.angle) * 40)) < d;
    const ahead = (player.x - car.x) * Math.cos(player.angle) + (player.y - car.y) * Math.sin(player.angle) > 0;
    const side = Math.abs((player.x - car.x) * -Math.sin(player.angle) + (player.y - car.y) * Math.cos(player.angle));
    let status = 'PURSUIT';
    if (d < 70 && closing) status = 'RAMMING';
    else if (side > 120) status = 'FLANKING';
    else if (ahead && d < 260 && wantedStars(game) >= 3) status = 'ROADBLOCK';
    units.push({ name: car.unitName || 'PATROL', status, dist: Math.round(d), id: car.id, kind: 'car' });
  }
  for (const cop of game.cops) {
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    units.push({ name: cop.unitName || 'OFFICER', status: d < 40 ? 'CLOSING IN' : 'ON FOOT', dist: Math.round(d), id: null, kind: 'cop' });
  }
  if (game.heli && game.heli.active) {
    units.push({ name: 'HAWK-1', status: 'SPOTLIGHT', dist: Math.round(Math.hypot(player.x - game.heli.x, player.y - game.heli.y)), id: null, kind: 'heli' });
  }
  units.sort((a, b) => a.dist - b.dist);
  return units;
}

export function updatePolice(game, dt) {
  const stars = wantedStars(game);
  game.wanted = stars;
  // Spawn police cars up to the star count (max 4 on the road).
  const policeCars = game.cars.filter((c) => c.driver === 'police');
  const wantCars = Math.min(4, stars);
  if (policeCars.length < wantCars && game.policeSpawnTimer <= 0) {
    spawnPoliceCar(game);
    game.policeSpawnTimer = 2.5;
  }
  if (game.policeSpawnTimer > 0) game.policeSpawnTimer -= dt;
  // Foot officers at 2+ stars, at most 3.
  if (stars >= 2 && game.cops.length < 3 && game.copSpawnTimer <= 0) {
    spawnFootCop(game);
    game.copSpawnTimer = 4;
  }
  if (game.copSpawnTimer > 0) game.copSpawnTimer -= dt;
  if (stars === 0) {
    // Stand down: police cars drive off, officers leave.
    for (const car of policeCars) {
      car.driver = 'traffic';
      car.siren = false;
    }
    game.cops.length = 0;
  }
  // HAWK-1 circles overhead from 2 stars up: ahead of Rico and off to
  // the side, low enough that the spotlight cone reads in the frame.
  if (stars >= 2) {
    const fx = Math.cos(game.player.angle);
    const fy = Math.sin(game.player.angle);
    const lx = -fy;
    const ly = fx;
    game.heli.active = true;
    game.heli.x = game.player.x + fx * 180 + lx * 40;
    game.heli.y = game.player.y + fy * 180 + ly * 40;
    game.heli.z = 170;
  } else {
    game.heli.active = false;
  }
  // Chase: police cars steer at the player and ram. Staged cars (the
  // screenshot scenes) drive straight at their set speed instead, so
  // the frame the shot takes is the frame that was staged.
  const player = game.player;
  let anyNear = false;
  for (const car of game.cars) {
    if (car.driver !== 'police') continue;
    if (car.staged) {
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const sd = Math.hypot(player.x - car.x, player.y - car.y);
      if (sd < 620) anyNear = true;
      continue;
    }
    const desired = Math.atan2(player.y - car.y, player.x - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
    const targetSpeed = 300 + stars * 45;
    if (car.speed < targetSpeed) car.speed += 320 * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Police cars slide along buildings instead of driving through them.
    if (resolveCityCollision(game.city, car, car.length / 2 - 4)) car.speed *= 0.8;
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    if (d < 620) anyNear = true;
    // Ram: shove the player's car, or knock Rico down on foot.
    if (d < (car.length / 2 + 18)) {
      const pcar = playerCar(game);
      if (pcar && pcar !== car) {
        pcar.speed *= 0.6;
        pcar.x += Math.cos(car.angle) * 26;
        pcar.y += Math.sin(car.angle) * 26;
        game.addShake(4);
      } else if (player.onFoot) {
        damagePlayer(game, 25 * dt);
        player.x += Math.cos(car.angle) * 30 * dt * 10;
        player.y += Math.sin(car.angle) * 30 * dt * 10;
      }
    }
  }
  // Foot officers chase and arrest.
  for (const cop of game.cops) {
    cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (player.onFoot && d > 24) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      resolveCityCollision(game.city, cop, cop.radius);
    }
    if (player.onFoot && d < 30) {
      cop.arrestTimer += dt;
      if (cop.arrestTimer > 1.4) {
        bustPlayer(game);
        return;
      }
    } else {
      cop.arrestTimer = Math.max(0, cop.arrestTimer - dt);
    }
    if (!player.onFoot && d < 60) {
      // Officer pounds on the car; getting out near one is a bad idea.
      cop.arrestTimer += dt * 0.5;
    }
  }
  // Heat decays only when nobody is close enough to see Rico.
  const seen = policeCars.some((c) => Math.hypot(player.x - c.x, player.y - c.y) < 520)
    || game.cops.some((c) => Math.hypot(player.x - c.x, player.y - c.y) < 420);
  if (!seen && stars > 0) {
    game.heat = Math.max(0, game.heat - HEAT_DECAY_PER_SECOND * dt);
    if (game.heat < WANTED_THRESHOLDS[0]) {
      game.heat = 0;
      game.addMessage('You lost the cops. Lay low.');
    }
  }
  setSiren(game.audio, anyNear && stars > 0);
}

export function bustPlayer(game) {
  const fine = Math.min(game.player.money, 150);
  game.player.money -= fine;
  game.heat = 0;
  game.wanted = 0;
  game.cops.length = 0;
  for (const car of game.cars) {
    if (car.driver === 'police') {
      car.driver = 'traffic';
      car.siren = false;
    }
  }
  // Drop Rico at the precinct steps, on foot, car gone.
  const player = game.player;
  if (!player.onFoot) {
    const car = playerCar(game);
    if (car) car.driver = 'parked';
    player.carId = null;
    player.onFoot = true;
  }
  player.x = 1100;
  player.y = 660;
  player.health = Math.max(player.health, 50);
  game.screen = 'busted';
  game.stats.busted += 1;
}
