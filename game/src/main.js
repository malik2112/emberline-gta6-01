// EMBERLINE — main.js (round 3 redo)
// The conductor: boots the renderer, owns the fixed-step game loop,
// translates keyboard/mouse into input, handles car entry, and runs the
// busted / wasted / story-complete flows. Every system lives in its own
// module; this file only calls them in the right order.
import * as THREE from 'three';
import {
  CITY, GAME_TITLE, GAME_SUBTITLE, STORY, CONTROLS, WANTED, CAR, HUB,
  MECHANIC, COMPLETE_TITLE, BUSTED_TEXT, WASTED_TEXT, RADIO_NAME, PALETTE,
} from './config.js';
import { buildCity, streetCenters, collideCircle } from './city.js';
import { SoundEngine } from './audio.js';
import { createPlayer, updatePlayerOnFoot, updateCamera, menuCamera } from './player.js';
import { spawnCar, updateTrafficCar, updatePlayerCar, randomCarColor, initVehicleFx, updateVehicleFx } from './vehicles.js';
import { spawnPed, updatePed, updateFallenPed, randomSidewalkPoint } from './pedestrians.js';
import { createCombat, fireWeapon, startReload, updateCombat, updateRivals, damagePlayer } from './combat.js';
import { createWanted, addHeat, updateWanted, updatePolice, clearWanted, checkSpeeding } from './wanted.js';
import { createMissions, updateMissions, updateHub, startMission, onPlayerEnterCar, placeHubBeacon } from './missions.js';
import { createHud, addFeedMessage, showHint, flashScreen, updateHud } from './hud.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { applyShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const query = new URLSearchParams(location.search);
const SHOT = query.get('shot');
const SELFTEST = query.get('selftest') === '1';
const STEP = 1 / 60;

function createGameState() {
  return {
    scene: null, camera: null, renderer: null,
    mode: 'menu', // menu | playing | paused | busted | wasted | complete
    time: 0,
    player: null, cars: [], peds: [], rivals: [],
    city: null, wanted: null, combat: null, missions: null, hud: null,
    sound: new SoundEngine(),
    input: { up: false, down: false, left: false, right: false, run: false, handbrake: false },
    shotInput: null,
    shotMode: false,
    mouseDX: 0, mouseDY: 0,
    dangerPos: null, dangerTimer: 0,
    kick: 0,
    stats: { missionsDone: 0, carsStolen: 0, shotsFired: 0, bestCash: 50 },
    rngSeed: 20261124,
  };
}

const G = createGameState();
window.__game = G;

// ---------- bridges the systems call back through ----------
G.hudMessage = (text, kind) => addFeedMessage(G.hud, text, kind);
G.hudHint = (text) => showHint(G.hud, text);
G.hudFlash = (kind) => flashScreen(G.hud, kind);
G.showBriefing = (def) => {
  const panel = document.getElementById('briefing');
  document.getElementById('brief-title').textContent = `MISSION ${def.id}: ${def.title} — $${def.reward}`;
  document.getElementById('brief-text').textContent = def.brief;
  panel.classList.add('show');
  clearTimeout(panel._t);
  panel._t = setTimeout(() => panel.classList.remove('show'), 14000);
};
G.saveGame = () => { if (saveGame(G)) G.hudMessage('Progress saved.', 'good'); };

// ---------- end-of-run flows ----------
function showEndScreen(title, text, buttonText) {
  const overlay = document.getElementById('endscreen');
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  const button = document.getElementById('end-button');
  button.textContent = buttonText;
  overlay.style.display = 'flex';
  button.onclick = () => {
    overlay.style.display = 'none';
    respawnAtYard();
  };
}

function respawnAtYard() {
  const player = G.player;
  player.hp = 100;
  player.bustMeter = 0;
  player.stamina = 100;
  player.sprintLocked = false;
  G.kick = 0;
  if (player.car) G.exitCar(true);
  player.pos.set(HUB.x + 6, 0, HUB.z - 18);
  player.yaw = Math.PI * 0.75;
  player.mesh.position.copy(player.pos);
  player.mesh.visible = true;
  G.mode = 'playing';
  G.missions.state = G.missions.index >= 5 ? 'done' : 'waiting-hub';
  G.saveGame();
}

G.busted = () => {
  if (G.mode !== 'playing') return;
  G.mode = 'busted';
  G.sound.busted();
  G.sound.sirenStop();
  G.player.cash = Math.max(0, G.player.cash - 100);
  clearWanted(G);
  document.exitPointerLock?.();
  showEndScreen('BUSTED', BUSTED_TEXT, 'Walk free');
};

