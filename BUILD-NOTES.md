# SOLMAR BAY — Build notes (for the next run)

## Status (2026-11-17 ~16:05 WIB)
Game is **playable end-to-end** and all 4 screenshot scenes render cleanly
(no console errors, no network requests). Dossier builds OK (see below).
NOT submitted yet — parent handles sealing + submit. Do NOT stop/seal the
recording (01a1ea1d-0fdf-7120-bae0-d816a9896a63) or submit from this session.

## What is done
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
- Peds can be run over while crossing roads (by design, GTA-like) — that is why
  the play shot shows 1 star. Fine, but could add ped road-crossing caution.
- Traffic cars' corners can still clip a building edge by a few px at 45°.
- No car repair / garage shop, no weapon shop, no radio stations, no day/night.
- No minimap zoom; the minimap road grid is dense but readable.
- Mission 4 (Heat Wave) and 6 (Big Score) have NOT been playtested live end-to-end
  (only missions 1–2 staging verified via shots). Test them with the probe hook:
  `window.__world` is set in shot mode (see /tmp/probe-chase.js pattern).
- `window.__world` debug hook ships in main.js runShot — harmless, keep or remove.
- The live-game test in /tmp/test-solmar.js presses E on foot near spawn and
  shoots once; it does not enter a car live. Worth a live car-enter + mission-1
  completion test before submitting.
- `serve.ts` still says "Block Dodger"? No — check; serve.ts is the kit's, fine.

## Before submit (parent)
1. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — verify dossier.json.
2. Playtest mission 4 and 6 live if time allows; fix anything broken.
3. Commit + push, then seal recording, write usage rows to
   ~/.makefun/muse-usage-gta6-01.jsonl, submit with --recording
   01a1ea1d-0fdf-7120-bae0-d816a9896a63.
