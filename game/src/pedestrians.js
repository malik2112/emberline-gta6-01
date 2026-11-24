// EMBERLINE — pedestrians.js (round 3 redo)
// The people of Emberline: low-poly walkers who stroll between sidewalk
// corners, idle for a beat, glance at their phones, step aside for a car
// closing in — and sprint away from gunfire or a speeding car. One mesh
// builder serves peds, rivals and the player.
import * as THREE from 'three';
import { TRAFFIC } from './config.js';

const SHIRTS = [0xd95f4b, 0x4b8ad9, 0x53b06a, 0xd9b84b, 0x9a5fd0, 0xe8e8e8, 0x3a3f45, 0xe08aa8];
const SKINS = [0xc98e6a, 0x8a5a3a, 0xe8b89a, 0x6a4230];

function angleDiff(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function makePersonMesh(shirtColor, skinColor = 0xc98e6a) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2c3440 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8), shirtMat);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.72;
  group.add(head);
  // Cap brim so walkers read as dockworkers at a glance.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 10), shirtMat);
  cap.position.y = 1.9;
  group.add(cap);

  const legGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.62, 6);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.14, 0.31, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.14, 0.31, 0);
  group.add(legR);

  const armGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.44, 1.1, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.44, 1.1, 0);
  group.add(armR);

  return { group, legL, legR, armL, armR };
}

export function spawnPed(scene, x, z, rng, kind = 'walker') {
  const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
  const skin = SKINS[Math.floor(rng() * SKINS.length)];
  const built = makePersonMesh(shirt, skin);
  built.group.position.set(x, 0, z);
  scene.add(built.group);
  return {
    kind,
    mesh: built.group,
    legL: built.legL, legR: built.legR, armL: built.armL, armR: built.armR,
    pos: new THREE.Vector3(x, 0, z),
    yaw: rng() * Math.PI * 2,
    speed: 0,
    target: null,
    waitTimer: rng() * 3,
    walkPhase: rng() * 10,
    hp: 50,
    alive: true,
    fleeing: false,
    fleeTimer: 0,
    idleSway: rng() * Math.PI * 2,
    phoneTimer: 0,     // counts down while the walker checks a phone
    sidestepTimer: 0,  // counts down while stepping aside for a car
  };
}

// A sidewalk corner: an intersection nudged ~11m onto the pavement.
export function randomSidewalkPoint(centers, rng) {
  const cx = centers[Math.floor(rng() * centers.length)];
  const cz = centers[Math.floor(rng() * centers.length)];
  const offset = 11 + rng() * 2;
  return {
    x: cx + (rng() < 0.5 ? -1 : 1) * offset,
    z: cz + (rng() < 0.5 ? -1 : 1) * offset,
  };
}

// A car closing in from the front makes the walker step sideways.
export function sidestepForCar(ped, cars) {
  if (ped.sidestepTimer > 0) return;
  for (const car of cars) {
    if (!car.alive || Math.abs(car.speed) < 4) continue;
    const dx = car.pos.x - ped.pos.x;
    const dz = car.pos.z - ped.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > TRAFFIC.pedSidestepRange) continue;
    // Only if the car is actually heading at the walker.
    const approaching = (dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw)) / dist;
    if (approaching < 0.6) continue;
    const side = Math.random() < 0.5 ? -1 : 1;
    ped.target = {
      x: ped.pos.x + Math.cos(car.yaw) * side * 4,
      z: ped.pos.z - Math.sin(car.yaw) * side * 4,
    };
    ped.sidestepTimer = 1.2;
    ped.waitTimer = 0;
    return;
  }
}

export function updatePed(ped, centers, rng, dt, dangerPos, colliders, cars = []) {
  if (!ped.alive) return;

  // Danger nearby (shots, a speeding car) flips the walker into a sprint.
  if (dangerPos) {
    const distToDanger = Math.hypot(ped.pos.x - dangerPos.x, ped.pos.z - dangerPos.z);
    if (distToDanger < 18) {
      ped.fleeing = true;
      ped.fleeTimer = 3;
      // Run directly away from the threat.
      ped.target = {
        x: ped.pos.x + (ped.pos.x - dangerPos.x) * 2,
        z: ped.pos.z + (ped.pos.z - dangerPos.z) * 2,
      };
      ped.waitTimer = 0;
      ped.phoneTimer = 0;
    }
  }
  if (ped.fleeTimer > 0) {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.fleeing = false;
  }
  if (ped.sidestepTimer > 0) ped.sidestepTimer -= dt;
  if (!ped.fleeing) sidestepForCar(ped, cars);

  if (ped.phoneTimer > 0) {
    // Standing still, one arm raised to a phone.
    ped.phoneTimer -= dt;
    ped.speed = 0;
    ped.armR.rotation.x = -1.9;
    ped.armL.rotation.x = 0;
    ped.legL.rotation.x = 0;
    ped.legR.rotation.x = 0;
    ped.mesh.position.copy(ped.pos);
    return;
  }
  ped.armR.rotation.x = 0;

  if (ped.waitTimer > 0) {
    ped.waitTimer -= dt;
    ped.speed = 0;
    // Idle sway while standing at a corner; sometimes checks the phone.
    ped.idleSway += dt * 1.4;
    ped.mesh.rotation.z = Math.sin(ped.idleSway) * 0.03;
    if (ped.waitTimer <= 0 && rng() < 0.3) ped.phoneTimer = 2 + rng() * 3;
  } else {
    ped.mesh.rotation.z = 0;
    if (!ped.target) ped.target = randomSidewalkPoint(centers, rng);
    const dx = ped.target.x - ped.pos.x;
    const dz = ped.target.z - ped.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      ped.target = null;
      ped.waitTimer = 1 + rng() * 4;
      ped.speed = 0;
    } else {
      const desiredYaw = Math.atan2(dx, dz);
      ped.yaw += clamp(angleDiff(desiredYaw - ped.yaw), -3 * dt, 3 * dt);
      const targetSpeed = ped.fleeing ? TRAFFIC.pedFleeSpeed : TRAFFIC.pedSpeed;
      ped.speed += (targetSpeed - ped.speed) * Math.min(1, dt * 3);
      ped.pos.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.pos.z += Math.cos(ped.yaw) * ped.speed * dt;
    }
  }

  ped.walkPhase += dt * (2 + ped.speed * 2.4);
  const swing = Math.sin(ped.walkPhase) * 0.45 * Math.min(1, ped.speed / 2);
  ped.legL.rotation.x = swing;
  ped.legR.rotation.x = -swing;
  ped.armL.rotation.x = -swing * 0.8;
  if (ped.phoneTimer <= 0) ped.armR.rotation.x = swing * 0.8;
  ped.mesh.position.copy(ped.pos);
  ped.mesh.rotation.y = ped.yaw;
}

// Fallen walkers tip over and stay down. Returns true while animating.
export function updateFallenPed(ped, dt) {
  if (ped.alive) return false;
  ped.mesh.rotation.x += (Math.PI / 2 - ped.mesh.rotation.x) * Math.min(1, dt * 6);
  return true;
}
