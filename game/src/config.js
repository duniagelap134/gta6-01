// SOLMAR — every tunable number for the game lives here, so the rest of
// the code reads like the design instead of a pile of magic numbers.
// The city is a 2600 x 1800 grid: six north-south roads and four
// east-west roads, which is also where every mission objective sits.
export const CFG = {
  world: { w: 2600, h: 1800 },
  roadsX: [300, 700, 1100, 1500, 1900, 2300],
  roadsY: [300, 700, 1100, 1500],
  roadWidth: 90,
  seed: 20261124,
  player: {
    walkSpeed: 150,
    runSpeed: 150,
    health: 100,
    armor: 50,
    ammo: 60,
    money: 250,
    radius: 14,
  },
  car: {
    maxSpeed: 320,
    accel: 170,
    brake: 260,
    reverseMax: 120,
    turnRate: 2.4,
    friction: 55,
    length: 64,
    width: 30,
  },
  police: {
    maxCops: 4,
    spawnInterval: 1.2,
    spawnDistance: 650,
    chaseSpeed: 248,
    ramDamage: 3,
    ramCooldown: 0.6,
  },
  wanted: {
    stealHeat: 0.4,
    missionHeat: 2.6,
    decayPerSec: 0.05,
  },
  crew: {
    platesCooldown: 10,
    platesDrop: 1.2,
    fixCooldown: 8,
    eyesCooldown: 5,
  },
  combat: {
    fireInterval: 0.15,
    bulletSpeed: 620,
    bulletLife: 0.7,
    copDamage: 12,
  },
  missions: {
    startRadius: 100,
    objectiveRadius: 100,
  },
  saveKey: 'solmar-save-v1',
  districts: [
    { name: 'VELA POINT', x0: 0, y0: 0, x1: 1000, y1: 600 },
    { name: 'CORAL HEIGHTS', x0: 1000, y0: 0, x1: 2600, y1: 600 },
    { name: 'PALM ROW', x0: 0, y0: 600, x1: 1300, y1: 1200 },
    { name: 'OLD CANNERY', x0: 1300, y0: 600, x1: 2600, y1: 1200 },
    { name: 'MARINA GATE', x0: 0, y0: 1200, x1: 1300, y1: 1800 },
    { name: 'SUNSET STRIP', x0: 1300, y0: 1200, x1: 2600, y1: 1800 },
  ],
  radio: [
    'SOLMAR FM 98.4 — Island Pop',
    'RADIO PALMA 101.2 — Sunset Cumbia',
    'SOLMAR FM 98.4 — Golden Hour Mix',
  ],
  // Golden-hour palette used by the renderer and the HUD.
  palette: {
    skyTop: '#2e4a7a',
    skyMid: '#e8705a',
    skyLow: '#f7b267',
    duskTop: '#3a2a5e',
    duskMid: '#d95d6a',
    duskLow: '#f9a55c',
    nightTop: '#060a1c',
    nightMid: '#101c3a',
    nightLow: '#1d2f52',
    road: '#3d3a44',
    roadEdge: '#f7c948',
    ground: '#c9a06a',
  },
};
