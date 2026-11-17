// Keyboard + mouse input for desktop play. Held keys are read every frame; one-shot
// presses (interact, pause, confirm, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MUTE = 8;
export const ACTION_HANDBRAKE = 16;

const MOVE = {
  up: new Set(['KeyW', 'ArrowUp']),
  down: new Set(['KeyS', 'ArrowDown']),
  left: new Set(['KeyA', 'ArrowLeft']),
  right: new Set(['KeyD', 'ArrowRight']),
};

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, run: false, fire: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;

  function keyState(code, value) {
    if (MOVE.up.has(code)) held.up = value;
    else if (MOVE.down.has(code)) held.down = value;
    else if (MOVE.left.has(code)) held.left = value;
    else if (MOVE.right.has(code)) held.right = value;
    else if (code === 'ShiftLeft' || code === 'ShiftRight') held.run = value;
    else if (code === 'Space') {
      if (value && !held.handbrake) actions |= ACTION_HANDBRAKE;
      held.handbrake = value;
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' || event.code === 'Space') {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'Escape' || event.code === 'KeyP') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
    keyState(event.code, true);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keyState(event.code, false));
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = held.fire = held.handbrake = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    if (event.button === 0) held.fire = true;
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) held.fire = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held,
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
