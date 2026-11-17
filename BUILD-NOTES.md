# SOLMAR BAY — Build notes (for the next run)

## Status (2026-11-17 ~23:50 WIB, run 2)
Game is **playable end-to-end** and all 4 screenshot scenes render cleanly
(no console errors, no network requests). Dossier builds OK. `makefun check`
passes (4 passed, 0 failed; transcript checks are server-side at submit).
**Live playtests verified in run 2** (real keyboard input, Playwright):
- Mission 4 "Heat Wave": COMPLETE live twice — drive the road grid until the
  3-star heat fades, $500 → $2,000 (+$1,500). ~60 s after the decay retune.
- Mission 6 "The Big Score": COMPLETE live twice — bank pickup (150 s timer),
  4-star escape, safehouse, $500 → $5,500 (+$5,000). Once driving in, once
  finishing on foot after the car died at the safehouse door.
- Mission 1 completed live in run 1. Missions 2, 3, 5 staged/verified via shots
  only — not yet played live end-to-end.
**Debug hook REMOVED**: `window.__world` is gone from main.js (both runShot
and runGame) — no debug hook ships in the final entry.
NOT submitted yet — parent handles sealing + submit. Do NOT stop/seal
recording 2 (01a1ea3c-453e-778a-801f-b7979dc4ee30, node PID 5354) or submit
from this session.

## What changed in run 2 (bug fixes from the live mission 4/6 playtests)
- **Traffic cars drove off the world** (`vehicles.js`): stepTraffic never
  clamped positions, so a traffic car could end up at x=4026 (outside the
  3200 world), unreachable — the nearest-car search then sent the player
  walking into the void. Fixed: clamp to the world + U-turn at the edges.
- **Peds strolled into speeding cars** (`peds.js`, `world.js`): the "danger"
  passed to peds was only gunfire, so peds kept crossing roads in front of a
  560-speed car; each run-over is +45 heat, which stacked the Big Score to
  5 stars. Fixed: a fast car (>200 speed) is danger too; peds on a road run
  perpendicular to the nearest sidewalk, peds off-road dodge sideways out of
  the car's path (needs the car's heading). A `carFlee` timer holds the
  escape target so the retarget logic cannot replace it mid-flight.
- **Bank-job heat stacked past the brief** (`world.js`): the pickup added 200
  heat on top of whatever the player had (up to 5 stars). Fixed: the pickup
  now SETS heat to 230 — solidly inside the four-star band (200–319), so the
  player actually faces the promised four-star response.
- **Escapes were unwinnable** (`world.js`, `config.js`, `city.js`): police are
  faster than the player (605 vs 560) and 4–5 units converge, so "seen" was
  the permanent state and heat decayed at 2.2/s — the Big Score escape
  stretched past 5 minutes live. Fixed: (a) "seen" now needs a clear line of
  sight (`city.hasLineOfSight`, segment-vs-buildings slab test) — weaving
  through blocks really breaks the heat; (b) seen decay 2.2 → 4/s.
  Mission 6 escape is now ~60–100 s of active evasion.
- **Police rams shredded cars** (`world.js`): ram damage to the player's car
  2 → 1 per ram (police car wear stays −6), so one car lasts a whole escape leg.
- **Stale traffic** (`world.js`): traffic cars more than 1500 px from the
  player are retired so fresh cars keep spawning near the player.
- Test scripts (NOT in repo): /tmp/test-live-mission4.js,
  /tmp/test-live-mission6.js (real-keyboard drivers with Manhattan nav),
  /tmp/test-los.mjs (line-of-sight geometry check: 4/4 correct).
- City: 3200×3200 seeded grid (8×8 roads), buildings, parks, beach + ocean,
  named places, prerendered static layer. `game/src/city.js`
- Player on foot (WASD, Shift sprint, mouse aim, click shoot) + car entry/exit (E).
- Driving: arcade physics, handbrake, building collision, ramming, wrecks, smoke.
- Traffic AI follows the road grid, slows for cars ahead and in turns; peds walk
  sidewalks, flee gunfire; parked cars to steal (never on buildings).
- Wanted 0–5 stars from heat; police cars (ram, 1s cooldown, 605 speed) + foot
  cops (shoot, bust timer). Heat decays faster when unseen.
- 6 missions (Mara Voss / Big Lou): goto, pickup+timer, steal Comet GT, lose heat,
  eliminate 6 rivals, bank job + escape. Payouts $800–$5,000. J starts next job.
- Combat: pistol, enemy bullets, rivals shoot back, health/ammo pickups.
- HUD: health/money/ammo, stars, minimap (roads, player, objective, police,
  mission car), objective banner + timer, message banner, speed + car health,
  controls hint, off-screen objective arrow.
- Screens: title (menu incl. Continue), help, pause (auto-save), game over
  (BUSTED / FLATLINED) with respawn at safehouse −$150.
- Audio: WebAudio synth — engine, siren, gunshots, crash, pickup, mission
  jingle, synthwave bassline loop. M mutes.
- Save: localStorage `solmarbay-save-v1` (money, missions done, pos, health,
  ammo, kills, cars stolen). Auto-save on mission complete + pause + every 30 s.
- Shots: `?shot=start|play|chase|mission&seed=1`, deterministic autopilot that
  follows roads (Manhattan nav). 4 JPEGs in screenshots/ (~81–86 KiB each).
- README.md, LICENSE MIT (SPDX line present), .makefun/owner.json committed.
- Test scripts (NOT in repo): /tmp/test-solmar.js, /tmp/capture-shots.js,
  /tmp/probe-chase.js. Server: `node serve.ts` (port 8080).
- Last pushed commit: check `git log` (core game + fixes).

## Known gaps / polish ideas for the next run
- Traffic cars' corners can still clip a building edge by a few px at 45°.
- No car repair / garage shop, no weapon shop, no radio stations, no day/night.
- No minimap zoom; the minimap road grid is dense but readable.
- Missions 2, 3, 5 have NOT been playtested live end-to-end (only staged via
  shots; mission 1 completed live in run 1, missions 4 and 6 in run 2).
  Worth a live run if time allows before submit — the test drivers in /tmp
  (test-live-mission4/6.js) show the pattern, but they need `window.__world`,
  which was REMOVED from main.js in run 2; re-add it temporarily to test,
  then remove it again before the final commit.
- The live-test driver is clumsy: it plows through traffic, gets stuck on
  building corners, and swaps cars even when the escape is nearly done. The
  game is completable despite it; a human driver does better.
- The Big Score escape is still long (~60–100 s of evasion with 2–3 car
  swaps). It is winnable, but if the parent wants it tighter, the knobs are
  WANTED.decayPerSecond (now 4) and the 230 bank-job heat in world.js.
- `serve.ts` still says "Block Dodger"? No — check; serve.ts is the kit's, fine.

## Before submit (parent)
1. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — verify dossier.json.
   (Done in run 2; regenerate if anything changes after this.)
2. Missions 4 and 6 verified live in run 2; missions 2, 3, 5 live if time allows.
3. Commit + push (this run's work is pushed; see `git log`), then seal
   recording 2 (01a1ea3c-453e-778a-801f-b7979dc4ee30), write usage rows to
   ~/.makefun/muse-usage-gta6-01.jsonl, submit with --recording
   01a1ea3c-453e-778a-801f-b7979dc4ee30. Recording 1
   (01a1ea1d-0fdf-7120-bae0-d816a9896a63) is already sealed — do NOT reuse it
   for this run's changes.
