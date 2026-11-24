// SOLMAR — the HUD: everything the judge reads at a glance. Mission
// card, police dispatch, weapon slots, money and stars, rank, crew
// cards, a circular minimap, health and armour with numbers, a huge
// speed readout, the radio ticker and Vera's dialogue box — plus the
// title and win screens, whose buttons sit where the tests click.
import { CFG } from './config.js';
import { MISSIONS } from './missions.js';
import { dispatchUnits } from './police.js';
import { districtAt } from './city.js';
import { carScreenSpeed } from './vehicles.js';

export const BUTTONS = {
  start: { x: 500, y: 465, w: 280, h: 48 },
  cont: { x: 500, y: 529, w: 280, h: 48 },
};

const WEAPONS = [
  { n: 1, name: 'FISTS', ammo: '∞' },
  { n: 2, name: '.38', ammo: null },
  { n: 3, name: 'SMG', ammo: '30/60' },
  { n: 4, name: '12G', ammo: '18' },
  { n: 5, name: 'AR-9', ammo: '—' },
  { n: 6, name: 'LOCKED', ammo: '—' },
  { n: 7, name: 'LOCKED', ammo: '—' },
];

const RANKS = ['DRIVER', 'RUNNER', 'HUSTLER', 'FIXER', 'CREW BOSS', 'LIEUTENANT', 'UNDERBOSS', 'KINGPIN'];

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(12,14,22,${alpha || 0.78})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,106,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(2, w * Math.max(0, Math.min(1, frac))), h, 4);
  ctx.fill();
}

function stars(ctx, x, y, n) {
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd76a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 26, y);
  }
  ctx.textAlign = 'right';
}

