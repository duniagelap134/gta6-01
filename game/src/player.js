// Rico Vale on foot: WASD movement, sprint, aim with the mouse, punch
// with Space, shoot with click. The player is a circle with a facing
// angle; the camera and the HUD read the same fields.
import { PLAYER_WALK_SPEED, PLAYER_SPRINT_SPEED, PLAYER_HEALTH_MAX } from './config.js';
import { isDown } from './input.js';
import { resolveCityCollision } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: 14,
    health: PLAYER_HEALTH_MAX,
    armor: 0,
    money: 250,
    onFoot: true,
    carId: null,
    weapon: 'pistol',
    ammo: 12,
    ammoReserve: 48,
    reloading: 0,
    shootCooldown: 0,
    punchCooldown: 0,
    sprinting: false,
    moving: false,
    hurtFlash: 0,
    dead: false,
  };
}

export function damagePlayer(game, amount) {
  const player = game.player;
  if (player.dead || game.screen !== 'play') return;
  let left = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, left);
    player.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  player.hurtFlash = 0.5;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    game.screen = 'wasted';
    game.stats.deaths += 1;
  }
}

export function healPlayer(game, amount) {
  game.player.health = Math.min(PLAYER_HEALTH_MAX, game.player.health + amount);
}

export function updatePlayerOnFoot(game, dt) {
  const { input, player } = game;
  let mx = 0;
  let my = 0;
  if (isDown(input, 'KeyW', 'ArrowUp')) my -= 1;
  if (isDown(input, 'KeyS', 'ArrowDown')) my += 1;
  if (isDown(input, 'KeyA', 'ArrowLeft')) mx -= 1;
  if (isDown(input, 'KeyD', 'ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my);
  player.sprinting = isDown(input, 'ShiftLeft', 'ShiftRight') && len > 0;
  const speed = player.sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  player.moving = len > 0;
  if (len > 0) {
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
  }
  // Aim at the mouse (world coordinates through the camera).
  const wx = game.camera.x + input.mouse.x / game.camera.zoom;
  const wy = game.camera.y + input.mouse.y / game.camera.zoom;
  player.angle = Math.atan2(wy - player.y, wx - player.x);
  if (resolveCityCollision(game.city, player, player.radius)) {
    // bumped into a wall; nothing else to do
  }
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      const need = 12 - player.ammo;
      const take = Math.min(need, player.ammoReserve);
      player.ammo += take;
      player.ammoReserve -= take;
    }
  }
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
}

export function drawPlayer(ctx, game) {
  const player = game.player;
  if (!player.onFoot || player.dead) return;
  const night = game.night;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(player.x + 3, player.y + 5, 13, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: teal jacket, dark jeans — Rico's look.
  ctx.fillStyle = night ? '#1e6f6a' : '#2aa198';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22242a';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
  ctx.fill();
  // Facing nose + gun when aiming.
  const nx = player.x + Math.cos(player.angle) * 13;
  const ny = player.y + Math.sin(player.angle) * 13;
  ctx.strokeStyle = '#1c1c1c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8);
  ctx.lineTo(nx + Math.cos(player.angle) * 8, ny + Math.sin(player.angle) * 8);
  ctx.stroke();
  // Sprint dust.
  if (player.moving && player.sprinting && Math.random() < 0.3) {
    game.particles.push({
      x: player.x, y: player.y + 8, vx: 0, vy: 0, life: 0.4, max: 0.4,
      size: 5, color: 'rgba(200,190,160,0.5)',
    });
  }
}
