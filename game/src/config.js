// EMBERLINE — config.js (round 3 re-author)
// Single source of truth for every tuning knob, colour and line of story
// copy. Systems import from here instead of scattering literals, so the
// whole game can be re-balanced from one file. All names are fiction.

export const GAME_TITLE = 'EMBERLINE';
export const GAME_SUBTITLE = 'A dockside crime story — drive, steal, run';
export const SAVE_KEY = 'emberline-save-v2';

// World grid. Streets sit on the grid lines; blocks fill the squares between.
export const CITY = {
  blocks: 6,
  block: 70,
  streetWidth: 16,
  half: 210,
  beachX: 226,   // quay apron starts (east edge)
  waterX: 262,   // harbor water starts
  boundX: 288,
  boundZ: 228,
  fogNear: 170,
  fogFar: 500,
  sunIntensity: 2.3,
};

// Kessler's Yard — every job starts and ends at Mara's chop-shop.
export const HUB = { x: -186, z: 168 };
export const HUB_NAME = "Kessler's Yard";
export const PD_NAME = 'Harbor PD';
export const RADIO_NAME = 'DOCK FM 101.3';
export const COMPLETE_TITLE = 'KING OF DOCK 9';
export const BUSTED_TEXT = 'Harbor PD put you in the back of a cruiser, took $100 for the paperwork, and left you outside the yard.';
export const WASTED_TEXT = 'Dockside Clinic stitched you up and billed you $100. The heat is off — for now.';
export const CLOCK_START = 17 * 60 + 48; // 17:48, golden hour on the quay

// Signature mechanic: a nitro bottle plumbed into every car.
export const MECHANIC = {
  type: 'nitro',
  blurb: 'NITRO boost: hold SHIFT in a car to burn boost for +35% top speed.',
  boostDrain: 30,      // tank units per second while boosting
  boostRefill: 9,      // tank units per second while coasting
  speedMultiplier: 1.35,
  accelMultiplier: 1.5,
};

// On-foot tuning.
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11.5,
  radius: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  maxHp: 100,
  jumpSpeed: 0,
  headBobAmount: 0.05,
};

// Arcade car tuning — grip pulls velocity toward the nose, handbrake loosens it.
export const CAR = {
  accel: 23,
  brake: 35,
  reverseMax: 12,
  maxSpeed: 41,
  turnRate: 1.95,
  grip: 6.8,
  handbrakeTurn: 3.2,
  radius: 1.5,
  driftGrip: 1.6,
};

// Ambient population.
export const TRAFFIC = {
  carCount: 14,
  carSpeed: 11,
  pedCount: 16,
  pedSpeed: 1.6,
  pedFleeSpeed: 4.8,
};

// Wanted ladder.
export const WANTED = {
  max: 5,
  decaySeconds: 24,
  bustDistance: 3.2,
  bustSeconds: 1.6,
  heatStealCar: 1,
  heatHitPed: 1,
  heatShoot: 1,
  heatKillCop: 2,
  heatRamCop: 1,
  coolDistance: 55, // cruisers must be at least this far for heat to drop
};

// Pistol and people.
export const COMBAT = {
  magSize: 12,
  reloadSeconds: 1.35,
  range: 92,
  damage: 34,
  fireInterval: 0.21,
  pedHp: 50,
  copHp: 80,
  rivalHp: 100,
  spreadBase: 0.006,
  spreadBloom: 0.004, // extra spread per rapid shot, decays over time
};

// Sunset-over-the-harbor palette.
export const PALETTE = {
  sky: 0xe8965a,
  fog: 0xd89a6a,
  sun: 0xffd9a0,
  asphalt: 0x2a2c30,
  sidewalk: 0x8a8078,
  sand: 0x8a8f96,
  sea: 0x1d4e5e,
  building: [0xb8643a, 0x3a7a8a, 0xc8a86a, 0x8a4a3a, 0x5a6a7a, 0xd8c8b8, 0x7a5a48, 0xa84a2a],
  glass: 0x2a4a5a,
  palmTrunk: 0x8a6a48,
  palmLeaf: 0x3f9a4a,
  carPaint: [0xc23b2e, 0xe8782a, 0xe8c23a, 0x3aa88a, 0x8a5fc2, 0xe8e8e8, 0x222831, 0xb84a2a],
  ground: 0x6a6258,
  hemiSky: 0xe8a06a,
  hemiGround: 0x5a4a3a,
  minimapSea: '#1d4e5e',
  minimapSand: '#8a8f96',
  beacon: 0xffd23a,
};

// District names shown on the HUD location readout.
export const DISTRICTS = [
  { name: 'QUAY ROW', x: -140, z: 140 },
  { name: 'DOCK 9', x: 150, z: -120 },
  { name: 'CRANE STREET', x: 100, z: -60 },
  { name: 'OLD MARKET', x: -60, z: -60 },
  { name: 'EMBERLINE', x: 0, z: 0 },
];

export function districtAt(x, z) {
  let best = DISTRICTS[DISTRICTS.length - 1];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dist = Math.hypot(x - d.x, z - d.z);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best.name;
}

// Story copy. Kade Venn owes Mara Kessler; five jobs settle it.
export const STORY = {
  hero: 'Kade Venn',
  fixer: 'Mara Kessler',
  intro: 'You are Kade Venn, a dockhand who rolled into Emberline with a dead flatbed and a debt to Mara Kessler, who runs the chop-shop on Quay Row. Work it off job by job — drive, steal, run — and earn your name on Dock 9. Watch the stars: Harbor PD does not forgive.',
  outro: 'The cranes shrink behind you, $1,500 richer and finally square with Mara. Emberline is yours now, Kade — every street, every car, every getaway. KING OF DOCK 9.',
};

// Start-screen control list: [key label, what it does].
export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click to lock)'],
  ['Shift', 'Sprint / NITRO boost (in car)'],
  ['E', 'Enter / exit / steal a car'],
  ['Space', 'Handbrake (in car)'],
  ['F', 'Horn (in car)'],
  ['Click', 'Fire pistol'],
  ['R', 'Reload'],
  ['M', 'Toggle mission details'],
  ['P / Esc', 'Pause'],
  ['H', 'Toggle radio'],
];
