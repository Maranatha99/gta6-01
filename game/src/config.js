// SOLMAR BAY — configuration: world size, roads, player, cars, police, missions.
// All tuning lives here so the rest of the game reads one source of truth.
export const WORLD = { size: 3200, roadSpacing: 400, roadWidth: 96, firstRoad: 200 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmarbay-save-v1';

export const PLAYER = {
  radius: 13,
  walkSpeed: 195,
  runSpeed: 265,
  health: 100,
  maxAmmo: 120,
  pistolDamage: 34,
  fireInterval: 0.22,
  bulletSpeed: 920,
  bulletRange: 540,
};

export const CAR = {
  length: 54,
  width: 26,
  maxSpeed: 560,
  maxReverse: 180,
  accel: 430,
  brake: 720,
  steer: 2.6,
  grip: 6.5,
  health: 100,
};

export const TRAFFIC = { count: 26, speed: 150 };
export const PEDS = { count: 42, speed: 55 };

export const WANTED = {
  thresholds: [0, 25, 60, 120, 200, 320],
  decayPerSecond: 2.2,
  unseenDecay: 9,
  crimeSteal: 30,
  crimeShoot: 18,
  crimeKillPed: 45,
  crimeKillCop: 90,
};

export const POLICE = {
  carSpeed: 605,
  footSpeed: 178,
  ramDamage: 8,
  shootRange: 380,
  shootInterval: 0.9,
  bustRange: 46,
  bustTime: 2.2,
};

export const MONEY = { start: 500, missionPayout: [800, 1200, 1800, 1500, 2600, 5000] };

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  ocean: '#2f7fa8',
  oceanDeep: '#256b90',
  asphalt: '#3a3f46',
  asphaltLight: '#43484f',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  lineYellow: '#e8c33c',
  lineWhite: '#d8d8d2',
  building: ['#e8a87c', '#e8c87c', '#7fb8a8', '#c97b7b', '#a8b8d8', '#d8b8e8', '#f0e0c0', '#8fb8d8'],
  roof: ['#b87a5a', '#a87a3a', '#5a8a7a', '#96555a'],
  palm: '#3f8a4a',
  trunk: '#8a6a4a',
};

// Mission script: name, giver, briefing, steps.
// Steps: { kind: 'goto'|'pickup'|'deliver'|'steal'|'lose'|'eliminate'|'escape', x, y, label, seconds? }
export const MISSIONS = [
  {
    id: 1, name: 'First Gear', giver: 'Mara Voss',
    brief: 'Mara needs a driver she can trust. Get to her garage on Coral Row and say hello.',
    steps: [{ kind: 'goto', x: 1000, y: 600, label: 'Go to Mara\u2019s Garage' }],
  },
  {
    id: 2, name: 'Package Run', giver: 'Mara Voss',
    brief: 'Pick up the package at the marina, then drop it at the hotel on Palm Row. Quick and quiet — 90 seconds.',
    steps: [
      { kind: 'pickup', x: 3000, y: 2600, label: 'Pick up the package at the marina', seconds: 90 },
      { kind: 'deliver', x: 1800, y: 1000, label: 'Deliver the package to the hotel' },
    ],
  },
  {
    id: 3, name: 'Hot Wheels', giver: 'Big Lou',
    brief: 'Lou wants the cherry-red Comet GT parked outside the casino. Take it — any way you like — and bring it to the chop shop.',
    steps: [
      { kind: 'steal', x: 2200, y: 1400, label: 'Steal the Comet GT at the casino' },
      { kind: 'deliver', x: 600, y: 2600, label: 'Deliver the Comet GT to the chop shop' },
    ],
  },
  {
    id: 4, name: 'Heat Wave', giver: 'Mara Voss',
    brief: 'The cops are all over you. Lose the heat — break line of sight and stay out of trouble until the stars fade.',
    steps: [{ kind: 'lose', label: 'Lose the cops — get your wanted level to zero' }],
  },
  {
    id: 5, name: 'Loud & Clear', giver: 'Big Lou',
    brief: 'Rival crew is leaning on Lou\u2019s warehouse. Clear them out. Bring a gun — and watch your six.',
    steps: [{ kind: 'eliminate', x: 2600, y: 2200, label: 'Clear the warehouse of rivals', count: 6 }],
  },
  {
    id: 6, name: 'The Big Score', giver: 'Mara Voss',
    brief: 'One last job: the Sun Bank on Coral Row. Grab the cash, lose a four-star response, and bring it home to the safehouse.',
    steps: [
      { kind: 'pickup', x: 1400, y: 600, label: 'Grab the cash at Sun Bank', seconds: 150 },
      { kind: 'escape', x: 1000, y: 2600, label: 'Escape the heat and reach the safehouse' },
    ],
  },
];

export const CONTACTS = {
  mara: { name: 'Mara Voss', role: 'Fixer', color: '#e8c33c' },
  lou: { name: 'Big Lou', role: 'Chop-shop king', color: '#e87c5a' },
};
