// SOLMAR — the entry point: builds the game state, runs the fixed-step
// loop, wires input to the systems, and exposes the whole state on
// window.__game so tests (and the screenshot stager) can read it.
import { CFG } from './config.js';
import { buildCity } from './city.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { spawnParkedCars, updateDriving } from './vehicles.js';
import { makePlayer, updateOnFoot, tryEnterCar } from './player.js';
import { makeTraffic, updateTraffic } from './traffic.js';
import { makePolice, updatePolice, wantedFromHeat } from './police.js';
import { makeCombat, tryShoot, updateCombat } from './combat.js';
import { MISSIONS, updateMissions, say } from './missions.js';
import { hasSave, saveGame, loadSave, applySave } from './save.js';
import { renderScene } from './render3d.js';
import { drawHUD, drawTitle, drawWin, drawWasted, BUTTONS } from './hud.js';
import { stageShot } from './shots.js';

const FOCAL = 520;
const HORIZON = 330;
const EYE = 78;

function screenToWorld(game, sx, sy) {
  const cam = game.camera;
  const cy = Math.max(sy, HORIZON + 12);
  const fwd = (EYE * FOCAL) / (cy - HORIZON);
  const side = ((sx - 640) * fwd) / FOCAL;
  const c = Math.cos(cam.yaw);
  const s = Math.sin(cam.yaw);
  return {
    x: cam.x + fwd * c - side * s,
    y: cam.y + fwd * s + side * c,
  };
}

function createGame() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const input = new Input(canvas);
  const audio = new AudioSys();
  const city = buildCity(CFG.seed);
  const cars = spawnParkedCars();
  const player = makePlayer();
  const traffic = makeTraffic(CFG.seed + 5);
  const police = makePolice();
  const combat = makeCombat();
  const game = {
    canvas,
    ctx,
    input,
    audio,
    city,
    cars,
    traffic,
    police,
    heli: police.heli,
    combat,
    player,
    missionDefs: MISSIONS,
    mission: null,
    missionsDone: 0,
    heat: 0,
    wanted: 0,
    cops: police.cops,
    crew: { eyes: 0, trackedId: null, plates: 0, fix: 0 },
    crewCd: { plates: 0, fix: 0, eyes: 0 },
    dialogue: null,
    time: 0,
    timeOfDay: 'dusk',
    screen: 'title',
    recentCrime: 0,
    missionStealTaken: false,
    camera: { x: 1300, y: 900 - 210, yaw: -Math.PI / 2 },
    cameraDirty: false,
  };
  return game;
}

function startGame(game) {
  game.screen = 'play';
  game.audio.unlock();
  say(game, 'VERA SOLANO', 'FIXER', 'Rico. First job is on the map — go to the M marker.');
}

function updateCamera(game, dt) {
  const p = game.player;
  const car = game.cars.find((c) => c.id === p.carId);
  const facing = p.onFoot ? p.angle : car ? car.angle : p.angle;
  const tx = p.x - Math.cos(facing) * 210;
  const ty = p.y - Math.sin(facing) * 210;
  const k = Math.min(1, dt * 7);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
  let diff = facing - game.camera.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  game.camera.yaw += diff * Math.min(1, dt * 5);
}

