// SOLMAR — the Solmar PD. Heat is a float; the wanted level is its
// ceiling, so heat 2.2 already means three stars. Cops spawn at a
// distance and chase Rico; at three stars AIR ONE comes up with its
// spotlight. Cops can ram his car or, if he is on foot, drag him down.
import { CFG } from './config.js';
import { mulberry32, pick } from './rng.js';
import { makeCar } from './vehicles.js';

const CALLSIGNS = ['GULL-3', 'TIDE-22', 'PALM-9', 'SURF-14', 'REEF-31', 'BAY-12'];
const TAGS = ['RAMMING', 'FLANKING', 'PURSIT', 'PIT MANEUVER', 'BOX IN'];

export function wantedFromHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(3, Math.ceil(heat));
}

export function makePolice() {
  return {
    cops: [],
    heli: { active: false, x: 0, y: 0, angle: 0 },
    spawnTimer: 0,
    rng: mulberry32(CFG.seed + 31),
  };
}

export function updatePolice(police, game, dt) {
  const wanted = wantedFromHeat(game.heat);
  game.wanted = wanted;
  const p = game.player;

  // Heat cools slowly when Rico is not committing crimes.
  if (game.heat > 0 && !game.recentCrime) {
    game.heat = Math.max(0, game.heat - CFG.wanted.decayPerSec * dt);
  }

  // Spawn up to one cop per star (plus one) while the heat is on.
  const cap = wanted > 0 ? Math.min(CFG.police.maxCops, wanted + 1) : 0;
  police.spawnTimer -= dt;
  if (wanted > 0 && police.cops.length < cap && police.spawnTimer <= 0) {
    police.spawnTimer = CFG.police.spawnInterval;
    const a = pick(police.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const d = CFG.police.spawnDistance;
    const car = makeCar('SPPD Interceptor', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, a, 'police', '#e8e8e8');
    car.speed = CFG.police.chaseSpeed;
    car.callsign = CALLSIGNS[police.cops.length % CALLSIGNS.length];
    car.tag = TAGS[police.cops.length % TAGS.length];
    police.cops.push(car);
    game.cars.push(car);
  }
  if (wanted === 0) {
    for (const c of police.cops) {
      const i = game.cars.indexOf(c);
      if (i >= 0) game.cars.splice(i, 1);
    }
    police.cops.length = 0;
  }

  // Chase: steer at Rico, ram his car, or drag him down on foot.
  for (const c of police.cops) {
    if (c.condition <= 0) continue;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    let diff = want - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const sp = Math.min(CFG.police.chaseSpeed, 200 + dist * 0.25);
    c.speed = sp;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.ramTimer > 0) c.ramTimer -= dt;
    if (!p.onFoot && dist < 52 && c.ramTimer <= 0) {
      c.ramTimer = CFG.police.ramCooldown;
      const car = game.cars.find((v) => v.id === p.carId);
      if (car) car.condition = Math.max(0, car.condition - CFG.police.ramDamage);
      game.audio.blip(120, 0.1, 'sawtooth', 0.06);
    }
    if (p.onFoot && dist < 30) {
      p.health = Math.max(0, p.health - 22 * dt);
      if (p.health <= 0) {
        p.dead = true;
        game.screen = 'wasted';
      }
    }
  }

  // AIR ONE lives above Rico once the third star lights up, hovering
  // ahead of him so it stays in frame with its spotlight on him.
  police.heli.active = wanted >= 3;
  if (police.heli.active) {
    const tx = p.x + Math.cos(p.angle) * 260;
    const ty = p.y + Math.sin(p.angle) * 260;
    police.heli.x += (tx - police.heli.x) * Math.min(1, dt * 1.6);
    police.heli.y += (ty - police.heli.y) * Math.min(1, dt * 1.6);
    police.heli.angle += dt * 1.4;
  }
}

// The dispatch panel's rows: the chasing units, nearest first, with a
// distance in metres and the tag each one is running.
export function dispatchUnits(police, game) {
  const rows = police.cops
    .filter((c) => c.condition > 0)
    .map((c) => ({
      name: c.callsign || 'SPPD',
      dist: Math.max(3, Math.round(Math.hypot(c.x - game.player.x, c.y - game.player.y) / 10)),
      tag: c.tag || 'PURSIT',
    }))
    .sort((a, b) => a.dist - b.dist);
  if (police.heli.active) rows.unshift({ name: 'AIR ONE', dist: 0, tag: 'SPOTLIGHT' });
  return rows;
}
