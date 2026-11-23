// Combat: Rico's pistol and fists, rival gang members who shoot back,
// bullets, muzzle flashes and pickups (health, ammo, armour).
import { BULLET_SPEED, PISTOL_DAMAGE, FIST_DAMAGE, HEAT_SHOOT, HEAT_KILL } from './config.js';
import { wasPressed } from './input.js';
import { resolveCityCollision } from './city.js';
import { playShot, playPunch } from './audio.js';
import { damagePlayer, healPlayer } from './player.js';
import { addHeat } from './police.js';

export function spawnEnemy(game, x, y, kind) {
  const enemy = {
    x, y,
    angle: 0,
    health: kind === 'brute' ? 120 : 70,
    kind: kind || 'rival',
    radius: 13,
    shootTimer: 1 + game.rng() * 1.5,
    speed: kind === 'brute' ? 120 : 165,
    color: kind === 'brute' ? '#3d2b4a' : '#7a1f2b',
  };
  game.enemies.push(enemy);
  return enemy;
}

export function spawnPickup(game, x, y, kind) {
  game.pickups.push({ x, y, kind, bob: game.rng() * Math.PI * 2 });
}

export function playerShoot(game) {
  const player = game.player;
  if (!player.onFoot || player.shootCooldown > 0 || player.reloading > 0) return false;
  if (player.ammo <= 0) {
    player.reloading = 1.1;
    return false;
  }
  player.ammo -= 1;
  player.shootCooldown = 0.22;
  const spread = (game.rng() - 0.5) * 0.06;
  game.bullets.push({
    x: player.x + Math.cos(player.angle) * 20,
    y: player.y + Math.sin(player.angle) * 20,
    angle: player.angle + spread,
    speed: BULLET_SPEED,
    from: 'player',
    damage: PISTOL_DAMAGE,
    life: 0.9,
  });
  game.gunfireTimer = 1.2;
  addHeat(game, HEAT_SHOOT * 0.4);
  playShot(game.audio);
  game.particles.push({
    x: player.x + Math.cos(player.angle) * 26,
    y: player.y + Math.sin(player.angle) * 26,
    vx: 0, vy: 0, life: 0.08, max: 0.08, size: 12, color: '#ffd21f',
  });
  return true;
}

export function playerPunch(game) {
  const player = game.player;
  if (!player.onFoot || player.punchCooldown > 0) return false;
  player.punchCooldown = 0.45;
  playPunch(game.audio);
  const reach = 46;
  const px = player.x + Math.cos(player.angle) * reach;
  const py = player.y + Math.sin(player.angle) * reach;
  let hitSomething = false;
  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const e = game.enemies[i];
    if (Math.hypot(e.x - px, e.y - py) < 34 || Math.hypot(e.x - player.x, e.y - player.y) < 34) {
      damageEnemy(game, e, FIST_DAMAGE);
      hitSomething = true;
    }
  }
  for (const ped of game.peds) {
    if (Math.hypot(ped.x - player.x, ped.y - player.y) < 36) {
      ped.flee = true;
      hitSomething = true;
    }
  }
  return hitSomething;
}

function damageEnemy(game, enemy, amount) {
  enemy.health -= amount;
  game.particles.push({
    x: enemy.x, y: enemy.y, vx: 0, vy: -30, life: 0.4, max: 0.4,
    size: 6, color: '#ff5a4e',
  });
  if (enemy.health <= 0) {
    const index = game.enemies.indexOf(enemy);
    if (index !== -1) game.enemies.splice(index, 1);
    game.stats.kills += 1;
    addHeat(game, HEAT_KILL);
    game.player.money += 25;
    if (game.rng() < 0.4) spawnPickup(game, enemy.x, enemy.y, game.rng() < 0.5 ? 'health' : 'ammo');
    game.addMessage('Rival down. +$25');
  }
}

