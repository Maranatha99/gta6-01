// Missions and story: a scripted chain of jobs from Mara Voss and Big Lou. Each mission
// is a list of steps (go to, pick up, deliver, steal a named car, lose the heat, clear a
// place, escape). The mission object only tracks progress; the world applies the effects.
import { MISSIONS, MONEY } from './config.js';

export function createMissionState() {
  return {
    activeIndex: -1, // index into MISSIONS, -1 = free roam
    stepIndex: 0,
    timer: 0,
    started: false,
    failed: false,
    done: [], // completed mission ids
    rivalsLeft: 0,
    message: '',
    messageTimer: 0,
  };
}

export function currentMission(missions) {
  if (missions.activeIndex < 0) return null;
  return MISSIONS[missions.activeIndex];
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.stepIndex] || null;
}

export function startMission(missions, index) {
  missions.activeIndex = index;
  missions.stepIndex = 0;
  missions.started = true;
  missions.failed = false;
  const mission = MISSIONS[index];
  const step = mission.steps[0];
  missions.timer = step.seconds || 0;
  missions.rivalsLeft = step.count || 0;
  missions.message = `${mission.giver}: ${mission.brief}`;
  missions.messageTimer = 7;
  return mission;
}

export function nextMissionIndex(missions) {
  for (let i = 0; i < MISSIONS.length; i += 1) {
    if (!missions.done.includes(MISSIONS[i].id)) return i;
  }
  return -1;
}

export function advanceStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  missions.stepIndex += 1;
  if (missions.stepIndex >= mission.steps.length) {
    missions.done.push(mission.id);
    const payout = MONEY.missionPayout[missions.activeIndex] || 1000;
    missions.activeIndex = -1;
    missions.started = false;
    missions.message = `Job done — ${mission.name} complete. +$${payout}`;
    missions.messageTimer = 6;
    return { complete: true, payout, mission };
  }
  const step = mission.steps[missions.stepIndex];
  missions.timer = step.seconds || 0;
  missions.rivalsLeft = step.count || 0;
  missions.message = step.label;
  missions.messageTimer = 5;
  return { complete: false, step };
}

export function failMission(missions, reason) {
  const mission = currentMission(missions);
  missions.activeIndex = -1;
  missions.started = false;
  missions.failed = true;
  missions.message = `Job failed — ${reason}. Talk to your contact to try again.`;
  missions.messageTimer = 6;
  return mission;
}

export function stepMissions(missions, dt) {
  if (missions.messageTimer > 0) missions.messageTimer -= dt;
  if (missions.activeIndex < 0) return null;
  const step = currentStep(missions);
  if (step && step.seconds) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      failMission(missions, 'out of time');
      return { failed: true };
    }
  }
  return null;
}
