// EMBERLINE — shots.js (round 3 re-author)
// Screenshot staging: ?shot=<name> puts the real game into a real,
// playable state — menu, busy street, police chase, crate run — with the
// same traffic, police, missions and HUD a player gets. Nothing is fake
// scenery; the staging only arranges the live systems for the camera.
import { spawnCar, randomCarColor } from './vehicles.js';
import { spawnPed } from './pedestrians.js';
import { startMission } from './missions.js';
import { addHeat } from './wanted.js';
import { MISSIONS } from './missions.js';
import { GAME_TITLE } from './config.js';

function stagedRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function removeActors(G, predicate, listName) {
  for (const actor of [...G[listName]]) {
    if (!predicate(actor)) continue;
    actor.alive = false;
    G.scene.remove(actor.mesh);
    G[listName].splice(G[listName].indexOf(actor), 1);
  }
}

function clearAmbient(G) {
  removeActors(G, (car) => car.kind === 'traffic', 'cars');
  removeActors(G, (ped) => ped.kind === 'walker', 'peds');
}

function clearCruisers(G) {
  for (const cop of [...G.wanted.police]) {
    cop.alive = false;
    G.scene.remove(cop.mesh);
    const idx = G.cars.indexOf(cop);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  G.wanted.police.length = 0;
}

function populateAvenue(G, rng, cx, cz, carCount) {
  for (let i = 0; i < carCount; i++) {
    const lane = (rng() < 0.5 ? -1 : 1) * 4;
    const along = (rng() - 0.5) * 160;
    const heading = rng() < 0.5 ? 0 : Math.PI;
    const car = spawnCar(G.scene, cx + lane, cz + along, heading, randomCarColor(rng), 'traffic');
    car.target = { x: cx + lane, z: cz + along + (heading === 0 ? 200 : -200) };
    G.cars.push(car);
  }
  for (let i = 0; i < 8; i++) {
    G.peds.push(spawnPed(G.scene, cx + (rng() - 0.5) * 30, cz + (rng() - 0.5) * 60, rng));
  }
}

function keepCameraClear(G) {
  // The chase camera sits ~7m behind the player; push staged cars out of it.
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < 14) {
      car.pos.z += 30;
      car.mesh.position.copy(car.pos);
      if (car.target) car.target.z += 30;
    }
  }
}

export function applyShot(G, name) {
  const rng = stagedRng(20261124);
  G.shotMode = true;
  document.title = GAME_TITLE + ' — shot: ' + name;
  clearAmbient(G);
  document.getElementById('hud').style.display = name === 'start' ? 'none' : 'block';

  if (name === 'start') {
    G.mode = 'menu';
    return;
  }

  G.startGame(false);
  G.hud.el.hint.style.opacity = '0';

  if (name === 'street') {
    G.player.pos.set(-6, 0, -40);
    G.player.yaw = 0;
    G.player.mesh.position.copy(G.player.pos);
    populateAvenue(G, rng, 0, 0, 7);
    keepCameraClear(G);
    startMission(G, 0);
    G.player.cash = 50;
  } else if (name === 'drive') {
    const heroCar = spawnCar(G.scene, 0, -60, 0, 0xe8c23a, 'traffic');
    heroCar.parked = false;
    G.cars.push(heroCar);
    G.enterCar(heroCar, true);
    heroCar.speed = 24;
    G.shotInput = { up: true };
    G.missions.index = 2;
    startMission(G, 2);
    // Two formation cruisers flank the player so the chase stays in frame.
    clearCruisers(G);
    G.wanted.level = 3;
    G.wanted.quietTimer = 0;
    G.sound.sirenStart();
    G.wanted.sirenOn = true;
    for (const [dx, dz] of [[-5, 2], [5, 7]]) {
      const cop = spawnCar(G.scene, dx, -60 + dz, 0, 0x14181c, 'police');
      cop.shotFollow = { dx, dz };
      G.cars.push(cop);
      G.wanted.police.push(cop);
    }
    G.player.cash = 1250;
  } else if (name === 'mission') {
    const nextCrate = MISSIONS[3].packages[1];
    G.player.pos.set(nextCrate.x - 20, 0, nextCrate.z - 20);
    G.player.yaw = Math.PI * 0.25;
    G.player.mesh.position.copy(G.player.pos);
    populateAvenue(G, rng, nextCrate.x - 30, nextCrate.z - 30, 4);
    G.missions.index = 3;
    startMission(G, 3);
    G.missions.collected = 1;
    G.missions.packageIndex = 1;
    G.missions.beaconPos = { x: nextCrate.x, z: nextCrate.z };
    const collectedBeacon = G.missions.pkgMeshes[0];
    if (collectedBeacon) G.scene.remove(collectedBeacon);
    addHeat(G, 1, 'Speeding past a cruiser');
    const cop = spawnCar(G.scene, nextCrate.x - 40, nextCrate.z - 50, Math.PI * 0.5, 0x14181c, 'police');
    G.cars.push(cop);
    G.wanted.police.push(cop);
    G.player.cash = 820;
  }
}

export const SHOT_NAMES = ['start', 'street', 'drive', 'mission'];
