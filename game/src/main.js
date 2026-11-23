// SOLMAR — boot, game state, main loop, camera, rendering order.
// The world is one shared object `game`; every system module reads and
// writes it, and main.js is the only place that decides the order.
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, SHOT_SEED } from './config.js';
import { mulberry32 } from './rng.js';
import { buildCity, drawCity } from './city.js';
import { createInput, wasPressed, beginFrameInput } from './input.js';
import { createAudio, unlockAudio, setMuted, setEngine, startMusic } from './audio.js';
import { createPlayer, updatePlayerOnFoot, drawPlayer as drawPlayerOnFoot } from './player.js';
import { spawnParkedCars, updatePlayerDriving, playerCar, tryEnterOrExitCar, drawCar } from './vehicles.js';
import { spawnTraffic, updateTraffic, checkPedCarHits, drawPedestrians } from './traffic.js';
import { updatePolice, drawCops } from './police.js';
import { updateCombat, drawEnemies, drawBulletsAndPickups } from './combat.js';
import { updateMissions, checkMissionStart, drawMissionMarkers } from './missions.js';
import { drawHUD, drawTitleScreen, drawOverlay } from './hud.js';
import { saveGame, loadSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function newGame(seed) {
  const game = {
    seed,
    rng: mulberry32(seed),
    city: buildCity(seed),
    cityV: V_ROADS,
    cityH: H_ROADS,
    input: createInput(canvas),
    audio: createAudio(),
    screen: 'title',
    time: 0,
    dayTime: 0.35, // 0..1; 0.35 is late morning sun
    night: false,
    camera: { x: 0, y: 0, w: 1280, h: 800, zoom: 1, shake: 0 },
    viewW: 1280,
    viewH: 800,
    player: createPlayer(700, 500),
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    heat: 0,
    wanted: 0,
    policeSpawnTimer: 0,
    copSpawnTimer: 0,
    gunfireTimer: 0,
    mission: null,
    missionIndex: 0,
    missionsDone: 0,
    storyComplete: false,
    messages: [],
    stats: { carsStolen: 0, kills: 0, pedsHit: 0, deaths: 0, busted: 0, missionsDone: 0 },
    showHelp: false,
    uiButtons: [],
    autoSaveTimer: 30,
  };
  game.addMessage = (text) => {
    game.messages.push({ text, t: 7 });
    if (game.messages.length > 4) game.messages.shift();
  };
  game.addShake = (amount) => {
    game.camera.shake = Math.min(10, game.camera.shake + amount);
  };
  spawnParkedCars(game, 10);
  spawnTraffic(game, 14, 20);
  return game;
}

function resetWorld(game, seed) {
  const fresh = newGame(seed);
  for (const key of Object.keys(fresh)) {
    if (key !== 'input' && key !== 'audio') game[key] = fresh[key];
  }
  game.input = fresh.input;
  game.audio = fresh.audio;
}

export function updateWorld(game, dt) {
  game.time += dt;
  game.dayTime = (game.dayTime + dt * 0.0008) % 1;
  game.night = game.dayTime > 0.8 || game.dayTime < 0.18;
  if (game.screen !== 'play') return;
  const input = game.input;
  // Global keys.
  if (wasPressed(input, 'KeyM')) {
    setMuted(game.audio, !game.audio.muted);
    game.addMessage(game.audio.muted ? 'Sound muted (M to unmute)' : 'Sound on');
  }
  if (wasPressed(input, 'KeyP', 'Escape')) {
    game.screen = 'pause';
    return;
  }
  if (wasPressed(input, 'KeyE')) {
    const result = tryEnterOrExitCar(game);
    if (result === 'enter') game.addMessage(`Driving a ${playerCar(game).name}. W to go, S to brake.`);
  }
  // Player.
  if (game.player.onFoot) updatePlayerOnFoot(game, dt);
  else updatePlayerDriving(game, dt);
  // World systems.
  updateTraffic(game, dt);
  checkPedCarHits(game);
  updatePolice(game, dt);
  updateCombat(game, dt);
  updateMissions(game, dt);
  checkMissionStart(game);
  // Particles.
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const p = game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
  // Messages expire.
  for (let i = game.messages.length - 1; i >= 0; i -= 1) {
    game.messages[i].t -= dt;
    if (game.messages[i].t <= 0) game.messages.splice(i, 1);
  }
  // Camera follows the player (or their car), clamped to the city.
  const cam = game.camera;
  const zoom = game.player.onFoot ? 1 : 0.92;
  cam.zoom = zoom;
  cam.w = game.viewW / zoom;
  cam.h = game.viewH / zoom;
  const targetX = Math.max(0, Math.min(WORLD_W - cam.w, game.player.x - cam.w / 2));
  const targetY = Math.max(0, Math.min(WORLD_H - cam.h, game.player.y - cam.h / 2));
  cam.x += (targetX - cam.x) * Math.min(1, dt * 5);
  cam.y += (targetY - cam.y) * Math.min(1, dt * 5);
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 26);
  // Engine hum follows speed.
  const car = playerCar(game);
  setEngine(game.audio, car ? Math.abs(car.speed) / car.topSpeed : 0, !!car);
  // Autosave every 30 seconds of play.
  game.autoSaveTimer -= dt;
  if (game.autoSaveTimer <= 0) {
    game.autoSaveTimer = 30;
    saveGame(game);
  }
}

