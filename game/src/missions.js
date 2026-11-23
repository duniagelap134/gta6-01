// The story: Rico Vale, getaway driver, caught between the Costa Crew
// and the Vulture Kings over Solmar's turf. Eight linked missions,
// each a chain of steps (go to a place, pick something up, steal a car,
// survive the drive, deliver). The HUD and the minimap read the current
// step's target; finishing all eight ends the story. Each mission has
// a speaker and a line the dialogue box shows when the job starts —
// the fixer Vera Solano runs the Crew, and the crew (Dana, Milo, Nia)
// talk Rico through the jobs.
import { makeCar } from './vehicles.js';
import { spawnEnemy, spawnPickup } from './combat.js';
import { playMissionDone, playPickup } from './audio.js';
import { addHeat } from './police.js';

const VERA = { name: 'Vera Solano', role: 'FIXER · COSTA CREW' };
const MARA = { name: 'Mara Costa', role: 'COSTA CREW · PASSENGER' };
const DANA = { name: 'Dana Rook', role: 'DRIVER · COSTA CREW' };
const MILO = { name: 'Milo Ferran', role: 'MECHANIC · COSTA CREW' };
const NIA = { name: 'Nia Sol', role: 'LOOKOUT · COSTA CREW' };

export const MISSIONS = [
  {
    id: 'm1',
    title: 'Mission 1 — The Pickup',
    short: 'THE PICKUP',
    intro: 'Mara Costa needs a ride across town. The Kings are watching the Old Port — keep it quiet, keep it quick.',
    speaker: MARA,
    line: "Drive, Rico — and don't stop for anyone.",
    reward: 400,
    steps: [
      { type: 'goto', x: 700, y: 300, radius: 60, text: 'Pick up Mara at the Old Port cafe' },
      { type: 'goto', x: 1900, y: 1100, radius: 70, text: 'Drive Mara to the Palms safehouse — a tail is on you' },
    ],
  },
  {
    id: 'm2',
    title: 'Mission 2 — The Vela Job',
    short: 'THE VELA JOB',
    intro: 'The Kings parked a cherry-red Vela GT by the marina. Steal it, bring it to the Costa garage — and expect company.',
    speaker: VERA,
    line: 'The Kings parked a cherry Vela by the casino. Bring it home.',
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
    short: 'THE BRIDGE JOB',
    intro: 'One last run for the old crew: the package, three checkpoints, the whole PD on your tail. Finish this and Solmar is yours.',
    speaker: VERA,
    line: 'Three checkpoints, the whole PD on your tail. Make it count.',
    reward: 1500,
    steps: [
      { type: 'goto', x: 1500, y: 700, radius: 60, text: 'Grab the package at the Downtown tower' },
      { type: 'escape', x: 2300, y: 300, radius: 80, text: 'Checkpoint 1 — Marina Gate (wanted level 3!)' },
      { type: 'escape', x: 2300, y: 1500, radius: 80, text: 'Checkpoint 2 — Palms Corner' },
      { type: 'escape', x: 300, y: 1500, radius: 80, text: 'Final drop — Old Port docks. Lose them or outrun them.' },
    ],
  },
  {
    id: 'm4',
    title: 'Mission 4 — Dockside Debt',
    short: 'DOCKSIDE DEBT',
    intro: 'A ledger at the Old Port docks proves the Kings skimmed the Crew. Collect it, run it to the casino — gunmen are already on the pier.',
    speaker: DANA,
    line: "Ledger's worth more than my car. Don't scratch either.",
    reward: 800,
    steps: [
      { type: 'goto', x: 300, y: 1500, radius: 70, text: 'Collect the ledger at the Old Port docks' },
      { type: 'goto', x: 2150, y: 300, radius: 80, text: 'Run the ledger to the Marina Casino — Kings gunmen on the way' },
    ],
  },
  {
    id: 'm5',
    title: 'Mission 5 — Sunset Tow',
    short: 'SUNSET TOW',
    intro: 'A reinforced Harbor Hauler sits by Solmar Tower, and Milo needs its bed for the chop shop. Tow it home before the PD notices.',
    speaker: MILO,
    line: "That hauler's got a reinforced bed. I need it, you need the cash.",
    reward: 900,
    steps: [
      { type: 'goto', x: 1100, y: 700, radius: 70, text: 'Reach the marked Harbor Hauler at Solmar Tower' },
      { type: 'steal', x: 1100, y: 700, radius: 70, text: 'Steal the Harbor Hauler (press E beside it)' },
      { type: 'deliver', x: 1900, y: 1500, radius: 80, text: 'Tow it to the Palms chop shop — wanted level 2' },
    ],
  },
  {
    id: 'm6',
    title: 'Mission 6 — Static on the Line',
    short: 'STATIC ON THE LINE',
    intro: 'The Kings tapped the Crew radio. Nia found the relay on Tower Row — climb up, kill the tap, and be gone before the triangulation lands.',
    speaker: NIA,
    line: "Relay's hot. Cops triangulate in minutes — move.",
    reward: 1100,
    steps: [
      { type: 'goto', x: 1500, y: 300, radius: 60, text: 'Reach the relay on Tower Row' },
      { type: 'escape', x: 700, y: 300, radius: 80, text: 'Checkpoint 1 — Old Port (triangulation incoming!)' },
      { type: 'escape', x: 700, y: 1500, radius: 80, text: 'Checkpoint 2 — Costa garage. Lose the tail.' },
    ],
  },
  {
    id: 'm7',
    title: 'Mission 7 — Harbor Lights',
    short: 'HARBOR LIGHTS',
    intro: 'Midnight at the marina: a Kings courier van runs the coast road with the night take. Take the van, take the route, take the money.',
    speaker: VERA,
    line: 'The courier drives at midnight. Take the van, take the route, take the money.',
    reward: 1200,
    steps: [
      { type: 'goto', x: 2300, y: 1100, radius: 70, text: 'Find the Kings courier van at the marina' },
      { type: 'steal', x: 2300, y: 1100, radius: 70, text: 'Steal the courier van (press E beside it)' },
      { type: 'deliver', x: 300, y: 1100, radius: 80, text: 'Run the van to the Old Port docks — rivals will shoot' },
    ],
  },
  {
    id: 'm8',
    title: 'Mission 8 — King Tide',
    short: 'KING TIDE',
    intro: 'Last run, Rico. Everything the Crew owns rides on this package: four stops, the whole PD on your tail, and the tide coming in.',
    speaker: VERA,
    line: 'Last run, Rico. Everything the Crew owns rides on this package.',
    reward: 2000,
    steps: [
      { type: 'goto', x: 1100, y: 1100, radius: 60, text: 'Grab the package at the Solmar Tower plaza' },
      { type: 'escape', x: 2300, y: 300, radius: 80, text: 'Checkpoint 1 — Marina Gate (wanted level 3!)' },
      { type: 'escape', x: 2300, y: 1500, radius: 80, text: 'Checkpoint 2 — Palms Corner' },
      { type: 'escape', x: 300, y: 300, radius: 80, text: 'Final drop — Old Port docks. King Tide is yours.' },
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
  game.dialogue = { name: def.speaker.name, role: def.speaker.role, text: def.line, until: game.time + 8 };
  setupMissionStep(game);
  return true;
}

function setupMissionStep(game) {
  const mission = game.mission;
  if (!mission) return;
  const step = mission.def.steps[mission.step];
  if (!step) return;
  const id = mission.def.id;
  if (id === 'm1' && mission.step === 1) {
    // The tail: one police car joins the chase.
    addHeat(game, 1.0);
    game.addMessage('A patrol car spotted you — lose it on the way!');
  }
  if (id === 'm2' && mission.step === 1) {
    const car = makeCar(game, 'sport', 2230, 334, 0, 'parked');
    car.color = '#d21f3c';
    car.marker = true;
    game.cars.push(car);
    mission.targetCar = car;
  }
  if (id === 'm2' && mission.step === 2 && !mission.rivalsSpawned) {
    mission.rivalsSpawned = true;
    spawnEnemy(game, 1900, 500, 'rival');
    spawnEnemy(game, 2100, 600, 'rival');
    spawnEnemy(game, 1500, 1100, 'brute');
    game.addMessage('Kings gunmen on the street — fight or floor it!');
  }
  if (id === 'm3' && mission.step === 1) {
    addHeat(game, 2.4);
    game.addMessage('Wanted level 3! Every unit in Solmar is after you.');
  }
  if (id === 'm3') {
    spawnPickup(game, step.x, step.y, 'health');
  }
  if (id === 'm4' && mission.step === 1 && !mission.rivalsSpawned) {
    mission.rivalsSpawned = true;
    spawnEnemy(game, 1900, 500, 'rival');
    spawnEnemy(game, 2100, 700, 'rival');
    game.addMessage('Kings gunmen on the pier — keep the ledger moving!');
  }
  if (id === 'm5' && mission.step === 1) {
    const car = makeCar(game, 'truck', 1180, 734, 0, 'parked');
    car.color = '#7a5a3a';
    car.marker = true;
    game.cars.push(car);
    mission.targetCar = car;
  }
  if (id === 'm5' && mission.step === 2 && !mission.rivalsSpawned) {
    mission.rivalsSpawned = true;
    addHeat(game, 1.4);
    game.addMessage('The PD spotted the tow — wanted level 2!');
  }
  if (id === 'm6' && mission.step === 1) {
    addHeat(game, 1.2);
    game.addMessage('Triangulation! The PD is closing on your position.');
  }
  if (id === 'm7' && mission.step === 1) {
    const car = makeCar(game, 'van', 2380, 1134, 0, 'parked');
    car.color = '#8a94a6';
    car.marker = true;
    game.cars.push(car);
    mission.targetCar = car;
  }
  if (id === 'm7' && mission.step === 2 && !mission.rivalsSpawned) {
    mission.rivalsSpawned = true;
    spawnEnemy(game, 2100, 900, 'rival');
    spawnEnemy(game, 2300, 1300, 'brute');
    game.addMessage('Kings gunmen guarding the route — punch through!');
  }
  if (id === 'm8' && mission.step === 1) {
    addHeat(game, 2.4);
    game.addMessage('Wanted level 3! Every unit in Solmar is after you.');
  }
  if (id === 'm8') {
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
  game.dialogue = { name: mission.def.speaker.name, role: mission.def.speaker.role, text: `Job done, Rico. +$${reward} — next one pays more.`, until: game.time + 6 };
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
    { x: 300, y: 1500 },
    { x: 1100, y: 700 },
    { x: 1500, y: 300 },
    { x: 2300, y: 1100 },
    { x: 1100, y: 1100 },
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