function update(game, dt) {
  game.time += dt;
  const p = game.player;
  const input = game.input;
  if (game.recentCrime > 0) game.recentCrime -= dt;
  for (const k of ['plates', 'fix', 'eyes']) {
    if (game.crewCd[k] > 0) game.crewCd[k] -= dt;
  }

  if (game.screen === 'title') {
    if (input.mouse.clicked) {
      const m = input.mouse;
      const b = BUTTONS.start;
      if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) startGame(game);
      const c = BUTTONS.cont;
      if (hasSave() && m.x >= c.x && m.x <= c.x + c.w && m.y >= c.y && m.y <= c.y + c.h) {
        const data = loadSave();
        if (data) {
          applySave(game, data);
          game.screen = 'play';
          game.audio.unlock();
        }
      }
    }
    if (input.wasPressed('Enter')) startGame(game);
    updateCamera(game, dt);
    return;
  }

  if (game.screen === 'win') {
    if (input.wasPressed('Enter')) game.screen = 'play';
    updateCamera(game, dt);
    return;
  }

  if (game.screen === 'wasted') {
    if (input.wasPressed('Enter')) {
      p.health = 100;
      p.armor = 50;
      p.dead = false;
      p.x = 1300;
      p.y = 900;
      p.onFoot = true;
      p.carId = null;
      game.heat = 0;
      game.cars = game.cars.filter((c) => c.driver !== 'police');
      game.police.cops.length = 0;
      game.screen = 'play';
    }
    updateCamera(game, dt);
    return;
  }

  // --- play
  if (input.wasPressed('KeyE')) tryEnterCar(game);
  if (input.wasPressed('KeyZ') && game.crewCd.plates <= 0) {
    game.heat = Math.max(0, game.heat - CFG.crew.platesDrop);
    game.crew.plates += 1;
    game.crewCd.plates = CFG.crew.platesCooldown;
    say(game, 'DANA ROOK', 'DRIVER', 'Plates swapped. They are looking for a different car now.');
    game.audio.blip(440, 0.1, 'sine', 0.06);
  }
  if (input.wasPressed('KeyX') && game.crewCd.fix <= 0 && !p.onFoot) {
    const car = game.cars.find((c) => c.id === p.carId);
    if (car) {
      car.condition = 100;
      game.crew.fix += 1;
      game.crewCd.fix = CFG.crew.fixCooldown;
      say(game, 'MILO FERRAN', 'MECHANIC', 'Patched up. She runs like new, Rico.');
      game.audio.blip(520, 0.1, 'sine', 0.06);
    }
  }
  if (input.wasPressed('KeyC') && game.crewCd.eyes <= 0) {
    const cops = game.police.cops.filter((c) => c.condition > 0);
    if (cops.length > 0) {
      let best = cops[0];
      let bestD = Infinity;
      for (const c of cops) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      game.crew.trackedId = best.id;
    }
    game.crew.eyes += 1;
    game.crewCd.eyes = CFG.crew.eyesCooldown;
    say(game, 'NIA SOL', 'LOOKOUT', game.crew.trackedId !== null ? 'Nearest unit tagged. I have eyes on them.' : 'No units in range. Stay sharp.');
  }
  if (input.wasPressed('F5')) {
    if (saveGame(game)) say(game, 'SOLMAR', 'SYSTEM', 'Quick-saved.');
  }

  if (p.onFoot) {
    updateOnFoot(p, input, dt);
    if (input.mouse.down) {
      const w = screenToWorld(game, input.mouse.x, input.mouse.y);
      tryShoot(game.combat, game, w.x, w.y);
    }
  } else {
    const car = game.cars.find((c) => c.id === p.carId);
    if (car) {
      updateDriving(car, input, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      game.audio.setEngine(Math.abs(car.speed), CFG.car.maxSpeed);
    }
  }

  updateTraffic(game.traffic, dt, p.onFoot ? null : game.cars.find((c) => c.id === p.carId) || null);
  updatePolice(game.police, game, dt);
  updateCombat(game.combat, game, dt);
  updateMissions(game, dt);
  updateCamera(game, dt);
  if (p.dead && game.screen === 'play') game.screen = 'wasted';
}

function render(game) {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, 1280, 800);
  renderScene(ctx, game);
  if (game.screen === 'title') drawTitle(ctx, game, hasSave());
  else if (game.screen === 'win') drawWin(ctx, game);
  else if (game.screen === 'wasted') drawWasted(ctx, game);
  else drawHUD(ctx, game);
}

function main() {
  const game = createGame();
  window.__game = game;
  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  if (shotName) {
    try { stageShot(game, shotName); } catch (err) { /* staging must never break boot */ }
  }
  let last = performance.now();
  let acc = 0;
  let frames = 0;
  const step = 1 / 60;
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += elapsed;
    while (acc >= step) {
      update(game, step);
      acc -= step;
    }
    render(game);
    game.input.endFrame();
    frames += 1;
    if (shotName && frames >= 2 && window.__shotReady !== true) window.__shotReady = true;
    requestAnimationFrame(frame);
  }
  window.addEventListener('mousedown', () => game.audio.unlock(), { once: true });
  window.addEventListener('keydown', () => game.audio.unlock(), { once: true });
  requestAnimationFrame(frame);
}

main();
