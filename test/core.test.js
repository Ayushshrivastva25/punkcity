const Core = require('../public/js/core.js');
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('  FAIL: ' + m); } else console.log('  ok:   ' + m); }

// ---- build a city like the game does
function city() {
  const cols = [];
  for (let bx = -5; bx <= 5; bx++) for (let bz = -5; bz <= 5; bz++) {
    if (!bx || !bz) continue;
    cols.push(Core.box(bx * 60, bz * 60, 14, 14, 'building'));
  }
  const H = Core.CITY_HALF;
  cols.push(Core.box(0, -H, H + 3, 1.5), Core.box(0, H, H + 3, 1.5), Core.box(-H, 0, 1.5, H + 3), Core.box(H, 0, 1.5, H + 3));
  return cols;
}
const cols = city();
const P = Core.defaultParams();
const noInp = { throttle: 0, brake: 0, steer: 0, hand: false, nitro: false };

console.log('1) Tunnelling: drive full speed at a building, at several frame rates');
for (const fps of [15, 20, 30, 60, 144]) {
  const car = Core.makeCar(0, 0, Math.PI / 2);        // heading +x along avenue z=0 → hits block (60,60)? no: avenue is open
  // aim at building column x=60 via street z=90 (between rows)? use a direct shot: start at (-30,60) heading +x into block (60,60)
  car.x = -30; car.z = 60; car.a = Math.PI / 2;
  let maxPen = 0, hits = 0, maxImpact = 0;
  const hooks = { onImpact: (i) => { hits++; maxImpact = Math.max(maxImpact, i); } };
  for (let t = 0; t < 10; t += 1 / fps) {
    Core.stepCar(car, { throttle: 1, brake: 0, steer: 0, hand: false, nitro: true }, P, Math.min(1 / fps, 0.05), cols, hooks);
    for (const b of cols) {
      const m = Core.obbAabb(car.x, car.z, car.a, Core.CAR_HW, Core.CAR_HL, b);
      if (m) maxPen = Math.max(maxPen, m.depth);
    }
  }
  ok(maxPen < 0.05 && hits > 0, `fps ${fps}: max penetration ${maxPen.toFixed(3)} (hits ${hits}, impact ${(maxImpact * 2).toFixed(0)} km/h)`);
}

console.log('2) Damage rule: nothing under 30 km/h');
ok(Core.crashDamage(14.9) === 0, '29.8 km/h → 0 damage');
ok(Core.crashDamage(15) === 0, '30 km/h → 0 damage');
ok(Core.crashDamage(25) > 0 && Core.crashDamage(25) < 10, '50 km/h → small damage ' + Core.crashDamage(25).toFixed(1));
ok(Core.crashDamage(60) <= 45, '120 km/h capped ' + Core.crashDamage(60).toFixed(1));
// low-speed bump into a wall
{
  const car = Core.makeCar(-30, 60, Math.PI / 2); car.vx = 12; // 24 km/h
  let dmg = 0;
  for (let i = 0; i < 120; i++) Core.stepCar(car, noInp, P, 1 / 60, cols, { onImpact: (im) => { dmg += Core.crashDamage(im); } });
  ok(dmg === 0, 'rolling into a wall at 24 km/h: damage ' + dmg);
}

console.log('3) Walls are exactly their visual size (no phantom padding)');
{
  // car parked beside a building (x=60±14 → edge at 46). Car half width 1.85 → centre can reach x=44.15
  const car = Core.makeCar(43, 60, 0); car.a = 0;      // facing +z, side toward +x
  car.vx = 8;
  for (let i = 0; i < 240; i++) Core.stepCar(car, noInp, P, 1 / 60, cols, null);
  ok(car.x <= 46 - 1.85 + 1e-6 && car.x > 46 - 1.85 - 0.6, `car side stops at wall (x=${car.x.toFixed(2)}, expected ${(46 - 1.85).toFixed(2)})`);
}

