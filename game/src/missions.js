// SOLMAR — the story: eight linked jobs from fixer Vera Solano, each a
// chain of objectives on the map. A mission starts when Rico walks into
// its marker, advances when he reaches each objective (or steals the
// marked car), and pays on delivery. The last one ends in a win screen.
import { CFG } from './config.js';
import { makeCar, nearestCar } from './vehicles.js';

export const MISSIONS = [
  {
    id: 'm1', name: 'The Pickup', reward: 400,
    briefing: 'Vera: "Package waiting at Palm Row. Pick it up, bring it to the lockup. No noise."',
    objectives: [
      { x: 700, y: 300, kind: 'goto', label: 'Pick up the package' },
      { x: 1900, y: 1100, kind: 'goto', label: 'Deliver to the lockup' },
    ],
  },
  {
    id: 'm2', name: 'The Vela Job', reward: 700,
    briefing: 'Vera: "A Vela GT is parked uptown. It is ours now. Bring it south."',
    objectives: [
      { x: 2150, y: 300, kind: 'goto', label: 'Meet the contact' },
      { x: 2150, y: 300, kind: 'steal', label: 'Steal the Vela GT' },
      { x: 700, y: 1500, kind: 'goto', label: 'Deliver the Vela' },
    ],
  },
  {
    id: 'm3', name: 'The Bridge Job', reward: 1500, wantedOnStart: true,
    briefing: 'Vera: "Three checkpoints, full heat. The Kings want this route. Take it anyway."',
    objectives: [
      { x: 1500, y: 700, kind: 'goto', label: 'Cross at Marina Gate' },
      { x: 2300, y: 300, kind: 'goto', label: 'Checkpoint 1 — Coral Heights' },
      { x: 2300, y: 1500, kind: 'goto', label: 'Checkpoint 2 — Sunset Strip' },
      { x: 300, y: 1500, kind: 'goto', label: 'Lose them at the marina' },
    ],
  },
  {
    id: 'm4', name: 'Dockside Debt', reward: 600,
    briefing: 'Vera: "The dockmaster owes us. Collect, and do not take no for an answer."',
    objectives: [
      { x: 300, y: 1500, kind: 'goto', label: 'Collect from the dockmaster' },
      { x: 2150, y: 300, kind: 'goto', label: 'Bring it back to Vera' },
    ],
  },
  {
    id: 'm5', name: 'Sunset Tow', reward: 800,
    briefing: 'Vera: "A tow truck is sitting at Palm Row. The Kings use it to move product. Take it."',
    objectives: [
      { x: 1100, y: 700, kind: 'goto', label: 'Find the tow truck' },
      { x: 1100, y: 700, kind: 'steal', label: 'Steal the tow truck' },
      { x: 1900, y: 1500, kind: 'goto', label: 'Drop it at the yard' },
    ],
  },
  {
    id: 'm6', name: 'Static on the Line', reward: 900,
    briefing: 'Vera: "Two relays, one message. Tap them both and get clear before they triangulate."',
    objectives: [
      { x: 1500, y: 300, kind: 'goto', label: 'Tap the first relay' },
      { x: 700, y: 300, kind: 'goto', label: 'Tap the second relay' },
      { x: 700, y: 1500, kind: 'goto', label: 'Get clear' },
    ],
  },
  {
    id: 'm7', name: 'Harbor Lights', reward: 1100,
    briefing: 'Vera: "Harbor car, east side. It carries the Kings\u2019 ledger. Bring it west."',
    objectives: [
      { x: 2300, y: 1100, kind: 'goto', label: 'Meet at the harbor' },
      { x: 2300, y: 1100, kind: 'steal', label: 'Steal the harbor car' },
      { x: 300, y: 1100, kind: 'goto', label: 'Deliver across town' },
    ],
  },
  {
    id: 'm8', name: 'King Tide', reward: 2000, wantedOnStart: true,
    briefing: 'Vera: "This is the whole war, Rico. Three checkpoints, full heat. End it at Vela Point."',
    objectives: [
      { x: 1100, y: 1100, kind: 'goto', label: 'Rally at Palm Row' },
      { x: 2300, y: 300, kind: 'goto', label: 'Checkpoint 1 — Coral Heights' },
      { x: 2300, y: 1500, kind: 'goto', label: 'Checkpoint 2 — Sunset Strip' },
      { x: 300, y: 300, kind: 'goto', label: 'End it at Vela Point' },
    ],
  },
];

export function say(game, name, role, text) {
  game.dialogue = { name, role, text, until: game.time + 7 };
}

function clearMarkers(game) {
  for (const c of game.cars) c.marker = false;
  game.missionStealTaken = false;
}

function startMission(game, def) {
  game.mission = { def, step: 0 };
  game.missionStealTaken = false;
  if (def.wantedOnStart) {
    game.heat = CFG.wanted.missionHeat;
    game.recentCrime = 3;
  }
  const steal = def.objectives.find((o) => o.kind === 'steal');
  if (steal) {
    let car = nearestCar(game.cars, steal.x, steal.y, 400, 'parked');
    if (!car) {
      car = makeCar('Vela GT', steal.x + 50, steal.y, 0, 'parked', '#e8543d');
      game.cars.push(car);
    }
    car.marker = true;
  }
  say(game, 'VERA SOLANO', 'FIXER', def.briefing);
  game.audio.blip(520, 0.12, 'sine', 0.07);
}

export function updateMissions(game, dt) {
  const p = game.player;
  if (!game.mission) {
    if (game.missionsDone < MISSIONS.length) {
      const next = MISSIONS[game.missionsDone];
      const first = next.objectives[0];
      if (Math.hypot(p.x - first.x, p.y - first.y) < CFG.missions.startRadius) {
        startMission(game, next);
      }
    }
    return;
  }
  const m = game.mission;
  const def = m.def;
  const obj = def.objectives[m.step];
  if (!obj) return;
  if (obj.kind === 'goto') {
    if (Math.hypot(p.x - obj.x, p.y - obj.y) < CFG.missions.objectiveRadius) {
      m.step += 1;
      game.audio.pickup();
      if (m.step < def.objectives.length) {
        say(game, 'VERA SOLANO', 'FIXER', def.objectives[m.step].label + '.');
      }
    }
  } else if (obj.kind === 'steal') {
    if (game.missionStealTaken) {
      game.missionStealTaken = false;
      m.step += 1;
      say(game, 'VERA SOLANO', 'FIXER', 'Got it. Now move — ' + def.objectives[m.step].label + '.');
    }
  }
  if (m.step >= def.objectives.length) {
    const reward = def.reward;
    game.missionsDone += 1;
    p.money += reward;
    clearMarkers(game);
    game.audio.cash();
    if (game.missionsDone >= MISSIONS.length) {
      game.mission = null;
      game.screen = 'win';
      say(game, 'VERA SOLANO', 'FIXER', 'Solmar is yours, Rico. The Kings are finished.');
    } else {
      say(game, 'VERA SOLANO', 'FIXER', def.name + ' done. +$' + reward + '. Next job is on the map.');
      game.mission = null;
    }
  }
}
