// EMBERLINE — city.js (round 3 redo)
// Builds the whole procedural town: ground slabs, the road grid with
// crosswalks, window-lit towers, the Quay Row chop-shop, the DOCK 9
// gantry crane, container stacks, the harbor lighthouse, streetlights,
// quay and water. Returns AABB colliders plus the intersection graph
// traffic drives on.
import * as THREE from 'three';
import { CITY, PALETTE, CLEARINGS } from './config.js';

// Deterministic PRNG (xorshift32) so every load builds the identical city.
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function cssHex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// Painted facade: base colour, a grid of windows (some lit warm, some
// cool), a dark awning stripe near the ground floor and a rooftop rim.
function paintFacade(baseHex, seed) {
  const rand = makeRng(seed);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 10;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lit = rand() < 0.42;
      ctx.fillStyle = lit ? (rand() < 0.7 ? '#ffd98a' : '#9ad4ff') : '#2c3a4a';
      ctx.fillRect(8 + col * 20, 10 + row * 22, 13, 14);
    }
  }
  ctx.fillStyle = 'rgba(20,24,28,0.55)';
  ctx.fillRect(0, 226, 128, 30);
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

function groundSlab(w, d, color, y) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

function crate(w, h, d, color, x, y, z, basic = false) {
  const mat = basic
    ? new THREE.MeshBasicMaterial({ color })
    : new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildCity(scene, seed = 20261124) {
  const rand = makeRng(seed);
  const colliders = [];
  const buildings = [];
  const props = [];
  const centers = streetCenters();
  const sw = CITY.streetWidth;
  const half = CITY.half;

  // --- ground layers: outer apron, city slab, then roads on top
  const apron = groundSlab(900, 700, PALETTE.ground, -0.05);
  apron.position.x = 40;
  scene.add(apron);
  scene.add(groundSlab(half * 2 + sw, half * 2 + sw, 0x7d838a, 0));

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
    for (let d = -half + 7; d < half; d += 14) {
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
  let facadeSeed = 101;
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
        // Gameplay clearings win over skyline: a tower overlapping a
        // mission point would make that job unwinnable, so skip it.
        const blocked = CLEARINGS.some((c) => {
          const nearX = Math.max(px, Math.min(c.x, px + w));
          const nearZ = Math.max(pz, Math.min(c.z, pz + d));
          return Math.hypot(nearX - c.x, nearZ - c.z) < c.r;
        });
        if (blocked) continue;
        const paint = PALETTE.building[Math.floor(rand() * PALETTE.building.length)];
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshLambertMaterial({ map: paintFacade(cssHex(paint), facadeSeed++) }),
        );
        tower.position.set(px + w / 2, h / 2, pz + d / 2);
        scene.add(tower);
        // Rooftop AC box so the skyline is not a flat slab.
        scene.add(crate(3, 1.4, 3, 0x4a5058, px + w / 2, h + 0.7, pz + d / 2));
        scene.add(crate(w + 1, 0.8, d + 1, 0x5a5f66, px + w / 2, h + 0.4, pz + d / 2));
        colliders.push({ minX: px, maxX: px + w, minZ: pz, maxZ: pz + d });
        buildings.push(tower);
      }
    }
  }

  // --- Kessler's Yard chop-shop (mission hub)
  scene.add(crate(26, 9, 18, 0x8a3324, -186, 4.5, 168));
  scene.add(crate(24, 2.4, 0.6, 0xffe08a, -186, 8.2, 158.6, true));
  // Yard fence posts along the south edge.
  for (let fx = -200; fx <= -172; fx += 7) {
    scene.add(crate(0.5, 2.2, 0.5, 0x3a3f45, fx, 1.1, 180));
  }
  colliders.push({ minX: -199, maxX: -173, minZ: 159, maxZ: 177 });

  // --- DOCK 9 gantry crane
  const cranePaint = 0xe8a13a;
  for (const legX of [138, 162]) {
    scene.add(crate(2.5, 40, 2.5, cranePaint, legX, 20, -150));
    colliders.push({ minX: legX - 1.5, maxX: legX + 1.5, minZ: -152, maxZ: -148 });
  }
  scene.add(crate(40, 3, 4, cranePaint, 150, 40, -150));
  scene.add(crate(0.6, 10, 0.6, 0x3a3f45, 150, 34, -150));
  scene.add(crate(10, 3, 3, 0x3a7a8a, 150, 28, -150));
  scene.add(crate(20, 2.4, 0.6, 0xffe08a, 150, 38, -147.6, true));

  // --- container stacks along the quay
  const containerPaints = [0xb8643a, 0x3a7a8a, 0xc8a86a, 0x8a4a3a, 0x5a6a7a];
  for (let i = 0; i < 10; i++) {
    const cx = 218;
    const cz = -180 + i * 40;
    const stackHeight = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < stackHeight; k++) {
      const unit = crate(6, 2.8, 12, containerPaints[Math.floor(rand() * containerPaints.length)], cx, 1.4 + k * 2.8, cz);
      scene.add(unit);
      props.push(unit);
    }
    colliders.push({ minX: cx - 3, maxX: cx + 3, minZ: cz - 6, maxZ: cz + 6 });
  }

  // --- harbor lighthouse at the far end of the quay
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
  const lightTower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 26, 12), towerMat);
  lightTower.position.set(238, 13, -205);
  scene.add(lightTower);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 2.4, 12),
    new THREE.MeshLambertMaterial({ color: PALETTE.lighthouse }),
  );
  lampRoom.position.set(238, 27, -205);
  scene.add(lampRoom);
  const lampGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2b8 }),
  );
  lampGlow.position.set(238, 27, -205);
  scene.add(lampGlow);
  colliders.push({ minX: 234, maxX: 242, minZ: -209, maxZ: -201 });

  // --- benches along the quay so the waterfront reads as a promenade
  for (const bz of [-120, -40, 40, 120]) {
    scene.add(crate(3.4, 0.5, 1.1, PALETTE.bench, 222, 0.55, bz));
    scene.add(crate(0.3, 0.5, 1.1, 0x3a3f45, 220.5, 0.25, bz));
    scene.add(crate(0.3, 0.5, 1.1, 0x3a3f45, 223.5, 0.25, bz));
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
  const quay = groundSlab(60, half * 2 + 60, PALETTE.sand, 0.02);
  quay.position.x = CITY.beachX + 16;
  scene.add(quay);
  const harbor = groundSlab(220, 700, PALETTE.sea, 0.0);
  harbor.position.x = CITY.waterX + 110;
  scene.add(harbor);
  for (const pierZ of [-70, 60]) {
    scene.add(crate(46, 1, 8, 0x6a6258, CITY.beachX + 30, 0.6, pierZ));
  }

  // Intersection graph for traffic routing.
  const nodes = [];
  for (const x of centers) for (const z of centers) nodes.push({ x, z });
  return { colliders, buildings, nodes, centers, palms: props };
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
