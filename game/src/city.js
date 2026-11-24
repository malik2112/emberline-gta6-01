// EMBERLINE city — builds the sunset harbour district from primitives.
import * as THREE from '../vendor/three/three.module.min.js';
import { WORLD, PALETTE } from './config.js';

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCity(scene) {
  const rand = mulberry(20261124);
  const colliders = [];   // {x, z, r} circles the player/cars push out of
  const roadLines = [];   // road centre lines for AI wandering
  const group = new THREE.Group();
  scene.add(group);

  scene.background = new THREE.Color(PALETTE.skyHorizon);
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 420);

  // Low sun + warm hemisphere light.
  const sun = new THREE.DirectionalLight(0xffb37a, 2.4);
  sun.position.set(-120, 55, -60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a5a9a, 0x2e2233, 0.9));
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(16, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sunDisc.position.set(-260, 34, -190);
  group.add(sunDisc);

  // Ground slab.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.half * 2 + 80, 1, WORLD.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  group.add(ground);

  // Harbour water on the east edge, past the pier.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(260, WORLD.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: PALETTE.water }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(WORLD.half + 130, -0.4, 0);
  group.add(water);

  // Roads: a grid of dark strips + centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c98a });
  const roads = [];
  for (let i = -3; i <= 3; i++) {
    roads.push({ x: i * WORLD.block, z: 0, along: 'z' });
    roads.push({ x: 0, z: i * WORLD.block, along: 'x' });
  }
  for (const r of roads) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(r.along === 'z' ? WORLD.road : WORLD.half * 2, 0.1, r.along === 'z' ? WORLD.half * 2 : WORLD.road),
      roadMat,
    );
    strip.position.set(r.x, 0.05, r.z);
    group.add(strip);
    roadLines.push(r);
  }
  for (let i = -3; i <= 3; i++) {
    for (let d = -WORLD.half; d < WORLD.half; d += 8) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 3), dashMat);
      dash.position.set(i * WORLD.block, 0.11, d);
      group.add(dash);
      const dash2 = dash.clone();
      dash2.rotation.y = Math.PI / 2;
      dash2.position.set(d, 0.11, i * WORLD.block);
      group.add(dash2);
    }
  }

  // Sidewalk blocks + buildings, skipping road corridors and the pier strip.
  const winMat = new THREE.MeshBasicMaterial({ color: PALETTE.windowLit });
  const winDark = new THREE.MeshBasicMaterial({ color: 0x1a1626 });
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const cx = gx * WORLD.block;
      const cz = gz * WORLD.block;
      if (gx === 0 || gz === 0) continue;              // road crossing
      if (cx > WORLD.half - 60) continue;              // pier strip stays open
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(WORLD.block - 14, 0.3, WORLD.block - 14),
        new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }),
      );
      base.position.set(cx, 0.15, cz);
      group.add(base);
      const n = 1 + Math.floor(rand() * 2);
      for (let b = 0; b < n; b++) {
        const w = 10 + rand() * 12;
        const d = 10 + rand() * 12;
        const h = 8 + rand() * 26;
        const ox = (rand() - 0.5) * (WORLD.block - 22 - w);
        const oz = (rand() - 0.5) * (WORLD.block - 22 - d);
        const mat = new THREE.MeshLambertMaterial({ color: PALETTE.building[Math.floor(rand() * PALETTE.building.length)] });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(cx + ox, h / 2, cz + oz);
        group.add(tower);
        colliders.push({ x: cx + ox, z: cz + oz, r: Math.max(w, d) * 0.62 });
        // Lit windows on the sun-facing side.
        const floors = Math.max(1, Math.floor(h / 4));
        for (let f = 0; f < floors; f++) {
          for (let k = 0; k < Math.floor(w / 4); k++) {
            if (rand() < 0.45) continue;
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), rand() < 0.6 ? winMat : winDark);
            win.position.set(cx + ox - w / 2 + 2 + k * 4, 2.5 + f * 4, cz + oz + d / 2 + 0.06);
            group.add(win);
          }
        }
        // Neon sign on some towers.
        if (rand() < 0.3) {
          const neon = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.5, 0.8, 0.4),
            new THREE.MeshBasicMaterial({ color: PALETTE.neon[Math.floor(rand() * PALETTE.neon.length)] }),
          );
          neon.position.set(cx + ox, h + 0.6, cz + oz + d / 2);
          group.add(neon);
        }
      }
    }
  }

  // Pier 9 — wooden deck jutting into the water, east side.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 18), pierMat);
  pier.position.set(WORLD.half + 28, 0.5, 40);
  group.add(pier);
  for (let p = 0; p < 8; p++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 8), pierMat);
    post.position.set(WORLD.half + 2 + p * 9, -1, 40 + (p % 2 === 0 ? 8 : -8));
    group.add(post);
  }
  const pierLight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.7, 9, 8),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  pierLight.position.set(WORLD.half + 58, 5, 40);
  group.add(pierLight);
  const pierLamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  pierLamp.position.set(WORLD.half + 58, 10, 40);
  group.add(pierLamp);

  // Lighthouse on the north-east corner.
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 22, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }),
  );
  light.position.set(WORLD.half - 20, 11, -WORLD.half + 24);
  group.add(light);
  const lampTop = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  lampTop.position.set(WORLD.half - 20, 23, -WORLD.half + 24);
  group.add(lampTop);
  colliders.push({ x: WORLD.half - 20, z: -WORLD.half + 24, r: 4 });

  // Streetlights along the main roads.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (let i = -3; i <= 3; i++) {
    for (let d = -150; d <= 150; d += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(i * WORLD.block + 7, 3.5, d);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), bulbMat);
      bulb.position.set(i * WORLD.block + 7, 7.1, d);
      group.add(bulb);
    }
  }

  // Crane silhouettes over the harbour.
  const craneMat = new THREE.MeshLambertMaterial({ color: 0x8a2f2f });
  for (const cz of [-60, 0, 90]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), craneMat);
    leg.position.set(WORLD.half - 8, 17, cz);
    group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2), craneMat);
    arm.position.set(WORLD.half + 2, 32, cz);
    group.add(arm);
  }

  return { group, colliders, roadLines, rand };
}

// Push a circle (x,z,r) out of every building collider. Returns corrected x,z.
export function resolveCollisions(x, z, r, colliders) {
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d2 = dx * dx + dz * dz;
    const min = c.r + r;
    if (d2 < min * min && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = c.x + (dx / d) * min;
      z = c.z + (dz / d) * min;
    }
  }
  return { x, z };
}
