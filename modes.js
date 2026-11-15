// ═══════════════════════════════════════════════
// PUNK CITY — multiplayer game modes (pure logic, no sockets)
//   race  : everyone races the same laps; server validates checkpoints in order
//   chase : one robber vs police players; cops win by holding the robber, robber wins by surviving
// ═══════════════════════════════════════════════
const RACE_CPS = [               // index 0 = start/finish line. All points sit on real roads.
  { x: -210, z: -210 }, { x: 0, z: -210 }, { x: 210, z: -210 }, { x: 210, z: 0 },
  { x: 210, z: 210 }, { x: 0, z: 210 }, { x: -210, z: 210 }, { x: -210, z: 0 }
];
const RACE_LAPS = 2, CP_RADIUS = 20, CP_SLACK = 55;       // slack: server only has the last 10Hz position
const CHASE_TIME = 150, BUST_RADIUS = 10, BUST_TIME = 5;

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

// ───────── RACE ─────────
function raceStarts(n) {               // 2-wide grid behind the line, facing +x
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: -234 - Math.floor(i / 2) * 11, z: -210 + (i % 2 ? 4 : -4), a: Math.PI / 2 });
  return out;
}
function newRace(ids) {
  const st = {}; ids.forEach(id => { st[id] = { c: 0, finishedAt: null, lastCpAt: 0 }; });
  return { cps: RACE_CPS, laps: RACE_LAPS, total: RACE_LAPS * RACE_CPS.length, st, startedAt: null, over: false, order: [] };
}
// client says "I passed checkpoint idx". Accept only the next one, and only if the last known position is near it.
function raceHit(race, id, idx, pos, now) {
  const s = race.st[id];
  if (!s || race.startedAt === null || race.over || s.finishedAt !== null) return { ok: false, why: 'inactive' };
  const want = (s.c + 1) % race.cps.length;
  if (idx !== want) return { ok: false, why: 'order' };
  if (!pos || dist(pos, race.cps[idx]) > CP_RADIUS + CP_SLACK) return { ok: false, why: 'far' };
  s.c++; s.lastCpAt = now;
  if (s.c >= race.total) { s.finishedAt = now - race.startedAt; race.order.push(id); }
  return { ok: true, c: s.c, finished: s.finishedAt !== null };
}
function raceStandings(race, now) {
  const rows = Object.keys(race.st).map(id => ({ id, c: race.st[id].c, finishedAt: race.st[id].finishedAt, lastCpAt: race.st[id].lastCpAt }));
  rows.sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1; if (b.finishedAt !== null) return 1;
    return b.c - a.c || a.lastCpAt - b.lastCpAt;
  });
  rows.forEach((r, i) => { r.pos = i + 1; r.lap = Math.min(race.laps, Math.floor(r.c / race.cps.length) + 1); r.cp = r.c % race.cps.length; });
  return rows;
}
// race ends when all have finished, or 45s after the first finisher
function raceCheckEnd(race, now) {
  const ids = Object.keys(race.st), fin = ids.filter(id => race.st[id].finishedAt !== null);
  if (fin.length === ids.length) return true;
  if (fin.length) { const first = Math.min.apply(null, fin.map(id => race.st[id].finishedAt)); if (now - race.startedAt - first > 45000) return true; }
  return false;
}

// ───────── CHASE ─────────
function chaseStarts(copCount) {
  const cops = [{ x: 0, z: -150, a: Math.PI }, { x: 150, z: 0, a: -Math.PI / 2 }, { x: -150, z: 0, a: Math.PI / 2 }];
  return { robber: { x: 4, z: 4, a: 0 }, cops: cops.slice(0, copCount) };
}
function newChase(robberId, copIds) {
  return { robber: robberId, cops: copIds.slice(), t: CHASE_TIME, bust: 0, over: false, winner: null, reason: '' };
}
// pos: {id:{x,z}} (latest known). Returns the chase (mutated). Call at a fixed dt.
function chaseTick(ch, pos, dt, hidden) {
  if (ch.over) return ch;
  ch.t -= dt;
  const r = pos[ch.robber];
  let held = false;
  if (r) ch.cops.forEach(c => { if (pos[c] && dist(pos[c], r) < BUST_RADIUS) held = true; });
  if (held && !(hidden && hidden[ch.robber])) ch.bust = Math.min(BUST_TIME, ch.bust + dt); else ch.bust = Math.max(0, ch.bust - dt * 0.7);
  if (ch.bust >= BUST_TIME) { ch.over = true; ch.winner = 'cops'; ch.reason = 'THE ROBBER WAS BUSTED'; }
  else if (ch.t <= 0) { ch.over = true; ch.winner = 'robber'; ch.reason = 'THE ROBBER GOT AWAY'; }
  return ch;
}
function chaseRobberWrecked(ch) { if (!ch.over) { ch.over = true; ch.winner = 'cops'; ch.reason = 'THE ROBBER WAS WRECKED'; } return ch; }
function chaseRobberLeft(ch) { if (!ch.over) { ch.over = true; ch.winner = 'cops'; ch.reason = 'THE ROBBER LEFT'; } return ch; }

module.exports = { RACE_CPS, RACE_LAPS, CHASE_TIME, BUST_RADIUS, BUST_TIME, raceStarts, newRace, raceHit, raceStandings, raceCheckEnd, chaseStarts, newChase, chaseTick, chaseRobberWrecked, chaseRobberLeft };
