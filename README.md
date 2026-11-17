# SOLMAR BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Maranatha99/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Maranatha99/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game, built for the [gta6-01](https://make.fun/bounty/gta6-01) bounty on [make.fun](https://make.fun/?ref=s11m3687).

You are **Jax Mercer**, a getaway driver trying to go straight in the sun-soaked
coastal city of **Solmar Bay** — and failing, one job at a time. Steal cars, outrun
the Solmar Bay PD, run jobs for fixer Mara Voss and chop-shop king Big Lou, and
build your name from First Gear to the Big Score.

## The game

- **A city to explore** — 3.2 km of streets, parks, the marina, the casino strip
  and Solmar Beach, on foot or behind the wheel.
- **Traffic and pedestrians** — cars drive the road grid, stop for each other and
  turn at intersections; pedestrians stroll the sidewalks and run from gunfire.
- **Cars to steal and drive** — any parked or traffic car is yours. Arcade
  handling with handbrake drifts, ramming, wrecks and smoke.
- **Wanted level** — 1 to 5 stars. Stealing, shooting and running people over
  raise the heat; patrol cars ram you, foot cops shoot and try to bust you.
  Break line of sight and lay low to cool off.
- **Missions and a story** — six jobs with briefings, timers, a target car to
  steal, a warehouse shootout, a heat-escape and a bank job, paying up to $5,000.
- **Combat** — mouse-aimed pistol, armed rivals who shoot back, health and ammo
  pickups around the city.
- **HUD and minimap** — health, cash, ammo, wanted stars, speed, a live minimap
  with the objective, police and mission-car blips, and an off-screen arrow.
- **Start screen, pause and save** — continue your game from the browser, or
  start a new life. Progress, cash and completed jobs are kept in localStorage.
- **Sound** — synthesised WebAudio: engine hum, sirens, gunshots, a mission
  jingle and a looping synthwave bassline. No audio files, no network.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Mouse | Aim (on foot) |
| Click | Shoot |
| E | Enter / exit a car |
| Shift | Sprint on foot |
| Space | Handbrake |
| J | Start the next job |
| P / Esc | Pause (auto-saves) |
| M | Mute |

On foot, walk up to any car and press **E** to take it. Follow the yellow marker
for the active job; the timer at the top shows how long you have left. When the
stars are lit, the PD is coming — lose them before they bust you.

## Run it locally

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome and play. The game is plain
static files under `game/` — no build step, no network requests, no dependencies.

Deterministic screenshots: `?shot=start|play|chase|mission&seed=1` stages a scene
from the real game (see `shots.json`).

## Credits

A wholly original game: its city, characters, vehicles, names, story, art and
sounds were made for this entry. No real city, person, brand or commercial game
appears in it. Built with plain canvas 2D and WebAudio — no engine, no assets.

<sub>Entered on [make.fun](https://make.fun/?ref=s11m3687&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
