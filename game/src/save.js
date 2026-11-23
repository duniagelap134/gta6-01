// Save / load through localStorage: money, missions finished, the
// player's spot, health and the current mission. Wanted level is never
// saved — a fresh session starts clean, like a new morning in Solmar.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(game) {
  const data = {
    version: 1,
    money: game.player.money,
    missionsDone: game.missionsDone,
    missionIndex: game.missionIndex,
    playerX: Math.round(game.player.x),
    playerY: Math.round(game.player.y),
    health: Math.round(game.player.health),
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
    if (!data || data.version !== 1) return null;
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
