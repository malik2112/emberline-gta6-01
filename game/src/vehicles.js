// EMBERLINE — vehicles.js (round 3 redo)
// Everything with wheels: procedural car meshes (brake lights, reverse
// lights, police light bar), an arcade driving model where the engine
// pushes against drag and grip swings the velocity vector toward the
// nose (handbrake breaks that alignment into a slide), traffic that
// stays on the road graph, police cruisers that chase and ram, and
// exhaust/smoke puffs for boosted or battered cars.
import * as THREE from 'three';
import { CAR, PALETTE, CITY, MECHANIC } from './config.js';
import { collideCircle } from './city.js';

let nextCarId = 0;

function angleDiff(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function buildCarBody(color, isPolice = false) {
  const group = new THREE.Group();
  const paintMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4e0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paintMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 2.3), paintMat);
  roof.position.set(0, 1.4, -0.2);
  group.add(roof);
  // Front bumper + grille strip so the nose reads at distance.
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.3), new THREE.MeshLambertMaterial({ color: 0x22262c }));
  bumper.position.set(0, 0.32, 2.2);
  group.add(bumper);

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  const reverseMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const tailLights = [];
  const reverseLights = [];
  for (const sideX of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(sideX, 0.6, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat.clone());
    tail.position.set(sideX, 0.6, -2.21);
    group.add(tail);
    tailLights.push(tail);
    const rev = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.1), reverseMat.clone());
    rev.position.set(sideX * 0.55, 0.34, -2.21);
    rev.material.color.setHex(0x555555);
    group.add(rev);
    reverseLights.push(rev);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const redLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    redLamp.position.x = -0.4;
    const blueLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    blueLamp.position.x = 0.4;
    bar.add(redLamp);
    bar.add(blueLamp);
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    lightBar = { red: redLamp, blue: blueLamp };
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group, wheels, lightBar, tailLights, reverseLights, paintMat };
}

export function spawnCar(scene, x, z, yaw, color, kind = 'traffic') {
  const built = buildCarBody(color, kind === 'police');
  built.group.position.set(x, 0, z);
  built.group.rotation.y = yaw;
  scene.add(built.group);
  return {
    id: ++nextCarId,
    kind,
    mesh: built.group,
    wheels: built.wheels,
    lightBar: built.lightBar,
    tailLights: built.tailLights,
    reverseLights: built.reverseLights,
    paintMat: built.paintMat,
    paintColor: new THREE.Color(color),
    damage: 0, // 0 pristine .. 1 wrecked; darkens the paint as it grows
    pos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector2(0, 0), // travel velocity (x,z); facing is yaw
    yaw,
    speed: 0,
    boost: 100,
    boosting: false,
    steer: 0,
    target: null,
    waitTimer: 0,
    stuckTimer: 0,
    lastPos: new THREE.Vector3(x, 0, z),
    alive: true,
    flashT: Math.random() * 10,
    braking: false,
    reversing: false,
    smokeTimer: 0,
  };
}

function setBrakeGlow(car, braking) {
  if (car.braking === braking || !car.tailLights) return;
  car.braking = braking;
  for (const tail of car.tailLights) tail.material.color.setHex(braking ? 0xff5544 : 0xff2a22);
}

function setReverseGlow(car, reversing) {
  if (car.reversing === reversing || !car.reverseLights) return;
  car.reversing = reversing;
  for (const rev of car.reverseLights) rev.material.color.setHex(reversing ? 0xffffff : 0x555555);
}

function pickRoadTarget(car, nodes, rng) {
  // Next node must share the car's street: turns happen at intersections.
  const sameStreetX = nodes.filter((n) => Math.abs(n.x - car.pos.x) < 6 && Math.abs(n.z - car.pos.z) > 1);
  const sameStreetZ = nodes.filter((n) => Math.abs(n.z - car.pos.z) < 6 && Math.abs(n.x - car.pos.x) > 1);
  const pool = sameStreetX.length || sameStreetZ.length ? [...sameStreetX, ...sameStreetZ] : nodes;
  car.target = pool[Math.floor(rng() * pool.length)];
}

