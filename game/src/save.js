// EMBERLINE — save.js (round 3 re-author)
// Progress lives in localStorage: cash, story position, lifetime stats.
// Version 2 records migrate version 1 saves forward instead of dropping
// them, and Continue always resumes on foot outside Kessler's Yard.
import { SAVE_KEY, HUB } from './config.js';

const LEGACY_KEY = 'emberline-save-v1';
const CURRENT_VERSION = 2;

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.version === CURRENT_VERSION) return data;
  if (data.version === 1) {
    return {
      version: CURRENT_VERSION,
      cash: data.cash ?? 50,
      missionIndex: data.missionIndex ?? 0,
      missionsDone: data.missionsDone ?? 0,
      carsStolen: data.carsStolen ?? 0,
      shotsFired: data.shotsFired ?? 0,
      playSeconds: data.playSeconds ?? 0,
      savedAt: data.savedAt ?? new Date().toISOString(),
    };
  }
  return null;
}

export function saveGame(G) {
  try {
    const record = {
      version: CURRENT_VERSION,
      cash: G.player.cash,
      missionIndex: G.missions.index,
      missionsDone: G.stats.missionsDone,
      carsStolen: G.stats.carsStolen,
      shotsFired: G.stats.shotsFired,
      playSeconds: Math.floor(G.time),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(record));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  const current = migrate(readRaw(SAVE_KEY));
  if (current) return current;
  const legacy = migrate(readRaw(LEGACY_KEY));
  if (legacy) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(legacy)); } catch (e) { /* read-only storage */ }
    return legacy;
  }
  return null;
}

export function applySave(G, data) {
  if (!data) return false;
  G.player.cash = data.cash ?? 50;
  G.stats.missionsDone = data.missionsDone ?? 0;
  G.stats.carsStolen = data.carsStolen ?? 0;
  G.stats.shotsFired = data.shotsFired ?? 0;
  G.missions.index = Math.min(data.missionIndex ?? 0, 4);
  G.missions.state = 'waiting-hub';
  G.player.pos.set(HUB.x + 6, 0, HUB.z - 18);
  G.player.mesh.position.copy(G.player.pos);
  return true;
}

export function hasSave() {
  try {
    return !!(localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEY));
  } catch (e) {
    return false;
  }
}
