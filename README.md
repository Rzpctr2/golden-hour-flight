# GOLDEN HOUR FLIGHT

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Rzpctr2/flight-game-golden-hour/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Rzpctr2/flight-game-golden-hour/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A prop-plane chase-view flight game that runs offline in a desktop browser. Fly a little prop plane through glowing target rings over terraced rice fields and a smoking volcano at golden hour — in Gibran's own TSULACE palette of toasted brown, cream, dusty teal and soft terracotta. Clear all three levels — Senja, Jingga, Malam — before the fuel runs out. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

**What makes it different:** a **pseudo-3D chase view** drawn entirely in code — the terraces scroll under you in perspective, the volcano sits on the horizon with a curling smoke plume, and the sun hangs low and huge. The **wind is a real opponent**: gusts push you sideways and the HUD's wind arrow tells you which way, so every ring approach is a small crosswind landing. Rings must be flown **in order**, stars and fuel orbs hide between them, and the night level turns the valley dark — the rings glow amber and fireflies replace the daylight.

**Visual polish:** three golden-hour palettes (dusk, orange, night) with distance haze, parallax clouds, hillside huts and trees, a banking prop plane with a spinning propeller and lit cockpit glass, ring-pass bursts, boost speed-lines, and a full instrument HUD — altitude, speed, heading with a compass tape, fuel bar, wind, next-ring beacon and an attitude indicator. All sound is synthesized with the Web Audio API: engine hum that follows speed, ring chimes, boost whoosh.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server). No network, no build step.

- **↑ / ↓ or W / S** — climb / descend · **← / → or A / D** — bank and turn
- **Shift** — boost · **Space** — brake · **P** — pause · **M** — mute · **R** — restart
- **Mouse** — click the on-screen buttons (start, restart, sound)
- Fly through the glowing rings **in order** — each one is +100. Stars are +25, green orbs refill fuel.
- Don't hit the valley floor or the cliff walls, and don't run out of fuel.
- Clear all rings in a level to advance: Senja (8 rings) → Jingga (10) → Malam (12).

## How it is built

Plain HTML + canvas + ES modules, no libraries, no assets: all art is drawn in code and all sound is synthesized. Source is split by job — `config.js` (tuning, palettes, levels), `random.js` (seeded PRNG), `input.js` (keyboard/mouse), `world.js` (flight physics, rings, stars, wind, levels), `render.js` (pseudo-3D chase view, plane, HUD, screens), `audio.js` (synth SFX + engine), `shots.js` (deterministic screenshot scenes), `main.js` (loop + state machine).

**Deterministic runs:** every ring, star, hill and gust comes from a seeded PRNG (mulberry32, default seed 7) — no `Math.random()` in any gameplay path, and restarting replays the exact same flight. Open with `?seed=N` for a different flight. `?shot=start|play|peak|end` stages a screenshot scene: an autopilot flies the real rules forward, so each screenshot is a frame a real game produces.

## Run it

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Hand it in (outside the grader): `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
