// Rico Vale on foot: WASD movement, sprint, aim with the mouse, punch
// with Space, shoot with click. The player is a circle with a facing
// angle; the camera and the HUD read the same fields.
//
// Aiming in v2: the mouse points at the ground plane under the cursor
// (screenToGround in render3d.js), so Rico aims where the player looks
// in the 3D view. Drawing moved to render3d.js.
import { PLAYER_WALK_SPEED, PLAYER_SPRINT_SPEED, PLAYER_HEALTH_MAX } from './config.js';
import { isDown } from './input.js';
import { resolveCityCollision } from './city.js';
import { screenToGround } from './render3d.js';

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
  // Aim at the ground under the mouse cursor in the 3D view.
  const aim = screenToGround(game, input.mouse.x, input.mouse.y);
  player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
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
  // Sprint dust.
  if (player.moving && player.sprinting && Math.random() < 0.3) {
    game.particles.push({
      x: player.x, y: player.y + 8, vx: 0, vy: 0, life: 0.4, max: 0.4,
      size: 5, color: 'rgba(200,190,160,0.5)',
    });
  }
}
