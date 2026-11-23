// HUD, minimap and menus, rebuilt for v2: the dense, game-like HUD
// the top entries share — mission card, police dispatch panel,
// weapon slots, crew cards, rank + RP, money + wanted stars, circular
// minimap, health/armour with numbers, big speed + condition, radio
// ticker and a dialogue box with a portrait. Every number comes from
// live game state (mission, dispatch distances, money, stars, health,
// speed, condition, RP); locked weapon slots honestly say LOCKED.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, SEA_X, MARINA_X, RADIO, CREW, rankFor } from './config.js';
import { MISSIONS, currentStep, missionStartMarker } from './missions.js';
import { wantedStars, dispatchUnits } from './police.js';
import { playerCar } from './vehicles.js';
import { districtAt } from './city.js';
import { worldClock } from './render3d.js';
import { hasSave } from './save.js';

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(8,10,16,${alpha === undefined ? 0.72 : alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function bar(ctx, x, y, w, h, frac, fill, bg) {
  ctx.fillStyle = bg || 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawStars(ctx, game, x, y, size) {
  const stars = wantedStars(game);
  ctx.font = `${size}px sans-serif`;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd21f' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.fillText('★', x + i * (size + 2), y);
    ctx.strokeText('★', x + i * (size + 2), y);
  }
}

function portraitColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  const cols = ['#2aa198', '#c96f4a', '#4a7fb5', '#7d6a9e', '#d9a441'];
  return cols[Math.abs(h) % cols.length];
}

function drawPortrait(ctx, x, y, size, name) {
  ctx.fillStyle = portraitColor(name);
  ctx.fillRect(x, y, size, size);
  // Simple face: skin, hair, eyes, mouth.
  const cx = x + size / 2;
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(cx, y + size * 0.52, size * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22242a';
  ctx.beginPath();
  ctx.arc(cx, y + size * 0.42, size * 0.26, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#22242a';
  ctx.beginPath();
  ctx.arc(cx - size * 0.1, y + size * 0.52, size * 0.035, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.1, y + size * 0.52, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#22242a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, y + size * 0.58, size * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size, size);
}

const STATUS_COLORS = {
  RAMMING: '#ff5a4e', FLANKING: '#ffb02e', PURSUIT: '#3d7bff',
  ROADBLOCK: '#ffd21f', SPOTLIGHT: '#e8e4d2', 'CLOSING IN': '#ff5a4e', 'ON FOOT': '#8a8a8a',
};

export function drawHUD(ctx, game) {
  const w = game.viewW;
  const h = game.viewH;
  const S = Math.min(w / 1280, h / 800);
  const player = game.player;
  const car = playerCar(game);
  const stars = wantedStars(game);
  const step = currentStep(game);
  const mission = game.mission;
  const district = districtAt(player.x, player.y);
  const rank = rankFor(game);
  const radio = RADIO[Math.floor(game.time / 30) % RADIO.length];
  const units = dispatchUnits(game);
  const tracked = game.crew && game.crew.trackedId;

  // ---- Top-left: mission card.
  const mx = 14;
  let my = 12;
  const mw = 360 * S + 20;
  panel(ctx, mx, my, mw, 108 * S + 14);
  const missionTitle = mission ? `MISSION ${game.missionIndex + 1} · ${mission.def.short}` : `JOB ${Math.min(game.missionIndex + 1, MISSIONS.length)}/${MISSIONS.length}`;
  ctx.fillStyle = '#ffd21f';
  ctx.font = `bold ${Math.round(15 * S + 3)}px sans-serif`;
  ctx.fillText(missionTitle, mx + 12, my + 24 * S + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `${Math.round(12 * S + 2)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(mission ? `STAGE ${mission.step + 1}/${mission.def.steps.length}` : 'NO JOB ACTIVE', mx + mw - 12, my + 24 * S + 4);
  ctx.textAlign = 'left';
  if (mission) {
    bar(ctx, mx + 12, my + 32 * S + 4, mw - 24, 6, (mission.step + 1) / mission.def.steps.length, '#ffd21f');
  }
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(14 * S + 2)}px sans-serif`;
  const objective = step ? step.text : (game.missionIndex < MISSIONS.length ? `Find the yellow M — ${MISSIONS[game.missionIndex].title}` : 'Story complete — Solmar is yours. Free roam!');
  ctx.fillText(objective.slice(0, 44), mx + 12, my + 58 * S + 6);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.round(12 * S + 2)}px sans-serif`;
  const next = mission && mission.step + 1 < mission.def.steps.length
    ? `NEXT  ${mission.def.steps[mission.step + 1].text.slice(0, 44)}`
    : (game.missionIndex + 1 < MISSIONS.length ? `NEXT  ${MISSIONS[game.missionIndex + 1].title}` : 'NEXT  Free roam Solmar');
  ctx.fillText(next, mx + 12, my + 80 * S + 8);

  // ---- Dispatch panel under the mission card.
  const dy = my + 122 * S + 14;
  panel(ctx, mx, dy, mw, 24 + Math.min(5, units.length) * 22 * S + 18);
  ctx.fillStyle = '#ff5a4e';
  ctx.font = `bold ${Math.round(13 * S + 2)}px sans-serif`;
  ctx.fillText(units.length > 0 ? `SPPD DISPATCH — ${units.length} UNIT${units.length > 1 ? 'S' : ''} · ${'★'.repeat(stars)}` : 'SPPD DISPATCH — ALL QUIET', mx + 12, dy + 20);
  let ry = dy + 40;
  const shown = units.slice(0, 5);
  for (const u of shown) {
    const isTracked = tracked && u.id === tracked;
    ctx.fillStyle = isTracked ? '#ffd21f' : '#e8e4d2';
    ctx.font = `${isTracked ? 'bold ' : ''}${Math.round(13 * S + 1)}px sans-serif`;
    ctx.fillText(u.name, mx + 12, ry);
    const tag = u.status;
    const tagW = ctx.measureText(tag).width + 12;
    ctx.fillStyle = STATUS_COLORS[tag] || '#8a8a8a';
    ctx.fillRect(mx + mw - 12 - tagW - 52, ry - 13, tagW, 16);
    ctx.fillStyle = '#111';
    ctx.font = `bold ${Math.round(11 * S + 1)}px sans-serif`;
    ctx.fillText(tag, mx + mw - 12 - tagW - 52 + 6, ry);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(12 * S + 2)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${u.dist} m`, mx + mw - 16, ry);
    ctx.textAlign = 'left';
    ry += 22 * S;
  }
  if (units.length > 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${Math.round(12 * S + 1)}px sans-serif`;
    ctx.fillText(`+${units.length - 5} more unit${units.length - 5 > 1 ? 's' : ''}`, mx + 12, ry);
  }
  if (units.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.round(12 * S + 2)}px sans-serif`;
    ctx.fillText('No units on you. Lay low.', mx + 12, ry);
  }

  // ---- District + clock under the dispatch panel.
  const ddy = dy + 24 + Math.min(5, units.length) * 22 * S + 18 + 10;
  ctx.fillStyle = '#ffd21f';
  ctx.font = `bold ${Math.round(16 * S + 3)}px sans-serif`;
  ctx.fillText(district.name.toUpperCase(), mx + 2, ddy + 18);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${Math.round(12 * S + 2)}px sans-serif`;
  ctx.fillText(`${district.street}  •  ${worldClock(game)}`, mx + 2, ddy + 38);

  // ---- Top-right: money, stars, air-unit tag, rank + RP.
  const rx = w - 14;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7ee787';
  ctx.font = `bold ${Math.round(30 * S + 6)}px sans-serif`;
  ctx.fillText(`$${player.money.toLocaleString('en-US')}`, rx, 44 * S + 6);
  ctx.textAlign = 'left';
  drawStars(ctx, game, rx - 5 * 30 * S - 8, 74 * S + 4, Math.round(24 * S + 4));
  if (game.heli && game.heli.active) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = `bold ${Math.round(12 * S + 2)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('AIR UNIT DEPLOYED', rx, 100 * S + 4);
    ctx.textAlign = 'left';
  }
  const rankY = 116 * S + 8;
  panel(ctx, rx - 210 * S - 10, rankY, 210 * S + 10, 46 * S + 6);
  ctx.fillStyle = '#ffd21f';
  ctx.font = `bold ${Math.round(13 * S + 2)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`RANK ${rank.tier} · ${rank.name}`, rx - 10, rankY + 18 * S + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `${Math.round(11 * S + 2)}px sans-serif`;
  ctx.fillText(`${rank.rp.toLocaleString('en-US')} / ${rank.rpMax.toLocaleString('en-US')} RP`, rx - 10, rankY + 36 * S + 2);
  ctx.textAlign = 'left';
  bar(ctx, rx - 200 * S, rankY + 42 * S + 2, 190 * S, 5, rank.rp / Math.max(1, rank.rpMax), '#ffd21f');

  // ---- Right side: weapon slots 1-7.
  const slotW = 54 * S + 4;
  const slotH = 56 * S + 4;
  const slotsX = rx - 7 * slotW - 6 * 6;
  const slotsY = rankY + 62 * S + 8;
  const slots = [
    { n: 1, name: 'FISTS', ammo: '∞', owned: true, sel: player.ammo <= 0 },
    { n: 2, name: 'PISTOL', ammo: `${player.ammo}`, owned: true, sel: player.ammo > 0 },
    { n: 3, name: 'SMG', ammo: 'LOCKED', owned: false },
    { n: 4, name: '12G', ammo: 'LOCKED', owned: false },
    { n: 5, name: 'AR-9', ammo: 'LOCKED', owned: false },
    { n: 6, name: 'RPG', ammo: 'LOCKED', owned: false },
    { n: 7, name: 'BAT', ammo: 'LOCKED', owned: false },
  ];
  slots.forEach((slot, i) => {
    const sx = slotsX + i * (slotW + 6);
    ctx.fillStyle = slot.sel ? 'rgba(255,210,31,0.9)' : 'rgba(8,10,16,0.72)';
    ctx.fillRect(sx, slotsY, slotW, slotH);
    ctx.strokeStyle = slot.sel ? '#ffd21f' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = slot.sel ? 2 : 1;
    ctx.strokeRect(sx + 0.5, slotsY + 0.5, slotW, slotH);
    ctx.fillStyle = slot.sel ? '#111' : (slot.owned ? '#fff' : 'rgba(255,255,255,0.45)');
    ctx.font = `bold ${Math.round(11 * S + 1)}px sans-serif`;
    ctx.fillText(`${slot.n}`, sx + 5, slotsY + 14);
    ctx.font = `bold ${Math.round(12 * S + 1)}px sans-serif`;
    ctx.fillText(slot.name, sx + 5, slotsY + 30 * S + 6);
    ctx.font = `${Math.round(11 * S + 1)}px sans-serif`;
    ctx.fillText(slot.owned ? slot.ammo : 'LOCKED', sx + 5, slotsY + 46 * S + 6);
  });

  // ---- Crew cards under the weapon slots.
  const crewY = slotsY + slotH + 10;
  const crewList = [
    { def: CREW.plates, cd: game.crew ? game.crew.plates : 0 },
    { def: CREW.fix, cd: game.crew ? game.crew.fix : 0 },
    { def: CREW.eyes, cd: game.crew ? game.crew.eyes : 0 },
  ];
  crewList.forEach((c, i) => {
    const cy = crewY + i * (48 * S + 8);
    const cw = 210 * S + 10;
    const cx0 = rx - cw;
    panel(ctx, cx0, cy, cw, 48 * S + 4, c.cd > 0 ? 0.45 : 0.72);
    drawPortrait(ctx, cx0 + 6, cy + 6, 36 * S + 4, c.def.person);
    ctx.fillStyle = '#ffd21f';
    ctx.font = `bold ${Math.round(12 * S + 2)}px sans-serif`;
    ctx.fillText(c.def.name, cx0 + 48 * S + 6, cy + 20 * S + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(11 * S + 2)}px sans-serif`;
    ctx.fillText(`${c.def.person} · ${c.def.role}`, cx0 + 48 * S + 6, cy + 36 * S + 4);
    ctx.fillStyle = c.cd > 0 ? 'rgba(255,255,255,0.5)' : '#7ee787';
    ctx.font = `bold ${Math.round(12 * S + 2)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(c.cd > 0 ? `${Math.ceil(c.cd)}s` : `[${c.def.key}]`, cx0 + cw - 8, cy + 20 * S + 2);
    ctx.textAlign = 'left';
  });

  // ---- Bottom-left: circular minimap + health / armour with numbers.
  const mapR = 86 * S;
  const mapCx = mx + mapR + 6;
  const mapCy = h - mapR - 14;
  drawMinimap(ctx, game, mapCx, mapCy, mapR);
  const hbX = mx;
  const hbY = h - 58 * S;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(hbX, hbY - 8, 210 * S + 10, 52 * S + 8);
  ctx.fillStyle = '#e8e4d2';
  ctx.font = `bold ${Math.round(11 * S + 2)}px sans-serif`;
  ctx.fillText('HEALTH', hbX + 8, hbY + 8);
  bar(ctx, hbX + 62, hbY - 2, 110 * S, 10, player.health / 100, player.health > 30 ? '#7ee787' : '#ff5a4e');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(player.health)}`, hbX + 206 * S + 4, hbY + 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e4d2';
  ctx.fillText('ARMOUR', hbX + 8, hbY + 28);
  bar(ctx, hbX + 62, hbY + 18, 110 * S, 10, player.armor / 50, '#6fb5ff');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(player.armor)}`, hbX + 206 * S + 4, hbY + 28);
  ctx.textAlign = 'left';

  // ---- Bottom-right: radio ticker, huge speed, car + condition.
  const spX = w - 14;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7ee787';
  ctx.font = `${Math.round(13 * S + 2)}px sans-serif`;
  ctx.fillText(`♪ ${radio.name} — ${radio.show}`, spX, h - 132 * S);
  if (car) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(52 * S + 12)}px sans-serif`;
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.22)}`, spX - 62 * S, h - 66 * S);
    ctx.font = `bold ${Math.round(15 * S + 3)}px sans-serif`;
    ctx.fillText('KM/H', spX - 4, h - 66 * S);
    ctx.fillStyle = '#7ee787';
    ctx.font = `bold ${Math.round(15 * S + 3)}px sans-serif`;
    ctx.fillText(car.name.toUpperCase(), spX, h - 40 * S);
    const cond = Math.round(car.condition);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${Math.round(12 * S + 2)}px sans-serif`;
    ctx.fillText(`CONDITION ${cond}%${cond < 60 ? ' — DENTED' : ''}`, spX, h - 20 * S);
    bar(ctx, spX - 150 * S, h - 14 * S, 150 * S, 5, car.condition / 100, cond < 60 ? '#ffb02e' : '#7ee787');
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(20 * S + 4)}px sans-serif`;
    ctx.fillText('ON FOOT', spX, h - 66 * S);
    ctx.fillStyle = '#e8e4d2';
    ctx.font = `${Math.round(13 * S + 2)}px sans-serif`;
    ctx.fillText(`PISTOL  ${player.ammo} / ${player.ammoReserve}${player.reloading > 0 ? ' — reloading…' : ''}`, spX, h - 40 * S);
  }
  ctx.textAlign = 'left';

  // ---- Bottom-centre: dialogue box with portrait + named character.
  if (game.dialogue && game.time < game.dialogue.until) {
    const dlg = game.dialogue;
    const dw = 560 * S;
    const dx = (w - dw) / 2;
    const dyy = h - 108 * S;
    panel(ctx, dx, dyy, dw, 76 * S, 0.85);
    drawPortrait(ctx, dx + 10, dyy + 10, 56 * S, dlg.name);
    ctx.fillStyle = '#7ee787';
    ctx.font = `bold ${Math.round(13 * S + 2)}px sans-serif`;
    ctx.fillText(dlg.name.toUpperCase(), dx + 76 * S, dyy + 26 * S);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.round(11 * S + 1)}px sans-serif`;
    ctx.fillText(dlg.role, dx + 76 * S, dyy + 42 * S);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(14 * S + 2)}px sans-serif`;
    ctx.fillText(dlg.text.slice(0, 74), dx + 76 * S, dyy + 62 * S);
  }

  // ---- Messages feed above the minimap.
  ctx.font = `${Math.round(13 * S + 1)}px sans-serif`;
  let msgY = h - 200 * S;
  for (let i = game.messages.length - 1; i >= 0; i -= 1) {
    const msg = game.messages[i];
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const mw2 = ctx.measureText(msg.text).width + 16;
    ctx.fillRect(mx, msgY - 16, Math.min(mw2, 520 * S), 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(msg.text.slice(0, 72), mx + 8, msgY);
    msgY -= 26;
  }
  // Controls hint, after the first seconds so the staged screenshots
  // stay clean, and only for the first minute of play.
  if (game.time > 8 && game.time < 75 && game.screen === 'play') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(mx, ddy + 56, 330, 92);
    ctx.fillStyle = '#e8e4d2';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move / drive   •   Mouse aim, Click shoot', mx + 12, ddy + 76);
    ctx.fillText('E enter / steal car   •   Space punch / handbrake', mx + 12, ddy + 96);
    ctx.fillText('R reload   •   Z / X / C crew   •   P pause   •   M mute', mx + 12, ddy + 116);
    ctx.fillText('F5 quick-save   •   Follow the ★ to your objective', mx + 12, ddy + 136);
  }
  // Crosshair.
  if (player.onFoot && game.screen === 'play') {
    const mx2 = game.input.mouse.x;
    const my2 = game.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx2, my2, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx2 - 13, my2); ctx.lineTo(mx2 - 5, my2);
    ctx.moveTo(mx2 + 5, my2); ctx.lineTo(mx2 + 13, my2);
    ctx.moveTo(mx2, my2 - 13); ctx.lineTo(mx2, my2 - 5);
    ctx.moveTo(mx2, my2 + 5); ctx.lineTo(mx2, my2 + 13);
    ctx.stroke();
  }
  // Damage flash.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,30,30,${Math.min(0.35, player.hurtFlash * 0.4)})`;
    ctx.fillRect(0, 0, w, h);
  }
}