console.log('4) Frame-rate independence of handling');
{
  const run = (fps) => {
    const car = Core.makeCar(0, -300, 0);
    for (let i = 0; i < 4 * fps; i++) Core.stepCar(car, { throttle: 1, brake: 0, steer: i >= 2 * fps ? 1 : 0, hand: false, nitro: false }, P, 1 / fps, [], null);
    return car;
  };
  const a = run(30), b = run(144);
  console.log('     30fps → x=%s z=%s a=%s | 144fps → x=%s z=%s a=%s', a.x.toFixed(1), a.z.toFixed(1), a.a.toFixed(2), b.x.toFixed(1), b.z.toFixed(1), b.a.toFixed(2));
  ok(Math.hypot(a.x - b.x, a.z - b.z) < 2.5 && Math.abs(a.a - b.a) < 0.05, 'trajectories match across frame rates');
}

console.log('5) Handling feel');
{
  const car = Core.makeCar(0, 0, 0);
  const inp = { throttle: 1, brake: 0, steer: 0, hand: false, nitro: false };
  let t30 = 0, t100 = 0, t = 0;
  while (t < 20) { Core.stepCar(car, inp, P, 1 / 60, [], null); t += 1 / 60; const k = Math.hypot(car.vx, car.vz) * 2; if (!t30 && k >= 30) t30 = t; if (!t100 && k >= 100) t100 = t; }
  console.log('     0-30 km/h %ss, 0-100 km/h %ss, top %s km/h', t30.toFixed(2), t100.toFixed(2), (Math.hypot(car.vx, car.vz) * 2).toFixed(0));
  ok(t30 > 0.4 && t30 < 1.2 && t100 > 2.5 && t100 < 7, 'sensible acceleration');
  // turning radius at 40 km/h
  const c2 = Core.makeCar(0, 0, 0); c2.vz = 20; c2.vf = 20;
  for (let i = 0; i < 180; i++) Core.stepCar(c2, { throttle: 0.4, brake: 0, steer: 1, hand: false, nitro: false }, P, 1 / 60, [], null);
  console.log('     after 3s full-left at ~40km/h: heading %s rad, speed %s km/h', c2.a.toFixed(2), (Math.hypot(c2.vx, c2.vz) * 2).toFixed(0));
  ok(c2.a > 1.2, 'turns decisively at moderate speed');
  // can a car take a 90° corner of a 16-wide street from 70 km/h (35 u/s)?  ~radius check
  const c3 = Core.makeCar(0, 0, 0); c3.vz = 35;
  let minX = 0; for (let i = 0; i < 120; i++) { Core.stepCar(c3, { throttle: 0, brake: 0, steer: 1, hand: false, nitro: false }, P, 1 / 60, [], null); }
  console.log('     70km/h corner: heading after 2s = %s rad', c3.a.toFixed(2));
  // steering returns to centre / car goes straight
  const c4 = Core.makeCar(0, 0, 0); c4.vz = 30;
  for (let i = 0; i < 120; i++) Core.stepCar(c4, { throttle: 0.3, brake: 0, steer: 0, hand: false, nitro: false }, P, 1 / 60, [], null);
  ok(Math.abs(c4.a) < 1e-6 && Math.abs(c4.x) < 1e-6, 'no steer input → perfectly straight');
  // reverse
  const c5 = Core.makeCar(0, 0, 0);
  for (let i = 0; i < 180; i++) Core.stepCar(c5, { throttle: 0, brake: 1, steer: 0, hand: false, nitro: false }, P, 1 / 60, [], null);
  ok(c5.vf < -10, 'holding brake from standstill reverses (vf=' + c5.vf.toFixed(1) + ')');
}

console.log('6) Car vs car');
{
  const A = Core.makeCar(0, 0, 0), B = Core.makeCar(0, 7.5, Math.PI); A.vz = 20;
  let relImpact = 0;
  for (let i = 0; i < 20; i++) { A.z += A.vz / 60; B.z += B.vz / 60; relImpact = Math.max(relImpact, Core.collideCars(A, B, 1, 1)); }
  const m = Core.obbObb(A.x, A.z, A.a, 1.85, 4.2, B.x, B.z, B.a, 1.85, 4.2);
  ok(!m, 'cars separated after collision'); ok(relImpact > 15, 'reported relative impact ' + (relImpact * 2).toFixed(0) + ' km/h');
}

