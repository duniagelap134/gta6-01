// SOLMAR v2 — shared constants: world size, roads, palette, tuning,
// story data (districts, radio, crew, ranks) and chase-camera tuning.
// All numbers are world units (pixels at zoom 1) unless noted.
export const WORLD_W = 2600;
export const WORLD_H = 1800;
export const ROAD_W = 96;
export const V_ROADS = [300, 700, 1100, 1500, 1900, 2300];
export const H_ROADS = [300, 700, 1100, 1500];
export const SEA_X = 110; // west of this is water
export const BEACH_X = 190; // sand strip between sea and city
export const MARINA_X = 2480; // east of this is the marina water

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4c',
  sand: '#e8d29a',
  sea: '#2f7fb8',
  seaDeep: '#256a9e',
  asphalt: '#3d3f45',
  asphaltLight: '#4a4c54',
  sidewalk: '#b9b3a4',
  line: '#e8e4d2',
  roofA: '#c96f4a',
  roofB: '#4a7fb5',
  roofC: '#d9a441',
  roofD: '#7d6a9e',
  roofE: '#5a8a6a',
  wallA: '#8a4a34',
  wallB: '#33506e',
  wallC: '#9c7a2e',
  wallD: '#574a70',
  wallE: '#3f6248',
  sun: '#ffd98a',
  night: '#0d1526',
};

// District names, shown in the HUD with a clock. The streets keep the
// city's own geography: Old Port on the west, Marina on the east.
export const DISTRICTS = [
  { name: 'Old Port', x0: 190, y0: 0, x1: 700, y1: 1800, street: 'Harbor Avenue' },
  { name: 'Downtown', x0: 700, y0: 0, x1: 1500, y1: 1800, street: 'Tower Row' },
  { name: 'Palms', x0: 1500, y0: 700, x1: 2480, y1: 1800, street: 'Palm Crescent' },
  { name: 'Marina', x0: 1500, y0: 0, x1: 2480, y1: 700, street: 'Casino Strip' },
];

// Radio stations for the ticker. The music loop is a bassline; the
// ticker just names the station that would be playing.
export const RADIO = [
  { name: 'SOLMAR FM 98.4', show: 'Coastline' },
  { name: 'WAVE 101.7', show: 'Night Drive' },
  { name: 'PALM 88.2', show: 'Island Gold' },
];

// The crew: three real abilities on Z / X / C, with cooldowns.
export const CREW = {
  plates: { key: 'Z', name: 'SWAP PLATES', person: 'Dana Rook', role: 'Driver', cooldown: 30, blurb: 'Fresh plates — heat drops a star' },
  fix: { key: 'X', name: 'QUICK FIX', person: 'Milo Ferran', role: 'Mechanic', cooldown: 45, blurb: 'Patches the ride back to 100%' },
  eyes: { key: 'C', name: 'EYES OUT', person: 'Nia Sol', role: 'Lookout', cooldown: 12, blurb: 'Marks the nearest unit for 10 s' },
};

// Respect ranks, driven by real stats (missions, kills, cars stolen).
export const RANKS = [
  { at: 0, name: 'ROOKIE' },
  { at: 500, name: 'HUSTLER' },
  { at: 1500, name: 'DRIVER' },
  { at: 3000, name: 'FIXER' },
  { at: 5200, name: 'KINGPIN' },
  { at: 9000, name: 'LEGEND' },
];

export function respectPoints(game) {
  return game.missionsDone * 1300 + game.stats.kills * 75 + game.stats.carsStolen * 150 + game.stats.pedsHit * 10;
}

export function rankFor(game) {
  const rp = respectPoints(game);
  let tier = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (rp >= RANKS[i].at) tier = i;
  }
  const start = RANKS[tier].at;
  const end = tier + 1 < RANKS.length ? RANKS[tier + 1].at : RANKS[tier].at + 5000;
  return { name: RANKS[tier].name, tier: tier + 1, rp: rp - start, rpMax: end - start };
}

// Chase camera: distance behind the car, height above the street, and
// how far down the camera tilts. On foot the camera closes in.
export const CAM_DRIVE_DIST = 95;
export const CAM_DRIVE_HEIGHT = 52;
export const CAM_FOOT_DIST = 85;
export const CAM_FOOT_HEIGHT = 44;
export const CAM_PITCH = 0.26; // radians the camera looks down
export const CAM_FOV_DEG = 75;

export const PLAYER_WALK_SPEED = 230;
export const PLAYER_SPRINT_SPEED = 330;
export const PLAYER_HEALTH_MAX = 100;
export const CAR_ENTER_RADIUS = 70;
export const BULLET_SPEED = 900;
export const PISTOL_DAMAGE = 34;
export const FIST_DAMAGE = 20;

// Wanted heat thresholds: heat >= each value earns that star count.
export const WANTED_THRESHOLDS = [0.5, 1.2, 2.1, 3.2, 4.5];
export const HEAT_DECAY_PER_SECOND = 0.03;
export const HEAT_STEAL_CAR = 0.9;
export const HEAT_SHOOT = 0.45;
export const HEAT_HIT_PED = 0.7;
export const HEAT_KILL = 0.25;

export const SAVE_KEY = 'solmar-save-v1';
export const SHOT_SEED = 7;
