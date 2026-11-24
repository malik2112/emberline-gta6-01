// EMBERLINE — hud.js (round 3 redo)
// Everything the player reads: cash, health, stamina, wanted stars, ammo,
// speed, nitro tank, mission objective, message feed, clock, compass,
// district readout, and the live minimap canvas with traffic/cruiser
// blips and a pulsing mission beacon. All DOM access lives here.
import { CITY, COMBAT, PALETTE, CLOCK_START, MECHANIC, districtAt, headingDegrees } from './config.js';
import { missionObjectiveText } from './missions.js';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function compassLabel(deg) {
  return COMPASS_POINTS[Math.round(deg / 45) % 8];
}

export function createHud() {
  const byId = (id) => document.getElementById(id);
  return {
    el: {
      cash: byId('cash'),
      hpFill: byId('hpfill'),
      hpNum: byId('hpnum'),
      staminaFill: byId('stamfill'),
      staminaWrap: byId('stamwrap'),
      stars: byId('stars'),
      ammo: byId('ammo'),
      speed: byId('speed'),
      speedLabel: byId('speedlabel'),
      boostfill: byId('boostfill'),
      boostwrap: byId('boostwrap'),
      objective: byId('objtext'),
      feed: byId('feed'),
      hint: byId('hint'),
      bust: byId('bustbar'),
      clock: byId('clock'),
      radio: byId('radio'),
      compass: byId('compass'),
      minimap: byId('minimap'),
      loc: byId('loc'),
    },
    minimapCtx: null,
    lastStars: -1,
    lastCash: -1,
    lastDistrict: '',
    clockMin: CLOCK_START,
  };
}

export function addFeedMessage(hud, text, kind = 'info') {
  if (!hud.el.feed) return;
  const entry = document.createElement('div');
  entry.className = kind;
  entry.textContent = text;
  hud.el.feed.prepend(entry);
  while (hud.el.feed.children.length > 4) hud.el.feed.removeChild(hud.el.feed.lastChild);
  setTimeout(() => { if (entry.parentNode) entry.parentNode.removeChild(entry); }, 9000);
}

export function showHint(hud, text) {
  if (!hud.el.hint) return;
  hud.el.hint.textContent = text;
  hud.el.hint.style.opacity = '1';
  clearTimeout(hud.el.hint._t);
  hud.el.hint._t = setTimeout(() => { hud.el.hint.style.opacity = '0'; }, 2600);
}

export function flashScreen(hud, kind) {
  const overlay = document.getElementById('flash');
  if (!overlay) return;
  overlay.className = 'on ' + kind;
  setTimeout(() => { overlay.className = ''; }, kind === 'damage' ? 220 : 120);
  if (kind === 'bust' && hud.el.bust) {
    hud.el.bust.style.opacity = '1';
    setTimeout(() => { hud.el.bust.style.opacity = '0'; }, 300);
  }
}

