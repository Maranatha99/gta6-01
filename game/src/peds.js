// Pedestrians: they stroll the sidewalks, cross roads at intersections, and run away
// from gunfire and speeding cars. A few are armed rivals during the warehouse mission.
import { PEDS, WORLD } from './config.js';
import { ROAD_LINES, isOnRoad } from './city.js';

export const PED_COLORS = ['#e8b88a', '#c98a6a', '#8a6a4a', '#d8d8d8', '#7a5a8a', '#4a7a8a', '#e8e8a8', '#a85a5a'];
const SHIRTS = ['#4a7ad8', '#d84a4a', '#e8c33c', '#4ad8a8', '#d88ad8', '#e87c3c', '#7fb8a8', '#a8a8a8'];

export function makePed(random, x, y, opts = {}) {
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: PEDS.speed * (0.8 + random() * 0.5),
    color: PED_COLORS[Math.floor(random() * PED_COLORS.length)],
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
    state: 'walk', // walk | flee | dead
    health: 100,
    rival: !!opts.rival,
    targetX: x,
    targetY: y,
    retarget: 0,
    panic: 0,
    shootTimer: 0,
  };
}

function pickTarget(ped, random) {
  // Walk along a sidewalk: pick a nearby road, then a point along it.
  const road = ROAD_LINES[Math.floor(random() * ROAD_LINES.length)];
  const along = 100 + random() * (WORLD.size - 200);
  const off = (random() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + 18 + random() * 26);
  if (random() < 0.5) {
    ped.targetX = along;
    ped.targetY = road + off;
  } else {
    ped.targetX = road + off;
    ped.targetY = along;
  }
  ped.retarget = 4 + random() * 8;
}

export function stepPed(ped, dt, random, danger) {
  if (ped.state === 'dead') return;
  ped.retarget -= dt;
  if (ped.panic > 0) ped.panic -= dt;

  // Danger (gunfire, a car bearing down): run away from it.
  if (danger) {
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.hypot(dx, dy);
    if (d < 320) {
      ped.state = 'flee';
      ped.panic = 1.5;
      ped.targetX = ped.x + (dx / (d || 1)) * 300;
      ped.targetY = ped.y + (dy / (d || 1)) * 300;
    }
  }
  if (ped.state === 'flee' && ped.panic <= 0) ped.state = 'walk';

  if (ped.retarget <= 0 || Math.hypot(ped.targetX - ped.x, ped.targetY - ped.y) < 24) {
    if (ped.state !== 'flee') pickTarget(ped, random);
    else { ped.targetX = ped.x + (random() - 0.5) * 400; ped.targetY = ped.y + (random() - 0.5) * 400; }
  }

  const dx = ped.targetX - ped.x;
  const dy = ped.targetY - ped.y;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    const want = Math.atan2(dy, dx);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
    const speed = ped.state === 'flee' ? ped.speed * 2.1 : ped.speed;
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
  }
  ped.x = Math.max(30, Math.min(WORLD.size - 30, ped.x));
  ped.y = Math.max(30, Math.min(WORLD.size - 30, ped.y));
  // Peds avoid walking through buildings by sliding along them is too costly;
  // instead they never pick targets inside buildings (see spawn), and the renderer
  // draws them over the sidewalk layer.
  void isOnRoad;
}

/** Spawn a ped on a sidewalk near (x, y), never inside a building. */
export function spawnPed(random, insideBuilding, x, y) {
  for (let tries = 0; tries < 10; tries += 1) {
    const px = Math.max(60, Math.min(WORLD.size - 60, x + (random() - 0.5) * 700));
    const py = Math.max(60, Math.min(WORLD.size - 60, y + (random() - 0.5) * 700));
    if (insideBuilding(px, py, 8)) continue;
    return makePed(random, px, py);
  }
  return makePed(random, 600, 600);
}
