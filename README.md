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

## Layout
`public/js/core.js` pure logic (collision, physics, road graph) · `world.js` city · `entities.js` car/human meshes · `interiors.js` rooms · `game.js` loop/input/cops/peds · `missions.js` · `foot.js` on-foot gameplay · `hud.js` HUD & maps · `mp.js` multiplayer.

`npm test` runs physics unit tests and a headless smoke test of the whole game with a stubbed THREE.