export function drawMinimap(G) {
  const hud = G.hud;
  const canvas = hud.el.minimap;
  if (!canvas) return;
  if (!hud.minimapCtx) hud.minimapCtx = canvas.getContext('2d');
  const ctx = hud.minimapCtx;
  const size = canvas.width;
  const worldSpan = CITY.half * 2 + 90;
  const toMapX = (x) => ((x + CITY.half) / worldSpan) * size;
  const toMapZ = (z) => ((z + CITY.half) / worldSpan) * size;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#20262c';
  ctx.fillRect(0, 0, size, size);

  // Water + sand on the east edge.
  const seaX = toMapX(CITY.waterX);
  const sandX = toMapX(CITY.beachX);
  ctx.fillStyle = PALETTE.minimapSea;
  ctx.fillRect(seaX, 0, size - seaX, size);
  ctx.fillStyle = PALETTE.minimapSand;
  ctx.fillRect(sandX, 0, seaX - sandX, size);

  // City blocks.
  ctx.fillStyle = '#3a4148';
  const blockPx = ((CITY.block - 16) / worldSpan) * size;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      ctx.fillRect(
        toMapX(-CITY.half + bx * CITY.block + 10),
        toMapZ(-CITY.half + bz * CITY.block + 10),
        blockPx, blockPx,
      );
    }
  }

  // Street grid.
  ctx.strokeStyle = '#565e66';
  ctx.lineWidth = 3;
  for (const c of G.city.centers) {
    ctx.beginPath(); ctx.moveTo(toMapX(c), 0); ctx.lineTo(toMapX(c), size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toMapZ(c)); ctx.lineTo(size, toMapZ(c)); ctx.stroke();
  }

  // Pulsing mission beacon.
  if (G.missions.beaconPos) {
    const bx = toMapX(G.missions.beaconPos.x);
    const bz = toMapZ(G.missions.beaconPos.z);
    const pulse = 5 + Math.sin(G.time * 5) * 2;
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(bx, bz, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20262c';
    ctx.beginPath(); ctx.arc(bx, bz, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // Traffic blips.
  ctx.fillStyle = '#c8ccd0';
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    ctx.fillRect(toMapX(car.pos.x) - 1.5, toMapZ(car.pos.z) - 1.5, 3, 3);
  }

  // Cruiser blips, flashing red/blue.
  ctx.fillStyle = Math.sin(G.time * 8) > 0 ? '#ff4444' : '#4488ff';
  for (const cop of G.wanted.police) {
    ctx.beginPath();
    ctx.arc(toMapX(cop.pos.x), toMapZ(cop.pos.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player arrow, rotated to the facing.
  const px = toMapX(G.player.pos.x);
  const pz = toMapZ(G.player.pos.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(Math.atan2(Math.cos(G.player.yaw), Math.sin(G.player.yaw)));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('N', 6, 12);
}

function healthColor(hp) {
  if (hp > 50) return '#69e08a';
  if (hp > 25) return '#e8c23a';
  return '#ff5346';
}

export function updateHud(G, dt) {
  const hud = G.hud;
  const player = G.player;

  // clockMin is in minutes; dt arrives in seconds.
  hud.clockMin = (hud.clockMin + dt / 60) % (24 * 60);
  const hh = Math.floor(hud.clockMin / 60);
  const mm = Math.floor(hud.clockMin % 60);
  if (hud.el.clock) {
    hud.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  if (hud.el.compass) {
    const deg = Math.round(headingDegrees(player.yaw));
    hud.el.compass.textContent = `${compassLabel(deg)} ${String(deg).padStart(3, '0')}°`;
  }
  if (hud.el.cash && player.cash !== hud.lastCash) {
    hud.el.cash.textContent = '$' + player.cash.toLocaleString('en-US');
    hud.lastCash = player.cash;
  }
  if (hud.el.hpFill) {
    hud.el.hpFill.style.width = Math.max(0, player.hp) + '%';
    hud.el.hpFill.style.background = healthColor(player.hp);
  }
  if (hud.el.hpNum) hud.el.hpNum.textContent = Math.ceil(Math.max(0, player.hp));
  if (hud.el.staminaFill && hud.el.staminaWrap) {
    hud.el.staminaWrap.style.opacity = player.onFoot ? '1' : '0';
    hud.el.staminaFill.style.width = Math.max(0, player.stamina) + '%';
    hud.el.staminaFill.style.background = player.sprintLocked ? '#ff5346' : '#39c6ff';
    hud.el.staminaWrap.title = player.sprintLocked
      ? 'Winded — sprint locked until stamina refills'
      : `Sprint stamina ${Math.round(player.stamina)}%`;
  }

  if (hud.el.stars && G.wanted.level !== hud.lastStars) {
    hud.lastStars = G.wanted.level;
    hud.el.stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const star = document.createElement('span');
      star.className = 'star' + (i < G.wanted.level ? ' on' : '');
      star.textContent = '★';
      hud.el.stars.appendChild(star);
    }
  }

  if (hud.el.ammo) {
    hud.el.ammo.textContent = G.combat.reloading
      ? 'RELOADING…'
      : `AMMO ${G.combat.ammo} / ${COMBAT.magSize}`;
  }
  if (hud.el.speed) {
    hud.el.speed.textContent = player.onFoot
      ? player.speedKmh
      : Math.round(Math.abs(player.car ? player.car.speed * 3.6 : 0));
    hud.el.speedLabel.textContent = player.onFoot ? 'KM/H ON FOOT' : 'KM/H';
    // The speedo burns gold while the nitro is lit.
    hud.el.speed.style.color = player.car && player.car.boosting ? '#ffd23a' : '';
  }
  if (hud.el.boostfill && hud.el.boostwrap) {
    const showBoost = MECHANIC.type === 'nitro' && !player.onFoot && player.car;
    hud.el.boostwrap.style.opacity = showBoost ? '1' : '0';
    hud.el.boostfill.style.width = showBoost ? Math.max(0, player.car.boost || 0) + '%' : '0%';
    hud.el.boostfill.style.background = player.car && player.car.boosting ? '#ffd23a' : '';
  }
  if (hud.el.objective) hud.el.objective.textContent = missionObjectiveText(G);

  if (hud.el.loc) {
    const district = districtAt(player.pos.x, player.pos.z);
    if (district !== hud.lastDistrict) {
      hud.lastDistrict = district;
      hud.el.loc.textContent = `EMBERLINE · ${district}`;
    }
  }

  drawMinimap(G);
}
