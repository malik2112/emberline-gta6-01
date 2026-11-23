// EMBERLINE — player.js (round 3 re-author)
// Kade Venn on foot: camera-relative WASD movement with sprint, a subtle
// head-bob at speed, and the third-person camera that trails him on foot
// or chases his car. Driving physics lives in vehicles.js.
import * as THREE from 'three';
import { PLAYER, CITY } from './config.js';
import { collideCircle } from './city.js';
import { makePersonMesh } from './pedestrians.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createPlayer(scene) {
  const { group, legL, legR, armL, armR } = makePersonMesh(0xc23b2e);
  group.position.set(-180, 0, 180);
  scene.add(group);
  return {
    mesh: group,
    legL, legR, armL, armR,
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
  };
}

export function updatePlayerOnFoot(player, input, dt, colliders) {
  const sprinting = !!input.run;
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
    player.yaw += wrapAngle(desiredYaw - player.yaw) * Math.min(1, dt * 10);
    targetSpeed = topSpeed;
    player.pos.x += worldX * topSpeed * dt;
    player.pos.z += worldZ * topSpeed * dt;
  }

  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);
  collideCircle(player.pos, PLAYER.radius, colliders);
  player.pos.x = Math.max(-CITY.boundZ, Math.min(CITY.boundX, player.pos.x));
  player.pos.z = Math.max(-CITY.boundZ, Math.min(CITY.boundZ, player.pos.z));

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

export function updateCamera(camera, player, dt, mouseDX, mouseDY) {
  if (player.onFoot) {
    player.yaw -= mouseDX * 0.0028;
    player.pitch = Math.max(-0.6, Math.min(0.45, player.pitch - mouseDY * 0.0028));
    const distance = 6.5;
    const targetX = player.pos.x - Math.sin(player.yaw) * Math.cos(player.pitch) * distance;
    const targetZ = player.pos.z - Math.cos(player.yaw) * Math.cos(player.pitch) * distance;
    const targetY = PLAYER.eyeHeight + Math.sin(player.pitch) * distance + 1.2;
    const blend = Math.min(1, dt * 12);
    camera.position.x += (targetX - camera.position.x) * blend;
    camera.position.y += (targetY - camera.position.y) * blend;
    camera.position.z += (targetZ - camera.position.z) * blend;
    camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
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
    camera.lookAt(car.pos.x + Math.sin(car.yaw) * 6, 1.4, car.pos.z + Math.cos(car.yaw) * 6);
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
