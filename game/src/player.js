// EMBERLINE player — on-foot movement, mesh, health, enter/exit.
import * as THREE from '../vendor/three/three.module.min.js';
import { PLAYER } from './config.js';
import { resolveCollisions } from './city.js';

export class Player {
  constructor(scene, colliders) {
    this.colliders = colliders;
    this.group = new THREE.Group();
    this.health = PLAYER.health;
    this.money = 0;
    this.heading = 0;          // radians, facing
    this.speed = 0;
    this.inVehicle = null;
    this.dead = false;

    const jacket = new THREE.MeshLambertMaterial({ color: 0xd8542e });
    const denim = new THREE.MeshLambertMaterial({ color: 0x2c3e63 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6b });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1c1410 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), jacket);
    torso.position.y = 1.05;
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.72;
    this.group.add(head);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, 1.1), hair);
    cap.position.y = 1.78;
    this.group.add(cap);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), denim);
    this.legL.position.set(-0.16, 0.38, 0);
    this.group.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    this.group.add(this.legR);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), jacket);
    this.armR.position.set(0.42, 1.05, 0.1);
    this.group.add(this.armR);

    this.group.position.set(-20, 0, 30);
    scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }
  setPos(x, z, heading = this.heading) {
    this.group.position.x = x;
    this.group.position.z = z;
    this.heading = heading;
    this.group.rotation.y = heading;
  }

  // input: {f, b, l, r, run} in camera-relative space; camYaw is camera yaw.
  update(dt, input, camYaw) {
    if (this.dead || this.inVehicle) return;
    let mx = 0;
    let mz = 0;
    if (input.f) mz -= 1;
    if (input.b) mz += 1;
    if (input.l) mx -= 1;
    if (input.r) mx += 1;
    if (mx === 0 && mz === 0) {
      this.speed = 0;
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
      return;
    }
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    // Rotate local input by camera yaw into world space.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const wx = mx * cos - mz * sin;
    const wz = mx * sin + mz * cos;
    const target = Math.atan2(wx, wz);
    let dh = target - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += dh * Math.min(1, dt * 12);
    this.group.rotation.y = this.heading;

    const spd = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    this.speed = spd;
    let nx = this.x + wx * spd * dt;
    let nz = this.z + wz * spd * dt;
    const fixed = resolveCollisions(nx, nz, PLAYER.radius, this.colliders);
    nx = Math.max(-185, Math.min(185, fixed.x));
    nz = Math.max(-185, Math.min(185, fixed.z));
    this.group.position.x = nx;
    this.group.position.z = nz;

    // Walk-cycle swing.
    const t = performance.now() / 1000;
    const swing = Math.sin(t * (input.run ? 13 : 9)) * (input.run ? 0.7 : 0.45);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armR.rotation.x = -swing * 0.6;
  }

  damage(amount) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }

  heal(amount) {
    this.health = Math.min(PLAYER.health, this.health + amount);
  }
}
