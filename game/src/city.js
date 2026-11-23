// EMBERLINE — city.js (round 3 re-author)
// Builds the whole procedural city: ground slabs, the road grid with
// crosswalks, window-textured towers, the Quay Row chop-shop, the DOCK 9
// gantry crane, container stacks, streetlights, quay and harbor. Returns
// AABB colliders plus the intersection graph traffic drives on.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

// Small deterministic PRNG so every load builds the identical city.
function seededRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexString(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// Painted facade: base colour, a grid of windows, a few of them lit warm.
function facadeTexture(baseHex, seed) {
  const rand = seededRng(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 12;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lit = rand() < 0.44;
      ctx.fillStyle = lit ? (rand() < 0.72 ? '#ffd98a' : '#9ad4ff') : '#2c3a4a';
      ctx.fillRect(10 + col * 22, 12 + row * 20, 14, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Coordinates of every street centre line (both axes share the list).
export function streetCenters() {
  const lines = [];
  for (let i = 0; i <= CITY.blocks; i++) lines.push(-CITY.half + i * CITY.block);
  return lines;
}

function flatPlane(w, d, color, y) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function box(w, h, d, color, x, y, z, basic = false) {
  const mat = basic
    ? new THREE.MeshBasicMaterial({ color })
    : new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildCity(scene, seed = 20261118) {
  const rand = seededRng(seed);
  const colliders = [];
  const buildings = [];
  const palms = []; // decorative props list (containers reuse it)
  const centers = streetCenters();
  const sw = CITY.streetWidth;
  const half = CITY.half;

  // --- ground layers: outer apron, city slab, then roads on top
  const apron = flatPlane(900, 700, PALETTE.ground, -0.05);
  apron.position.x = 40;
  scene.add(apron);
  scene.add(flatPlane(half * 2 + sw, half * 2 + sw, 0x7d838a, 0));

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (const c of centers) {
    const northSouth = new THREE.Mesh(new THREE.PlaneGeometry(sw, half * 2 + sw), roadMat);
    northSouth.rotation.x = -Math.PI / 2;
    northSouth.position.set(c, 0.01, 0);
    scene.add(northSouth);
    const eastWest = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + sw, sw), roadMat);
    eastWest.rotation.x = -Math.PI / 2;
    eastWest.position.set(0, 0.01, c);
    scene.add(eastWest);
    for (let d = -half; d < half; d += 14) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(c, 0.02, d);
      scene.add(dashV);
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(d, 0.02, c);
      scene.add(dashH);
    }
  }

  // Crosswalks at every intersection: four zebra arms.
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e0 });
  for (const cx of centers) {
    for (const cz of centers) {
      for (let s = -2; s <= 2; s++) {
        const stripeN = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3), zebraMat);
        stripeN.rotation.x = -Math.PI / 2;
        stripeN.position.set(cx + s * 2.2, 0.025, cz - sw / 2 - 2);
        scene.add(stripeN);
        const stripeS = stripeN.clone();
        stripeS.position.z = cz + sw / 2 + 2;
        scene.add(stripeS);
        const stripeW = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), zebraMat);
        stripeW.rotation.x = -Math.PI / 2;
        stripeW.position.set(cx - sw / 2 - 2, 0.025, cz + s * 2.2);
        scene.add(stripeW);
        const stripeE = stripeW.clone();
        stripeE.position.x = cx + sw / 2 + 2;
        scene.add(stripeE);
      }
    }
  }

  // --- sidewalks hugging both sides of every road
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  for (const c of centers) {
    for (const side of [-1, 1]) {
      const vWalk = new THREE.Mesh(new THREE.PlaneGeometry(4, half * 2 + sw), walkMat);
      vWalk.rotation.x = -Math.PI / 2;
      vWalk.position.set(c + side * (sw / 2 + 2), 0.015, 0);
      scene.add(vWalk);
      const hWalk = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + sw, 4), walkMat);
      hWalk.rotation.x = -Math.PI / 2;
      hWalk.position.set(0, 0.015, c + side * (sw / 2 + 2));
      scene.add(hWalk);
    }
  }

  // --- towers: corner-anchored lots so blocks keep an alley gap
  let facadeSeed = 11;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const lotX = -half + bx * CITY.block + sw / 2;
      const lotZ = -half + bz * CITY.block + sw / 2;
      const inner = CITY.block - sw;
      const towerCount = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < towerCount; k++) {
        const w = 14 + rand() * 16;
        const d = 14 + rand() * 16;
        const h = 12 + rand() * rand() * 55;
        const px = lotX + 8 + rand() * Math.max(1, inner - w - 16);
        const pz = lotZ + 8 + rand() * Math.max(1, inner - d - 16);
        const paint = PALETTE.building[Math.floor(rand() * PALETTE.building.length)];
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshLambertMaterial({ map: facadeTexture(hexString(paint), facadeSeed++) }),
        );
        tower.position.set(px + w / 2, h / 2, pz + d / 2);
        scene.add(tower);
        const rim = box(w + 1, 0.8, d + 1, 0x5a5f66, px + w / 2, h + 0.4, pz + d / 2);
        scene.add(rim);
        colliders.push({ minX: px, maxX: px + w, minZ: pz, maxZ: pz + d });
        buildings.push(tower);
      }
    }
  }

  // --- Kessler's Yard chop-shop (mission hub)
  scene.add(box(26, 9, 18, 0x8a3324, -186, 4.5, 168));
  scene.add(box(24, 2.4, 0.6, 0xffe08a, -186, 8.2, 158.6, true));
  colliders.push({ minX: -199, maxX: -173, minZ: 159, maxZ: 177 });

  // --- DOCK 9 gantry crane
  const cranePaint = 0xe8a13a;
  for (const legX of [138, 162]) {
    scene.add(box(2.5, 40, 2.5, cranePaint, legX, 20, -150));
    colliders.push({ minX: legX - 1.5, maxX: legX + 1.5, minZ: -152, maxZ: -148 });
  }
  scene.add(box(40, 3, 4, cranePaint, 150, 40, -150));
  scene.add(box(0.6, 10, 0.6, 0x3a3f45, 150, 34, -150));
  scene.add(box(10, 3, 3, 0x3a7a8a, 150, 28, -150));
  scene.add(box(20, 2.4, 0.6, 0xffe08a, 150, 38, -147.6, true));

  // --- container stacks along the quay
  const containerPaints = [0xb8643a, 0x3a7a8a, 0xc8a86a, 0x8a4a3a, 0x5a6a7a];
  for (let i = 0; i < 10; i++) {
    const cx = 218;
    const cz = -180 + i * 40;
    const stackHeight = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < stackHeight; k++) {
      const unit = box(6, 2.8, 12, containerPaints[Math.floor(rand() * containerPaints.length)], cx, 1.4 + k * 2.8, cz);
      scene.add(unit);
      palms.push(unit);
    }
    colliders.push({ minX: cx - 3, maxX: cx + 3, minZ: cz - 6, maxZ: cz + 6 });
  }

  // --- streetlights on alternate corners
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < centers.length; i += 2) {
    for (let j = 0; j < centers.length; j += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), poleMat);
      pole.position.set(centers[i] + sw / 2 + 1.5, 3, centers[j] + sw / 2 + 1.5);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(centers[i] + sw / 2 + 1.5, 6.2, centers[j] + sw / 2 + 1.5);
      scene.add(lamp);
    }
  }

  // --- quay apron, harbor water, piers
  const quay = flatPlane(60, half * 2 + 60, PALETTE.sand, 0.02);
  quay.position.x = CITY.beachX + 16;
  scene.add(quay);
  const harbor = flatPlane(220, 700, PALETTE.sea, 0.0);
  harbor.position.x = CITY.waterX + 110;
  scene.add(harbor);
  for (const pierZ of [-70, 60]) {
    scene.add(box(46, 1, 8, 0x6a6258, CITY.beachX + 30, 0.6, pierZ));
  }

  // Intersection graph for traffic routing.
  const nodes = [];
  for (const x of centers) for (const z of centers) nodes.push({ x, z });
  return { colliders, buildings, nodes, centers, palms };
}

// Push a circle out of every AABB it overlaps. Returns true if it touched one.
export function collideCircle(pos, radius, colliders) {
  for (const b of colliders) {
    const closestX = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const closestZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      pos.x = closestX + (dx / dist) * radius;
      pos.z = closestZ + (dz / dist) * radius;
    } else {
      // Centre inside the box: exit along the shallowest side.
      const left = pos.x - b.minX;
      const right = b.maxX - pos.x;
      const top = pos.z - b.minZ;
      const bottom = b.maxZ - pos.z;
      const shallowest = Math.min(left, right, top, bottom);
      if (shallowest === left) pos.x = b.minX - radius;
      else if (shallowest === right) pos.x = b.maxX + radius;
      else if (shallowest === top) pos.z = b.minZ - radius;
      else pos.z = b.maxZ + radius;
    }
    return true;
  }
  return false;
}