G.wasted = () => {
  if (G.mode !== 'playing') return;
  G.mode = 'wasted';
  G.sound.busted();
  G.player.cash = Math.max(0, G.player.cash - 100);
  clearWanted(G);
  document.exitPointerLock?.();
  showEndScreen('WASTED', WASTED_TEXT, 'Leave the hospital');
};

G.storyComplete = () => {
  G.mode = 'complete';
  G.sound.chime();
  document.exitPointerLock?.();
  showEndScreen(
    COMPLETE_TITLE,
    STORY.outro + ` — Missions done: ${G.stats.missionsDone}, cars stolen: ${G.stats.carsStolen}.`,
    'Keep playing (free roam)',
  );
};

// ---------- entering, stealing and leaving cars ----------
G.enterCar = (car, silent = false) => {
  const player = G.player;
  if (car.kind === 'police') { G.hudHint('Too hot — leave the cruiser alone.'); return false; }
  const wasOwned = !!car.owned;
  player.car = car;
  player.onFoot = false;
  player.mesh.visible = false;
  car.kind = 'player';
  car.parked = false;
  if (!silent) {
    G.sound.door();
    G.sound.engineStart();
  }
  if (!wasOwned) {
    G.stats.carsStolen++;
    addHeat(G, WANTED.heatStealCar, 'Grand theft auto');
    onPlayerEnterCar(G);
  }
  if (MECHANIC.type === 'nitro') G.hudHint('Hold SHIFT for NITRO boost.');
  return true;
};

G.tryEnterCar = () => {
  const player = G.player;
  if (!player.onFoot) { G.exitCar(); return; }
  let nearest = null;
  let nearestDist = 4.5;
  for (const car of G.cars) {
    if (!car.alive || car.kind === 'police' || car.kind === 'player') continue;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < nearestDist) { nearestDist = d; nearest = car; }
  }
  if (nearest) G.enterCar(nearest);
  else G.hudHint('No car close enough — walk up to one and press E.');
};

G.exitCar = (silent = false) => {
  const player = G.player;
  if (!player.car) return;
  const car = player.car;
  player.car = null;
  player.onFoot = true;
  player.pos.set(car.pos.x - Math.sin(car.yaw) * 2.5, 0, car.pos.z - Math.cos(car.yaw) * 2.5);
  collideCircle(player.pos, 0.6, G.city.colliders);
  player.mesh.visible = true;
  player.mesh.position.copy(player.pos);
  player.yaw = car.yaw;
  car.kind = 'traffic';
  car.target = null;
  car.speed = 0;
  if (!silent) G.sound.door();
  G.sound.engineStop();
};

// ---------- starting a run ----------
G.startGame = (fresh) => {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('endscreen').style.display = 'none';
  if (fresh) {
    G.player.cash = 50;
    G.player.hp = 100;
    G.player.stamina = 100;
    G.player.sprintLocked = false;
    G.kick = 0;
    G.stats = { missionsDone: 0, carsStolen: 0, shotsFired: 0, bestCash: 50 };
    G.missions.index = 0;
    G.missions.state = 'waiting-hub';
    G.player.pos.set(HUB.x + 6, 0, HUB.z - 6);
    G.player.mesh.position.copy(G.player.pos);
  }
  G.mode = 'playing';
  if (G.missions.state === 'waiting-hub') placeHubBeacon(G);
  G.hudMessage(`${GAME_TITLE} — ${STORY.fixer} is waiting at the chop-shop.`, 'mission');
  if (G.sound.init()) {
    G.sound.musicStart();
    G.sound.engineStop();
  }
};

// ---------- shooting ----------
function shootableTargets() {
  return G.peds.filter((ped) => ped.alive);
}

function handleShotHit(target) {
  if (target.kind === 'walker') {
    addHeat(G, target.alive ? WANTED.heatShoot : WANTED.heatHitPed, target.alive ? 'Shots fired' : 'Pedestrian down');
    if (!target.alive) G.hudMessage('A pedestrian is down. The PD will remember that.', 'bad');
  } else if (target.kind === 'rival' && !target.alive) {
    G.player.cash += 75;
    G.hudMessage('Rival down (+$75).', 'good');
  }
}

function togglePause(on) {
  if (on && G.mode === 'playing') {
    G.mode = 'paused';
    document.getElementById('pausemenu').style.display = 'flex';
    document.exitPointerLock?.();
  } else if (!on && G.mode === 'paused') {
    G.mode = 'playing';
    document.getElementById('pausemenu').style.display = 'none';
  }
}

