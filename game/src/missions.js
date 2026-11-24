// EMBERLINE missions — five story jobs with markers and payouts.
import * as THREE from '../vendor/three/three.module.min.js';
import { MISSIONS, ECONOMY } from './config.js';

// Named places in the city (x, z).
export const PLACES = {
  pier9: { x: 205, z: 40, label: 'Pier 9' },
  garage: { x: -23, z: -69, label: 'Crane Street garage' },
  fishMarket: { x: 69, z: 23, label: 'Fish market' },
  lighthouse: { x: 170, z: -166, label: 'Lighthouse' },
  ottosBar: { x: -69, z: 69, label: "Otto's bar" },
  impound: { x: -115, z: -23, label: 'Impound lot' },
  pierEnd: { x: 222, z: 40, label: 'End of Pier 9' },
  pierLight: { x: 218, z: 40, label: 'Pier light' },
};

export class MissionManager {
  constructor(scene, hud, game) {
    this.scene = scene;
    this.hud = hud;
    this.game = game;             // callbacks: onCrime, onReward
    this.index = 0;               // current mission
    this.step = 0;
    this.destroyed = 0;
    this.done = false;
    this.marker = null;
    this.beacon = null;
    this.markerTarget = null;
    this._makeBeacon();
  }

  _makeBeacon() {
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 30;
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb020, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.marker = ring;
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  get current() { return MISSIONS[this.index] ?? null; }
  get currentStep() { return this.current?.steps[this.step] ?? null; }

  start() {
    this.index = 0;
    this.step = 0;
    this.done = false;
    this._showStep();
  }

  // Where the current step points.
  stepTarget() {
    const m = this.current;
    if (!m) return null;
    const s = this.currentStep;
    if (!s) return null;
    switch (m.id) {
      case 'm1': return s.kind === 'steal' ? PLACES.pier9 : PLACES.garage;
      case 'm2': return s.kind === 'destroy' ? PLACES.fishMarket : null;
      case 'm3': return s.kind === 'goto' && this.step === 0 ? PLACES.lighthouse : PLACES.ottosBar;
      case 'm4': return s.kind === 'steal' ? PLACES.impound : null;
      case 'm5': return s.kind === 'drive' ? PLACES.pierEnd : PLACES.pierLight;
      default: return null;
    }
  }

  _showStep() {
    const m = this.current;
    if (!m) { this.done = true; this._hideMarker(); this.hud?.setObjective('All jobs done — Emberline is yours.'); return; }
    const s = this.currentStep;
    this.hud?.setMission(`${m.name} — ${m.giver}`, m.brief);
    this.hud?.setObjective(s.text);
    const t = this.stepTarget();
    if (t) {
      this.markerTarget = t;
      this.marker.position.set(t.x, 0.15, t.z);
      this.marker.visible = true;
      this.beacon.position.set(t.x, 30, t.z);
      this.beacon.visible = true;
    } else {
      this._hideMarker();
    }
  }

  _hideMarker() {
    this.marker.visible = false;
    this.beacon.visible = false;
    this.markerTarget = null;
  }

  advance() {
    const m = this.current;
    this.step += 1;
    if (this.step >= m.steps.length) {
      const reward = ECONOMY.missionRewards[this.index] ?? 500;
      this.game?.onReward(reward, m.name);
      this.index += 1;
      this.step = 0;
      this.destroyed = 0;
      if (this.index >= MISSIONS.length) {
        this.done = true;
        this._hideMarker();
        this.hud?.setObjective('All jobs done — Emberline is yours.');
        this.hud?.message('EMBERLINE complete. You own the harbour now.');
        return;
      }
    }
    this._showStep();
  }

  // Called every frame with the player's position/vehicle state.
  update(px, pz, inVehicle, vehicle) {
    if (this.done || !this.current) return;
    const s = this.currentStep;
    const t = this.stepTarget();
    if (s.kind === 'goto' && t) {
      if (Math.hypot(px - t.x, pz - t.z) < 4) this.advance();
    } else if (s.kind === 'drive' && t) {
      if (inVehicle && vehicle && Math.hypot(px - t.x, pz - t.z) < 6) this.advance();
    } else if (s.kind === 'evade') {
      const lvl = this.game?.wantedLevel() ?? 0;
      const need = this.current.id === 'm4' ? 1 : 0;
      if (lvl <= need) this.advance();
    }
  }

  // External events the game routes here.
  onSteal(vehicle) {
    if (this.done) return;
    const s = this.currentStep;
    if (s.kind !== 'steal') return;
    if (this.current.id === 'm1' && vehicle.label === 'coupe') this.advance();
    if (this.current.id === 'm4' && vehicle.label === 'bike') this.advance();
  }

  onDestroy(vehicle) {
    if (this.done) return;
    const s = this.currentStep;
    if (this.current.id === 'm2' && s.kind === 'destroy' && vehicle.label === 'rival') {
      this.destroyed += 1;
      if (this.destroyed >= (s.count ?? 2)) this.advance();
      else this.hud?.setObjective(`Destroy rival sedans — ${this.destroyed}/${s.count ?? 2} done`);
    }
  }

  updateBeacon(t) {
    if (this.beacon.visible) {
      this.beacon.material.opacity = 0.25 + Math.sin(t * 3) * 0.12;
      this.beacon.rotation.y = t * 0.5;
    }
  }
}
