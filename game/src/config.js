// SOLMAR — shared constants: world size, roads, palette, tuning.
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