export function render(game) {
  const w = game.viewW;
  const h = game.viewH;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#11141b';
  ctx.fillRect(0, 0, w, h);
  if (game.screen === 'title') {
    drawTitleScreen(ctx, game);
    return;
  }
  const cam = game.camera;
  const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom + shakeX, -cam.y * cam.zoom + shakeY);
  // City first, then markers, then everything that stands on the street.
  drawCity(ctx, game.city, cam, game.night);
  drawMissionMarkers(ctx, game);
  drawBulletsAndPickups(ctx, game);
  // Entities sorted by y so nearer things draw over farther ones.
  const entities = [];
  for (const car of game.cars) entities.push({ y: car.y, draw: () => drawCar(ctx, car, game.night) });
  for (const ped of game.peds) entities.push({ y: ped.y, draw: () => drawPedestrians(ctx, { ...game, peds: [ped] }) });
  for (const cop of game.cops) entities.push({ y: cop.y, draw: () => drawCops(ctx, { ...game, cops: [cop] }) });
  for (const e of game.enemies) entities.push({ y: e.y, draw: () => drawEnemies(ctx, { ...game, enemies: [e] }) });
  if (game.player.onFoot) {
    entities.push({ y: game.player.y, draw: () => drawPlayerOnFoot(ctx, game) });
  }
  entities.sort((a, b) => a.y - b.y);
  for (const entity of entities) entity.draw();
  // Particles.
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Night darkens the world; the HUD stays bright.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (game.night) {
    ctx.fillStyle = 'rgba(8,12,34,0.30)';
    ctx.fillRect(0, 0, w, h);
  } else {
    // Warm sun wash from the top-left.
    const sun = ctx.createRadialGradient(w * 0.2, 0, 50, w * 0.2, 0, w * 0.9);
    sun.addColorStop(0, 'rgba(255,220,140,0.10)');
    sun.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  }
  if (game.screen === 'play') drawHUD(ctx, game);
  if (game.screen === 'pause') {
    drawHUD(ctx, game);
    drawOverlay(ctx, game, 'PAUSED', ['The city waits. Rico does not.'], 'Press P to keep driving  •  F5 quick-save');
  }
  if (game.screen === 'busted') {
    drawOverlay(ctx, game, 'BUSTED', [`The PD took $${Math.min(150, game.player.money + 150)} and your ride.`, 'Rico walks out of the precinct with a warning.'], 'Press Enter to get back on the street');
  }
  if (game.screen === 'wasted') {
    drawOverlay(ctx, game, 'WASTED', ['Rico wakes up at Solmar General, patched up and poorer.'], 'Press Enter to get back on the street');
  }
  if (game.screen === 'win') {
    drawOverlay(ctx, game, 'SOLMAR IS YOURS', ['All three jobs done. The Costa Crew runs the city,', 'and Rico Vale is the driver nobody catches.'], 'Press Enter to free-roam Solmar');
  }
}

