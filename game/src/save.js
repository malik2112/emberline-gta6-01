// EMBERLINE save — localStorage persistence for cash, progress, position.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      v: 3,
      cash: state.cash,
      mission: state.mission,
      step: state.step,
      x: state.x,
      z: state.z,
      health: state.health,
      ammo: state.ammo,
      reserve: state.reserve,
      savedAt: Date.now(),
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
    if (!data || data.v !== 3) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
