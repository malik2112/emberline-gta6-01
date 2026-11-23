// EMBERLINE — selftest.js (round 3 re-author)
// Headless proof the game works: ?selftest=1 drives the real systems —
// boot, start, steal, drive, wanted, police response, mission payout,
// save round-trip, shooting, minimap paint — and reports PASS/FAIL lines
// into #selftest, the console, and the document title.
import { addHeat } from './wanted.js';
import { startMission } from './missions.js';
import { fireWeapon } from './combat.js';
import { saveGame, loadSave } from './save.js';
import { MISSIONS } from './missions.js';
import { spawnPed } from './pedestrians.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function nearestTrafficCar(G) {
  let best = null;
  let bestDist = Infinity;
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}

export async function runSelfTest(G) {
  const results = [];
  const panel = document.getElementById('selftest');
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`;
    if (panel) {
      const row = document.createElement('div');
      row.textContent = line;
      panel.appendChild(row);
    }
    console.log('[selftest] ' + line);
  };

  try {
    check('boot', !!G.renderer && G.scene.children.length > 60, `${G.scene.children.length} scene objects`);

    G.startGame(true);
    await pause(300);
    check('start', G.mode === 'playing', 'mode=' + G.mode);

    const car = nearestTrafficCar(G);
    if (car) {
      G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
      G.tryEnterCar();
    }
    check('steal-car', !G.player.onFoot && G.player.car === car, car ? `entered car #${car.id}` : 'no car found');

    // Hold W until the car has genuinely travelled (cold renderers compile
    // shaders on the first frames, so wall-clock waits under-measure).
    const startX = G.player.pos.x;
    const startZ = G.player.pos.z;
    G.input.up = true;
    let travelled = 0;
    for (let i = 0; i < 24; i++) {
      await pause(250);
      travelled = Math.hypot(G.player.pos.x - startX, G.player.pos.z - startZ);
      if (travelled > 5) break;
    }
    G.input.up = false;
    check('drive', travelled > 5, `moved ${travelled.toFixed(1)}m`);

    addHeat(G, 2, 'selftest');
    await pause(600);
    check('wanted', G.wanted.level >= 2, `level=${G.wanted.level}`);
    check('police-respond', G.wanted.police.length >= 1, `${G.wanted.police.length} cruisers`);

    // Mission 1 completes in a car at the drop-off point.
    G.exitCar();
    if (G.missions.state !== 'active') startMission(G, 0);
    const cashBefore = G.player.cash;
    const missionBefore = G.missions.index;
    const car2 = nearestTrafficCar(G);
    if (car2) {
      G.player.pos.set(car2.pos.x + 2, 0, car2.pos.z);
      G.tryEnterCar();
      car2.pos.set(MISSIONS[0].target.x, 0, MISSIONS[0].target.z);
      car2.mesh.position.copy(car2.pos);
      G.player.pos.copy(car2.pos);
    }
    await pause(400);
    check('mission-complete', G.missions.index === missionBefore + 1, `mission ${missionBefore + 1} -> ${G.missions.index + 1}`);
    check('mission-reward', G.player.cash >= cashBefore + MISSIONS[0].reward, `$${cashBefore} -> $${G.player.cash}`);

    saveGame(G);
    const loaded = loadSave();
    check('save-load', !!loaded && loaded.cash === G.player.cash, loaded ? `cash $${loaded.cash}` : 'no save found');

    G.exitCar();
    const ped = spawnPed(G.scene, G.player.pos.x + 6, G.player.pos.z, Math.random);
    ped.hp = 50;
    G.peds.push(ped);
    G.camera.position.set(G.player.pos.x, 1.7, G.player.pos.z);
    G.camera.lookAt(ped.pos.x, 1.2, ped.pos.z);
    const ammoBefore = G.combat.ammo;
    const hpBefore = ped.hp;
    fireWeapon(G, [ped]);
    await pause(120);
    check('shoot', G.combat.ammo === ammoBefore - 1 && ped.hp < hpBefore, `ammo ${ammoBefore}->${G.combat.ammo}, ped hp ${hpBefore}->${ped.hp}`);

    const canvas = G.hud.el.minimap;
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonBackground = 0;
    for (let i = 0; i < pixels.length; i += 400) {
      if (pixels[i] !== 32 || pixels[i + 1] !== 38 || pixels[i + 2] !== 44) nonBackground++;
    }
    check('minimap', nonBackground > 5, `${nonBackground} non-background samples`);
    check('exit-car', G.player.onFoot === true, 'onFoot=' + G.player.onFoot);
  } catch (e) {
    check('exception', false, String((e && e.message) || e));
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const verdict = passed === total ? 'PASS' : 'FAIL';
  document.title = `SELFTEST: ${passed}/${total} ${verdict}`;
  window.__selftestDone = true;
  window.__selftestResults = results;
  if (panel) {
    const summary = document.createElement('div');
    summary.textContent = `SELFTEST: ${passed}/${total} ${verdict}`;
    summary.style.fontWeight = 'bold';
    panel.appendChild(summary);
  }
}