function startPlaying(game, fromSave) {
  unlockAudio(game.audio);
  startMusic(game.audio);
  if (fromSave) {
    const data = loadSave();
    if (data) {
      game.player.money = data.money;
      game.missionsDone = data.missionsDone;
      game.missionIndex = data.missionIndex;
      game.stats.missionsDone = data.missionsDone;
      game.stats.carsStolen = data.carsStolen;
      game.player.x = data.playerX;
      game.player.y = data.playerY;
      game.player.health = data.health;
      game.addMessage('Save loaded. Welcome back to Solmar.');
    }
  } else {
    game.addMessage('Welcome to Solmar. Find the yellow M to start Mission 1.');
  }
  game.screen = 'play';
}

function handleTitleClick(game) {
  if (!game.input.frameClicked) return;
  const mx = game.input.mouse.x;
  const my = game.input.mouse.y;
  for (const b of game.uiButtons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      if (b.action === 'start') startPlaying(game, false);
      if (b.action === 'continue') startPlaying(game, true);
      if (b.action === 'help') game.showHelp = !game.showHelp;
      return;
    }
  }
}

function handleOverlayKey(game) {
  const input = game.input;
  if (!wasPressed(input, 'Enter', 'NumpadEnter')) return;
  if (game.screen === 'busted' || game.screen === 'wasted') {
    if (game.screen === 'wasted') {
      game.player.money = Math.max(0, game.player.money - 100);
      game.player.health = 100;
      game.player.dead = false;
      game.player.x = 1100;
      game.player.y = 660;
      game.player.onFoot = true;
      game.player.carId = null;
      game.heat = 0;
    }
    game.screen = 'play';
  } else if (game.screen === 'win') {
    game.screen = 'play';
  }
}

function frame(game, last) {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  game.viewW = canvas.width;
  game.viewH = canvas.height;
  beginFrameInput(game.input);
  if (game.screen === 'title') {
    handleTitleClick(game);
    if (wasPressed(game.input, 'Enter', 'NumpadEnter')) startPlaying(game, false);
    render(game);
  } else if (game.screen === 'pause') {
    if (wasPressed(game.input, 'KeyP', 'Escape', 'Enter')) game.screen = 'play';
    render(game);
  } else if (game.screen === 'busted' || game.screen === 'wasted' || game.screen === 'win') {
    handleOverlayKey(game);
    render(game);
  } else {
    updateWorld(game, dt);
    render(game);
  }
  requestAnimationFrame((t) => frame(game, now));
}

function boot() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || SHOT_SEED) || SHOT_SEED;
  const game = newGame(seed);
  window.__game = game;
  window.__solmar = { title: 'SOLMAR', version: 1 };
  // F5 quick-saves instead of reloading the page.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'F5') {
      event.preventDefault();
      if (game.screen === 'play' && saveGame(game)) game.addMessage('Progress saved.');
    }
  });
  if (shot) {
    // Screenshot staging: build the scene, play it forward with the
    // autopilot, render once, and signal readiness.
    const plan = stageShot(shot, game);
    game.screen = 'play';
    game.viewW = canvas.width;
    game.viewH = canvas.height;
    const step = 1 / 60;
    for (let i = 0; i < plan.seconds * 60; i += 1) {
      beginFrameInput(game.input);
      if (plan.driveTarget) {
        const car = playerCar(game);
        const target = plan.driveTarget;
        const px = car ? car.x : game.player.x;
        const py = car ? car.y : game.player.y;
        const want = Math.atan2(target.y - py, target.x - px);
        const facing = car ? car.angle : game.player.angle;
        let diff = want - facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        game.input.keys.clear();
        game.input.keys.add('KeyW');
        if (diff > 0.15) game.input.keys.add('KeyD');
        if (diff < -0.15) game.input.keys.add('KeyA');
      }
      updateWorld(game, step);
    }
    game.input.keys.clear();
    beginFrameInput(game.input);
    updateWorld(game, 0);
    render(game);
    window.__shotReady = true;
    return;
  }
  requestAnimationFrame((t) => frame(game, t));
}

boot();
