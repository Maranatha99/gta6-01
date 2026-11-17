// The game's rules and state, with no drawing and no browser in it: the player on foot
// and in cars, traffic, pedestrians, police and wanted heat, missions, combat and
// pickups. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, messages) without the world knowing about screens or sound.
import { CAR, MISSIONS, MONEY, PLAYER, POLICE, STEP, WANTED, WORLD } from './config.js';
import { createCity, isOnRoad } from './city.js';
import { createRandom } from './random.js';
import { createCombat, fireBullet, spawnParticles, stepCombat } from './combat.js';
import { advanceStep, createMissionState, currentMission, currentStep, failMission, nextMissionIndex, startMission, stepMissions } from './missions.js';
import { maintainPolice, stepFootCop, stepPoliceCar, wantedStars } from './police.js';
import { driveCar, makeCar, spawnParked, spawnTraffic, stepTraffic } from './vehicles.js';
import { makePed, spawnPed, stepPed } from './peds.js';

export const EVENT_SHOT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_MISSION_FAIL = 8;
export const EVENT_WASTED = 16;
export const EVENT_BUSTED = 32;
export const EVENT_CRASH = 64;
export const EVENT_STEAL = 128;
export const EVENT_STAR_UP = 256;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createWorld(random) {
  const city = createCity(random);
  const combat = createCombat();
  const missions = createMissionState();
  const police = { cars: [], cops: [], spawnTimer: 0 };

  const player = {
    x: 600, y: 600, angle: 0, health: PLAYER.health, ammo: 60,
    inCar: null, fireTimer: 0, invulnerable: 0, run: false,
  };
  const state = {
    player, city, combat, missions, police,
    money: MONEY.start, heat: 0, stars: 0, elapsed: 0,
    kills: 0, carsStolen: 0, cars: [], peds: [], rivals: [],
    wantedSeen: false, missionCar: null, busted: false,
    cameraShake: 0, objectiveFlash: 0,
  };

  function collideCircle(x, y, r) {
    const hit = city.collideCircle(x, y, r);
    if (hit) return hit;
    return null;
  }

  function reset() {
    player.x = 600;
    player.y = 600;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.ammo = 60;
    player.inCar = null;
    player.fireTimer = 0;
    player.invulnerable = 0;
    state.money = MONEY.start;
    state.heat = 0;
    state.stars = 0;
    state.elapsed = 0;
    state.kills = 0;
    state.carsStolen = 0;
    state.cars = [];
    state.peds = [];
    state.rivals = [];
    state.missionCar = null;
    state.busted = false;
    state.cameraShake = 0;
    state.wantedSeen = false;
    missions.activeIndex = -1;
    missions.stepIndex = 0;
    missions.done = [];
    missions.message = '';
    missions.messageTimer = 0;
    police.cars = [];
    police.cops = [];
    police.spawnTimer = 0;
    for (const b of combat.bullets) b.active = false;
    for (const p of combat.particles) p.active = false;
    for (const pk of city.pickups) { pk.taken = false; pk.respawn = 0; }
    // Traffic, parked cars and pedestrians around the spawn.
    for (let i = 0; i < 26; i += 1) {
      const c = spawnTraffic(random, player.x, player.y);
      if (c) state.cars.push(c);
    }
    for (let i = 0; i < 8; i += 1) {
      const c = spawnParked(random, player.x, player.y, city.insideBuilding);
      if (c) state.cars.push(c);
    }
    for (let i = 0; i < 42; i += 1) state.peds.push(spawnPed(random, city.insideBuilding, player.x, player.y));
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of state.cars) {
      if (c.dead || c.police) continue;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function addHeat(amount) {
    const before = wantedStars(state.heat);
    state.heat = Math.min(400, state.heat + amount);
    const after = wantedStars(state.heat);
    state.stars = after;
    return after > before;
  }

  function enterCar(car) {
    player.inCar = car;
    car.traffic = false;
    state.carsStolen += 1;
    if (addHeat(WANTED.crimeSteal)) return EVENT_STAR_UP | EVENT_STEAL;
    return EVENT_STEAL;
  }

  function exitCar() {
    const car = player.inCar;
    if (!car) return;
    player.inCar = null;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 40;
    player.y = car.y + Math.sin(side) * 40;
    const fixed = city.collideCircle(player.x, player.y, PLAYER.radius);
    if (fixed) { player.x = fixed.x; player.y = fixed.y; }
    player.angle = car.angle;
  }

  function damagePlayer(amount) {
    if (player.invulnerable > 0) return 0;
    player.health -= amount;
    player.invulnerable = 0.25;
    state.cameraShake = Math.max(state.cameraShake, 6);
    if (player.health <= 0) {
      player.health = 0;
      return EVENT_WASTED;
    }
    return 0;
  }

  /** Bullet hit test against buildings, peds, cops, rivals and cars. */
  function hitTest(bullet) {
    if (city.insideBuilding(bullet.x, bullet.y, 0)) return 'block';
    if (bullet.x < 20 || bullet.y < 20 || bullet.x > WORLD.size - 20 || bullet.y > WORLD.size - 20) return 'block';
    const targets = [...state.peds, ...state.rivals, ...police.cops];
    for (const t of targets) {
      if (t.state === 'dead') continue;
      if (Math.hypot(t.x - bullet.x, t.y - bullet.y) < 16) {
        t.health -= PLAYER.pistolDamage;
        if (t.health <= 0) {
          t.state = 'dead';
          state.kills += 1;
          if (t.rival) {
            missions.rivalsLeft -= 1;
            addHeat(WANTED.crimeKillPed);
          } else if (police.cops.includes(t)) {
            addHeat(WANTED.crimeKillCop);
          } else {
            addHeat(WANTED.crimeKillPed);
          }
          spawnParticles(combat, t.x, t.y, 10, '#c8a888', 160, 0.6);
        }
        return t.rival ? 'cop' : (police.cops.includes(t) ? 'cop' : 'ped');
      }
    }
    for (const c of state.cars) {
      if (c.dead) continue;
      const dx = bullet.x - c.x;
      const dy = bullet.y - c.y;
      const along = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = -dx * Math.sin(c.angle) + dy * Math.cos(c.angle);
      if (Math.abs(along) < CAR.length / 2 && Math.abs(side) < CAR.width / 2) {
        c.health -= PLAYER.pistolDamage;
        if (c.health <= 0) {
          c.dead = true;
          spawnParticles(combat, c.x, c.y, 24, '#e8c33c', 260, 0.8);
          spawnParticles(combat, c.x, c.y, 16, '#555', 120, 1.2);
        }
        return 'car';
      }
    }
    return null;
  }

  function stepPlayer(dt, input, aimAngle) {
    player.fireTimer -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.inCar) {
      const speed = driveCar(player.inCar, input, dt, (x, y, r) => collideCircle(x, y, r));
      // Running over pedestrians.
      for (const ped of state.peds) {
        if (ped.state === 'dead') continue;
        if (Math.hypot(ped.x - player.inCar.x, ped.y - player.inCar.y) < 30 && Math.abs(speed) > 120) {
          ped.state = 'dead';
          state.kills += 1;
          addHeat(WANTED.crimeKillPed);
          spawnParticles(combat, ped.x, ped.y, 10, '#c8a888', 160, 0.6);
        }
      }
      // Ramming traffic and police cars.
      for (const c of state.cars) {
        if (c === player.inCar || c.dead) continue;
        const d = Math.hypot(c.x - player.inCar.x, c.y - player.inCar.y);
        if (d < 44 && Math.abs(speed) > 150) {
          c.health -= 30;
          player.inCar.health -= 4;
          if (c.health <= 0) { c.dead = true; spawnParticles(combat, c.x, c.y, 20, '#e8c33c', 240, 0.7); }
        }
      }
      if (player.inCar.health <= 0) {
        player.inCar.dead = true;
        spawnParticles(combat, player.inCar.x, player.inCar.y, 30, '#e8c33c', 300, 1);
        exitCar();
      }
      return 0;
    }

    // On foot.
    const mx = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const my = (input.up ? -1 : 0) + (input.down ? 1 : 0);
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      const nx = player.x + (mx / len) * speed * dt;
      const ny = player.y + (my / len) * speed * dt;
      const hit = city.collideCircle(nx, ny, PLAYER.radius);
      if (hit) { player.x = hit.x; player.y = hit.y; }
      else { player.x = nx; player.y = ny; }
      player.x = clamp(player.x, 30, WORLD.size - 30);
      player.y = clamp(player.y, 30, WORLD.size - 30);
    }
    player.angle = aimAngle;
    // Shooting.
    if (input.fire && player.fireTimer <= 0 && player.ammo > 0) {
      player.fireTimer = PLAYER.fireInterval;
      player.ammo -= 1;
      fireBullet(combat, player.x, player.y, player.angle, true);
      spawnParticles(combat, player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, 3, '#ffd76a', 160, 0.12);
      addHeat(WANTED.crimeShoot * 0.15);
      return EVENT_SHOT;
    }
    return 0;
  }

  function stepMission(dt, events) {
    const mission = currentMission(missions);
    if (!mission) return events;
    const step = currentStep(missions);
    if (!step) return events;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const dist = step.x !== undefined ? Math.hypot(step.x - px, step.y - py) : Infinity;

    if (step.kind === 'goto' || step.kind === 'deliver') {
      if (dist < 70) {
        const res = advanceStep(missions);
        if (res && res.complete) { state.money += res.payout; events |= EVENT_MISSION_DONE; }
      }
    } else if (step.kind === 'pickup') {
      if (dist < 70) {
        const res = advanceStep(missions);
        if (res && res.complete) { state.money += res.payout; events |= EVENT_MISSION_DONE; }
        else if (mission.id === 6) {
          // Bank job: the response is four stars — set the heat to 230, solidly
          // inside the four-star band (200–319), whatever the player arrived
          // with. (Adding 200 on top of heat the player already had could stack
          // to five stars, which the brief never asks for and makes the escape
          // effectively unwinnable. Setting exactly 200 would decay below the
          // band on the very next tick, so the player would never actually face
          // the promised four-star response.)
          state.heat = 230;
          state.stars = wantedStars(state.heat);
        }
      }
    } else if (step.kind === 'steal') {
      // The target car waits at the casino; entering it completes the step.
      if (!state.missionCar) {
        const car = makeCar(step.x, step.y, 0, '#d84a4a', { target: true });
        state.missionCar = car;
        state.cars.push(car);
      }
      if (player.inCar === state.missionCar) {
        const res = advanceStep(missions);
        if (res && res.complete) { state.money += res.payout; events |= EVENT_MISSION_DONE; }
      }
    } else if (step.kind === 'lose') {
      if (mission.id === 4 && !mission.started) { /* heat is set by the starter */ }
      if (state.stars === 0) {
        const res = advanceStep(missions);
        if (res && res.complete) { state.money += res.payout; events |= EVENT_MISSION_DONE; }
      }
    } else if (step.kind === 'eliminate') {
      if (state.rivals.length === 0 && missions.rivalsLeft > 0) {
        for (let i = 0; i < step.count; i += 1) {
          const rx = step.x + (random() - 0.5) * 260;
          const ry = step.y + (random() - 0.5) * 260;
          const rival = makePed(random, rx, ry, { rival: true });
          rival.health = 100;
          state.rivals.push(rival);
        }
      }
      if (missions.rivalsLeft <= 0 && state.rivals.length > 0) {
        const res = advanceStep(missions);
        if (res && res.complete) { state.money += res.payout; events |= EVENT_MISSION_DONE; }
      }
    } else if (step.kind === 'escape') {
      if (dist < 80 && state.stars === 0) {
        const res = advanceStep(missions);
        if (res && res.complete) { state.money += res.payout; events |= EVENT_MISSION_DONE; }
      }
    }
    return events;
  }

  function stepWorld(dt, input, aimAngle) {
    let events = 0;
    state.elapsed += dt;
    if (state.cameraShake > 0) state.cameraShake = Math.max(0, state.cameraShake - dt * 30);

    // Mission timer / failure.
    const mres = stepMissions(missions, dt);
    if (mres && mres.failed) events |= EVENT_MISSION_FAIL;

    // Player.
    events |= stepPlayer(dt, input, aimAngle);

    // Interact (enter/exit car) is handled by the caller via tryInteract().

    // Traffic and parked-car upkeep: keep the streets full near the player.
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    state.cars = state.cars.filter((c) => (!c.dead || c === player.inCar)
      && (!c.traffic || Math.hypot(c.x - px, c.y - py) < 1500));
    if (state.cars.filter((c) => c.traffic).length < 20) {
      const c = spawnTraffic(random, px, py);
      if (c) state.cars.push(c);
    }
    for (const c of state.cars) {
      if (c.traffic && c !== player.inCar) stepTraffic(c, dt, random, state.cars, (x, y, r) => collideCircle(x, y, r));
    }

    // Pedestrians. A fast car is danger too: peds on the road get out of its way.
    const fastCar = player.inCar && Math.abs(player.inCar.speed) > 200 ? player.inCar : null;
    const danger = input.fire ? { x: player.x, y: player.y }
      : fastCar ? { x: fastCar.x, y: fastCar.y, car: true, angle: fastCar.angle } : null;
    for (const ped of state.peds) {
      if (ped.state === 'dead') continue;
      stepPed(ped, dt, random, danger);
    }
    state.peds = state.peds.filter((p) => p.state !== 'dead' || Math.hypot(p.x - px, p.y - py) < 900);
    if (state.peds.length < 36) state.peds.push(spawnPed(random, city.insideBuilding, px, py));

    // Rivals shoot back during the warehouse mission.
    for (const rival of state.rivals) {
      if (rival.state === 'dead') continue;
      const d = Math.hypot(rival.x - player.x, rival.y - player.y);
      rival.shootTimer -= dt;
      if (d < 420 && rival.shootTimer <= 0 && !player.inCar) {
        rival.shootTimer = 1.1 + random() * 0.6;
        const angle = Math.atan2(player.y - rival.y, player.x - rival.x) + (random() - 0.5) * 0.3;
        fireBullet(combat, rival.x, rival.y, angle, false);
        events |= EVENT_SHOT;
      } else if (d < 500) {
        // Close in on the player.
        rival.targetX = player.x;
        rival.targetY = player.y;
        rival.retarget = 0.5;
        stepPed(rival, dt, random, null);
      }
    }

    // Wanted heat: decay when unseen, faster when no police are near.
    // "Seen" needs a clear line of sight, not just distance: a police unit
    // behind a building (or cutting across a block) does not see the player,
    // so weaving through the blocks really does break the heat — that is what
    // the Heat Wave / Big Score escapes are about. Police cars drive through
    // buildings, so a unit inside a block counts as blind too.
    const seesPlayer = (ux, uy, range) => Math.hypot(ux - px, uy - py) < range
      && city.hasLineOfSight(ux, uy, px, py);
    const nearPolice = police.cars.some((c) => seesPlayer(c.x, c.y, 500)) ||
      police.cops.some((c) => seesPlayer(c.x, c.y, 400));
    state.wantedSeen = nearPolice;
    if (state.stars > 0) {
      state.heat -= (nearPolice ? WANTED.decayPerSecond : WANTED.unseenDecay) * dt;
      if (state.heat < 0) state.heat = 0;
      const ns = wantedStars(state.heat);
      if (ns !== state.stars) state.stars = ns;
    }
    if (state.stars > 0) {
      maintainPolice(police, dt, random, px, py, state.stars);
      for (const car of police.cars) {
        stepPoliceCar(car, dt, px, py, (c) => {
          // Ram: damage the player (or their car) and shake the camera. One ram a
          // second per car, so a chase wears the player down instead of deleting them.
          if (c.ramTimer > 0) return;
          c.ramTimer = 1.0;
          if (player.inCar) {
            player.inCar.health -= 1; // a ram chips the car; at 1/s per police car
            // a chase still wears it down, but one car now lasts a whole escape leg
            c.health -= 6; // ramming wears the police car out too
            if (c.health <= 0) c.dead = true;
            if (player.inCar.health <= 0) {
              player.inCar.dead = true;
              spawnParticles(combat, player.inCar.x, player.inCar.y, 30, '#e8c33c', 300, 1);
              exitCar();
            }
          } else {
            events |= damagePlayer(6);
          }
          state.cameraShake = Math.max(state.cameraShake, 8);
          c.speed *= 0.4;
          events |= EVENT_CRASH;
        });
      }
      for (const cop of police.cops) {
        stepFootCop(cop, dt, px, py, !!player.inCar, (c) => {
          const angle = Math.atan2(player.y - c.y, player.x - c.x) + (random() - 0.5) * 0.35;
          fireBullet(combat, c.x, c.y, angle, false);
          events |= EVENT_SHOT;
        }, (bust) => {
          if (bust >= 1.2) state.busted = true;
        });
      }
      if (state.busted) {
        state.busted = false;
        events |= EVENT_BUSTED;
      }
    } else {
      police.cars = [];
      police.cops = [];
    }

    // Enemy bullets hitting the player.
    stepCombat(combat, dt, (b) => {
      if (b.friendly) return hitTest(b);
      const d = Math.hypot(b.x - player.x, b.y - player.y);
      if (d < 16 && !player.inCar) {
        events |= damagePlayer(9);
        return 'ped';
      }
      if (player.inCar && d < 30) {
        player.inCar.health -= 4;
        return 'car';
      }
      if (city.insideBuilding(b.x, b.y, 0)) return 'block';
      return null;
    });

    // Pickups: health and ammo, respawning after a while.
    for (const pk of city.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
        continue;
      }
      if (Math.hypot(pk.x - px, pk.y - py) < 40) {
        pk.taken = true;
        pk.respawn = 45;
        if (pk.kind === 'health') player.health = Math.min(PLAYER.health, player.health + 40);
        else player.ammo = Math.min(PLAYER.maxAmmo, player.ammo + 40);
        events |= EVENT_PICKUP;
      }
    }

    // Mission progress.
    events = stepMission(dt, events);

    // Smoke from a dying car.
    for (const c of state.cars) {
      if (!c.dead && c.health < 40 && random() < dt * 8) {
        spawnParticles(combat, c.x, c.y, 1, '#777', 40, 1.1);
      }
    }
    return events;
  }

  function tryInteract() {
    if (player.inCar) {
      exitCar();
      return 'exit';
    }
    const car = nearestCar(64);
    if (car) {
      const ev = enterCar(car);
      return ev & EVENT_STEAL ? 'steal' : 'enter';
    }
    return null;
  }

  function startNextMission() {
    const idx = nextMissionIndex(missions);
    if (idx < 0) return null;
    return startMissionAt(idx);
  }

  function startMissionAt(idx) {
    const mission = startMission(missions, idx);
    if (mission.id === 4) {
      // Heat Wave starts with the heat already on.
      state.heat = 130;
      state.stars = wantedStars(state.heat);
    }
    if (mission.id === 5) missions.rivalsLeft = mission.steps[0].count;
    return mission;
  }

  function applySave(data) {
    state.money = data.money;
    missions.done = data.missionsDone || [];
    player.x = data.x;
    player.y = data.y;
    player.health = data.health;
    player.ammo = data.ammo;
    state.elapsed = data.time || 0;
    state.kills = data.kills || 0;
    state.carsStolen = data.carsStolen || 0;
  }

  reset();
  return {
    state, reset, step: stepWorld, tryInteract, startNextMission, startMissionAt, addHeat, damagePlayer,
    currentMission: () => currentMission(missions),
    currentStep: () => currentStep(missions),
    missionLabel: () => {
      const step = currentStep(missions);
      return step ? step.label : '';
    },
  };
}

export { MISSIONS, STEP };
export { createRandom };
