// HUD, minimap and menus: health, armour, cash, wanted stars, mission
// banner, speed, messages, damage flash, the start screen, pause,
// busted / wasted / win screens — and the minimap that shows the whole
// city, the player, police, traffic and the mission marker at a glance.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, SEA_X, MARINA_X } from './config.js';
import { MISSIONS, currentStep, missionStartMarker } from './missions.js';
import { wantedStars } from './police.js';
import { playerCar } from './vehicles.js';
import { districtAt } from './city.js';
import { hasSave } from './save.js';

function drawStars(ctx, game, x, y) {
  const stars = wantedStars(game);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd21f' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.font = '28px sans-serif';
    ctx.fillText('★', x + i * 30, y);
    ctx.strokeText('★', x + i * 30, y);
  }
}

export function drawHUD(ctx, game) {
  const w = game.viewW;
  const h = game.viewH;
  const player = game.player;
  // Top-left: cash, health, armour.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(14, 12, 250, 92);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${player.money}`, 26, 44);
  ctx.fillStyle = '#e8e4d2';
  ctx.font = '13px sans-serif';
  ctx.fillText('SOLMAR  •  ' + districtAt(player.x, player.y).toUpperCase(), 26, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(26, 72, 200, 10);
  ctx.fillStyle = player.health > 30 ? '#7ee787' : '#ff5a4e';
  ctx.fillRect(26, 72, 200 * Math.max(0, player.health / 100), 10);
  if (player.armor > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(26, 88, 200, 6);
    ctx.fillStyle = '#6fb5ff';
    ctx.fillRect(26, 88, 200 * Math.max(0, player.armor / 50), 6);
  }
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(w - 196, 12, 182, 46);
  drawStars(ctx, game, w - 184, 42);
  // Top-centre: mission objective.
  const step = currentStep(game);
  const banner = step
    ? step.text
    : game.missionIndex < MISSIONS.length
      ? `Next: ${MISSIONS[game.missionIndex].title} — find the yellow M`
      : 'Story complete — Solmar is yours. Free roam!';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const bw = Math.min(620, ctx.measureText(banner).width + 90);
  ctx.fillRect((w - bw) / 2, 12, bw, 46);
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(banner, w / 2, 41);
  ctx.textAlign = 'left';
  // Bottom-left: weapon + speed.
  const car = playerCar(game);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(14, h - 84, 250, 70);
  ctx.fillStyle = '#e8e4d2';
  ctx.font = 'bold 16px sans-serif';
  if (car) {
    ctx.fillText(`${car.name}`, 26, h - 56);
    ctx.font = '26px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.22)} km/h`, 26, h - 26);
  } else {
    ctx.fillText('PISTOL', 26, h - 56);
    ctx.font = '15px sans-serif';
    ctx.fillText(`Ammo ${player.ammo} / ${player.ammoReserve}${player.reloading > 0 ? ' — reloading…' : ''}`, 26, h - 30);
  }
  // Bottom-right: minimap.
  drawMinimap(ctx, game, w - 224, h - 184, 210, 170);
  // Messages feed above the minimap.
  ctx.font = '14px sans-serif';
  let my = h - 200;
  for (let i = game.messages.length - 1; i >= 0; i -= 1) {
    const msg = game.messages[i];
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const mw = ctx.measureText(msg.text).width + 16;
    ctx.fillRect(w - 240 - mw + 16, my - 16, mw, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(msg.text, w - 240 - mw + 24, my);
    my -= 26;
  }
  // Controls hint, first minute only.
  if (game.time < 75 && game.screen === 'play') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(14, 116, 330, 92);
    ctx.fillStyle = '#e8e4d2';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move / drive   •   Mouse aim, Click shoot', 26, 136);
    ctx.fillText('E enter / steal car   •   Space punch / handbrake', 26, 156);
    ctx.fillText('R reload   •   Shift sprint   •   P pause   •   M mute', 26, 176);
    ctx.fillText('F5 quick-save   •   Follow the ★ to your objective', 26, 196);
  }
  // Crosshair.
  if (player.onFoot && game.screen === 'play') {
    const mx = game.input.mouse.x;
    const my2 = game.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my2, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my2); ctx.lineTo(mx - 5, my2);
    ctx.moveTo(mx + 5, my2); ctx.lineTo(mx + 13, my2);
    ctx.moveTo(mx, my2 - 13); ctx.lineTo(mx, my2 - 5);
    ctx.moveTo(mx, my2 + 5); ctx.lineTo(mx, my2 + 13);
    ctx.stroke();
  }
  // Damage flash.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,30,30,${Math.min(0.35, player.hurtFlash * 0.4)})`;
    ctx.fillRect(0, 0, w, h);
  }
}