export function updateTrafficCar(car, nodes, rng, dt, allCars, colliders) {
  if (!car.target) pickRoadTarget(car, nodes, rng);
  const dx = car.target.x - car.pos.x;
  const dz = car.target.z - car.pos.z;
  if (Math.hypot(dx, dz) < 3) { pickRoadTarget(car, nodes, rng); return; }
  const desiredYaw = Math.atan2(dx, dz);
  car.yaw += clamp(angleDiff(desiredYaw - car.yaw), -1.6 * dt, 1.6 * dt);

  // Yield to anything stopped or slow directly ahead.
  let blocked = false;
  const fwdX = Math.sin(car.yaw);
  const fwdZ = Math.cos(car.yaw);
  for (const other of allCars) {
    if (other === car || !other.alive) continue;
    const ox = other.pos.x - car.pos.x;
    const oz = other.pos.z - car.pos.z;
    if (Math.hypot(ox, oz) < 9 && ox * fwdX + oz * fwdZ > 0) { blocked = true; break; }
  }
  const cruiseSpeed = blocked ? 0 : 10;
  setBrakeGlow(car, blocked);
  car.speed += (cruiseSpeed - car.speed) * Math.min(1, dt * 2);
  car.pos.x += fwdX * car.speed * dt;
  car.pos.z += fwdZ * car.speed * dt;
  car.vel.set(fwdX * car.speed, fwdZ * car.speed);
  collideCircle(car.pos, CAR.radius, colliders);
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  spinWheels(car, dt);
}

export function spinWheels(car, dt) {
  const spin = (car.speed * dt) / 0.36;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
}

// Player driving: the engine pushes against drag, so top speed emerges
// from the balance; grip rotates the velocity vector toward the nose.
// Handbrake drops grip so the car slides sideways.
export function updatePlayerCar(car, input, dt, colliders, allCars, onCrash) {
  const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const handbrake = !!input.handbrake;

  let topSpeed = CAR.maxSpeed;
  let engine = CAR.accel;
  car.boosting = false;
  if (MECHANIC.type === 'nitro' && input.run && car.boost > 0 && throttle > 0) {
    topSpeed *= MECHANIC.speedMultiplier;
    engine *= MECHANIC.accelMultiplier;
    car.boost = Math.max(0, car.boost - dt * MECHANIC.boostDrain);
    car.boosting = true;
  } else {
    car.boost = Math.min(100, car.boost + dt * MECHANIC.boostRefill);
  }
  setBrakeGlow(car, throttle < 0 || handbrake);
  setReverseGlow(car, car.speed < -0.5);

  // Steering authority grows with speed, then saturates.
  const speed01 = Math.min(1, Math.abs(car.speed) / topSpeed);
  const turnRate = handbrake ? CAR.handbrakeTurn : CAR.turnRate;
  const steerTarget = steerInput * turnRate * (0.35 + 0.65 * speed01) * (car.speed < -0.5 ? -1 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.yaw += car.steer * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.15);

  // Engine force minus quadratic-ish drag; braking is a hard decel.
  if (throttle > 0) {
    car.speed += engine * dt * (1 - (car.speed / topSpeed) * 0.75);
  } else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= engine * 0.6 * dt;
  } else {
    car.speed -= car.speed * Math.min(1, dt * (handbrake ? 2.2 : 0.7));
  }
  car.speed = clamp(car.speed, -CAR.reverseMax, topSpeed);
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;

  // Blend velocity toward the nose by grip; low grip = drift.
  const grip = handbrake ? CAR.driftGrip : CAR.grip;
  const noseX = Math.sin(car.yaw) * car.speed;
  const noseZ = Math.cos(car.yaw) * car.speed;
  const blend = Math.min(1, dt * grip);
  car.vel.x += (noseX - car.vel.x) * blend;
  car.vel.y += (noseZ - car.vel.y) * blend;
  car.pos.x += car.vel.x * dt;
  car.pos.z += car.vel.y * dt;

  const hitWall = collideCircle(car.pos, CAR.radius, colliders);
  if (hitWall) {
    const impact = Math.hypot(car.vel.x, car.vel.y);
    car.speed *= 0.35;
    car.vel.multiplyScalar(0.35);
    // Visible crash damage: hard hits scar the paint toward charcoal.
    if (impact > 8) {
      car.damage = Math.min(1, car.damage + impact / 120);
      const scarred = car.paintColor.clone().lerp(new THREE.Color(0x1a1a1a), car.damage * 0.7);
      car.paintMat.color.copy(scarred);
    }
    if (impact > 14 && onCrash) onCrash(impact);
  }
  for (const other of allCars) {
    if (other === car || !other.alive) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.4 && dist > 0.001) {
      const push = (3.4 - dist) / 2;
      car.pos.x += (dx / dist) * push;
      car.pos.z += (dz / dist) * push;
      other.pos.x -= (dx / dist) * push;
      other.pos.z -= (dz / dist) * push;
      if (other.kind === 'traffic') other.speed *= 0.6;
      if (Math.abs(car.speed) > 10 && onCrash) onCrash(Math.abs(car.speed) * 0.5);
      car.speed *= 0.92;
    }
  }
  car.pos.x = clamp(car.pos.x, -CITY.boundZ, CITY.boundX);
  car.pos.z = clamp(car.pos.z, -CITY.boundZ, CITY.boundZ);
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  spinWheels(car, dt);
}

