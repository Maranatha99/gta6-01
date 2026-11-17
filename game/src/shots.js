// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a scripted
// driver (follow the road, brake for nothing, keep the camera on the action), so the
// frame is what a short game really looks like and the same seed always gives the same
// frame. The driver is deliberately simple: it accelerates and steers toward the next
// road waypoint, which keeps the car on the streets.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { makeCar } from './vehicles.js';
import { nearestRoad } from './city.js';

const SAMPLE = STEP;

/** Manhattan navigation: stay on the roads and turn only at intersections. */
function navPoint(car, tx, ty) {
  const rx = nearestRoad(car.x);
  const ry = nearestRoad(car.y);
  const onH = Math.abs(car.y - ry) < 24;
  const onV = Math.abs(car.x - rx) < 24;
  if (onH && Math.abs(tx - car.x) > 90) return { x: tx, y: ry };
  if (onV && Math.abs(ty - car.y) > 90) return { x: rx, y: ty };
  if (onH) return { x: rx, y: ty };
  if (onV) return { x: tx, y: ry };
  return { x: rx, y: ry };
}

/** Steer a car along the road grid toward (tx, ty): returns a fake input object. */
function driveInput(world, tx, ty) {
  const car = world.state.player.inCar;
  if (!car) return { up: false, down: false, left: false, right: false, run: false, fire: false, handbrake: false };
  const nav = navPoint(car, tx, ty);
  const want = Math.atan2(nav.y - car.y, nav.x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Ease off the throttle in a hard turn so the car does not swing wide off the road.
  const throttle = Math.abs(diff) > 1.1 ? Math.abs(car.speed) < 200 : true;
  return {
    up: throttle, down: false,
    left: diff < -0.08, right: diff > 0.08,
    run: false, fire: false, handbrake: false,
  };
}

/** Step the world forward `seconds`, steering the player's car along `waypoints`. */
function driveFor(world, seconds, waypoints) {
  let wp = 0;
  for (let t = 0; t < seconds; t += SAMPLE) {
    const car = world.state.player.inCar;
    if (car) {
      const target = waypoints[Math.min(wp, waypoints.length - 1)];
      if (Math.hypot(target.x - car.x, target.y - car.y) < 140 && wp < waypoints.length - 1) wp += 1;
      world.step(SAMPLE, driveInput(world, target.x, target.y), car.angle);
    } else {
      world.step(SAMPLE, { up: false, down: false, left: false, right: false, run: false, fire: false, handbrake: false }, 0);
    }
  }
}

/** Put the player in a car at (x, y) on the road, facing along it. */
function placeInCar(world, x, y, angle) {
  const car = makeCar(x, y, angle, '#d84a4a', {});
  world.state.cars.push(car);
  world.state.player.inCar = car;
  world.state.player.x = x;
  world.state.player.y = y;
  return car;
}

function stageStart(world) {
  for (let i = 0; i < 4 / STEP; i += 1) {
    world.step(STEP, { up: false, down: false, left: false, right: false, run: false, fire: false, handbrake: false }, 0);
  }
  return { screen: SCREEN_TITLE, ui: {} };
}

function stagePlay(world) {
  placeInCar(world, 600, 600, 0);
  driveFor(world, 14, [{ x: 1400, y: 600 }, { x: 1400, y: 1400 }, { x: 2200, y: 1400 }]);
  return { screen: SCREEN_PLAY, ui: {} };
}

function stageChase(world) {
  placeInCar(world, 1000, 1000, 0);
  world.addHeat(130);
  driveFor(world, 7, [{ x: 1800, y: 1000 }, { x: 1800, y: 1800 }, { x: 1000, y: 1800 }]);
  return { screen: SCREEN_PLAY, ui: {} };
}

function stageMission(world) {
  // Mission 2: the package run — drive to the marina pickup.
  world.startMissionAt(1);
  placeInCar(world, 2200, 2200, -Math.PI / 2);
  world.state.player.x = 2200;
  world.state.player.y = 2200;
  driveFor(world, 12, [{ x: 2200, y: 2600 }, { x: 2600, y: 2600 }, { x: 3000, y: 2600 }]);
  return { screen: SCREEN_PLAY, ui: {} };
}

/**
 * Set `world` to the named scene and return the screen and ui to draw over it.
 * Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') return stagePlay(world);
  if (name === 'chase') return stageChase(world);
  if (name === 'mission') return stageMission(world);
  return stageStart(world);
}
