// EMBERLINE — missions.js (round 3 redo)
// Mara Kessler's five jobs, each driven by one handler in a dispatch
// table over a shared beacon system: reach a point, steal-and-deliver,
// lose the heat, a timed crate run, and the grab-and-escape finale.
// Cash lands on completion; timed jobs pay a speed bonus for seconds
// to spare, and a failed job costs $25 of Mara's patience.
import * as THREE from 'three';
import { spawnPed } from './pedestrians.js';
import { HUB, PALETTE } from './config.js';
import { syncPolice } from './wanted.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Shift',
    reward: 200,
    brief: 'Mara: "My flatbed is parked by the yard, Kade. Run it to the crane drop-off on the east quay. No scratches — it is not yours."',
    objective: "Drive Mara's flatbed to the crane drop-off",
    type: 'reach',
    radius: 9,
    target: { x: 236, z: 60 },
    needCar: true,
  },
  {
    id: 2,
    title: 'Borrowed Rig',
    reward: 350,
    brief: 'Mara: "A client wants a sunset-orange coupe. Not to buy — to borrow. Permanently. Take any car and bring it to my yard."',
    objective: "Steal a car and bring it to Mara's yard",
    type: 'steal-deliver',
    radius: 10,
    target: { x: -186, z: 168 },
  },
  {
    id: 3,
    title: 'Heat on the Docks',
    reward: 500,
    brief: 'Mara: "You clipped a cruiser, Kade. Harbor PD is wide awake. Shake the heat, then get to the safehouse on Crane Street. Do not get busted."',
    objective: 'Lose the wanted level, then reach the safehouse',
    type: 'lose-heat',
    radius: 10,
    target: { x: 100, z: -100 },
    startHeat: 2,
  },
  {
    id: 4,
    title: 'Crate Run',
    reward: 700,
    brief: 'Mara: "Three crates, three corners of the docks, 150 seconds. The buyers do not wait and neither do I."',
    objective: 'Collect 3 crates before the timer runs out',
    type: 'collect',
    count: 3,
    timeLimit: 150,
    packages: [{ x: -170, z: -170 }, { x: 170, z: 170 }, { x: 30, z: -170 }],
  },
  {
    id: 5,
    title: 'The Crane Job',
    reward: 1500,
    brief: 'Mara: "Last job, Kade. The DOCK 9 crane crew left a gap at dawn. Grab the manifest cash, dodge the guards, and bring it to the harbor. Then we are square."',
    objective: 'Grab the cash at the DOCK 9 crane, then escape to the harbor',
    type: 'grab-escape',
    radius: 10,
    target: { x: 150, z: -138 },
    startHeat: 3,
    escape: { x: 236, z: -70 },
  },
];

export function createMissions() {
  return {
    index: 0,
    state: 'idle', // idle | active | waiting-hub | done
    timer: 0,
    collected: 0,
    packageIndex: 0,
    phase: 0,
    beacon: null,
    beaconPos: null,
    pkgMeshes: [],
  };
}

export function currentMission(missions) {
  return missions.index < MISSIONS.length ? MISSIONS[missions.index] : null;
}

function makeBeaconMesh(scene) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: PALETTE.beacon, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  pillar.position.y = 20;
  group.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.3, 8, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.beacon }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  group.add(ring);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: PALETTE.beacon }),
  );
  diamond.position.y = 8;
  group.add(diamond);
  group.userData.diamond = diamond;
  scene.add(group);
  return group;
}

function clearBeacons(G) {
  const missions = G.missions;
  if (missions.beacon) {
    G.scene.remove(missions.beacon);
    missions.beacon = null;
  }
  missions.beaconPos = null;
  for (const pkg of missions.pkgMeshes) G.scene.remove(pkg);
  missions.pkgMeshes = [];
}

function plantBeacon(G, pos) {
  clearBeacons(G);
  const beacon = makeBeaconMesh(G.scene);
  beacon.position.set(pos.x, 0, pos.z);
  G.missions.beacon = beacon;
  G.missions.beaconPos = { x: pos.x, z: pos.z };
}

export function placeHubBeacon(G) {
  if (!G.missions.beacon) plantBeacon(G, { x: HUB.x, z: HUB.z });
}

export function startMission(G, index) {
  const missions = G.missions;
  missions.index = index;
  missions.state = 'active';
  missions.collected = 0;
  missions.packageIndex = 0;
  missions.phase = 0;
  const def = MISSIONS[index];
  if (!def) { missions.state = 'done'; return; }
  missions.timer = def.timeLimit || 0;

  if (def.type === 'collect') {
    for (const pkg of def.packages) {
      const beacon = makeBeaconMesh(G.scene);
      beacon.position.set(pkg.x, 0, pkg.z);
      beacon.scale.setScalar(0.6);
      missions.pkgMeshes.push(beacon);
    }
    missions.beaconPos = { ...def.packages[0] };
  } else if (def.target) {
    plantBeacon(G, def.target);
  }

  if (def.startHeat) {
    G.wanted.level = Math.max(G.wanted.level, def.startHeat);
    G.wanted.quietTimer = 0;
    G.sound.sirenStart();
    G.wanted.sirenOn = true;
    syncPolice(G);
  }
  G.hudMessage(`MISSION ${def.id}: ${def.title} — $${def.reward}`, 'mission');
  G.sound.missionStart();
  G.showBriefing(def);
}

export function onPlayerEnterCar(G) {
  const missions = G.missions;
  const def = MISSIONS[missions.index];
  if (missions.state === 'active' && def && def.type === 'steal-deliver') {
    missions.phase = 1;
  }
}

function distanceTo(G, point) {
  return Math.hypot(G.player.pos.x - point.x, G.player.pos.z - point.z);
}

