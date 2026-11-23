// The story: Rico Vale, getaway driver, caught between the Costa Crew
// and the Vulture Kings over Solmar's turf. Three linked missions,
// each a chain of steps (go to a place, pick something up, steal a car,
// survive the drive, deliver). The HUD and the minimap read the current
// step's target; finishing all three ends the story.
import { makeCar } from './vehicles.js';
import { spawnEnemy, spawnPickup } from './combat.js';
import { playMissionDone, playPickup } from './audio.js';
import { addHeat } from './police.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'Mission 1 — The Pickup',
    intro: 'Mara Costa needs a ride across town. The Kings are watching the Old Port — keep it quiet, keep it quick.',
    reward: 400,
    steps: [
      { type: 'goto', x: 700, y: 300, radius: 60, text: 'Pick up Mara at the Old Port cafe' },
      { type: 'goto', x: 1900, y: 1100, radius: 70, text: 'Drive Mara to the Palms safehouse — a tail is on you' },
    ],
  },
  {
    id: 'm2',
    title: 'Mission 2 — The Vela Job',
    intro: 'The Kings parked a cherry-red Vela GT by the marina. Steal it, bring it to the Costa garage — and expect company.',
    reward: 700,
    steps: [
      { type: 'goto', x: 2150, y: 300, radius: 70, text: 'Reach the marked Vela GT at the Marina Casino' },
      { type: 'steal', x: 2150, y: 300, radius: 70, text: 'Steal the Vela GT (press E beside it)' },
      { type: 'deliver', x: 700, y: 1500, radius: 80, text: 'Deliver the Vela to the Costa garage — rivals will shoot' },
    ],
  },
  {
    id: 'm3',
    title: 'Mission 3 — The Bridge Job',
    intro: 'One last run: the package, three checkpoints, the whole PD on your tail. Finish this and Solmar is yours.',
    reward: 1500,
    steps: [
      { type: 'goto', x: 1500, y: 700, radius: 60, text: 'Grab the package at the Downtown tower' },
      { type: 'escape', x: 2300, y: 300, radius: 80, text: 'Checkpoint 1 — Marina Gate (wanted level 3!)' },
      { type: 'escape', x: 2300, y: 1500, radius: 80, text: 'Checkpoint 2 — Palms Corner' },
      { type: 'escape', x: 300, y: 1500, radius: 80, text: 'Final drop — Old Port docks. Lose them or outrun them.' },
    ],
  },
];

export function startMission(game, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  game.missionIndex = index;
  game.mission = {
    def,
    step: 0,
    passenger: false,
    targetCar: null,
    rivalsSpawned: false,
    startedAt: game.time,
  };
  game.addMessage(`${def.title}: ${def.intro}`);
  setupMissionStep(game);
  return true;
}

function setupMissionStep(game) {
  const mission = game.mission;
  if (!mission) return;
  const step = mission.def.steps[mission.step];
  if (!step) return;
  if (mission.def.id === 'm1' && mission.step === 1) {
    // The tail: one police car joins the chase.
    addHeat(game, 1.0);
    game.addMessage('A patrol car spotted you — lose it on the way!');
  }
  if (mission.def.id === 'm2' && mission.step === 1) {
    const car = makeCar(game, 'sport', 2230, 334, 0, 'parked');
    car.color = '#d21f3c';
    car.marker = true;
    game.cars.push(car);
    mission.targetCar = car;
  }
  if (mission.def.id === 'm2' && mission.step === 2 && !mission.rivalsSpawned) {
    mission.rivalsSpawned = true;
    spawnEnemy(game, 1900, 500, 'rival');
    spawnEnemy(game, 2100, 600, 'rival');
    spawnEnemy(game, 1500, 1100, 'brute');
    game.addMessage('Kings gunmen on the street — fight or floor it!');
  }
  if (mission.def.id === 'm3' && mission.step === 1) {
    addHeat(game, 2.4);
    game.addMessage('Wanted level 3! Every unit in Solmar is after you.');
  }
  if (mission.def.id === 'm3') {
    spawnPickup(game, step.x, step.y, 'health');
  }
}

export function currentStep(game) {
  if (!game.mission) return null;
  return game.mission.def.steps[game.mission.step] || null;
}

export function missionTarget(game) {
  const step = currentStep(game);
  if (!step) return null;
  return { x: step.x, y: step.y, text: step.text };
}

export function updateMissions(game, dt) {
  const mission = game.mission;
  if (!mission) return;
  const step = currentStep(game);
  if (!step) return;
  const player = game.player;
  const d = Math.hypot(player.x - step.x, player.y - step.y);
  if (step.type === 'steal') {
    const car = mission.targetCar;
    if (car && car.driver === 'player') {
      advanceMissionStep(game);
    }
    return;
  }
  if (d < step.radius) {
    if (step.type === 'goto' && mission.def.id === 'm1' && mission.step === 0) {
      mission.passenger = true;
      game.addMessage('Mara is in. "Drive, Rico — and don\'t stop for anyone."');
      playPickup(game.audio);
    }
    advanceMissionStep(game);
  }
}

function advanceMissionStep(game) {
  const mission = game.mission;
  mission.step += 1;
  if (mission.step >= mission.def.steps.length) {
    completeMission(game);
    return;
  }
  const step = currentStep(game);
  game.addMessage(`Objective: ${step.text}`);
  playPickup(game.audio);
  setupMissionStep(game);
}

function completeMission(game) {
  const mission = game.mission;
  const reward = mission.def.reward;
  game.player.money += reward;
  game.missionsDone += 1;
  game.stats.missionsDone += 1;
  game.addMessage(`${mission.def.title} complete! +$${reward}`);
  playMissionDone(game.audio);
  if (mission.targetCar) mission.targetCar.marker = false;
  game.mission = null;
  game.missionIndex += 1;
  if (game.missionIndex >= MISSIONS.length) {
    game.storyComplete = true;
    game.screen = 'win';
    return;
  }
  // The next mission waits at its start marker; the player starts it
  // by driving into the yellow M marker (see missionStartMarker).
  game.addMessage(`Next: ${MISSIONS[game.missionIndex].title} — find the yellow M marker.`);
}

export function missionStartMarker(game) {
  // Where the next mission begins, so the player can find it.
  const starts = [
    { x: 700, y: 300 },
    { x: 2150, y: 300 },
    { x: 1500, y: 700 },
  ];
  if (game.mission || game.missionIndex >= MISSIONS.length) return null;
  return starts[game.missionIndex];
}

export function checkMissionStart(game) {
  const marker = missionStartMarker(game);
  if (!marker) return;
  const player = game.player;
  if (Math.hypot(player.x - marker.x, player.y - marker.y) < 70) {
    startMission(game, game.missionIndex);
  }
}

export function drawMissionMarkers(ctx, game) {
  const step = currentStep(game);
  const pulse = 1 + Math.sin(game.time * 5) * 0.15;
  if (step) {
    // Pulsing ring + beam at the objective.
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(step.x, step.y, 42 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,31,0.18)';
    ctx.beginPath();
    ctx.arc(step.x, step.y, 42 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', step.x, step.y + 8);
    ctx.textAlign = 'left';
  }
  const start = missionStartMarker(game);
  if (start) {
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(start.x, start.y, 40 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('M', start.x, start.y + 9);
    ctx.textAlign = 'left';
  }
}
