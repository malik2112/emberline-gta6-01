// EMBERLINE selftest — ?selftest=1 runs headless checks in the browser.
import { MISSIONS } from './config.js';

export async function runSelftest(game) {
  const results = [];
  const check = (name, fn) => {
    try {
      const ok = fn();
      results.push({ name, ok: !!ok });
    } catch (e) {
      results.push({ name, ok: false, error: String(e?.message ?? e) });
    }
  };

  check('three loaded', () => !!game.THREE);
  check('renderer created', () => !!game.renderer);
  check('scene has children', () => game.scene.children.length > 20);
  check('player exists', () => !!game.player && game.player.health > 0);
  check('vehicles spawned', () => game.vehicles.list.length >= 6);
  check('pedestrians spawned', () => game.peds.list.length >= 8);
  check('5 missions defined', () => MISSIONS.length === 5);
  check('mission manager ready', () => !!game.missions.current);
  check('hud ready', () => !!game.hud && !!game.hud.mapCtx);
  check('combat ready', () => game.combat.ammo > 0);
  check('wanted starts at 0', () => game.wanted.level === 0);
  check('save round-trip', () => {
    game.saveNow();
    return true;
  });
  check('player moves', () => {
    const z0 = game.player.z;
    game.player.update(0.5, { f: true, b: false, l: false, r: false, run: false }, 0);
    const moved = Math.abs(game.player.z - z0);
    game.player.setPos(-20, 30, 0);
    return moved > 1;
  });
  check('wanted rises on crime', () => {
    game.wanted.add(1, 'test');
    const lvl = game.wanted.level;
    game.wanted.setStars(0);
    game.wanted.clearCops();
    return lvl === 1;
  });
  check('mission advances on goto', () => {
    const t = game.missions.stepTarget();
    return t !== null || game.missions.currentStep.kind === 'evade';
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const summary = { total: results.length, passed, failed: failed.map((f) => f.name), results };
  window.__selftest = summary;

  const box = document.createElement('pre');
  box.id = 'selftest';
  box.textContent = `SELFTEST ${passed}/${results.length} passed\n` + results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.error ? ` — ${r.error}` : ''}`).join('\n');
  box.style.cssText = 'position:fixed;left:12px;top:12px;z-index:99;background:#111;color:#0f0;padding:12px;font:13px monospace;max-width:60vw;white-space:pre-wrap';
  document.body.appendChild(box);
  window.__shotReady = true;
  return summary;
}
