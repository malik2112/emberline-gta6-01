// EMBERLINE vehicles — stealable cars + a bike and a van, arcade driving.
import * as THREE from '../vendor/three/three.module.min.js';
import { VEHICLE } from './config.js';
import { resolveCollisions } from './city.js';

const PAINTS = [0xd8542e, 0x2e6fd8, 0xd8c22e, 0x3aa655, 0x8a2f5e, 0xd8d8d8, 0x222226, 0x7c5cff];

function buildCarMesh(color, kind) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x101418 });
  const bodyH = kind === 'van' ? 1.5 : 0.62;
  const bodyL = kind === 'bike' ? 1.6 : kind === 'van' ? 5.2 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, bodyH, bodyL), paint);
  body.position.y = kind === 'bike' ? 0.55 : 0.72;
  g.add(body);
  if (kind !== 'bike') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, kind === 'van' ? 1.6 : 2.1), glass);
    cabin.position.set(0, bodyH + 0.35, kind === 'van' ? 1.2 : -0.2);
    g.add(cabin);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  const spots = kind === 'bike'
    ? [[0, 0.75], [0, -0.75]]
    : [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]];
  for (const [wx, wz] of spots) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  // Headlights.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), lampMat);
    lamp.position.set(sx, 0.75, bodyL / 2 + 0.02);
    g.add(lamp);
  }
  return { group: g, wheels, length: bodyL };
}

export class Vehicle {
  constructor(scene, x, z, heading, color, kind = 'car', label = 'car') {
    this.kind = kind;
    this.label = label;
    this.color = color;
    this.speed = 0;
    this.heading = heading;
    this.health = 100;
    this.driver = null;      // 'player' | 'cop' | null
    this.burning = false;
    const built = buildCarMesh(color, kind);
    this.group = built.group;
    this.wheels = built.wheels;
    this.length = built.length;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }
  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  update(dt, input, colliders) {
    if (this.driver !== 'player') return;
    const accel = input.f ? VEHICLE.accel : input.b ? -VEHICLE.brake : 0;
    this.speed += accel * dt;
    if (!input.f && !input.b) this.speed *= Math.max(0, 1 - dt * 1.4);
    const max = this.speed >= 0 ? VEHICLE.maxSpeed : VEHICLE.reverseMax;
    this.speed = Math.max(-VEHICLE.reverseMax, Math.min(max, this.speed));
    const steer = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += steer * VEHICLE.steer * dt * Math.min(1, Math.abs(this.speed) / 8) * dir;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let nx = this.x + fx * this.speed * dt;
    let nz = this.z + fz * this.speed * dt;
    const fixed = resolveCollisions(nx, nz, 1.6, colliders);
    if (fixed.x !== nx || fixed.z !== nz) this.speed *= 0.4;
    nx = Math.max(-188, Math.min(235, fixed.x));
    nz = Math.max(-188, Math.min(188, fixed.z));
    this.group.position.x = nx;
    this.group.position.z = nz;
    this.group.rotation.y = this.heading;
    const spin = this.speed * dt * 2.6;
    for (const w of this.wheels) w.rotation.x += spin;
  }
}

export class VehicleManager {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.list = [];
  }

  spawn(x, z, heading, color, kind = 'car', label = 'car') {
    const v = new Vehicle(this.scene, x, z, heading, color, kind, label);
    this.list.push(v);
    return v;
  }

  // Parked traffic along the roads so the city feels alive and stealable.
  populate(seedSpots) {
    for (const s of seedSpots) this.spawn(s.x, s.z, s.h, s.c, s.k || 'car', s.l || 'car');
  }

  nearestTo(x, z, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const v of this.list) {
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  update(dt, input) {
    for (const v of this.list) v.update(dt, input, this.colliders);
  }
}

export { PAINTS };