console.log('7) Road graph / pathing');
{
  const p = Core.findPath(-330, -330, 330, 330);
  ok(p.length === 20, 'path across city has ' + p.length + ' nodes');
  ok(p.every(n => Core.ROAD_LINES.includes(n.x) && Core.ROAD_LINES.includes(n.z)), 'all nodes on roads');
  // every road node is clear of colliders
  let bad = 0; for (const x of Core.ROAD_LINES) for (const z of Core.ROAD_LINES) if (Core.pointBlocked(x, z, cols, Core.CAR_HL)) bad++;
  ok(bad === 0, 'all 121 intersections are drivable even with car length margin (bad=' + bad + ')');
  // street gap: a car can fit between blocks (16 wide)
  const car = Core.makeCar(90, -300, 0);
  car.vz = 40; let pen = 0;
  for (let i = 0; i < 400; i++) { Core.stepCar(car, { throttle: 0.6, brake: 0, steer: 0, hand: false, nitro: false }, P, 1 / 60, cols, null); }
  ok(Math.abs(car.x - 90) < 0.5 && car.z > 0, 'drives straight down a 16-wide street without touching walls (z=' + car.z.toFixed(0) + ')');
}

console.log('8) On-foot circle collision & camera arm');
{
  const room = [Core.box(0, 0, 3, 3, 'desk')];
  let p = { x: -6, z: 0 };
  for (let i = 0; i < 60; i++) p = Core.moveCircle(p.x, p.z, 0.45, 0.2, 0, room);
  ok(p.x <= -3.45 + 1e-6 && p.x > -3.6, 'player stops at desk edge (x=' + p.x.toFixed(2) + ')');
  const t = Core.armT(0, 0, 20, 0, [Core.box(10, 0, 1, 5)], 0.8);
  ok(t < 0.5, 'camera arm shortened by wall (t=' + t.toFixed(2) + ')');
  const tr = Core.clampInRoom(0, 5, 0, 20, { minx: -13, maxx: 13, minz: -13, maxz: 13 }, 0.7);
  ok(5 + 15 * tr <= 12.3 + 1e-6, 'camera stays inside room (z=' + (5 + 15 * tr).toFixed(2) + ')');
}

console.log('9) Rival AI laps (real city colliders)');
{
  const RACE = [{ x: -210, z: -210 }, { x: 210, z: -210 }, { x: 210, z: 210 }, { x: -210, z: 210 }, { x: -210, z: -210 }];
  const RING = [{ x: 0, z: -330 }, { x: 330, z: -330 }, { x: 330, z: 0 }, { x: 330, z: 330 }, { x: 0, z: 330 }, { x: -330, z: 330 }, { x: -330, z: 0 }, { x: -330, z: -330 }, { x: 0, z: -330 }];
  for (const [name, cps, top, limit] of [['race loop', RACE, 52, 60], ['ring road', RING, 54, 90]]) {
    const p0 = cps[0], a = Math.atan2(cps[1].x - p0.x, cps[1].z - p0.z);
    const car = Core.makeCar(p0.x, p0.z, a), rt = { cps, idx: 1, finished: false, brain: {} };
    const RP = Core.defaultParams(); RP.top = top; RP.acc = 22; RP.nitroTopMul = 1;
    let t = 0, hits = 0, big = 0; const hooks = { onImpact: (i) => { hits++; if (i * 2 > 30) big++; } };
    while (t < 140 && !rt.finished) { Core.stepCar(car, Core.driveRoute(car, rt, top, 1 / 60), RP, 1 / 60, cols, hooks); t += 1 / 60; }
    console.log('     ' + name + ': finished=' + rt.finished + ' time=' + t.toFixed(1) + 's wallHits=' + hits + ' hardHits(>30km/h)=' + big);
    ok(rt.finished && t < limit && big === 0, name + ' completed in under ' + limit + 's with no hard crashes');
  }
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