export function updateCombat(game, dt) {
  const player = game.player;
  // Player shooting (mouse held) and punching (Space).
  if (player.onFoot && !player.dead) {
    if (game.input.mouse.down) playerShoot(game);
    if (wasPressed(game.input, 'Space')) playerPunch(game);
    if (wasPressed(game.input, 'KeyR') && player.ammo < 12 && player.ammoReserve > 0 && player.reloading <= 0) {
      player.reloading = 1.1;
    }
  }
  // Bullets fly, hit buildings, cars, enemies, cops and Rico.
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const b = game.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Building hit: spark and stop.
      for (const building of game.city.buildings) {
        if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
          dead = true;
          game.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 5, color: '#ffd21f' });
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (const e of [...game.enemies]) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + 4) {
          damageEnemy(game, e, b.damage);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of game.cops) {
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
            game.cops.splice(game.cops.indexOf(cop), 1);
            addHeat(game, 1.2);
            game.addMessage('You shot a cop! The whole PD is coming.');
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of game.cars) {
          if (Math.abs(b.x - car.x) < car.length / 2 && Math.abs(b.y - car.y) < car.width / 2) {
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      if (player.onFoot && Math.hypot(player.x - b.x, player.y - b.y) < player.radius + 4) {
        damagePlayer(game, b.damage * 0.6);
        dead = true;
      }
      const pcar = game.cars.find((c) => c.id === player.carId);
      if (!dead && pcar && Math.abs(b.x - pcar.x) < pcar.length / 2 && Math.abs(b.y - pcar.y) < pcar.width / 2) {
        damagePlayer(game, b.damage * 0.25);
        dead = true;
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
  // Enemies chase Rico and shoot when close enough.
  for (const e of [...game.enemies]) {
    const d = Math.hypot(player.x - e.x, player.y - e.y);
    e.angle = Math.atan2(player.y - e.y, player.x - e.x);
    if (d > 60) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
      // Rivals walk around buildings, never through them.
      resolveCityCollision(game.city, e, e.radius);
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && d < 420 && !player.dead) {
      e.shootTimer = 1.1 + game.rng() * 0.9;
      game.bullets.push({
        x: e.x + Math.cos(e.angle) * 20,
        y: e.y + Math.sin(e.angle) * 20,
        angle: e.angle + (game.rng() - 0.5) * 0.22,
        speed: BULLET_SPEED * 0.85,
        from: 'enemy',
        damage: 14,
        life: 1.1,
      });
      playShot(game.audio);
      game.gunfireTimer = 1.0;
    }
  }
  // Pickups.
  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const p = game.pickups[i];
    p.bob += dt * 3;
    if (player.onFoot && Math.hypot(p.x - player.x, p.y - player.y) < 30) {
      if (p.kind === 'health') healPlayer(game, 40);
      if (p.kind === 'ammo') player.ammoReserve += 24;
      if (p.kind === 'armor') player.armor = 50;
      game.addMessage(p.kind === 'health' ? 'Picked up a medkit. +40 health' : p.kind === 'ammo' ? 'Picked up ammo. +24' : 'Picked up armour.');
      game.pickups.splice(i, 1);
    }
  }
}

export function drawEnemies(ctx, game) {
  for (const e of game.enemies) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y + 4, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e4d2';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // Gun barrel.
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(e.angle) * 8, e.y + Math.sin(e.angle) * 8);
    ctx.lineTo(e.x + Math.cos(e.angle) * 22, e.y + Math.sin(e.angle) * 22);
    ctx.stroke();
    // Health bar.
    const max = e.kind === 'brute' ? 120 : 70;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(e.x - 16, e.y - 26, 32 * Math.max(0, e.health / max), 5);
  }
}

export function drawBulletsAndPickups(ctx, game) {
  for (const b of game.bullets) {
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const p of game.pickups) {
    const bobY = Math.sin(p.bob) * 3;
    ctx.fillStyle = p.kind === 'health' ? '#e8e4d2' : p.kind === 'ammo' ? '#2f2f2f' : '#3d6fc9';
    ctx.beginPath();
    ctx.arc(p.x, p.y + bobY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.kind === 'health' ? '#d21f3c' : '#ffd21f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bobY, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = p.kind === 'health' ? '#d21f3c' : '#ffd21f';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.kind === 'health' ? '+' : p.kind === 'ammo' ? 'A' : 'S', p.x, p.y + bobY + 4);
    ctx.textAlign = 'left';
  }
}