// Cars at speed flatten walkers; the player's car earns heat for it.
function checkCarPedestrianHits() {
  for (const car of G.cars) {
    if (!car.alive || (car.kind !== 'player' && car.kind !== 'police')) continue;
    if (Math.abs(car.speed) <= 3) continue;
    for (const ped of G.peds) {
      if (!ped.alive || ped.kind !== 'walker') continue;
      if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) >= 1.8) continue;
      ped.alive = false;
      ped.hp = 0;
      G.sound.thud();
      G.dangerPos = ped.pos.clone();
      G.dangerTimer = 2;
      if (car.kind === 'player') addHeat(G, WANTED.heatHitPed, 'Hit and run');
    }
  }
}

function updateAmbient(dt) {
  for (const car of G.cars) {
    if (car.kind === 'traffic' && !car.parked && car.alive) {
      updateTrafficCar(car, G.city.nodes, Math.random, dt, G.cars, G.city.colliders);
    }
  }
  for (const ped of G.peds) {
    if (ped.alive) {
      if (ped.kind !== 'rival') updatePed(ped, G.city.centers, Math.random, dt, G._danger || null, G.city.colliders, G.cars);
    } else {
      updateFallenPed(ped, dt);
    }
  }
}

// One simulation step. The render loop below feeds it fixed slices so
// physics feel identical at any display refresh rate.
function simulate(dt) {
  const input = G.shotInput || G.input;

  if (G.player.onFoot) {
    updatePlayerOnFoot(G.player, input, dt, G.city.colliders);
    // Footstep ticks, one per ~2.2m walked.
    if (G.player.stepAccum > 2.2) {
      G.player.stepAccum = 0;
      if (G.sound.ready && G.player.speed > 1) G.sound.step();
    }
  } else if (G.player.car) {
    updatePlayerCar(G.player.car, input, dt, G.city.colliders, G.cars, (force) => {
      G.sound.crash();
      if (force > 20) damagePlayer(G, Math.floor(force / 8));
    });
    G.sound.engineSet(Math.abs(G.player.car.speed) / CAR.maxSpeed, true);
  }

  updateAmbient(dt);
  updateVehicleFx(G, dt);
  updatePolice(G, dt);
  updateWanted(G, dt);
  checkSpeeding(G, dt);
  updateMissions(G, dt);
  updateHub(G);
  updateCombat(G, dt);
  updateRivals(G, dt);
  checkCarPedestrianHits();

  if (G.dangerTimer > 0) G.dangerTimer -= dt;
  G._danger = G.dangerTimer > 0 ? G.dangerPos : null;

  // Track the best cash ever held for the save record.
  if (G.player.cash > G.stats.bestCash) G.stats.bestCash = G.player.cash;

  // Slow health regen, only while nobody is looking for you.
  if (G.wanted.level === 0 && G.player.hp > 0 && G.player.hp < 100) {
    G.player.hp = Math.min(100, G.player.hp + dt * 2);
  }
}

let lastTimestamp = 0;
let accumulator = 0;

function tick(timestamp) {
  const frameDt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || STEP);
  lastTimestamp = timestamp;
  G.time += frameDt;
  const mouseDX = G.mouseDX;
  const mouseDY = G.mouseDY;
  G.mouseDX = 0;
  G.mouseDY = 0;

  if (G.mode === 'menu') {
    menuCamera(G.camera, G.time);
    updateAmbient(frameDt);
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (G.mode !== 'playing') {
    G.renderer.render(G.scene, G.camera);
    return;
  }

  accumulator += frameDt;
  let steps = 0;
  while (accumulator >= STEP && steps < 4) {
    simulate(STEP);
    accumulator -= STEP;
    steps++;
  }
  if (steps === 4) accumulator = 0; // drop backlog instead of spiralling

  // Camera kick from the last shot decays fast.
  const kick = G.kick;
  G.kick = Math.max(0, G.kick - frameDt * 0.25);
  updateCamera(G.camera, G.player, frameDt, mouseDX, mouseDY, kick);
  updateHud(G, frameDt);
  G.renderer.render(G.scene, G.camera);
}

// ---------- menu + input wiring ----------
function wireMenu() {
  document.getElementById('btn-start').onclick = () => G.startGame(true);
  const continueButton = document.getElementById('btn-continue');
  if (hasSave()) {
    continueButton.style.display = 'inline-block';
    continueButton.onclick = () => {
      applySave(G, loadSave());
      G.startGame(false);
      G.hudMessage('Welcome back, Kade Venn. Mara Kessler is still waiting at the chop-shop.', 'mission');
    };
  }
  document.getElementById('btn-save').onclick = () => { G.saveGame(); togglePause(false); };
  document.getElementById('btn-resume').onclick = () => togglePause(false);
  document.getElementById('btn-restart').onclick = () => {
    document.getElementById('pausemenu').style.display = 'none';
    G.startGame(true);
  };
  document.getElementById('btn-quit').onclick = () => {
    togglePause(false);
    G.mode = 'menu';
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
  };

  // Menu copy.
  document.getElementById('menu-title').textContent = GAME_TITLE;
  document.getElementById('menu-sub').textContent = GAME_SUBTITLE;
  document.getElementById('menu-story').textContent = STORY.intro;
  const controlsBox = document.getElementById('controls');
  for (const [key, desc] of CONTROLS) {
    const row = document.createElement('div');
    row.innerHTML = `<b>${key}</b><span>${desc}</span>`;
    controlsBox.appendChild(row);
  }
}

