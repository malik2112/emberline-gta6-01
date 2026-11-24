// EMBERLINE wanted — heat stars, pursuing officers, busted.
import * as THREE from '../vendor/three/three.module.min.js';
import { WANTED } from './config.js';

export class Wanted {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;
    this.stars = 0;          // float, displayed floored
    this.cops = [];          // {group, speed}
    this.busted = false;
    this.spawnT = 0;
    this.copMat = new THREE.MeshLambertMaterial({ color: 0x1d3f8a });
  }

  get level() { return Math.min(WANTED.maxStars, Math.floor(this.stars + 0.001)); }

  add(amount, reason) {
    this.stars = Math.min(WANTED.maxStars, this.stars + amount);
    this.hud?.message(`Wanted +${amount} — ${reason}`);
    this.hud?.setStars(this.level);
  }

  setStars(n) {
    this.stars = n;
    this.hud?.setStars(this.level);
  }

  spawnCop(x, z) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.32), this.copMat);
    torso.position.y = 1.05;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc98e6b }));
    head.position.y = 1.68;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0x101418 }));
    cap.position.y = 1.9;
    g.add(cap);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const cop = { group: g, speed: WANTED.copChaseSpeed };
    this.cops.push(cop);
    return cop;
  }

  clearCops() {
    for (const c of this.cops) this.scene.remove(c.group);
    this.cops = [];
  }

  update(dt, playerX, playerZ, player) {
    if (this.busted) return;
    // Heat melts when quiet.
    if (this.stars > 0) {
      this.stars = Math.max(0, this.stars - WANTED.decayPerSec * dt);
      const lvl = this.level;
      if (lvl !== this._shown) { this._shown = lvl; this.hud?.setStars(lvl); }
    }
    const want = this.level;
    // Keep roughly one cop per star, spawning at a distance.
    this.spawnT -= dt;
    if (this.cops.length < want && this.spawnT <= 0) {
      this.spawnT = 2.5;
      const a = Math.random() * Math.PI * 2;
      this.spawnCop(playerX + Math.sin(a) * 30, playerZ + Math.cos(a) * 30);
    }
    while (this.cops.length > want) {
      const c = this.cops.pop();
      this.scene.remove(c.group);
    }
    // Chase.
    for (const c of this.cops) {
      const dx = playerX - c.group.position.x;
      const dz = playerZ - c.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        c.group.position.x += (dx / d) * c.speed * dt;
        c.group.position.z += (dz / d) * c.speed * dt;
        c.group.rotation.y = Math.atan2(dx, dz);
      }
      if (d < WANTED.bustRadius && !player.dead) {
        this.busted = true;
        this.hud?.message('BUSTED — the harbour police got you.');
      }
    }
  }
}
