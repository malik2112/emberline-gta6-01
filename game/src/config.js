// EMBERLINE — shared tuning, palette and story data.
// Sunset harbour city. All numbers are game design, written for this build.
export const WORLD = {
  half: 190,            // playable ground half-extent (metres)
  block: 46,            // city block pitch
  road: 12,             // road width
  sunAngle: 0.42,       // low sun
};

export const PALETTE = {
  skyTop: 0x2b1d4d,
  skyHorizon: 0xff7a3c,
  fog: 0xdd6a3a,
  ground: 0x3a3340,
  asphalt: 0x2c2a33,
  sidewalk: 0x6b6259,
  building: [0x4a3a55, 0x5d4a63, 0x3c465e, 0x6e4a3a, 0x54423e],
  windowLit: 0xffc46b,
  water: 0x274b63,
  neon: [0xff2e88, 0x22d3ee, 0xffb020, 0x7c5cff],
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 12,
  radius: 0.6,
  health: 100,
};

export const VEHICLE = {
  accel: 16,
  brake: 30,
  maxSpeed: 34,
  reverseMax: 9,
  steer: 1.9,
};

export const WANTED = {
  decayPerSec: 0.06,    // stars melt slowly when quiet
  copChaseSpeed: 8.5,
  bustRadius: 1.6,
  maxStars: 5,
};

export const ECONOMY = {
  startCash: 120,
  missionRewards: [250, 400, 650, 900, 1500],
};

export const MISSIONS = [
  {
    id: 'm1', name: 'First Light', giver: 'Mara',
    brief: 'Mara needs a driver. Steal the orange coupe on Pier 9 and bring it to the garage on Crane Street.',
    steps: [
      { kind: 'steal', text: 'Steal the orange coupe on Pier 9' },
      { kind: 'drive', text: 'Deliver the coupe to the garage marker' },
    ],
  },
  {
    id: 'm2', name: 'Harbour Lights', giver: 'Mara',
    brief: 'A rival crew torched Mara\'s stash. Torch their two sedans parked by the fish market, then lose the heat.',
    steps: [
      { kind: 'destroy', count: 2, text: 'Destroy 2 rival sedans at the fish market' },
      { kind: 'evade', text: 'Drop your wanted level to zero' },
    ],
  },
  {
    id: 'm3', name: 'The Long Way Home', giver: 'Otto',
    brief: 'Otto the dock boss pays for a pickup: collect the package at the lighthouse, then bring it to Otto\'s bar.',
    steps: [
      { kind: 'goto', text: 'Pick up the package at the lighthouse' },
      { kind: 'goto', text: 'Deliver the package to Otto\'s bar' },
    ],
  },
  {
    id: 'm4', name: 'Blue Hour', giver: 'Mara',
    brief: 'The cops impounded Mara\'s bike. Break into the impound lot, grab it, and outrun the patrol cars.',
    steps: [
      { kind: 'steal', text: 'Steal the bike from the impound lot' },
      { kind: 'evade', text: 'Escape: drop wanted to 1 star or less' },
    ],
  },
  {
    id: 'm5', name: 'Emberline', giver: 'Otto',
    brief: 'One last job. Drive the evidence van to the pier and sink the whole case — then walk away clean.',
    steps: [
      { kind: 'drive', text: 'Drive the van to the end of Pier 9' },
      { kind: 'goto', text: 'Walk to the pier light and finish the job' },
    ],
  },
];

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  shoot: ['Mouse0'],
  reload: ['KeyR'],
  radio: ['KeyQ'],
  pause: ['KeyP', 'Escape'],
};

export const SAVE_KEY = 'emberline-save-v3';
