// EMBERLINE — player.js (round 3 redo)
// Kade Venn on foot: camera-relative WASD movement with a stamina meter
// gating the sprint, a subtle head-bob at speed, footstep pacing the
// audio engine can hook into, and the third-person camera that trails
// him on foot or chases his car. Driving physics lives in vehicles.js.
import * as THREE from 'three';
import { PLAYER, CITY } from './config.js';
import { collideCircle } from './city.js';
import { makePersonMesh } from './pedestrians.js';

function angleDiff(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createPlayer(scene) {
  const built = makePersonMesh(0xc23b2e);
  built.group.position.set(-180, 0, 180);
  scene.add(built.group);
  return {
    mesh: built.group,
    legL: built.legL, legR: built.legR, armL: built.armL, armR: built.armR,
    pos: new THREE.Vector3(-180, 0, 180),
    yaw: Math.PI * 0.75,
    pitch: -0.12,
    hp: PLAYER.maxHp,
    cash: 50,
    speed: 0,
    walkPhase: 0,
    onFoot: true,
    car: null,
    speedKmh: 0,
    bustMeter: 0,
    bobPhase: 0,
    stamina: PLAYER.staminaMax,
    sprintLocked: false,
    stepAccum: 0, // distance walked since the last footstep tick
  };
}

export function updatePlayerOnFoot(player, input, dt, colliders) {
  // Sprint drains stamina; an empty tank locks sprint until it refills
  // past the lockout line.
  const wantSprint = !!input.run;
  if (player.stamina <= 0) player.sprintLocked = true;
  if (player.sprintLocked && player.stamina >= PLAYER.staminaLockout) player.sprintLocked = false;
  const sprinting = wantSprint && !player.sprintLocked;
  if (sprinting) {
    player.stamina = Math.max(0, player.stamina - PLAYER.staminaDrain * dt);
  } else {
    player.stamina = Math.min(PLAYER.staminaMax, player.stamina + PLAYER.staminaRegen * dt);
  }
  const topSpeed = sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed;

  let inputX = 0;
  let inputZ = 0;
  if (input.up) inputZ += 1;
  if (input.down) inputZ -= 1;
  if (input.left) inputX -= 1;
  if (input.right) inputX += 1;
  const hasInput = inputX !== 0 || inputZ !== 0;

  let targetSpeed = 0;
  if (hasInput) {
    const len = Math.hypot(inputX, inputZ);
    inputX /= len;
    inputZ /= len;
    // Rotate the input into world space using the camera yaw.
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const worldX = inputZ * sin + inputX * cos;
    const worldZ = inputZ * cos - inputX * sin;
    // Turn the body toward the travel direction smoothly.
    const desiredYaw = Math.atan2(worldX, worldZ);
    player.yaw += angleDiff(desiredYaw - player.yaw) * Math.min(1, dt * 10);
    targetSpeed = topSpeed;
    const stepX = worldX * topSpeed * dt;
    const stepZ = worldZ * topSpeed * dt;
    player.pos.x += stepX;
    player.pos.z += stepZ;
    player.stepAccum += Math.hypot(stepX, stepZ);
  }

  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);
  collideCircle(player.pos, PLAYER.radius, colliders);
  player.pos.x = clamp(player.pos.x, -CITY.boundZ, CITY.boundX);
  player.pos.z = clamp(player.pos.z, -CITY.boundZ, CITY.boundZ);

  player.walkPhase += dt * (2 + player.speed * 1.6);
  const swing = Math.sin(player.walkPhase) * 0.5 * Math.min(1, player.speed / 5);
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  player.armL.rotation.x = -swing * 0.8;
  player.armR.rotation.x = swing * 0.8;

  // Head-bob: a gentle vertical bounce scaled by speed.
  player.bobPhase += dt * player.speed * 1.8;
  const bob = Math.sin(player.bobPhase) * PLAYER.headBobAmount * Math.min(1, player.speed / 6);
  player.mesh.position.set(player.pos.x, bob, player.pos.z);
  player.mesh.rotation.y = player.yaw;
  player.speedKmh = Math.round(player.speed * 3.6);
}

export function updateCamera(camera, player, dt, mouseDX, mouseDY, kick = 0) {
  if (player.onFoot) {
    player.yaw -= mouseDX * 0.0028;
    player.pitch = clamp(player.pitch - mouseDY * 0.0028, -0.6, 0.45);
    const distance = 6.5;
    const targetX = player.pos.x - Math.sin(player.yaw) * Math.cos(player.pitch) * distance;
    const targetZ = player.pos.z - Math.cos(player.yaw) * Math.cos(player.pitch) * distance;
    const targetY = PLAYER.eyeHeight + Math.sin(player.pitch) * distance + 1.2;
    const blend = Math.min(1, dt * 12);
    camera.position.x += (targetX - camera.position.x) * blend;
    camera.position.y += (targetY - camera.position.y) * blend;
    camera.position.z += (targetZ - camera.position.z) * blend;
    camera.lookAt(player.pos.x, player.pos.y + 1.6 + kick, player.pos.z);
  } else if (player.car) {
    const car = player.car;
    const trailDistance = 10 + Math.abs(car.speed) * 0.12;
    const trailHeight = 4 + Math.abs(car.speed) * 0.03;
    const targetX = car.pos.x - Math.sin(car.yaw) * trailDistance;
    const targetZ = car.pos.z - Math.cos(car.yaw) * trailDistance;
    const blend = Math.min(1, dt * 5);
    camera.position.x += (targetX - camera.position.x) * blend;
    camera.position.y += (trailHeight - camera.position.y) * blend;
    camera.position.z += (targetZ - camera.position.z) * blend;
    camera.lookAt(car.pos.x + Math.sin(car.yaw) * 6, 1.4 + kick, car.pos.z + Math.cos(car.yaw) * 6);
    player.yaw = car.yaw;
    player.pos.copy(car.pos);
  }
}

// Slow orbit used behind the start menu.
export function menuCamera(camera, t) {
  const radius = 150;
  camera.position.set(
    Math.cos(t * 0.05) * radius,
    55 + Math.sin(t * 0.03) * 12,
    Math.sin(t * 0.05) * radius,
  );
  camera.lookAt(0, 8, 0);
}
