// Vehicles: the player's car physics and the traffic that drives the road grid.
// Cars are axis-aligned to the road network when they are traffic; the player's car
// steers freely with arcade physics (acceleration, steering that scales with speed,
// handbrake drift) and collides with buildings and other cars.
import { CAR, TRAFFIC, WORLD } from './config.js';
import { ROAD_LINES, isOnRoad, nearestRoad } from './city.js';

export const CAR_COLORS = ['#d84a4a', '#4a7ad8', '#e8c33c', '#7fb8a8', '#e8e8e8', '#3a3a3a', '#d88ad8', '#e87c3c', '#4ad8a8', '#a8c84a'];
export const POLICE_COLOR = '#e8e8e8';

let nextId = 1;

export function makeCar(x, y, angle, color, opts = {}) {
  return {
    id: nextId += 1,
    x, y, angle,
    speed: 0,
    color,
    police: !!opts.police,
    target: !!opts.target,
    traffic: !!opts.traffic,
    health: CAR.health,
    dead: false,
    // Traffic AI: which road axis it follows and where it is heading.
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    nextTurn: 0,
    stuck: 0,
    honk: 0,
  };
}

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Arcade driving: throttle, brake/reverse, steering, handbrake, building collision. */
export function driveCar(car, input, dt, collide) {
  const forward = input.up ? 1 : 0;
  const back = input.down ? 1 : 0;
  const steerInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const handbrake = !!input.handbrake;

  if (forward) car.speed += CAR.accel * dt;
  if (back) car.speed -= (car.speed > 10 ? CAR.brake : CAR.accel * 0.55) * dt;
  if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 900 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));

  const speedRatio = Math.min(1, Math.abs(car.speed) / CAR.maxSpeed);
  const steer = steerInput * CAR.steer * (0.35 + 0.65 * speedRatio) * (handbrake ? 1.5 : 1);
  car.angle += steer * dt * Math.sign(car.speed) * (handbrake ? 1.4 : 1);
  car.angle = clampAngle(car.angle);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collide(nx, ny, CAR.length / 2 - 4);
  if (hit) {
    car.x = hit.x;
    car.y = hit.y;
    if (Math.abs(car.speed) > 260) car.health -= 6;
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(40, Math.min(WORLD.size - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.size - 40, car.y));
  return car.speed;
}

/** Traffic: follow the road grid, turn at intersections, slow for the car ahead. */
export function stepTraffic(car, dt, random, cars, collide) {
  if (car.dead) return;
  const road = nearestRoad(car.axis === 'x' ? car.y : car.x);
  // Ease back onto the centre line of the current road.
  const cross = car.axis === 'x' ? car.y - road : car.x - road;
  const targetAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  let want = targetAngle + Math.max(-0.5, Math.min(0.5, -cross * 0.02));
  let diff = clampAngle(want - car.angle);
  car.angle = clampAngle(car.angle + Math.max(-2.4 * dt, Math.min(2.4 * dt, diff)));

  // Slow down if another car is close ahead.
  let ahead = 0;
  const ax = Math.cos(car.angle);
  const ay = Math.sin(car.angle);
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * ax + dy * ay;
    const side = Math.abs(dx * -ay + dy * ax);
    if (along > 0 && along < 110 && side < 40) ahead = Math.max(ahead, 1 - along / 110);
  }
  const targetSpeed = TRAFFIC.speed * (1 - ahead * 0.85);
  car.speed += Math.max(-260 * dt, Math.min(260 * dt, targetSpeed - car.speed));
  if (car.speed < 0) car.speed = 0;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collide(nx, ny, CAR.length / 2 - 4);
  if (hit) {
    car.x = hit.x;
    car.y = hit.y;
    car.speed = 0;
    car.stuck += dt;
  } else {
    car.x = nx;
    car.y = ny;
    car.stuck = 0;
  }

  // At an intersection, sometimes turn onto the crossing road.
  const alongRoad = car.axis === 'x' ? car.x : car.y;
  const nearLine = ROAD_LINES.some((p) => Math.abs(alongRoad - p) < 14);
  if (nearLine && random() < dt * 0.5) {
    car.axis = car.axis === 'x' ? 'y' : 'x';
    car.dir = random() < 0.5 ? 1 : -1;
  }
  if (car.stuck > 2) {
    // Unstick: reverse a little, then pick a new direction.
    car.angle = clampAngle(car.angle + Math.PI);
    car.stuck = 0;
  }
}

/** Spawn a traffic car on a random road, away from the player. */
export function spawnTraffic(random, px, py) {
  for (let tries = 0; tries < 12; tries += 1) {
    const road = ROAD_LINES[Math.floor(random() * ROAD_LINES.length)];
    const along = 120 + random() * (WORLD.size - 240);
    const axis = random() < 0.5 ? 'x' : 'y';
    const x = axis === 'x' ? along : road + (random() - 0.5) * 20;
    const y = axis === 'x' ? road + (random() - 0.5) * 20 : along;
    if (Math.hypot(x - px, y - py) < 320) continue;
    if (!isOnRoad(x, y)) continue;
    return makeCar(x, y, axis === 'x' ? 0 : Math.PI / 2, CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], {
      traffic: true, axis, dir: random() < 0.5 ? 1 : -1,
    });
  }
  return null;
}

/** A parked car near a road, for the player to steal. */
export function spawnParked(random, px, py) {
  for (let tries = 0; tries < 12; tries += 1) {
    const road = ROAD_LINES[Math.floor(random() * ROAD_LINES.length)];
    const along = 160 + random() * (WORLD.size - 320);
    const horizontal = random() < 0.5;
    const off = (random() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + 24);
    const x = horizontal ? along : road + off;
    const y = horizontal ? road + off : along;
    if (Math.hypot(x - px, y - py) < 260) continue;
    return makeCar(x, y, horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], {});
  }
  return null;
}
