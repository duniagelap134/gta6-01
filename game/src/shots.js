// SOLMAR — screenshot staging. The shoot tool loads the game with a
// ?shot= name; this sets the world up at a dramatic moment (mid-chase,
// on foot, driving, night) and raises window.__shotReady once the
// scene has rendered, so every screenshot is a real frame of the game.
import { say } from './missions.js';
import { makeCar } from './vehicles.js';

function putPlayerInCar(game, carId) {
  const car = game.cars.find((c) => c.id === carId);
  const p = game.player;
  if (!car) return;
  p.onFoot = false;
  p.carId = car.id;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
}

// Police already on Rico's tail when the shot opens, so the dispatch
// panel and the chase read on the very first frame.
function stageCops(game, n) {
  const p = game.player;
  const spots = [
    { dx: -220, dy: 90, tag: 'RAMMING', call: 'GULL-3' },
    { dx: -380, dy: -70, tag: 'FLANKING', call: 'TIDE-22' },
    { dx: -140, dy: -190, tag: 'PURSIT', call: 'PALM-9' },
  ];
  for (let i = 0; i < n; i++) {
    const s = spots[i % spots.length];
    const car = makeCar('SPPD Interceptor', p.x + s.dx, p.y + s.dy, 0, 'police', '#e8e8e8');
    car.speed = 240;
    car.callsign = s.call;
    car.tag = s.tag;
    game.cars.push(car);
    game.police.cops.push(car);
  }
  game.police.spawnTimer = 2;
}

export function stageShot(game, name) {
  const p = game.player;
  const parked = () => game.cars.find((c) => c.driver === 'parked');
  game.timeOfDay = 'dusk';
  game.screen = 'play';
  game.mission = null;
  game.dialogue = null;
  if (name === 'chase') {
    const car = parked();
    if (car) {
      car.x = 1100; car.y = 700; car.angle = 0; car.speed = 240;
      putPlayerInCar(game, car.id);
    }
    game.heat = 2.6;
    game.wanted = 3;
    game.mission = { def: game.missionDefs[2], step: 1 };
    game.missionsDone = 2;
    say(game, 'VERA SOLANO', 'FIXER', 'Checkpoint 1 — Coral Heights (wanted level 3!)');
    game.police.heli.active = true;
    game.police.heli.x = p.x + 260;
    game.police.heli.y = p.y;
    stageCops(game, 3);
  } else if (name === 'foot') {
    p.x = 700; p.y = 300;
    p.onFoot = true;
    p.carId = null;
    game.mission = { def: game.missionDefs[0], step: 0 };
    game.missionsDone = 0;
    game.heat = 0;
    say(game, 'VERA SOLANO', 'FIXER', 'Package waiting at Palm Row. Pick it up, bring it to the lockup.');
  } else if (name === 'drive') {
    const car = parked();
    if (car) {
      car.x = 700; car.y = 1100; car.angle = 0; car.speed = 280;
      putPlayerInCar(game, car.id);
    }
    game.mission = { def: game.missionDefs[1], step: 2 };
    game.missionsDone = 1;
    game.heat = 0.4;
    say(game, 'VERA SOLANO', 'FIXER', 'Vela secured. Now bring it south to the lockup.');
  } else if (name === 'night') {
    game.timeOfDay = 'night';
    const car = parked();
    if (car) {
      car.x = 1500; car.y = 1100; car.angle = 0; car.speed = 200;
      putPlayerInCar(game, car.id);
    }
    game.heat = 1.4;
    game.wanted = 2;
    game.mission = { def: game.missionDefs[6], step: 1 };
    game.missionsDone = 6;
    say(game, 'NIA SOL', 'LOOKOUT', 'Two cruisers on your tail, Rico. Cut through Old Cannery.');
    stageCops(game, 2);
  }
  game.cameraDirty = true;
}
