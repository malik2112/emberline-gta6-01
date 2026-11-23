# EMBERLINE — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/malik2112/emberline-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/malik2112/emberline-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for [make.fun's **gta6-01** bounty](https://make.fun/bounty/gta6-01).
Plain static files, no build step, no network: open `game/index.html` in a
desktop browser, or run `node serve.ts` and visit http://localhost:8080.

## The pitch

You are **Kade Venn**, a dockhand who rolled into the harbor town of
**Emberline** owing money to **Mara Kessler**, the fixer who runs the
chop-shop on Quay Row. Five jobs settle the debt: an errand to the crane,
a car to "borrow", a pursuit to shake, a timed crate run, and one last
job under the DOCK 9 gantry. Everything — city, people, cars, story,
music — is original fiction; no part of any commercial game is used.

## What's in the game

- **A whole town, procedurally built**: a 6×6-block grid of window-lit
  towers with crosswalks and streetlights, Kessler's Yard, the DOCK 9
  gantry crane, container stacks along the quay, piers and harbor water.
- **Drive anything**: traffic cruises the road graph and yields to cars
  ahead; walk up to any car and press **E** to take it. The driving model
  is velocity-based — grip pulls travel toward the nose, the handbrake
  breaks it into a slide, and brake lights flare when you slow down.
- **Signature mechanic — NITRO**: hold **Shift** in a car to burn the
  nitro tank for +35% top speed. The tank refills while you coast.
- **Wanted system**: steal, run someone down, or open fire and the stars
  climb. Harbor PD cruisers dispatch to match the level, chase, ram, and
  bust you on foot. Stay quiet and out of sight and the heat cools.
- **Combat**: a 12-round pistol with tracers, muzzle flash, reloads and
  spread that blooms under rapid fire; rival crew who shoot back.
- **People**: walkers stroll the pavements, idle at corners, and sprint
  away from gunfire or a car arriving too fast.
- **HUD**: cash, health, wanted stars, a live minimap with traffic and
  cruiser blips, mission objective, speed, ammo, nitro tank, an in-game
  clock, a district readout, and a synth radio (DOCK FM 101.3) generated
  live with WebAudio.
- **Save**: progress persists in localStorage (v2 records, v1 migrated);
  Continue resumes at the yard.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look around (click to lock) |
| Shift | Sprint / NITRO boost (in car) |
| E | Enter / exit / steal a car |
| Space | Handbrake (in car) |
| F | Horn (in car) |
| Click | Fire pistol |
| R | Reload |
| M | Toggle mission details |
| H | Toggle radio |
| P / Esc | Pause |

## How it's built

- `game/index.html` — the page, HUD and menus
- `game/src/main.js` — boot, fixed-step loop, input, car enter/exit, flows
- `game/src/config.js` — tuning, palette, districts, story text
- `game/src/city.js` — procedural city, collisions, road graph
- `game/src/vehicles.js` — car meshes, drift driving model, traffic + police AI
- `game/src/pedestrians.js` — walkers, fleeing, fallen
- `game/src/player.js` — on-foot movement, head-bob, third-person camera
- `game/src/combat.js` — pistol, tracers, rivals
- `game/src/wanted.js` — wanted level, police dispatch, busted
- `game/src/missions.js` — the five-job story
- `game/src/hud.js` — HUD + live minimap
- `game/src/save.js` — localStorage save/load with migration
- `game/src/audio.js` — synthesised sound + radio (WebAudio, no files)
- `game/src/shots.js` — staged scenes for the screenshots (`?shot=`)
- `game/src/selftest.js` — headless play-through checks (`?selftest=1`)
- `game/vendor/three/three.module.min.js` — three.js (MIT), vendored

## License

MIT — see LICENSE.
