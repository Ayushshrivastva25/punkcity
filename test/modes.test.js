const M = require('../modes');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL: ' + m); } else console.log('  ok:   ' + m); };
console.log('race');
{
  const r = M.newRace(['a', 'b', 'c']); const cps = M.RACE_CPS;
  ok(M.raceHit(r, 'a', 1, cps[1], 0).why === 'inactive', 'hits before the start are ignored');
  r.startedAt = 1000;
  ok(M.raceHit(r, 'a', 2, cps[2], 2000).why === 'order', 'skipping a checkpoint is rejected');
  ok(M.raceHit(r, 'a', 1, { x: 300, z: 300 }, 2000).why === 'far', 'claiming a checkpoint from far away is rejected');
  ok(M.raceHit(r, 'a', 1, cps[1], 2000).ok, 'next checkpoint accepted');
  let t = 3000; for (let k = 2; k <= 8; k++) { M.raceHit(r, 'a', k % 8, cps[k % 8], t); t += 1000; }
  ok(r.st.a.c === 8, 'lap 1 complete after 8 checkpoints');
  const s = M.raceStandings(r, t); ok(s[0].id === 'a' && s[0].lap === 2 && s[0].pos === 1, 'leader is in lap 2, position 1');
  for (let k = 9; k <= 16; k++) { M.raceHit(r, 'a', k % 8, cps[k % 8], t); t += 1000; }
  ok(r.st.a.finishedAt !== null && r.order[0] === 'a', 'finishes after 2 laps with a recorded time');
  ok(!M.raceHit(r, 'a', 1, cps[1], t).ok, 'no hits after finishing');
  ok(!M.raceCheckEnd(r, t), 'race continues while others are still racing');
  ok(M.raceCheckEnd(r, r.startedAt + r.st.a.finishedAt + 46000), 'race ends 45s after the first finisher');
  const g = M.raceStarts(3); ok(g.length === 3 && new Set(g.map(p => p.x + ',' + p.z)).size === 3, 'grid slots are distinct');
}
console.log('chase');
{
  const ch = M.newChase('r', ['c1', 'c2']);
  const far = { r: { x: 0, z: 0 }, c1: { x: 100, z: 0 }, c2: { x: -100, z: 0 } };
  for (let i = 0; i < 100; i++) M.chaseTick(ch, far, 0.25);
  ok(!ch.over && Math.abs(ch.t - 125) < 0.01 && ch.bust === 0, 'timer runs, no bust when cops are far');
  const near = { r: { x: 0, z: 0 }, c1: { x: 5, z: 0 }, c2: { x: -100, z: 0 } };
  for (let i = 0; i < 12; i++) M.chaseTick(ch, near, 0.25);
  ok(!ch.over && ch.bust > 2.9 && ch.bust < 3.1, 'bust meter fills while a cop is on the robber (' + ch.bust.toFixed(2) + ')');
  for (let i = 0; i < 4; i++) M.chaseTick(ch, far, 0.25);
  ok(ch.bust < 2.35, 'bust meter drains when the robber breaks away');
  for (let i = 0; i < 30; i++) M.chaseTick(ch, near, 0.25);
  ok(ch.over && ch.winner === 'cops', 'cops win after holding the robber 5s');
  const c2 = M.newChase('r', ['c1']); for (let i = 0; i < 700; i++) M.chaseTick(c2, far, 0.25);
  ok(c2.over && c2.winner === 'robber', 'robber wins by surviving 150s');
  const c3 = M.newChase('r', ['c1']); const hid = { r: true };
  for (let i = 0; i < 40; i++) M.chaseTick(c3, near, 0.25, hid);
  ok(!c3.over && c3.bust === 0, 'robber cannot be busted while hidden indoors');
  const c4 = M.newChase('r', ['c1']); M.chaseRobberWrecked(c4); ok(c4.winner === 'cops', 'wrecked robber = cops win');
  const st = M.chaseStarts(2); ok(st.cops.length === 2, 'cop start positions provided');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
