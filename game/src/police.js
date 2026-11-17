// Wanted level and the police response: patrol cars that chase and ram, foot cops who
// shoot and try to bust the player, and heat that cools when the player breaks line of
// sight. Stars come from heat thresholds; at 1 star one car hunts, at 5 the whole city does.
import { POLICE, WANTED, WORLD } from './config.js';
import { makeCar } from './vehicles.js';

export function wantedStars(heat) {
  let stars = 0;
  for (let i = 1; i < WANTED.thresholds.length; i += 1) {
    if (heat >= WANTED.thresholds[i]) stars = i;
  }
  return stars;
}

export function createPolice() {
  const cars = [];
  const cops = [];
  let spawnTimer = 0;
  return { cars, cops, spawnTimer };
}

/** How many police cars and foot cops the current heat calls for. */
export function wantedForce(stars) {
  return { cars: Math.min(stars + 1, 6), cops: stars >= 3 ? Math.min((stars - 2) * 2, 6) : 0 };
}

function spawnPoint(random, px, py) {
  // Just off-screen from the player, on a road.
  const angle = random() * Math.PI * 2;
  const dist = 700 + random() * 350;
  const x = Math.max(80, Math.min(WORLD.size - 80, px + Math.cos(angle) * dist));
  const y = Math.max(80, Math.min(WORLD.size - 80, py + Math.sin(angle) * dist));
  return { x, y };
}

/** Keep the force at the size the heat demands; despawn units far from the player. */
export function maintainPolice(police, dt, random, px, py, stars) {
  const want = wantedForce(stars);
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0 && (police.cars.length < want.cars || police.cops.length < want.cops)) {
    police.spawnTimer = 1.2;
    const p = spawnPoint(random, px, py);
    if (police.cars.length < want.cars) {
      const car = makeCar(p.x, p.y, 0, '#e8e8e8', { police: true });
      car.speed = 200;
      police.cars.push(car);
    } else if (police.cops.length < want.cops) {
      police.cops.push({
        x: p.x, y: p.y, angle: 0, health: 100, state: 'chase',
        shootTimer: 0.5 + random(), bust: 0, speed: POLICE.footSpeed,
      });
    }
  }
  police.cars = police.cars.filter((c) => !c.dead && Math.hypot(c.x - px, c.y - py) < 1600);
  police.cops = police.cops.filter((c) => c.state !== 'dead' && Math.hypot(c.x - px, c.y - py) < 1400);
}

/** A police car chases the player: steer at them, ram on contact, slow in tight turns. */
export function stepPoliceCar(car, dt, px, py, onRam) {
  if (car.dead) return;
  const dx = px - car.x;
  const dy = py - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
  const targetSpeed = dist > 700 ? POLICE.carSpeed : POLICE.carSpeed * (0.75 + 0.25 * Math.min(1, dist / 700));
  car.speed += Math.max(-600 * dt, Math.min(600 * dt, targetSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(40, Math.min(WORLD.size - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.size - 40, car.y));
  if (dist < 52 && onRam) onRam(car);
}

/** A foot cop runs at the player, shoots in range, and busts them up close. */
export function stepFootCop(cop, dt, px, py, playerInCar, onShoot, onBustProgress) {
  if (cop.state === 'dead') return;
  const dx = px - cop.x;
  const dy = py - cop.y;
  const dist = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  if (dist > POLICE.bustRange) {
    cop.bust = 0;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0 && dist < POLICE.shootRange && !playerInCar) {
      cop.shootTimer = POLICE.shootInterval + Math.random() * 0.5;
      if (onShoot) onShoot(cop);
    }
  } else if (!playerInCar) {
    // On foot and cornered: the bust timer runs.
    cop.bust += dt;
    if (onBustProgress) onBustProgress(cop.bust);
    if (cop.bust >= POLICE.bustTime) cop.state = 'busted';
  }
}
