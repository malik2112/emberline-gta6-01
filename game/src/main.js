// EMBERLINE — boot, game loop, camera, input and system wiring.
import * as THREE from '../vendor/three/three.module.min.js';
import { WORLD, ECONOMY, KEYS } from './config.js';
import { createCity } from './city.js';
import { Player } from './player.js';
import { VehicleManager, PAINTS } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { Combat } from './combat.js';
import { Wanted } from './wanted.js';
import { MissionManager, PLACES } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { runSelftest } from './selftest.js';
import { applyShot } from './shots.js';

class Game {
  constructor() {
    this.THREE = THREE;
    this.state = 'menu';       // menu | playing | paused | wasted | busted
    this.camMode = 'orbit';
    this.cash = ECONOMY.startCash;
    this.keys = {};
    this.mouseDown = false;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.orbitT = 0;
    this.saveT = 0;
    this.paused = false;
  }

  boot() {
    const canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(60, 30, 90);

    const city = createCity(this.scene);
    this.colliders = city.colliders;
    this.cityRand = city.rand;

    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.player = new Player(this.scene, this.colliders);
    this.player.money = this.cash;

    this.vehicles = new VehicleManager(this.scene, this.colliders);
    this._spawnTraffic();
    this.peds = new PedestrianManager(this.scene);
    this._spawnPeds();
    this.combat = new Combat(this.scene, this.audio);
    this.wanted = new Wanted(this.scene, this.hud);
    this.missions = new MissionManager(this.scene, this.hud, this);
    this.missions.start();

    this._bindInput();
    this._restoreSave();
    this.hud.setCash(this.cash);
    this.hud.setHealth(this.player.health);
    this.hud.setStars(0);
    this.hud.setAmmo(this.combat.ammo, this.combat.reserve);
    this.hud.showMenu('EMBERLINE', 'Open-world crime at sunset — steal, drive, survive the harbour.', '▶  START ENGINE');
    this.hud.menuBtn.addEventListener('click', () => this.startPlaying());

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const params = new URLSearchParams(window.location.search);
    this._shotStaged = applyShot(this);
    if (params.get('selftest') === '1') {
      this.state = 'playing';
      this.hud.hideMenu();
      this.camMode = 'third';
    }
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
    window.__emberlineReady = true;
    if (params.get('selftest') === '1') {
      window.setTimeout(() => runSelftest(this), 800);
    }
  }

  _spawnTraffic() {
    // Mission vehicles first (labels the missions look for).
    this.vehicles.spawn(PLACES.pier9.x, PLACES.pier9.z, 0.3, 0xd8542e, 'car', 'coupe');
    this.vehicles.spawn(PLACES.fishMarket.x + 4, PLACES.fishMarket.z + 2, 1.2, 0x8a2f5e, 'car', 'rival');
    this.vehicles.spawn(PLACES.fishMarket.x - 6, PLACES.fishMarket.z - 3, -0.6, 0x8a2f5e, 'car', 'rival');
    this.vehicles.spawn(PLACES.impound.x, PLACES.impound.z, 0, 0x2e6fd8, 'bike', 'bike');
    this.vehicles.spawn(-46, -90, Math.PI / 2, 0xd8d8d8, 'van', 'van');
    // Ambient parked cars on road edges.
    const spots = [];
    const rnd = this.cityRand;
    for (let i = 0; i < 14; i++) {
      const road = Math.floor(rnd() * 7) - 3;
      const along = (rnd() - 0.5) * 300;
      const vertical = rnd() < 0.5;
      spots.push({
        x: vertical ? road * WORLD.block + 8 : along,
        z: vertical ? along : road * WORLD.block + 8,
        h: vertical ? 0 : Math.PI / 2,
        c: PAINTS[Math.floor(rnd() * PAINTS.length)],
      });
    }
    this.vehicles.populate(spots);
  }

  _spawnPeds() {
    const rnd = this.cityRand;
    const spots = [];
    for (let i = 0; i < 12; i++) {
      spots.push({ x: (rnd() - 0.5) * 260, z: (rnd() - 0.5) * 260 });
    }
    this.peds.populate(18, rnd, spots);
  }

  _restoreSave() {
    const s = loadGame();
    if (!s) return;
    this.cash = s.cash;
    this.player.money = s.cash;
    this.player.health = s.health;
    this.player.setPos(s.x, s.z);
    this.combat.ammo = s.ammo;
    this.combat.reserve = s.reserve;
    this.missions.index = Math.min(s.mission, 4);
    this.missions.step = s.step;
    this.missions._showStep();
    this.hud.message('Save loaded — welcome back to Emberline.');
  }

