// EMBERLINE pedestrians — sidewalk walkers who flee gunfire.
import * as THREE from '../vendor/three/three.module.min.js';

const SHIRTS = [0x3aa655, 0xd8c22e, 0x7c5cff, 0xd8d8d8, 0x2e6fd8, 0xd8542e];
const PANTS = [0x2c3e63, 0x333333, 0x5e3a2e];

export class Pedestrian {
  constructor(scene, x, z, rand) {
    this.group = new THREE.Group();
    this.alive = true;
    this.fleeing = false;
    this.speed = 1.1 + rand() * 1.2;
    this.heading = rand() * Math.PI * 2;
    this.turnAt = 0;
    this.fallT = 0;

    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rand() * SHIRTS.length)] });
    const pants = new THREE.MeshLambertMaterial({ color: PANTS[Math.floor(rand() * PANTS.length)] });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6b });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt);
    torso.position.y = 1.0;
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.55;
    this.group.add(head);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), pants);
    this.legL.position.set(-0.14, 0.3, 0);
    this.group.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.14;
    this.group.add(this.legR);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = this.heading;
    scene.add(this.group);
  }
  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  scare(fromX, fromZ) {
    this.fleeing = true;
    const dx = this.x - fromX;
    const dz = this.z - fromZ;
    this.heading = Math.atan2(dx, dz);
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.fallT = 0.001;
    this.group.rotation.x = -Math.PI / 2;   // fall flat
    this.group.position.y = 0.3;
  }

  update(dt, t, bounds) {
    if (!this.alive) return;
    const spd = this.fleeing ? this.speed * 2.6 : this.speed;
    if (t > this.turnAt) {
      this.turnAt = t + 2 + Math.random() * 4;
      if (!this.fleeing) this.heading += (Math.random() - 0.5) * 1.6;
    }
    let nx = this.x + Math.sin(this.heading) * spd * dt;
    let nz = this.z + Math.cos(this.heading) * spd * dt;
    if (Math.abs(nx) > bounds || Math.abs(nz) > bounds) {
      this.heading += Math.PI;
      nx = this.x;
      nz = this.z;
    }
    this.group.position.x = nx;
    this.group.position.z = nz;
    this.group.rotation.y = this.heading;
    const swing = Math.sin(t * 9) * 0.5;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }
}

export class PedestrianManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  populate(count, rand, spots) {
    for (let i = 0; i < count; i++) {
      const s = spots[i % spots.length];
      const p = new Pedestrian(this.scene, s.x + (rand() - 0.5) * 6, s.z + (rand() - 0.5) * 6, rand);
      this.list.push(p);
    }
  }

  scareAll(fromX, fromZ, radius) {
    for (const p of this.list) {
      if (p.alive && Math.hypot(p.x - fromX, p.z - fromZ) < radius) p.scare(fromX, fromZ);
    }
  }

  update(dt, t) {
    for (const p of this.list) p.update(dt, t, 185);
  }

  nearestAlive(x, z, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const p of this.list) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
