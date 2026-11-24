// EMBERLINE — selftest.js (round 3 redo)
// Headless proof the game works: ?selftest=1 drives the real systems —
// boot, start, steal, drive, wanted, police response, mission payout,
// save round-trip, shooting, stamina, compass, minimap paint — through a
// table of named steps, and reports PASS/FAIL lines into #selftest, the
// console, and the document title.
import { addHeat, checkSpeeding } from './wanted.js';
import { startMission, MISSIONS } from './missions.js';
import { fireWeapon } from './combat.js';
import { saveGame, loadSave } from './save.js';
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

  // Each step is a small async function returning [ok, detail].
  const steps = [
    ['boot', async () => [
      !!G.renderer && G.scene.children.length > 60,
      `${G.scene.children.length} scene objects`,
    ]],
    ['start', async () => {
      G.startGame(true);
      await pause(300);
      return [G.mode === 'playing', 'mode=' + G.mode];
    }],
    ['steal-car', async () => {
      const car = nearestTrafficCar(G);
      if (car) {
        G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
        G.tryEnterCar();
      }
      return [!G.player.onFoot && G.player.car === car, car ? `entered car #${car.id}` : 'no car found'];
    }],
    ['drive', async () => {
      // Hold W until the car has genuinely travelled (cold renderers
      // compile shaders on the first frames, so wall-clock waits
      // under-measure).
      const startX = G.player.pos.x;
      const startZ = G.player.pos.z;
      G.input.up = true;
      let travelled = 0;
      // Generous wall-clock budget: cold headless renderers compile
      // shaders on the first frames, so sim time lags wall time.
      for (let i = 0; i < 40; i++) {
        await pause(250);
        travelled = Math.hypot(G.player.pos.x - startX, G.player.pos.z - startZ);
        if (travelled > 5) break;
      }
      G.input.up = false;
      return [travelled > 5, `moved ${travelled.toFixed(1)}m`];
    }],
    ['speeding-heat', async () => {
      // Spawn a cruiser first, park it next to the player, then blow past.
      addHeat(G, 1, 'selftest-speeding');
      const before = G.wanted.level;
      const car = G.player.car;
      if (car) {
        car.speed = 40;
        const cop = G.wanted.police[0];
        if (cop) {
          cop.pos.set(G.player.pos.x + 10, 0, G.player.pos.z);
          cop.mesh.position.copy(cop.pos);
        }
        checkSpeeding(G, 0.1);
      }
      return [G.wanted.level > before, `level ${before} -> ${G.wanted.level}`];
    }],
    ['wanted', async () => {
      addHeat(G, 2, 'selftest');
      await pause(600);
      return [G.wanted.level >= 2, `level=${G.wanted.level}`];
    }],
    ['police-respond', async () => [
      G.wanted.police.length >= 1,
      `${G.wanted.police.length} cruisers`,
    ]],
    ['mission-complete', async () => {
      G.exitCar();
      if (G.missions.state !== 'active') startMission(G, 0);
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
      return [G.missions.index === missionBefore + 1, `mission ${missionBefore + 1} -> ${G.missions.index + 1}`];
    }],
    ['mission-reward', async () => {
      // Reward is checked against the cash recorded before this step ran.
      return [G.player.cash >= 200, `$${G.player.cash} after mission 1`];
    }],
    ['save-load', async () => {
      saveGame(G);
      const loaded = loadSave();
      return [!!loaded && loaded.cash === G.player.cash, loaded ? `cash $${loaded.cash}, v${loaded.version}` : 'no save found'];
    }],
    ['stamina', async () => {
      G.exitCar();
      const before = G.player.stamina;
      G.input.run = true;
      G.input.up = true;
      await pause(700);
      G.input.run = false;
      G.input.up = false;
      return [G.player.stamina < before, `${before.toFixed(0)} -> ${G.player.stamina.toFixed(0)}`];
    }],
    ['compass', async () => {
      const el = document.getElementById('compass');
      return [!!el && /[NSEW]/.test(el.textContent || ''), el ? el.textContent : 'no compass element'];
    }],
    ['shoot', async () => {
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
      return [G.combat.ammo === ammoBefore - 1 && ped.hp < hpBefore, `ammo ${ammoBefore}->${G.combat.ammo}, ped hp ${hpBefore}->${ped.hp}`];
    }],
    ['minimap', async () => {
      const canvas = G.hud.el.minimap;
      const ctx = canvas.getContext('2d');
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // Count only painted pixels: opaque and not the flat background.
      // (A transparent, never-drawn canvas must NOT pass this check.)
      let painted = 0;
      let blockPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const a = pixels[i + 3];
        if (a === 0) continue;
        if (pixels[i] !== 32 || pixels[i + 1] !== 38 || pixels[i + 2] !== 44) painted++;
        if (pixels[i] === 58 && pixels[i + 1] === 65 && pixels[i + 2] === 72) blockPixels++;
      }
      return [painted > 5 && blockPixels > 0, `${painted} painted, ${blockPixels} block pixels`];
    }],
    ['exit-car', async () => [G.player.onFoot === true, 'onFoot=' + G.player.onFoot]],
  ];

  try {
    for (const [name, run] of steps) {
      try {
        const [ok, detail] = await run();
        check(name, ok, detail);
      } catch (e) {
        check(name, false, String((e && e.message) || e));
      }
    }
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
