// EMBERLINE staged shots — ?shot=<name> poses a deterministic scene,
// then sets window.__shotReady so the capture driver can screenshot.
import { PLACES } from './missions.js';

const SHOTS = {
  // Player driving the orange coupe down a city road at sunset.
  drive: (game) => {
    const coupe = game.vehicles.list.find((v) => v.label === 'coupe');
    coupe.group.position.set(-60, 0, 2);
    coupe.heading = Math.PI / 2;
    coupe.group.rotation.y = coupe.heading;
    game.enterVehicle(coupe);
    coupe.speed = 8;
    game.camMode = 'chase';
    game.snapCamera();
    game.hud.hideMenu();
    game.state = 'playing';
  },
  // On foot on a busy street, pedestrians and neon around.
  street: (game) => {
    game.player.setPos(-24, -30, -2.2);
    game.player.health = 82;
    game.wanted.add(2, 'staged');
    // Pull three pedestrians into frame near the player.
    game.peds.list.slice(0, 3).forEach((p, i) => {
      p.group.position.set(-30 + i * 5, 0, -38 + i * 3);
    });
    game.camMode = 'third';
    game.snapCamera();
    game.hud.hideMenu();
    game.state = 'playing';
  },
  // Mission marker active: the garage delivery on Crane Street.
  mission: (game) => {
    game.missions.index = 0;
    game.missions.step = 1;
    game.missions._showStep();
    const coupe = game.vehicles.list.find((v) => v.label === 'coupe');
    coupe.group.position.set(2, 0, -20);
    coupe.heading = Math.PI;
    coupe.group.rotation.y = coupe.heading;
    game.enterVehicle(coupe);
    coupe.speed = 6;
    game.camMode = 'chase';
    game.snapCamera();
    game.hud.hideMenu();
    game.state = 'playing';
  },
  // Start menu over the city.
  start: (game) => {
    game.state = 'menu';
    game.hud.showMenu('EMBERLINE', 'Open-world crime at sunset — steal, drive, survive the harbour.', '▶  START ENGINE');
    game.camMode = 'orbit';
  },
};

export function applyShot(game) {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name || !SHOTS[name]) return false;
  try {
    SHOTS[name](game);
  } catch (e) {
    console.error('shot staging failed', e);
    return false;
  }
  // Let the scene settle (camera lerp, car roll, beacon pulse), then signal.
  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames >= 30) {
      window.__emberlineShot = name;
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
}

export function shotNames() { return Object.keys(SHOTS); }
