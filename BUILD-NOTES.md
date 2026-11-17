# SOLMAR BAY — Build notes (for the next run)

## Status (2026-11-18 ~00:40 WIB, run 4 — FINAL BUILD, ready for parent to seal + submit)
Game is **playable end-to-end** and all 4 screenshot scenes render cleanly
(no console errors, no network requests). Dossier builds OK. `makefun check`
passes everything checkable locally (4 passed: competition_open, snapshot,
license_osi, entrypoint; 1 failed: transcripts_present — expected, transcripts
are bundled by the parent at submit; same as runs 1–2).
**ALL 6 MISSIONS NOW VERIFIED LIVE end-to-end** (real keyboard input, Playwright):
- Mission 1: run 1. Mission 2 "Package Run": run 3 — pickup marina (3000,2600)
  with ~53 s left of 90 s, delivery hotel (1800,1000), $500 → $1,700 (+$1,200).
- Mission 3 "Hot Wheels": run 3 — $500 → $2,300 (+$1,800), after the Bug 1 fix.
- Mission 4 "Heat Wave": run 2 — COMPLETE twice, $500 → $2,000 (+$1,500).
- Mission 5 "Loud & Clear": run 4 — COMPLETE live (driver /tmp/test-live-mission5b.js,
  seed 7, ~350 s): drove to warehouse (2600,2200), eliminated all 6 rivals on foot,
  $0 → $2,600 (+$2,600 payout). Player died 3× en route (rivals + police) and
  respawned each time; every respawn reset rivals to 6 (Bug 2 fix verified live 3×).
  Zero console errors.
- Mission 6 "The Big Score": run 2 — COMPLETE twice, $500 → $5,500 (+$5,000).
**Debug hook REMOVED**: `window.__world` is gone from main.js — no debug hook ships
in the final entry (verified: grep finds nothing in game/).
NOT submitted yet — parent handles sealing recording 4 + submit. Do NOT stop/seal
recording 4 (01a1ea94-aeb4-7258-8cdd-50805df6a9fc, node PID 2164) or submit
from this session. Serve run 4 (`node serve.ts`, PID 2452, port 8080) left running.

## What changed in run 3 (bug fixes from the live mission 2/3 playtests)
- **Bug 1 (misi 3, SOFTLOCK):** the target Comet GT could be destroyed before
  being stolen (driver rammed it at ~236 speed; ~4 ticks × 30 damage killed the
  100-HP car), after which the `steal` step could never complete. Fixed in
  `game/src/world.js` (stepMission, `steal` branch): if `state.missionCar` is
  dead/missing, a fresh Comet GT respawns at the casino (step coords). Retest:
  steal succeeded first try. Run 4 added one clarifying comment line to the hunk.
- **Bug 2 (misi 5, SOFTLOCK):** dying during mission 5 left `state.rivals`
  holding the dead rivals, so the spawn branch (only runs when the array is
  empty) never fired and `rivalsLeft` (reset to 6) could never reach zero.
  Fixed in `game/src/world.js` (`startMissionAt`): mission 5 (re)start clears
  `state.rivals = []` and resets `rivalsLeft`. Verified live in run 4: 3 deaths
  → 3 respawns, rivals reset to 6 every time. Run 4 added one clarifying
  comment line to the hunk.
- Test scripts (NOT in repo, /tmp was wiped by a VM restart between run 3 and 4;
  mission 5 driver recovered from the run-3 session log, screenshot script
  rewritten fresh): /tmp/test-live-mission5b.js, /tmp/capture-shots.js.

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
- All 6 missions have now been playtested live end-to-end (runs 1–4).
  The live-test drivers live in /tmp (test-live-mission5b.js, capture-shots.js)
  and are NOT in the repo; they need `window.__world`, which was REMOVED from
  main.js in run 4 — re-add it temporarily to test, then remove it again
  before the final commit.
- The live-test driver is clumsy: it plows through traffic, gets stuck on
  building corners, and swaps cars even when the escape is nearly done. The
  game is completable despite it; a human driver does better.
- The Big Score escape is still long (~60–100 s of evasion with 2–3 car
  swaps). It is winnable, but if the parent wants it tighter, the knobs are
  WANTED.decayPerSecond (now 4) and the 230 bank-job heat in world.js.
- `serve.ts` still says "Block Dodger"? No — check; serve.ts is the kit's, fine.

## Before submit (parent)
1. `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — verify dossier.json.
   (Done in run 4; regenerate if anything changes after this.)
2. All 6 missions verified live (runs 1–4).
3. Commit + push (this run's work is pushed; see `git log`), then seal
   recording 4 (01a1ea94-aeb4-7258-8cdd-50805df6a9fc), write usage rows to
   ~/.makefun/muse-usage-gta6-01.jsonl, submit with --recording
   01a1ea94-aeb4-7258-8cdd-50805df6a9fc. Recordings 1–3 are already sealed —
   do NOT reuse them for this run's changes.