  saveNow() {
    return saveGame({
      cash: this.cash,
      mission: this.missions.index,
      step: this.missions.step,
      x: this.player.x,
      z: this.player.z,
      health: this.player.health,
      ammo: this.combat.ammo,
      reserve: this.combat.reserve,
    });
  }

  onReward(amount, name) {
    this.cash += amount;
    this.player.money = this.cash;
    this.hud.setCash(this.cash);
    this.hud.banner(`JOB DONE: ${name} — +$${amount}`);
    this.audio.blip(990, 0.12);
    this.saveNow();
  }

  wantedLevel() { return this.wanted.level; }

  startPlaying() {
    this.audio.ensure();
    this.hud.hideMenu();
    this.state = 'playing';
    this.camMode = this.player.inVehicle ? 'chase' : 'third';
    this.hud.message('WASD move · E enter car · Click shoot · R reload · Q radio');
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (KEYS.enter.includes(e.code)) this.toggleVehicle();
      if (KEYS.reload.includes(e.code)) this.combat.reload();
      if (KEYS.radio.includes(e.code)) {
        const st = this.audio.radioToggle();
        if (st) this.hud.banner(`RADIO — ${st}`);
      }
      if (KEYS.pause.includes(e.code)) this.togglePause();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    const canvas = document.getElementById('game');
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      this.audio.ensure();
    });
    window.addEventListener('pointerup', () => { this.mouseDown = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (e.buttons === 2 || e.pointerType === 'touch') {
        this.camYaw -= e.movementX * 0.003;
        this.camPitch = Math.max(0.05, Math.min(1.1, this.camPitch + e.movementY * 0.002));
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Right-drag (or touch-drag) orbits the camera; left button is for shooting.
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showMenu('PAUSED', 'Emberline waits. The harbour never sleeps.', '▶  RESUME');
    } else if (this.state === 'paused') {
      this.startPlaying();
    }
  }

  toggleVehicle() {
    if (this.state !== 'playing') return;
    if (this.player.inVehicle) {
      const v = this.player.inVehicle;
      v.driver = null;
      this.player.inVehicle = null;
      this.player.group.visible = true;
      const sx = Math.cos(v.heading);
      const sz = -Math.sin(v.heading);
      this.player.setPos(v.x + sx * 2.4, v.z + sz * 2.4, v.heading);
      this.camMode = 'third';
      this.audio.engineStop();
      return;
    }
    const v = this.vehicles.nearestTo(this.player.x, this.player.z, 3.6);
    if (v) this.enterVehicle(v);
  }

  enterVehicle(v) {
    if (!v) return;
    if (v.driver === 'player') return;
    v.driver = 'player';
    this.player.inVehicle = v;
    this.player.group.visible = false;
    this.camMode = 'chase';
    this.wanted.add(1, 'grand theft auto');
    this.missions.onSteal(v);
    this.hud.message(`You took the ${v.label}. The harbour saw it.`);
  }

  _shootTargets() {
    const list = [];
    for (const p of this.peds.list) list.push({ kind: 'ped', ref: p, obj: p.group });
    for (const c of this.wanted.cops) list.push({ kind: 'cop', ref: c, obj: c.group });
    for (const v of this.vehicles.list) list.push({ kind: 'car', ref: v, obj: v.group });
    return list;
  }

  _fire() {
    if (this.player.inVehicle) return;   // no drive-by in this build
    const origin = new THREE.Vector3(this.player.x, 1.5, this.player.z);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const res = this.combat.fire(origin, dir, this._shootTargets());
    this.hud.setAmmo(this.combat.ammo, this.combat.reserve);
    if (res.dry) { this.hud.message('Click — empty. Press R to reload.'); return; }
    if (!res.hit) return;
    this.peds.scareAll(this.player.x, this.player.z, 25);
    if (res.hit === 'ped') {
      res.target.kill();
      this.wanted.add(1, 'assault');
    } else if (res.hit === 'cop') {
      this.wanted.add(2, 'officer down');
      this.scene.remove(res.target.group);
      this.wanted.cops = this.wanted.cops.filter((c) => c !== res.target);
    } else if (res.hit === 'car') {
      const v = res.target;
      v.health -= 34;
      if (v.health <= 0 && !v.burning) {
        v.burning = true;
        v.group.children[0].material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        this.missions.onDestroy(v);
        this.wanted.add(1, 'vehicle destroyed');
      }
    }
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    if (this.state === 'playing' && !this.paused) this.update(dt, t);
    this._updateCamera(dt, t);
    this.missions.updateBeacon(t);
    this.renderer.render(this.scene, this.camera);
  }

  update(dt, t) {
    const input = {
      f: KEYS.forward.some((k) => this.keys[k]),
      b: KEYS.back.some((k) => this.keys[k]),
      l: KEYS.left.some((k) => this.keys[k]),
      r: KEYS.right.some((k) => this.keys[k]),
      run: KEYS.run.some((k) => this.keys[k]),
    };
    const px = this.player.inVehicle ? this.player.inVehicle.x : this.player.x;
    const pz = this.player.inVehicle ? this.player.inVehicle.z : this.player.z;

    if (this.player.inVehicle) {
      this.player.inVehicle.update(dt, input, this.colliders);
      this.audio.engine(Math.abs(this.player.inVehicle.speed) / 34);
      // Hitting a pedestrian while driving is a crime too.
      const hit = this.peds.nearestAlive(px, pz, 2.2);
      if (hit && Math.abs(this.player.inVehicle.speed) > 4) {
        hit.kill();
        this.wanted.add(1, 'hit and run');
      }
    } else {
      this.player.update(dt, input, this.camYaw);
      this.audio.engineStop();
      if (this.mouseDown) this._fire();
    }
    this.vehicles.update(dt, input);
    this.peds.update(dt, t);
    this.combat.update(dt);
    this.wanted.update(dt, px, pz, this.player);
    this.missions.update(px, pz, !!this.player.inVehicle, this.player.inVehicle);
    this.audio.siren(this.wanted.level >= 2);

    // Death / busted handling.
    if (this.player.dead && this.state === 'playing') {
      this.state = 'wasted';
      this.hud.showMenu('WASTED', 'The harbour keeps what it takes. Your cash is gone.', '↻  START OVER');
      this.hud.menuBtn.onclick = () => { clearSave(); window.location.reload(); };
    }
    if (this.wanted.busted && this.state === 'playing') {
      this.state = 'busted';
      const fine = Math.min(this.cash, 100);
      this.cash -= fine;
      this.hud.showMenu('BUSTED', `The harbour police got you. Fine paid: $${fine}.`, '↻  WALK FREE');
      this.hud.menuBtn.onclick = () => {
        this.wanted.busted = false;
        this.wanted.clearCops();
        this.wanted.setStars(0);
        this.player.heal(100);
        this.player.setPos(-20, 30, 0);
        this.saveNow();
        this.startPlaying();
      };
    }

    // HUD refresh.
    this.hud.setHealth(this.player.health);
    this.hud.setAmmo(this.combat.ammo, this.combat.reserve);
    this.hud.drawMinimap(px, pz, this.player.inVehicle ? this.player.inVehicle.heading : this.player.heading, this.missions.markerTarget, this.wanted.cops, this.vehicles.list);

    this.saveT += dt;
    if (this.saveT > 20) { this.saveT = 0; this.saveNow(); }
  }

  // Instantly place the camera at its follow target (used by staged shots).
  snapCamera() {
    const focus = this.player.inVehicle ? this.player.inVehicle : this.player;
    const heading = this.player.inVehicle ? this.player.inVehicle.heading : this.player.heading + this.camYaw;
    const back = this.player.inVehicle ? 10 : 8;
    const height = this.player.inVehicle ? 4.2 : 3.4;
    this.camera.position.set(
      focus.x - Math.sin(heading) * back,
      height + Math.sin(this.camPitch) * 2,
      focus.z - Math.cos(heading) * back,
    );
    this.camera.lookAt(focus.x, 1.6, focus.z);
  }

  _updateCamera(dt, t) {
    const cam = this.camera;
    if (this.camMode === 'orbit') {
      this.orbitT += dt * 0.06;
      const a = this.orbitT;
      cam.position.set(Math.sin(a) * 130, 46, Math.cos(a) * 130);
      cam.lookAt(20, 4, 0);
      return;
    }
    const focus = this.player.inVehicle ? this.player.inVehicle : this.player;
    const heading = this.player.inVehicle ? this.player.inVehicle.heading : this.player.heading + this.camYaw;
    const back = this.player.inVehicle ? 10 : 8;
    const height = this.player.inVehicle ? 4.2 : 3.4;
    const tx = focus.x - Math.sin(heading) * back;
    const tz = focus.z - Math.cos(heading) * back;
    const ty = height + Math.sin(this.camPitch) * 2;
    cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 6);
    cam.position.y += (ty - cam.position.y) * Math.min(1, dt * 6);
    cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 6);
    cam.lookAt(focus.x, 1.6, focus.z);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.__emberline = game;
  try {
    game.boot();
  } catch (e) {
    console.error('EMBERLINE boot failed', e);
    document.getElementById('boot-error').textContent = `Boot failed: ${e.message}`;
  }
});