export function drawMinimap(ctx, game, x, y, mw, mh) {
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(x - 6, y - 6, mw + 12, mh + 12);
  ctx.fillStyle = '#1d2b1e';
  ctx.fillRect(x, y, mw, mh);
  // Sea + marina.
  ctx.fillStyle = '#256a9e';
  ctx.fillRect(x, y, SEA_X * sx, mh);
  ctx.fillRect(x + MARINA_X * sx, y, mw - MARINA_X * sx, mh);
  // Roads.
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 4;
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + mh); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + mw, y + ry * sy); ctx.stroke();
  }
  // Buildings as faint dots.
  ctx.fillStyle = 'rgba(220,220,210,0.5)';
  for (const b of game.city.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  // Traffic (grey), police (blue/red), player (white arrow), objective (★).
  ctx.fillStyle = 'rgba(200,200,200,0.8)';
  for (const car of game.cars) {
    if (car.driver === 'traffic') ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 3, 3);
  }
  for (const car of game.cars) {
    if (car.driver === 'police') {
      ctx.fillStyle = '#3d7bff';
      ctx.beginPath(); ctx.arc(x + car.x * sx, y + car.y * sy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,200,200,0.8)';
    }
  }
  for (const cop of game.cops) {
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath(); ctx.arc(x + cop.x * sx, y + cop.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const step = currentStep(game);
  const start = missionStartMarker(game);
  const target = step ? { x: step.x, y: step.y } : start;
  if (target) {
    const pulse = 3 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath(); ctx.arc(x + target.x * sx, y + target.y * sy, pulse + 2, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const px = x + game.player.x * sx;
  const py = y + game.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#e8e4d2';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('SOLMAR', x, y - 10);
}

// Full-screen overlays. `onStart` / `onContinue` are wired by main.js
// through game.uiAction so clicks work without DOM buttons.
export function drawTitleScreen(ctx, game) {
  const w = game.viewW;
  const h = game.viewH;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ff9d5c');
  grad.addColorStop(0.45, '#e86a6a');
  grad.addColorStop(1, '#2b1a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun + skyline silhouette.
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,16,50,0.85)';
  const base = h * 0.78;
  const towers = [0.5, 0.72, 0.6, 0.85, 0.66, 0.78, 0.55];
  towers.forEach((t, i) => {
    const tw = w / towers.length;
    ctx.fillRect(i * tw + 12, base - h * 0.42 * t, tw - 24, h * 0.42 * t);
  });
  ctx.fillRect(0, base, w, h - base);
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 96px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR', w / 2, h * 0.42);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('A sun-soaked open-world crime story', w / 2, h * 0.42 + 38);
  ctx.font = '16px sans-serif';
  ctx.fillText('Rico Vale, getaway driver. The Costa Crew. The Vulture Kings. One city, three jobs.', w / 2, h * 0.42 + 68);
  // Buttons (hit boxes stored for click handling).
  const bw = 300;
  const bx = w / 2 - bw / 2;
  game.uiButtons = [];
  const buttons = [];
  buttons.push({ label: '▶  START ENGINE', action: 'start', y: h * 0.58 });
  if (hasSave()) buttons.push({ label: '↻  CONTINUE', action: 'continue', y: h * 0.58 + 64 });
  buttons.push({ label: 'HOW TO PLAY', action: 'help', y: h * 0.58 + (hasSave() ? 128 : 64) });
  for (const b of buttons) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, b.y, bw, 50);
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, b.y, bw, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(b.label, w / 2, b.y + 32);
    game.uiButtons.push({ ...b, x: bx, w: bw, h: 50 });
  }
  if (game.showHelp) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(w / 2 - 330, h * 0.2, 660, 300);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HOW TO PLAY', w / 2, h * 0.2 + 36);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    const lines = [
      'WASD / Arrows — walk or drive',
      'Mouse — aim   •   Click — shoot   •   Space — punch / handbrake',
      'E — get in a car, steal one, get out   •   R — reload',
      'Shift — sprint   •   P — pause   •   M — mute   •   F5 — quick-save',
      'Follow the ★: three linked missions, a turf war, one city.',
      'Stealing cars, shooting and hitting pedestrians raise your',
      'wanted level — lose the cops, or pay the fine at the precinct.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.2 + 68 + i * 24));
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game. SOLMAR, its people and its story are invented — no Rockstar content.', w / 2, h - 22);
  ctx.textAlign = 'left';
}

export function drawOverlay(ctx, game, title, lines, hint) {
  const w = game.viewW;
  const h = game.viewH;
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, w / 2, h * 0.4);
  ctx.fillStyle = '#fff';
  ctx.font = '19px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.4 + 40 + i * 30));
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px sans-serif';
  ctx.fillText(hint, w / 2, h * 0.4 + 40 + lines.length * 30 + 26);
  ctx.textAlign = 'left';
}
