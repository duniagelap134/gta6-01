// SOLMAR — saving. One slot in localStorage: money, progress, health,
// armour, ammo and where Rico stands. Loading puts him back exactly
// there, in play, with the same story state.
import { CFG } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(CFG.saveKey) !== null;
  } catch (err) {
    return false;
  }
}

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      money: p.money,
      missionsDone: game.missionsDone,
      health: p.health,
      armor: p.armor,
      ammo: p.ammo,
      x: p.x,
      y: p.y,
      onFoot: p.onFoot,
      heat: game.heat,
    };
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function applySave(game, data) {
  const p = game.player;
  p.money = data.money;
  p.health = data.health;
  p.armor = data.armor;
  p.ammo = data.ammo;
  p.x = data.x;
  p.y = data.y;
  p.onFoot = true;
  p.carId = null;
  p.dead = false;
  game.missionsDone = data.missionsDone;
  game.heat = data.heat || 0;
  game.mission = null;
}
