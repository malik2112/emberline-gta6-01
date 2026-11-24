[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/malik2112/emberline-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/malik2112/emberline-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# EMBERLINE — Open-World Crime at Sunset

A Three.js open-world crime game set in a sunset harbour city. Steal cars, outrun the harbour police, and run five story jobs for Mara and Otto — from a first car theft on Pier 9 to sinking the whole case at the end of the pier.

## Play

Serve the repo and open `game/index.html`:

```sh
node serve.ts 8901
# → http://127.0.0.1:8901/game/index.html
```

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Shift | Run |
| E | Enter / exit vehicle |
| Click | Shoot (on foot) |
| R | Reload |
| Q | Radio station |
| P / Esc | Pause |

## Features

- **Sunset harbour city** — procedural Three.js district: road grid, lit towers with neon, cranes, lighthouse, wooden Pier 9 over the water, low sun + fog.
- **Stealable vehicles** — coupe, sedans, a bike and a van with arcade driving physics; stealing raises your wanted level.
- **Wanted system** — 0–5 stars, heat decays when quiet, officers spawn and chase, busted means a fine and a walk back.
- **5 story missions** — First Light, Harbour Lights, The Long Way Home, Blue Hour, Emberline — with beacon markers, objectives and cash payouts.
- **Living streets** — pedestrians wander the sidewalks and flee gunfire; hit-and-runs count against you.
- **Combat** — hitscan pistol with tracer, muzzle flash, 12-round mag, reload.
- **HUD + minimap** — health, cash, stars, ammo, mission tracker, message feed and a live top-down minimap.
- **Synth audio** — WebAudio gunshots, siren, engine hum and three looping radio stations. No audio assets.
- **Save / load** — progress, cash, health and position persist in localStorage.
- **Self-test** — open `game/index.html?selftest=1` for an in-browser check suite (`window.__selftest`).

## Layout

```
game/
  index.html            page + HUD shell
  src/
    config.js           tuning, palette, missions, keys
    city.js             procedural harbour city
    player.js           on-foot character
    vehicles.js         stealable cars / bike / van
    pedestrians.js      sidewalk walkers
    combat.js           hitscan pistol
    wanted.js           stars, cops, busted
    missions.js         5 story jobs + beacons
    hud.js              HUD, minimap, menu
    audio.js            WebAudio synth (no assets)
    save.js             localStorage persistence
    selftest.js         ?selftest=1 checks
    shots.js            ?shot= staging for captures
    main.js             boot, loop, camera, input
  vendor/three/         vendored Three.js
main.ts                 builds makefun/dossier/v1
serve.ts                static dev server
screenshots/            4 staged captures
```

## Dossier

```sh
MAKEFUN_OUTPUT_DIR=/tmp/emberline-out node main.ts
# → dossier.json (makefun/dossier/v1)
```

Built from scratch in-session for the make.fun `gta6-01` bounty.