function wireInput() {
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'handbrake',
  };
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.preventDefault();
    const mapped = keyMap[event.code];
    if (mapped) G.input[mapped] = true;
    if (event.repeat) return;
    if (event.code === 'KeyE' && G.mode === 'playing') G.tryEnterCar();
    if (event.code === 'KeyF' && G.mode === 'playing' && !G.player.onFoot && G.sound.init()) {
      G.sound.horn();
      // A horn blast startles nearby walkers into a brief scatter.
      G.dangerPos = G.player.pos.clone();
      G.dangerTimer = Math.max(G.dangerTimer, 0.8);
    }
    if (event.code === 'KeyR' && G.mode === 'playing') startReload(G);
    if (event.code === 'KeyM') document.getElementById('briefing').classList.toggle('show');
    if (event.code === 'KeyH' && G.sound.init()) {
      const on = G.sound.toggleMusic();
      G.hudMessage(on ? 'Radio on — ' + RADIO_NAME + '.' : 'Radio off.', 'info');
    }
    if (event.code === 'KeyP' && (G.mode === 'playing' || G.mode === 'paused')) togglePause(G.mode === 'playing');
    if (event.code === 'Escape' && G.mode === 'playing') togglePause(true);
  });
  window.addEventListener('keyup', (event) => {
    const mapped = keyMap[event.code];
    if (mapped) G.input[mapped] = false;
  });

  const canvas = G.renderer.domElement;
  canvas.addEventListener('click', () => {
    if (G.mode !== 'playing' || G.shotMode || SELFTEST) return;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    } else if (G.player.onFoot) {
      const shot = fireWeapon(G, shootableTargets());
      if (shot) {
        G.stats.shotsFired++;
        G.dangerPos = shot.end.clone();
        G.dangerTimer = 2;
        if (shot.hit) handleShotHit(shot.hit);
      }
    }
  });
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas) {
      G.mouseDX += event.movementX;
      G.mouseDY += event.movementY;
    }
  });
  window.addEventListener('resize', () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ---------- boot ----------
function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, CITY.fogNear, CITY.fogFar);
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(-160, 40, 220);
  G.scene = scene;
  G.camera = camera;
  G.renderer = renderer;

  const sun = new THREE.DirectionalLight(PALETTE.sun, CITY.sunIntensity);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  G.city = buildCity(scene);
  G.player = createPlayer(scene);
  G.wanted = createWanted();
  G.combat = createCombat();
  G.missions = createMissions();
  G.hud = createHud();
  initVehicleFx(scene);

  // Ambient traffic cruising the road graph.
  for (let i = 0; i < 12; i++) {
    const node = G.city.nodes[Math.floor(Math.random() * G.city.nodes.length)];
    const car = spawnCar(scene, node.x, node.z, Math.random() * Math.PI * 2, randomCarColor(Math.random), 'traffic');
    car.target = G.city.nodes[Math.floor(Math.random() * G.city.nodes.length)];
    G.cars.push(car);
  }
  // Mara's own car by the yard — taking it costs no heat.
  const yardCar = spawnCar(scene, -168, 176, Math.PI * 0.5, 0xc23b2e, 'traffic');
  yardCar.owned = true;
  yardCar.parked = true;
  G.cars.push(yardCar);
  for (const [x, z, yaw] of [[40, 76, 0], [-100, -64, 3.14159], [140, 16, 1.5708], [-30, 150, 0]]) {
    const parked = spawnCar(scene, x, z, yaw, randomCarColor(Math.random), 'traffic');
    parked.parked = true;
    G.cars.push(parked);
  }
  for (let i = 0; i < 16; i++) {
    const pt = randomSidewalkPoint(streetCenters(), Math.random);
    G.peds.push(spawnPed(scene, pt.x, pt.z, Math.random));
  }

  wireMenu();
  wireInput();

  if (SHOT) applyShot(G, SHOT);
  if (SELFTEST) setTimeout(() => runSelfTest(G), 1500);
  renderer.setAnimationLoop(tick);
}

boot();
