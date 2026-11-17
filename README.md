# PUNK CITY

Multiplayer open-city driving game (Three.js + Node/Socket.IO). `npm install && npm start` → http://localhost:3000

## Controls
| | Keyboard | Touch |
|---|---|---|
| Drive | W/S gas·brake-reverse, A/D steer, SPACE handbrake, SHIFT nitro | left pad = steer, GAS / BRAKE / NOS / HAND buttons |
| On foot (bank, club, tune shop) | WASD move (camera-relative), mouse-drag camera, SHIFT run | left pad = move, drag right side = camera, RUN |
| Interact | E | ACT button (label changes with context) |
| Map / Missions / Pause / Unstuck | M / J / P / R | tap minimap, MAP, MISSIONS, ❚❚ |

## Rules
* Crashes below **30 km/h do no damage**; above that damage scales with impact speed (ARMOR upgrade −40%).
* Buildings, walls, pumps and props are exact-size rigid colliders; the car is a real oriented box (no phasing).
* Inside the bank / club / tune shop the city is hidden and frozen — nothing can hit you, the camera stays in the room.
* 10 story missions (fuel → rampage → shake the cops → garage → delivery → street race → bank heist → lay low → upgrade → ring-road lap) + 4 bonus challenges. First to finish all 10 wins in multiplayer.

## Story
Three characters talk to you through a comm box at the top of the screen: **Razor** (your fixer, phone), **Maya** (mechanic at the garage) and rival gang boss **Viper**. Every mission has an intro and outro line, plus one-off reactive lines (low fuel, car smoking, cops on your tail).
Viper races you in two missions — the street race (mission 6) and the final Ring Road lap (mission 10). He appears when you cross the start line; if he finishes first the run resets and you try again. He also rams, so watch your health. His driver AI is `Core.driveRoute` (unit-tested to lap both courses without hard crashes).

## Multiplayer modes (pick when you create a room, up to 3 players)
* **Story Race** — first to finish all 10 missions.
* **Street Race** — 3-2-1 countdown, 2 laps of an 8-checkpoint loop, live positions, podium. The server accepts checkpoints only in order and only if you were actually near them. Wreck out and you respawn at your last checkpoint (R does the same).
* **Cops vs Robber** — one random player is the robber, the rest drive indestructible police cars. Cops win by staying within 10 units for 5 seconds (bust meter) or wrecking the robber; the robber wins by surviving 150 seconds.
No AI cops, pedestrians or shops in the versus modes. Game rules live in `modes.js` (server-side, unit-tested in `test/modes.test.js`).

## Layout
`public/js/core.js` pure logic (collision, physics, road graph) · `world.js` city · `entities.js` car/human meshes · `interiors.js` rooms · `game.js` loop/input/cops/peds · `missions.js` · `foot.js` on-foot gameplay · `hud.js` HUD & maps · `mp.js` multiplayer.

`npm test` runs physics unit tests and a headless smoke test of the whole game with a stubbed THREE.
