// EMBERLINE — wanted.js (round 3 re-author)
// The wanted ladder: crimes add heat, Harbor PD dispatches cruisers to
// match, and a quiet stretch with no cruiser nearby cools one star at a
// time. On foot, sustained contact with a stopped cruiser is a bust.
import { WANTED } from './config.js';
import { spawnCar, updatePoliceCar, spinWheels } from './vehicles.js';

export function createWanted() {
  return {
    level: 0,
    quietTimer: 0,
    bustTimer: 0,
    police: [],
    sirenOn: false,
  };
}

export function addHeat(G, amount, reason) {
  const wanted = G.wanted;
  const previousLevel = wanted.level;
  wanted.level = Math.min(WANTED.max, wanted.level + amount);
  wanted.quietTimer = 0;
  if (wanted.level > previousLevel) {
    G.hudMessage(`WANTED LEVEL ${wanted.level} — ${reason}`, 'bad');
    G.sound.sirenStart();
    wanted.sirenOn = true;
  }
  syncPolice(G);
}

function cruisersWanted(level) {
  return level <= 0 ? 0 : Math.min(1 + level, 4);
}

// Keep the cruiser count matched to the wanted level.
export function syncPolice(G) {
  const wanted = G.wanted;
  const desired = cruisersWanted(wanted.level);
  while (wanted.police.length < desired) {
    const p = G.player.pos;
    const angle = Math.random() * Math.PI * 2;
    const distance = 70 + Math.random() * 40;
    const x = Math.max(-200, Math.min(200, p.x + Math.cos(angle) * distance));
    const z = Math.max(-200, Math.min(200, p.z + Math.sin(angle) * distance));
    const cruiser = spawnCar(G.scene, x, z, Math.random() * Math.PI * 2, 0x14181c, 'police');
    wanted.police.push(cruiser);
    G.cars.push(cruiser);
  }
  while (wanted.police.length > desired) {
    const cruiser = wanted.police.pop();
    cruiser.alive = false;
    G.scene.remove(cruiser.mesh);
    const idx = G.cars.indexOf(cruiser);
    if (idx >= 0) G.cars.splice(idx, 1);
  }
  if (wanted.level === 0 && wanted.sirenOn) {
    G.sound.sirenStop();
    wanted.sirenOn = false;
  }
}

function nearestCruiserDistance(G) {
  let nearest = Infinity;
  for (const cruiser of G.wanted.police) {
    const d = Math.hypot(cruiser.pos.x - G.player.pos.x, cruiser.pos.z - G.player.pos.z);
    if (d < nearest) nearest = d;
  }
  return nearest;
}

export function updateWanted(G, dt) {
  const wanted = G.wanted;
  if (wanted.level === 0) return;
  wanted.quietTimer += dt;

  // Heat cools only when the street has been quiet AND cruisers are far.
  if (wanted.quietTimer > WANTED.decaySeconds && nearestCruiserDistance(G) > WANTED.coolDistance) {
    wanted.level -= 1;
    wanted.quietTimer = 0;
    G.hudMessage(
      wanted.level > 0 ? `Heat cooling… wanted level ${wanted.level}` : 'You lost them. Heat is off.',
      'good',
    );
    syncPolice(G);
  }

  // Busted check: on foot with a slow cruiser parked on top of you.
  if (G.player.onFoot) {
    let inContact = false;
    for (const cruiser of wanted.police) {
      const d = Math.hypot(cruiser.pos.x - G.player.pos.x, cruiser.pos.z - G.player.pos.z);
      if (d < WANTED.bustDistance && Math.abs(cruiser.speed) < 4) inContact = true;
    }
    if (inContact) {
      wanted.bustTimer += dt;
      G.hudFlash('bust');
      if (wanted.bustTimer >= WANTED.bustSeconds) {
        wanted.bustTimer = 0;
        G.busted();
      }
    } else {
      wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
    }
  } else {
    wanted.bustTimer = 0;
  }
}

function shovePlayer(G, cruiser) {
  const dx = G.player.pos.x - cruiser.pos.x;
  const dz = G.player.pos.z - cruiser.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  G.player.pos.x += (dx / d) * 1.2;
  G.player.pos.z += (dz / d) * 1.2;
  G.player.hp = Math.max(0, G.player.hp - 4);
  G.sound.thud();
  if (G.player.hp <= 0) G.wasted();
}

export function updatePolice(G, dt) {
  for (const cruiser of G.wanted.police) {
    if (!cruiser.alive) continue;
    // Screenshot staging: formation cruisers hold station beside the player.
    if (G.shotMode && cruiser.shotFollow) {
      const anchor = G.player.car || G.player;
      const { dx, dz } = cruiser.shotFollow;
      const sin = Math.sin(anchor.yaw);
      const cos = Math.cos(anchor.yaw);
      cruiser.pos.x = anchor.pos.x + cos * dx + sin * dz;
      cruiser.pos.z = anchor.pos.z - sin * dx + cos * dz;
      cruiser.yaw = anchor.yaw;
      cruiser.speed = anchor.speed || 0;
      cruiser.mesh.position.copy(cruiser.pos);
      cruiser.mesh.rotation.y = cruiser.yaw;
      spinWheels(cruiser, dt);
      cruiser.flashT += dt * 6;
      if (cruiser.lightBar) {
        const redOn = Math.sin(cruiser.flashT) > 0;
        cruiser.lightBar.red.material.color.setHex(redOn ? 0xff2222 : 0x551111);
        cruiser.lightBar.blue.material.color.setHex(redOn ? 0x111155 : 0x2244ff);
      }
      continue;
    }
    updatePoliceCar(cruiser, G.player.pos, dt, G.city.colliders, G.cars, (cop) => {
      if (G.player.onFoot) {
        const d = Math.hypot(cop.pos.x - G.player.pos.x, cop.pos.z - G.player.pos.z);
        if (d < 2.6) shovePlayer(G, cop);
      } else if (G.player.car) {
        G.player.car.speed *= 0.94;
        if (Math.abs(cop.speed) > 12) {
          G.sound.crash();
          G.player.hp = Math.max(0, G.player.hp - 2);
          if (G.player.hp <= 0) G.wasted();
        }
      }
    });
  }
}

export function clearWanted(G) {
  const wanted = G.wanted;
  wanted.level = 0;
  wanted.quietTimer = 0;
  wanted.bustTimer = 0;
  syncPolice(G);
}
