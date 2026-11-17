// Save games in localStorage: money, completed missions, the player's spot, health and
// ammo. A save never blocks play — if storage is off, the game just runs unsaved.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      missionsDone: state.missions.done,
      x: state.player.x,
      y: state.player.y,
      health: state.player.health,
      ammo: state.player.ammo,
      time: state.elapsed,
      kills: state.kills,
      carsStolen: state.carsStolen,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