export function updatePoliceCar(car, playerPos, dt, colliders, allCars, onRam) {
  const dx = playerPos.x - car.pos.x;
  const dz = playerPos.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const desiredYaw = Math.atan2(dx, dz);
  car.yaw += clamp(angleDiff(desiredYaw - car.yaw), -2.4 * dt, 2.4 * dt);
  const pursuitSpeed = dist > 4 ? Math.min(34, 16 + dist * 0.35) : 6;
  car.speed += (pursuitSpeed - car.speed) * Math.min(1, dt * 1.6);
  car.pos.x += Math.sin(car.yaw) * car.speed * dt;
  car.pos.z += Math.cos(car.yaw) * car.speed * dt;
  car.vel.set(Math.sin(car.yaw) * car.speed, Math.cos(car.yaw) * car.speed);
  collideCircle(car.pos, CAR.radius, colliders);
  if (dist < 3.6 && onRam) onRam(car);
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  spinWheels(car, dt);
  car.flashT += dt * 6;
  if (car.lightBar) {
    const redOn = Math.sin(car.flashT) > 0;
    car.lightBar.red.material.color.setHex(redOn ? 0xff2222 : 0x551111);
    car.lightBar.blue.material.color.setHex(redOn ? 0x111155 : 0x2244ff);
  }
}

// --- exhaust + damage smoke -------------------------------------------------
// A small shared pool of soft sprites; boosted cars puff blue-orange flame
// smoke, battered cars leak grey smoke from the hood.
let puffPool = null;

function makePuffTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function initVehicleFx(scene) {
  if (puffPool) return puffPool;
  const tex = makePuffTexture();
  puffPool = [];
  for (let i = 0; i < 24; i++) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(1);
    sprite.visible = false;
    scene.add(sprite);
    puffPool.push({ sprite, life: 0, maxLife: 1, grow: 1 });
  }
  return puffPool;
}

function emitPuff(scene, x, y, z, color, size, life) {
  if (!puffPool) initVehicleFx(scene);
  const puff = puffPool.find((p) => p.life <= 0);
  if (!puff) return;
  puff.sprite.position.set(x, y, z);
  puff.sprite.material.color.setHex(color);
  puff.sprite.material.opacity = 0.7;
  puff.sprite.scale.setScalar(size);
  puff.sprite.visible = true;
  puff.life = life;
  puff.maxLife = life;
  puff.grow = size * 2.2;
}

export function updateVehicleFx(G, dt) {
  if (!puffPool) return;
  for (const puff of puffPool) {
    if (puff.life <= 0) continue;
    puff.life -= dt;
    puff.sprite.position.y += dt * 1.6;
    const remain = Math.max(0, puff.life / puff.maxLife);
    puff.sprite.material.opacity = 0.7 * remain;
    puff.sprite.scale.setScalar(puff.grow * (1 - remain * 0.5) + 0.4);
    if (puff.life <= 0) puff.sprite.visible = false;
  }
  const car = G.player.car;
  if (!car || !car.alive) return;
  // Nitro exhaust: small flame puffs from the tailpipes while boosting.
  if (car.boosting) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.09;
      const bx = car.pos.x - Math.sin(car.yaw) * 2.3;
      const bz = car.pos.z - Math.cos(car.yaw) * 2.3;
      emitPuff(G.scene, bx, 0.6, bz, 0xff8a3a, 0.7, 0.4);
    }
  }
  // Battered engine: grey smoke from the hood.
  if (car.damage >= CAR.smokeDamage) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.22;
      const hx = car.pos.x + Math.sin(car.yaw) * 1.6;
      const hz = car.pos.z + Math.cos(car.yaw) * 1.6;
      emitPuff(G.scene, hx, 1.1, hz, 0x888888, 1.1, 0.9);
    }
  }
}

export function randomCarColor(rng) {
  return PALETTE.carPaint[Math.floor(rng() * PALETTE.carPaint.length)];
}