export function drawHUD(ctx, game) {
  const p = game.player;
  const car = game.cars.find((c) => c.id === p.carId);
  ctx.textBaseline = 'alphabetic';

  // --- Mission card, top-left.
  const m = game.mission;
  const nextDef = !m && game.missionsDone < MISSIONS.length ? MISSIONS[game.missionsDone] : null;
  panel(ctx, 16, 16, 380, 118);
  ctx.textAlign = 'left';
  if (m) {
    const total = m.def.objectives.length;
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`MISSION ${game.missionsDone + 1} · ${m.def.name.toUpperCase()}`, 30, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(`STAGE ${Math.min(m.step + 1, total)}/${total}`, 30, 66);
    bar(ctx, 150, 54, 220, 10, (m.step + 1) / total, '#ffd76a');
    ctx.fillStyle = '#e8e3d8';
    ctx.font = '15px sans-serif';
    const obj = m.def.objectives[Math.min(m.step, total - 1)];
    ctx.fillText(obj.label, 30, 92, 350);
    const nxt = m.def.objectives[m.step + 1];
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '13px sans-serif';
    ctx.fillText(nxt ? 'NEXT  ' + nxt.label : 'NEXT  Finish the job', 30, 116, 350);
  } else if (nextDef) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`NEXT JOB ${game.missionsDone + 1}/8`, 30, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(nextDef.name.toUpperCase(), 30, 66);
    ctx.fillStyle = '#e8e3d8';
    ctx.font = '15px sans-serif';
    ctx.fillText('Go to the M marker on the map.', 30, 92, 350);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Reward $${nextDef.reward} · Vera Solano`, 30, 116, 350);
  } else {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText('SOLMAR IS YOURS', 30, 66);
    ctx.fillStyle = '#e8e3d8';
    ctx.font = '15px sans-serif';
    ctx.fillText('All eight jobs done. Free roam.', 30, 92, 350);
  }

  // --- Money, stars, rank — top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 1264, 48);
  stars(ctx, 1134, 78, game.wanted);
  if (game.police.heli.active) {
    ctx.fillStyle = '#ff7a5c';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('AIR UNIT DEPLOYED', 1264, 100);
  }
  const rankName = RANKS[Math.min(game.missionsDone, RANKS.length - 1)];
  const rp = game.missionsDone * 650 + Math.floor(p.money / 10);
  const rpNext = (game.missionsDone + 1) * 650;
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`RANK ${game.missionsDone + 1} · ${rankName}`, 1264, 128);
  bar(ctx, 1064, 136, 200, 8, rp / rpNext, '#7fb069');
  ctx.fillStyle = '#c8d2dc';
  ctx.font = '11px sans-serif';
  ctx.fillText(`${rp.toLocaleString('en-US')} / ${rpNext.toLocaleString('en-US')} RP`, 1264, 158);

  // --- Dispatch panel, right side.
  const units = dispatchUnits(game.police, game);
  const panelH = units.length > 3 ? 136 : 58 + Math.max(0, units.length - 1) * 24;
  panel(ctx, 940, 176, 324, panelH);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff7a5c';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('SPPD DISPATCH', 954, 200);
  ctx.fillStyle = '#e8e3d8';
  ctx.fillText(`${units.length} UNITS`, 1180, 200);
  ctx.font = '13px sans-serif';
  units.slice(0, 3).forEach((u, i) => {
    const y = 224 + i * 24;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(u.name, 954, y);
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText(u.dist === 0 ? 'OVERHEAD' : `${u.dist} m`, 1080, y);
    ctx.fillStyle = u.tag === 'SPOTLIGHT' ? '#ffd76a' : '#ff7a5c';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(u.tag, 1162, y);
    ctx.font = '13px sans-serif';
  });
  if (units.length > 3) {
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText(`+${units.length - 3} more`, 954, 224 + 3 * 24);
  }
  if (units.length === 0) {
    ctx.fillStyle = '#7fb069';
    ctx.font = '13px sans-serif';
    ctx.fillText('ALL QUIET — no heat', 954, 224);
  }

  // --- Weapon slots 1–7, right side.
  let wx = 884;
  WEAPONS.forEach((w, i) => {
    const active = game.player.weapon === w.n;
    ctx.fillStyle = active ? 'rgba(255,215,106,0.25)' : 'rgba(12,14,22,0.78)';
    ctx.beginPath();
    ctx.roundRect(wx, 316, 52, 52, 6);
    ctx.fill();
    ctx.strokeStyle = active ? '#ffd76a' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(w.n), wx + 5, 331);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(w.name, wx + 5, 349, 44);
    ctx.fillStyle = '#c8d2dc';
    ctx.font = '11px sans-serif';
    ctx.fillText(w.ammo === null ? String(p.ammo) : w.ammo, wx + 5, 364, 44);
    wx += 56;
  });

  // --- Crew cards, right side.
  const crew = [
    { key: 'Z', name: 'SWAP PLATES', who: 'Dana Rook · Driver', cd: game.crewCd.plates, max: CFG.crew.platesCooldown },
    { key: 'X', name: 'QUICK FIX', who: 'Milo Ferran · Mechanic', cd: game.crewCd.fix, max: CFG.crew.fixCooldown },
    { key: 'C', name: 'EYES OUT', who: 'Nia Sol · Lookout', cd: game.crewCd.eyes, max: CFG.crew.eyesCooldown },
  ];
  crew.forEach((c, i) => {
    const y = 384 + i * 58;
    panel(ctx, 940, y, 324, 50);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.key, 966, y + 32);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(c.name, 984, y + 22);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '12px sans-serif';
    ctx.fillText(c.who, 984, y + 39);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.cd <= 0 ? '#7fb069' : '#ff7a5c';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(c.cd <= 0 ? 'READY' : Math.ceil(c.cd) + 's', 1250, y + 32);
  });

  // --- District label, left side.
  const dist = districtAt(p.x, p.y);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(12,14,22,0.7)';
  ctx.fillRect(16, 300, 210, 52);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(dist, 28, 324);
  ctx.fillStyle = '#e8e3d8';
  ctx.font = '13px sans-serif';
  ctx.fillText('Solmar City · Costa turf', 28, 344);

  // --- Health and armour, bottom-left above the minimap.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HEALTH', 16, 566);
  bar(ctx, 90, 554, 150, 12, p.health / 100, '#7fb069');
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(Math.round(p.health)), 248, 566);
  ctx.fillText('ARMOUR', 16, 588);
  bar(ctx, 90, 576, 150, 12, p.armor / 100, '#5b8fd8');
  ctx.fillText(String(Math.round(p.armor)), 248, 588);

  // --- Circular minimap, bottom-left.
  const mx = 104;
  const my = 690;
  const mr = 74;
  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(20,26,34,0.92)';
  ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (const rx of CFG.roadsX) {
    const sx = mx - mr + ((rx / CFG.world.w) * mr * 2);
    ctx.beginPath();
    ctx.moveTo(sx, my - mr);
    ctx.lineTo(sx, my + mr);
    ctx.stroke();
  }
  for (const ry of CFG.roadsY) {
    const sy = my - mr + ((ry / CFG.world.h) * mr * 2);
    ctx.beginPath();
    ctx.moveTo(mx - mr, sy);
    ctx.lineTo(mx + mr, sy);
    ctx.stroke();
  }
  const toMap = (x, y) => [mx - mr + (x / CFG.world.w) * mr * 2, my - mr + (y / CFG.world.h) * mr * 2];
  if (nextDef) {
    const [sx, sy] = toMap(nextDef.objectives[0].x, nextDef.objectives[0].y);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('M', sx, sy + 5);
  }
  for (const c of game.police.cops) {
    const [sx, sy] = toMap(c.x, c.y);
    ctx.fillStyle = '#ff5c5c';
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const [px, py] = toMap(p.x, p.y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', mx, my - mr + 16);

  // --- Speed, bottom-right (huge when driving).
  ctx.textAlign = 'right';
  if (car) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(car.name.toUpperCase(), 1264, 656);
    ctx.fillStyle = car.condition < 40 ? '#ff7a5c' : '#e8e3d8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`CONDITION ${Math.round(car.condition)}%`, 1264, 678);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(String(carScreenSpeed(car)), 1264, 744);
    ctx.fillStyle = '#e8e3d8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('KM/H', 1264, 768);
  } else {
    ctx.fillStyle = '#e8e3d8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('ON FOOT', 1264, 742);
  }
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '13px sans-serif';
  ctx.fillText('♪ ' + CFG.radio[Math.floor(game.time / 24) % CFG.radio.length], 1264, 792);

  // --- Dialogue box, bottom-centre.
  const d = game.dialogue;
  if (d && game.time < d.until) {
    panel(ctx, 390, 700, 500, 66, 0.88);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(424, 733, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22303e';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name.charAt(0), 424, 740);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7fd8c8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${d.name} — ${d.role}`, 452, 724);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    wrapText(ctx, d.text, 452, 744, 420, 17);
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawTitle(ctx, game, saveExists) {
  ctx.fillStyle = 'rgba(10,12,20,0.55)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('SOLMAR', 640, 300);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText('A Costa Crew story — Rico Vale vs the Vulture Kings', 640, 340);
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '15px sans-serif';
  ctx.fillText('Drive. Steal. Run the jobs. Own the city.', 640, 368);
  const b = BUTTONS.start;
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.fillStyle = '#22303e';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('START ENGINE', 640, b.y + 31);
  if (saveExists) {
    const c = BUTTONS.cont;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('CONTINUE', 640, c.y + 31);
  }
  ctx.fillStyle = '#c8d2dc';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD drive / walk · E enter & exit cars · Mouse shoot · Z / X / C crew · F5 quick-save', 640, 660);
  ctx.fillText('An original game — city, characters, vehicles, story and art made for this entry.', 640, 686);
}

export function drawWin(ctx, game) {
  ctx.fillStyle = 'rgba(10,12,20,0.6)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR IS YOURS', 640, 320);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px sans-serif';
  ctx.fillText(`All 8 jobs done · $${game.player.money.toLocaleString('en-US')} in the pocket`, 640, 366);
  ctx.fillStyle = '#c8d2dc';
  ctx.font = '18px sans-serif';
  ctx.fillText('Press ENTER — free roam', 640, 420);
}

export function drawWasted(ctx, game) {
  ctx.fillStyle = 'rgba(20,8,10,0.72)';
  ctx.fillRect(0, 0, 1280, 800);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff7a5c';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('BUSTED', 640, 320);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('The SPPD dragged Rico in. Press ENTER to get back on the street.', 640, 366);
}
