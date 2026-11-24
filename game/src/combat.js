// SOLMAR — shooting. Rico fires his .38 toward the mouse: a tracer
// bullet, a muzzle tick, one round of ammo per shot. Bullets that reach
// a police car knock its condition down; a wrecked cruiser stops
// chasing. Shooting on its own never raises the heat.
import { CFG } from './config.js';

export function makeCombat() {
  return { bullets: [], cooldown: 0 };
}

export function tryShoot(combat, game, targetX, targetY) {
  const p = game.player;
  if (combat.cooldown > 0 || p.ammo <= 0 || p.dead) return false;
  combat.cooldown = CFG.combat.fireInterval;
  p.ammo -= 1;
  const ox = p.x;
  const oy = p.y;
  const a = Math.atan2(targetY - oy, targetX - ox);
  combat.bullets.push({
    x: ox + Math.cos(a) * 26,
    y: oy + Math.sin(a) * 26,
    vx: Math.cos(a) * CFG.combat.bulletSpeed,
    vy: Math.sin(a) * CFG.combat.bulletSpeed,
    life: CFG.combat.bulletLife,
  });
  game.audio.shot();
  return true;
}

export function updateCombat(combat, game, dt) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  for (const b of combat.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const cop of game.cops) {
      if (cop.condition <= 0) continue;
      if (Math.hypot(b.x - cop.x, b.y - cop.y) < 34) {
        cop.condition = Math.max(0, cop.condition - CFG.combat.copDamage);
        b.life = 0;
        if (cop.condition <= 0) game.audio.blip(90, 0.3, 'sawtooth', 0.08);
        break;
      }
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
}
