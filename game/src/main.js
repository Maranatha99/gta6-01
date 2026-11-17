// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, help, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_HELP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { loadGame, saveGame } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 30;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world.state.city);
const audio = createAudio();
const saved = loadGame();

/** UI state the renderer reads: menu, objective, messages, hints. */
const ui = {
  menuItems: [],
  menuIndex: 0,
  objective: '',
  objectivePos: null,
  timer: 0,
  message: '',
  hintAlpha: 1,
  overKind: 'wasted',
};

function refreshMenu() {
  ui.menuItems = [];
  if (loadGame()) ui.menuItems.push({ label: 'Continue', action: 'continue' });
  ui.menuItems.push({ label: 'New Game', action: 'new' });
  ui.menuItems.push({ label: 'How to Play', action: 'help' });
  ui.menuIndex = 0;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const shotUi = {
    ...ui,
    objective: world.missionLabel(),
    objectivePos: objectivePos(),
    timer: world.state.missions.timer,
    message: '',
    hintAlpha: 0,
    menuItems: [{ label: 'Continue', action: 'continue' }, { label: 'New Game', action: 'new' }, { label: 'How to Play', action: 'help' }],
    menuIndex: 0,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, shotUi);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function objectivePos() {
  const step = world.currentStep();
  if (!step || step.x === undefined) return null;
  return { x: step.x, y: step.y };
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let hintTimer = 0;
  let saveTimer = 0;
  let playTime = 0;
  refreshMenu();

  function announce(message) {
    status.textContent = message;
  }

  function aimAngle() {
    const mouse = input.mouse();
    const view = renderer.view;
    const ratio = window.devicePixelRatio || 1;
    void ratio;
    const wx = view.camX + mouse.x / view.scale;
    const wy = view.camY + mouse.y / view.scale;
    const p = world.state.player;
    return Math.atan2(wy - p.y, wx - p.x);
  }

  function syncUi() {
    const step = world.currentStep();
    ui.objective = step ? step.label : 'Free roam — press J for the next job';
    ui.objectivePos = objectivePos();
    ui.timer = world.state.missions.timer;
    const msg = world.state.missions;
    ui.message = msg.messageTimer > 0 ? msg.message : '';
  }

  function startNewGame() {
    world.reset();
    world.startMissionAt(0);
    screen = SCREEN_PLAY;
    hintTimer = 0;
    ui.hintAlpha = 1;
    audio.ensure();
    audio.resume();
    announce('New game. Mission 1: First Gear — get to Mara\u2019s Garage.');
  }

  function continueGame() {
    const data = loadGame();
    world.reset();
    if (data) world.state && applySaveToWorld(data);
    screen = SCREEN_PLAY;
    hintTimer = 0;
    ui.hintAlpha = 1;
    audio.ensure();
    audio.resume();
    announce('Welcome back to Solmar Bay.');
  }

  function applySaveToWorld(data) {
    world.state.money = data.money;
    world.state.missions.done = data.missionsDone || [];
    world.state.player.x = data.x;
    world.state.player.y = data.y;
    world.state.player.health = data.health;
    world.state.player.ammo = data.ammo;
    world.state.elapsed = data.time || 0;
    world.state.kills = data.kills || 0;
    world.state.carsStolen = data.carsStolen || 0;
  }

  function doMenuAction(action) {
    audio.ensure();
    audio.click();
    if (action === 'new') startNewGame();
    else if (action === 'continue') continueGame();
    else if (action === 'help') {
      screen = SCREEN_HELP;
      announce('How to play.');
    }
  }

  function endGame(kind) {
    ui.overKind = kind;
    screen = SCREEN_OVER;
    audio.setSiren(false);
    audio.setEngine(0, false);
    announce(kind === 'busted' ? 'Busted by the Solmar Bay PD.' : 'Flatlined. The city never sleeps.');
  }

  function respawn() {
    const p = world.state.player;
    p.x = 1000;
    p.y = 2600;
    p.health = 100;
    p.inCar = null;
    world.state.money = Math.max(0, world.state.money - 150);
    world.state.heat = 0;
    world.state.stars = 0;
    world.state.police.cars = [];
    world.state.police.cops = [];
    // The failed mission can be tried again.
    if (world.state.missions.activeIndex >= 0) {
      const idx = world.state.missions.activeIndex;
      world.state.missions.activeIndex = -1;
      world.startMissionAt(idx);
    }
    saveGame(world.state);
    screen = SCREEN_PLAY;
    announce('Back on your feet at the safehouse. $150 hospital bill.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) doMenuAction(ui.menuItems[ui.menuIndex].action);
      return;
    }
    if (screen === SCREEN_HELP) {
      if (actions & (ACTION_CONFIRM | ACTION_PAUSE)) screen = SCREEN_TITLE;
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) respawn();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      saveGame(world.state);
      announce('Paused. Game saved.');
      return;
    }
    if (actions & ACTION_INTERACT) {
      const result = world.tryInteract();
      if (result === 'steal') announce('Car stolen — the cops noticed.');
      else if (result === 'enter') audio.click();
    }
  }

  // Menu keyboard navigation and clicks.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE) {
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        ui.menuIndex = (ui.menuIndex + 1) % ui.menuItems.length;
        event.preventDefault();
      } else if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        ui.menuIndex = (ui.menuIndex - 1 + ui.menuItems.length) % ui.menuItems.length;
        event.preventDefault();
      }
    } else if (screen === SCREEN_PLAY && event.code === 'KeyJ') {
      if (world.state.missions.activeIndex < 0) {
        const mission = world.startNextMission();
        if (mission) announce(`New job: ${mission.name}.`);
        else announce('All jobs done — Solmar Bay is yours. Free roam.');
      }
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    audio.ensure();
    audio.resume();
    if (screen === SCREEN_TITLE) {
      const rect = canvas.getBoundingClientRect();
      const my = event.clientY - rect.top;
      const base = window.innerHeight * 0.46;
      for (let i = 0; i < ui.menuItems.length; i += 1) {
        if (Math.abs(my - (base + i * 46)) < 22) {
          ui.menuIndex = i;
          doMenuAction(ui.menuItems[i].action);
          return;
        }
      }
    }
  });

  function step() {
    const held = input.held;
    const inputState = {
      up: held.up, down: held.down, left: held.left, right: held.right,
      run: held.run, fire: held.fire, handbrake: held.handbrake,
    };
    const events = world.step(STEP, inputState, aimAngle());
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      saveGame(world.state);
    }
    if (events & EVENT_MISSION_FAIL) audio.missionFail();
    if (events & EVENT_WASTED) endGame('wasted');
    else if (events & EVENT_BUSTED) endGame('busted');
    // Engine + siren follow the driving and the heat.
    const car = world.state.player.inCar;
    audio.setEngine(car ? Math.min(1, Math.abs(car.speed) / 560) : 0, !!car);
    audio.setSiren(world.state.stars > 0);
    playTime += STEP;
    hintTimer += STEP;
    ui.hintAlpha = Math.max(0, 1 - hintTimer / 25);
    saveTimer += STEP;
    if (saveTimer > AUTOSAVE_SECONDS) {
      saveTimer = 0;
      saveGame(world.state);
    }
    syncUi();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else if (screen === SCREEN_TITLE) {
      // The title's backdrop city idles: advance the world harmlessly.
      while (accumulator >= STEP) {
        world.step(STEP, { up: false, down: false, left: false, right: false, run: false, fire: false, handbrake: false }, 0);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, ui);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(world.state);
      announce('Paused.');
    }
  });

  syncUi();
  announce('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