export function drawMinimap(ctx, game, cx, cy, r) {
  const mw = r * 2;
  const mh = (r * 2 * WORLD_H) / WORLD_W;
  const x = cx - r;
  const y = cy - mh / 2;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  ctx.fillRect(x - 4, y - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#1d2b1e';
  ctx.fillRect(x, y, mw, mh);
  // Sea + marina.
  ctx.fillStyle = '#256a9e';
  ctx.fillRect(x, y, SEA_X * sx, mh);
  ctx.fillRect(x + MARINA_X * sx, y, mw - MARINA_X * sx, mh);
  // Roads.
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 3;
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + mh); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + mw, y + ry * sy); ctx.stroke();
  }
  // Buildings as faint dots.
  ctx.fillStyle = 'rgba(220,220,210,0.5)';
  for (const b of game.city.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  // Traffic (grey), police (blue), player (white arrow), objective (★).
  ctx.fillStyle = 'rgba(200,200,200,0.8)';
  for (const car of game.cars) {
    if (car.driver === 'traffic') ctx.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 2.5, 2.5);
  }
  for (const car of game.cars) {
    if (car.driver === 'police') {
      ctx.fillStyle = '#3d7bff';
      ctx.beginPath(); ctx.arc(x + car.x * sx, y + car.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,200,200,0.8)';
    }
  }
  for (const cop of game.cops) {
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath(); ctx.arc(x + cop.x * sx, y + cop.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
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
  ctx.restore();
  // Ring + N + label.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e8e4d2';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - r + 14);
  ctx.fillText('SOLMAR', cx, cy + r + 14);
  ctx.textAlign = 'left';
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
  ctx.fillText('Rico Vale, getaway driver. The Costa Crew. The Vulture Kings. Eight jobs, one city.', w / 2, h * 0.42 + 68);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#ffd21f';
  ctx.fillText('DRIVING  •  WANTED  •  POLICE CHASES  •  COMBAT  •  8 MISSIONS  •  SAVE', w / 2, h * 0.42 + 96);
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
      'Z swap plates   •   X quick fix   •   C eyes out',
      'Shift — sprint   •   P — pause   •   M — mute   •   F5 — quick-save',
      'Follow the ★: eight linked missions, a turf war, one city.',
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