function spawnGuards(G, at) {
  for (let i = 0; i < 2; i++) {
    const guard = spawnPed(G.scene, at.x + (i ? 6 : -6), at.z + 8, Math.random, 'rival');
    guard.hp = 100;
    guard.shootTimer = 1;
    G.rivals.push(guard);
    G.peds.push(guard);
  }
}

function finishMission(G) {
  const missions = G.missions;
  const def = MISSIONS[missions.index];
  // Timed jobs pay $2 per second left on the clock.
  const timeBonus = def.timeLimit ? Math.max(0, Math.floor(missions.timer)) * 2 : 0;
  const payout = def.reward + timeBonus;
  G.player.cash += payout;
  G.sound.cash();
  G.hudMessage(
    timeBonus > 0
      ? `MISSION COMPLETE: ${def.title} — +$${def.reward} (+$${timeBonus} time bonus)`
      : `MISSION COMPLETE: ${def.title} — +$${payout}`,
    'good',
  );
  G.stats.missionsDone++;
  clearBeacons(G);
  missions.index++;
  missions.state = 'idle';
  if (missions.index >= MISSIONS.length) {
    G.storyComplete();
    return;
  }
  G.saveGame();
  G.hudMessage("New job at Kessler's Yard — head back to Mara Kessler's base.", 'mission');
  plantBeacon(G, { x: HUB.x, z: HUB.z });
  missions.state = 'waiting-hub';
}

// One handler per mission type; updateMissions dispatches through this table.
const MISSION_HANDLERS = {
  reach(G, def) {
    if (distanceTo(G, def.target) < def.radius) {
      if (!G.player.onFoot) finishMission(G);
      else G.hudHint('You need to be in a car for this drop-off.');
    }
  },

  'steal-deliver'(G, def) {
    if (G.missions.phase === 1 && !G.player.onFoot && distanceTo(G, def.target) < def.radius) {
      finishMission(G);
    }
  },

  'lose-heat'(G, def) {
    if (G.missions.phase === 0 && G.wanted.level === 0) {
      G.missions.phase = 1;
      G.hudMessage('Heat is off — get to the safehouse!', 'good');
      plantBeacon(G, def.target);
    }
    if (G.missions.phase === 1 && distanceTo(G, def.target) < def.radius) finishMission(G);
  },

  collect(G, def) {
    const missions = G.missions;
    const pkg = def.packages[missions.packageIndex];
    if (!pkg || distanceTo(G, pkg) >= 4) return;
    missions.collected++;
    G.sound.cash();
    G.player.cash += 50;
    G.hudMessage(`Package ${missions.collected}/${def.count} collected (+$50)`, 'good');
    const mesh = missions.pkgMeshes[missions.packageIndex];
    if (mesh) G.scene.remove(mesh);
    missions.packageIndex++;
    if (missions.packageIndex < def.packages.length) {
      missions.beaconPos = { ...def.packages[missions.packageIndex] };
    } else {
      finishMission(G);
    }
  },

  'grab-escape'(G, def) {
    const missions = G.missions;
    if (missions.phase === 0 && distanceTo(G, def.target) < def.radius) {
      missions.phase = 1;
      G.player.cash += 1500;
      G.hudMessage('Cash grabbed! Get to the docks — the PD is coming!', 'bad');
      G.sound.cash();
      plantBeacon(G, def.escape);
      spawnGuards(G, def.target);
    } else if (missions.phase === 1 && distanceTo(G, def.escape) < def.radius) {
      finishMission(G);
    }
  },
};

export function updateMissions(G, dt) {
  const missions = G.missions;
  if (missions.state !== 'active') return;
  const def = MISSIONS[missions.index];
  if (!def) return;

  if (def.timeLimit) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      failMission(G, 'Out of time.');
      return;
    }
  }
  if (missions.beacon && missions.beacon.userData.diamond) {
    const diamond = missions.beacon.userData.diamond;
    diamond.rotation.y += dt * 2;
    diamond.position.y = 8 + Math.sin(G.time * 2.5) * 0.8;
  }

  const handler = MISSION_HANDLERS[def.type];
  if (handler) handler(G, def);
}

export function failMission(G, reason) {
  const missions = G.missions;
  // Mara's patience costs $25 a failure.
  G.player.cash = Math.max(0, G.player.cash - 25);
  G.hudMessage(`MISSION FAILED: ${reason} Mara takes $25 off your tab. Talk to her to retry.`, 'bad');
  G.sound.busted();
  clearBeacons(G);
  missions.state = 'idle';
  plantBeacon(G, { x: HUB.x, z: HUB.z });
  missions.state = 'waiting-hub';
}

export function updateHub(G) {
  const missions = G.missions;
  if (missions.state !== 'waiting-hub') return;
  if (Math.hypot(G.player.pos.x - HUB.x, G.player.pos.z - HUB.z) < 9) {
    startMission(G, missions.index);
  }
}

export function missionObjectiveText(G) {
  const missions = G.missions;
  if (missions.state === 'waiting-hub') {
    const next = MISSIONS[missions.index];
    return next ? `Go to Kessler's Yard to start: ${next.title}` : 'Story complete!';
  }
  if (missions.state !== 'active') return 'No active mission';
  const def = MISSIONS[missions.index];
  let text = def.objective;
  if (def.type === 'collect') text += ` — ${missions.collected}/${def.count}`;
  if (def.timeLimit) text += ` — ${Math.max(0, Math.ceil(missions.timer))}s left`;
  if (def.type === 'grab-escape' && missions.phase === 1) text = 'Escape to the docks!';
  if (def.type === 'lose-heat' && missions.phase === 0) text = 'Lose the wanted level!';
  return text;
}
