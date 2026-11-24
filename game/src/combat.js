// EMBERLINE — combat.js (round 3 redo)
// The pistol: hitscan shots from the camera centre with spread that blooms
// under rapid fire, tracer lines, a pooled muzzle-flash light, timed
// reloads, a small camera kick per shot, player damage, and rival gunmen
// who return fire in bursts. Hit testing is a manual ray-vs-body-cylinder
// check, so it needs no scene-graph raycast.
import * as THREE from 'three';
import { COMBAT } from './config.js';

export function createCombat() {
  return {
    ammo: COMBAT.magSize,
    reserve: 999,
    reloading: false,
    reloadTimer: 0,
    fireTimer: 0,
    tracers: [],
    flashes: [],
    bloom: 0, // accumulated spread from recent shots
  };
}

function addTracer(G, from, to, color, life) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.9,
  }));
  G.scene.add(line);
  G.combat.tracers.push({ line, life, maxLife: life });
}

// Manual ray vs. upright body cylinder: a target counts as hit when the
// ray passes within bodyRadius of the spine between hip and head height.
function rayHitsBody(origin, dir, target) {
  const spineX = target.pos.x - origin.x;
  const spineZ = target.pos.z - origin.z;
  const along = spineX * dir.x + spineZ * dir.z;
  if (along < 0 || along > COMBAT.range) return null;
  const closestX = origin.x + dir.x * along;
  const closestZ = origin.z + dir.z * along;
  const side = Math.hypot(closestX - target.pos.x, closestZ - target.pos.z);
  if (side > 0.62) return null;
  const heightAt = origin.y + dir.y * along;
  if (heightAt < 0.15 || heightAt > 1.95) return null;
  return along;
}

// Fire one shot. targets: shootable objects {pos, hp, alive, kind, mesh}.
// Returns {hit, end} or null when the gun cannot fire.
export function fireWeapon(G, targets) {
  const combat = G.combat;
  if (combat.reloading || combat.fireTimer > 0 || combat.ammo <= 0) {
    if (combat.ammo <= 0) G.sound.dryClick();
    return null;
  }
  combat.fireTimer = COMBAT.fireInterval;
  combat.ammo -= 1;
  combat.bloom = Math.min(0.05, combat.bloom + COMBAT.spreadBloom);
  G.sound.shot();
  G.kick = (G.kick || 0) + COMBAT.cameraKick;

  const origin = G.camera.position.clone();
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const spread = COMBAT.spreadBase + combat.bloom;
  dir.x += (Math.random() - 0.5) * spread * 2;
  dir.y += (Math.random() - 0.5) * spread * 2;
  dir.normalize();

  let best = null;
  let bestAlong = COMBAT.range;
  for (const target of targets) {
    if (!target.alive) continue;
    const along = rayHitsBody(origin, dir, target);
    if (along !== null && along < bestAlong) { bestAlong = along; best = target; }
  }
  const end = origin.clone().addScaledVector(dir, best ? bestAlong : COMBAT.range);
  let hit = null;
  if (best) {
    hit = best;
    hit.hp -= COMBAT.damage;
    if (hit.hp <= 0) {
      hit.alive = false;
      if (hit.mesh) hit.mesh.visible = false;
    }
  }
  addTracer(G, origin, end, 0xffd76a, 0.09);
  // Pooled muzzle flash: a short-lived point light, reaped in updateCombat.
  const flash = new THREE.PointLight(0xffc860, 12, 9, 1.5);
  flash.position.copy(origin).addScaledVector(dir, 0.8);
  G.scene.add(flash);
  combat.flashes.push({ light: flash, life: 0.06 });
  return { hit, end };
}

export function startReload(G) {
  const combat = G.combat;
  if (combat.reloading || combat.ammo === COMBAT.magSize) return;
  combat.reloading = true;
  combat.reloadTimer = COMBAT.reloadSeconds;
  G.sound.reload();
}

export function updateCombat(G, dt) {
  const combat = G.combat;
  if (combat.fireTimer > 0) combat.fireTimer -= dt;
  combat.bloom = Math.max(0, combat.bloom - dt * COMBAT.spreadDecay);
  if (combat.reloading) {
    combat.reloadTimer -= dt;
    if (combat.reloadTimer <= 0) {
      combat.reloading = false;
      combat.ammo = COMBAT.magSize;
    }
  }
  for (let i = combat.tracers.length - 1; i >= 0; i--) {
    const tracer = combat.tracers[i];
    tracer.life -= dt;
    tracer.line.material.opacity = Math.max(0, tracer.life / tracer.maxLife) * 0.9;
    if (tracer.life <= 0) {
      G.scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
      combat.tracers.splice(i, 1);
    }
  }
  for (let i = combat.flashes.length - 1; i >= 0; i--) {
    const flash = combat.flashes[i];
    flash.life -= dt;
    if (flash.life <= 0) {
      G.scene.remove(flash.light);
      combat.flashes.splice(i, 1);
    }
  }
}

export function damagePlayer(G, amount) {
  if (G.mode !== 'playing' || G.player.hp <= 0) return;
  G.player.hp = Math.max(0, G.player.hp - amount);
  G.hudFlash('damage');
  if (G.player.hp <= 0) G.wasted();
}

// Rivals hold their ground, face the player, and fire in short bursts.
export function updateRivals(G, dt) {
  for (const rival of G.rivals) {
    if (!rival.alive) continue;
    const dist = Math.hypot(rival.pos.x - G.player.pos.x, rival.pos.z - G.player.pos.z);
    if (dist >= 55 || G.mode !== 'playing') continue;
    rival.shootTimer -= dt;
    rival.mesh.rotation.y = Math.atan2(G.player.pos.x - rival.pos.x, G.player.pos.z - rival.pos.z);
    if (rival.shootTimer > 0) continue;
    rival.shootTimer = 0.9 + Math.random() * 0.7;
    const hitChance = Math.max(0.15, 0.6 - dist * 0.008);
    if (Math.random() < hitChance) {
      damagePlayer(G, 9 + Math.floor(Math.random() * 7));
      G.sound.thud();
    } else {
      G.sound.shot();
    }
    addTracer(
      G,
      new THREE.Vector3(rival.pos.x, 1.4, rival.pos.z),
      new THREE.Vector3(G.player.pos.x, 1.2, G.player.pos.z),
      0xff6a5a,
      0.08,
    );
  }
}
