// Save / load through localStorage: money, missions finished, the
// player's spot, health, armour and the current mission. Wanted level
// is never saved — a fresh session starts clean, like a new morning
// in Solmar. Version 2 saves armour too; version 1 saves still load.
import { SAVE_KEY } from './config.js';

const SAVE_VERSION = 2;

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(game) {
  const data = {
    version: SAVE_VERSION,
    money: game.player.money,
    missionsDone: game.missionsDone,
    missionIndex: game.missionIndex,
    playerX: Math.round(game.player.x),
    playerY: Math.round(game.player.y),
    health: Math.round(game.player.health),
    armor: Math.round(game.player.armor),
    carsStolen: game.stats.carsStolen,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (data.version !== 1 && data.version !== SAVE_VERSION)) return null;
    if (data.version === 1) data.armor = 0; // v1 saves had no armour
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // storage unavailable; nothing to clear
  }
}
