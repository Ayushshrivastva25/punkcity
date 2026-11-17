// ═══════════════════════════════════════════════
// MISSIONS — a 10-step story, one active at a time, each with a waypoint.
// Every location is on a real road (Core.ROAD_LINES) so it is always reachable.
//  1 fuel · 2 rampage · 3 shake the cops · 4 garage · 5 delivery
//  6 street race · 7 bank heist · 8 lay low · 9 upgrade · 10 ring road lap
// ═══════════════════════════════════════════════
var DELIVERY = { A: { x: -270, z: -30 }, B: { x: 270, z: 150 }, limit: 75 };
var RACE_CPS = [{ x: -210, z: -210 }, { x: 210, z: -210 }, { x: 210, z: 210 }, { x: -210, z: 210 }, { x: -210, z: -210 }];
var RING_CPS = [{ x: 0, z: -330 }, { x: 330, z: -330 }, { x: 330, z: 0 }, { x: 330, z: 330 }, { x: 0, z: 330 }, { x: -330, z: 330 }, { x: -330, z: 0 }, { x: -330, z: -330 }, { x: 0, z: -330 }];

function dist2car(p) { return Math.hypot(G.car.x - p.x, G.car.z - p.z); }

// Run through ordered checkpoints against the clock. Returns true when finished.
function runCheckpoints(st, cps, limit, R, dt, what) {
  if (st.stage === undefined) { st.stage = 0; st.idx = 0; }
  if (st.stage === 0) {
    if (dist2car(cps[0]) < R) { st.stage = 1; st.idx = 1; st.t = limit; toast(what + ' — GO!  ' + limit + 's', 1800, '#00ff88'); playCoin(); }
    return false;
  }
  st.t -= dt;
  if (dist2car(cps[st.idx]) < R) {
    st.idx++; playCoin();
    if (st.idx >= cps.length) return true;
    toast('CHECKPOINT ' + (st.idx - 1) + '/' + (cps.length - 1), 900, '#00ff88');
  }
  if (st.t <= 0) { st.stage = 0; st.idx = 0; toast(what + ' FAILED — drive back to the start', 2600, '#ff4433'); }
  return false;
}
function cpTarget(st, cps, label) {
  var p = (st.stage === 1) ? cps[st.idx] : cps[0];
  return { x: p.x, z: p.z, r: 14, label: st.stage === 1 ? label + ' ' + st.idx + '/' + (cps.length - 1) : label + ' START', color: 0x00ff88 };
}
function svcTarget(k, label) { var s = PLACES[k].svc; return { x: s.x, z: s.z, r: s.r, label: label || PLACES[k].name, color: PLACES[k].color }; }

var STORY = {"fuel": ["RAZOR", "Welcome to Punk City, rookie. Your tank's bone dry — hit the gas station before we talk business.", "RAZOR", "Full tank. Now let's see if you've got the nerve for this town."], "rampage": ["RAZOR", "The Vipers run these streets. Make some noise — five pedestrians — so they know we're here.", "RAZOR", "Loud. And now the cops are on you — lose them!"], "heat": ["RAZOR", "Sirens! Break line of sight, or ghost into Club Neon. They never check the dance floor.", "RAZOR", "Clean getaway. Swing by Maya's garage and get that car patched up."], "garage": ["MAYA", "Pull into my bay. First visit's on the house — Razor's tab.", "MAYA", "Good as new. Watch out for Viper's crew — they ram."], "delivery": ["RAZOR", "I need a package moved west to east. Fast. And don't dent it.", "RAZOR", "On time. One of Viper's shipments just went missing, funny that."], "race": ["VIPER", "So you're Razor's new driver. One lap of the loop — beat me, or leave town.", "VIPER", "...Lucky. Don't count on it twice."], "bank": ["RAZOR", "Viper keeps his cash in the First Bank vault. Guard, vault, cash, out. You get 30 seconds once the alarm trips.", "RAZOR", "You got it! Cops are swarming — get to Club Neon and lay low."], "lowlow": ["RAZOR", "Heat's gone. Viper's furious — he wants a rematch on the Ring Road.", "MAYA", "Hear that? Hit the Tune Shop first. You'll need every horsepower."], "tune": ["MAYA", "Spend that cash at the Tune Shop — nitro, engine, armor. Your pick.", "MAYA", "Now she's a monster. Viper's waiting on the Ring Road."], "ring": ["VIPER", "One lap of the Ring Road. Winner owns Punk City. Don't blink.", "VIPER", "...You win. The city's yours. Don't let it go to your head."]};
// Checkpoint run against VIPER: the rival appears when you cross the start line.
function rivalRun(st, dt, cps, limit, R, what, rivalTop) {
  if (st.stage === 1 && !G.rival) { spawnRival(cps, rivalTop); comm('VIPER', st.said ? 'Again? Fine.' : 'Eat my dust!', 2200); st.said = true; }
  var done = runCheckpoints(st, cps, limit, R, dt, what);
  if (done) { removeRival(); return true; }
  if (st.stage === 0 && G.rival) removeRival();
  if (G.rival && G.rival.finished) {
    st.stage = 0; st.idx = 0; removeRival();
    toast('VIPER BEAT YOU — drive back to the start', 3000, '#cc66ff'); comm('VIPER', 'Too slow, rookie. Try again.', 3000);
  }
  return false;
}
var MAIN = [
  { id: 'fuel', title: 'FILL THE TANK', reward: 100,
    brief: 'Your tank is almost empty. Drive to the GAS STATION, stop on the glowing ring and press the action button.',
    target: function () { return svcTarget('gas'); },
    done: function () { return !!G.flags.refuel; } },

  { id: 'rampage', title: 'MAKE SOME NOISE', reward: 150,
    brief: 'Run over 5 pedestrians. The police will notice…',
    start: function (st) { st.k0 = G.kills; },
    sub: function (st) { return 'Pedestrians hit: ' + Math.min(5, G.kills - st.k0) + ' / 5'; },
    done: function (st) { return G.kills - st.k0 >= 5; } },

  { id: 'heat', title: 'SHAKE THE POLICE', reward: 250,
    brief: 'Cops are on your tail! Break line of sight and stay hidden — or duck into CLUB NEON where they cannot follow.',
    start: function () { if (G.stars < 2) setStars(2); },
    target: function () { return G.stars > 0 ? svcTarget('club', 'HIDE HERE') : null; },
    sub: function () { return G.stars > 0 ? 'Wanted level: ' + G.stars + '★  —  escape the cops!' : 'You are clean'; },
    done: function () { return G.stars === 0; } },

  { id: 'garage', title: 'PIT STOP', reward: 100,
    brief: 'Drive into the GARAGE bay and get your car looked at. The first visit is free.',
    target: function () { return svcTarget('garage'); },
    done: function () { return !!G.flags.garage; } },

  { id: 'delivery', title: 'PACKAGE RUN', reward: 300,
    brief: 'Pick up the package on the west side, then deliver it across town before time runs out.',
    start: function (st) { st.stage = 0; },
    target: function (st) { var p = st.stage === 0 ? DELIVERY.A : DELIVERY.B; return { x: p.x, z: p.z, r: 9, label: st.stage === 0 ? 'PICK UP' : 'DROP OFF', color: st.stage === 0 ? 0x66ddff : 0xffaa00 }; },
    sub: function (st) { return st.stage === 0 ? 'Pick up the package (west edge of town)' : 'Deliver it to the east side!'; },
    timer: function (st) { return st.stage === 1 ? st.t : null; },
    update: function (st, dt) {
      if (st.stage === 0) { if (dist2car(DELIVERY.A) < 9) { st.stage = 1; st.t = DELIVERY.limit; toast('PACKAGE PICKED UP — ' + DELIVERY.limit + 's TO DELIVER', 2200, '#66ddff'); playCoin(); } return false; }
      st.t -= dt;
      if (dist2car(DELIVERY.B) < 9) return true;
      if (st.t <= 0) { st.stage = 0; toast('TOO SLOW — the package went back. Try again!', 2600, '#ff4433'); }
      return false;
    },
    done: function () { return false; } },

  { id: 'race', title: 'STREET RACE', reward: 350,
    brief: 'Drive to the START line, then race a full lap through all checkpoints in under 60 seconds.',
    start: function (st) { st.stage = 0; st.idx = 0; },
    target: function (st) { return cpTarget(st, RACE_CPS, 'RACE'); },
    sub: function (st) { return st.stage === 0 ? 'Drive to the green START marker' : 'Checkpoint ' + Math.min(st.idx, 4) + ' / 4'; },
    timer: function (st) { return st.stage === 1 ? st.t : null; },
    update: function (st, dt) { return rivalRun(st, dt, RACE_CPS, 60, 14, 'RACE', 52); },
    done: function () { return false; } },

  { id: 'bank', title: 'THE BIG SCORE', reward: 0,
    brief: 'Rob the BANK: knock out the guard, crack the vault, grab the cash and get out before the alarm brings the police.',
    target: function () { return svcTarget('bank'); },
    sub: function () { return bankHint(); },
    timer: function () { return (G.bank.stage >= 2 && G.bank.alarmT > 0 && !G.bank.done) ? G.bank.alarmT : null; },
    done: function () { return !!G.flags.bankDone; } },

  { id: 'lowlow', title: 'LAY LOW', reward: 250,
    brief: 'The heat is on! Hide inside CLUB NEON until the police lose interest.',
    target: function () { return svcTarget('club', 'HIDE HERE'); },
    sub: function () { return G.stars > 0 ? 'Wanted: ' + G.stars + '★ — get to the club!' : (G.clubSecs >= 6 ? 'You are clean' : 'Spend a moment inside CLUB NEON'); },
    done: function () { return G.stars === 0 && G.clubSecs >= 6; } },

  { id: 'tune', title: 'UPGRADE YOUR RIDE', reward: 150,
    brief: 'Spend some of that cash: buy any upgrade at the TUNE SHOP.',
    target: function () { return svcTarget('tune'); },
    done: function () { return !!G.flags.upgrade; } },

  { id: 'ring', title: 'RING ROAD RECORD', reward: 1000,
    brief: 'Final test: one full lap of the outer RING ROAD in under 90 seconds. Use your nitro!',
    start: function (st) { st.stage = 0; st.idx = 0; },
    target: function (st) { return cpTarget(st, RING_CPS, 'RING'); },
    sub: function (st) { return st.stage === 0 ? 'Drive to the start marker on the north road' : 'Checkpoint ' + Math.min(st.idx, 8) + ' / 8'; },
    timer: function (st) { return st.stage === 1 ? st.t : null; },
    update: function (st, dt) { return rivalRun(st, dt, RING_CPS, 90, 18, 'RING LAP', 54); },
    done: function () { return false; } }
];

var BONUS = [
  { id: 'pump', title: 'DEMOLITION', brief: 'Blow up a pump at the gas station.', reward: 200 },
  { id: 'rampage25', title: 'ROAD RAGE', brief: 'Run over 25 pedestrians in total.', reward: 300 },
  { id: 'speed150', title: 'SPEED DEMON', brief: 'Reach 150 km/h (needs the ENGINE upgrade or nitro).', reward: 250 },
  { id: 'survive', title: 'MOST WANTED', brief: 'Survive 30 seconds at 4+ stars.', reward: 400 }
];

// ───────── runtime ─────────
function initMissions() {
  G.m = { cur: 0, st: {} }; G.flags = {}; G.bonus = {}; G.surv = 0;
  startMission();
}
function curMission() { return MAIN[G.m.cur] || null; }
function startMission() {
  var m = curMission(); if (!m) return;
  G.m.st = {};
  if (m.start) m.start(G.m.st);
  toast('MISSION ' + (G.m.cur + 1) + '/10: ' + m.title, 2800, '#ffcc00');
  var sl = STORY[m.id]; if (sl) setTimeout(function () { if (G.m && curMission() === m) comm(sl[0], sl[1]); }, 1200);
}
function mEvent(name) { G.flags[name] = true; }

function updateMissions(dt) {
  if (G.gm !== 'story') return;
  var m = curMission();
  if (m) {
    var fin = false;
    if (m.update) fin = m.update(G.m.st, dt);
    if (!fin && m.done) fin = m.done(G.m.st);
    if (fin) completeMission(m);
  }
  // reactive one-liners (each once)
  G.said = G.said || {};
  if (!G.said.low && G.car.fuel < 20 && G.car.fuel > 0) { G.said.low = true; comm('RAZOR', "Fuel's getting low. Gas station's marked on your map.", 3000); }
  if (!G.said.hurt && G.car.health < 40) { G.said.hurt = true; comm('MAYA', "That car's smoking! Bring it to the garage.", 3000); }
  if (!G.said.cops && G.stars > 0 && curMission() && curMission().id !== 'heat' && curMission().id !== 'rampage') { G.said.cops = true; comm('RAZOR', "Cops! Keep moving, break their line of sight.", 3000); }
  // bonus challenges
  if (!G.bonus.rampage25 && G.kills >= 25) bonusDone('rampage25');
  if (!G.bonus.speed150 && Math.hypot(G.car.vx, G.car.vz) * Core.KMH >= 150) bonusDone('speed150');
  if (!G.bonus.survive) { if (G.stars >= 4) { G.surv += dt; if (G.surv >= 30) bonusDone('survive'); } else G.surv = 0; }
}
function completeMission(m) {
  G.money += m.reward; G.score += m.reward;
  playCoin();
  var n = G.m.cur + 1;
  triggerDrama('MISSION COMPLETE', m.title, m.reward ? '+$' + m.reward : '', '#0ffcd4');
  var so = STORY[m.id]; if (so) comm(so[2], so[3]);
  if (typeof mpMissionDone === 'function') mpMissionDone(m.id, n);
  G.m.cur++;
  if (G.m.cur >= MAIN.length) { setTimeout(triggerWin, 1800); G.m.st = {}; return; }
  startMission();
}
function bonusDone(id) {
  if (G.bonus[id]) return; G.bonus[id] = true;
  var b = BONUS.filter(function (x) { return x.id === id; })[0];
  G.money += b.reward; G.score += b.reward; playCoin();
  toast('BONUS: ' + b.title + '  +$' + b.reward, 2600, '#ffcc00');
}

// ───────── HUD hooks ─────────
function currentTarget() {
  if (G.gm !== 'story') return mpTarget();
  var m = curMission(); if (!m || !m.target || !G.m) return null;
  return m.target(G.m.st) || null;
}
function missionTimer() { if (G.gm !== 'story') return mpTimer(); var m = curMission(); return (m && m.timer) ? m.timer(G.m.st) : null; }
function missionHudInfo() {
  if (G.gm !== 'story') return mpHudInfo();
  var m = curMission();
  if (!m) return { title: 'ALL MISSIONS DONE', sub: '' };
  return { title: (G.m.cur + 1) + '/10 · ' + m.title, sub: (m.sub ? m.sub(G.m.st) : m.brief) };
}
function bankHint() {
  if (G.mode !== 'foot' || G.place !== 'bank') return 'Park on the ring and press ACT to go inside';
  var b = G.bank;
  if (b.stage === 0) return 'Knock out the guard (punch him 3 times)';
  if (b.stage === 1) return 'Crack the vault at the back wall';
  if (b.stage === 2) return 'Grab the cash!';
  return 'GET OUT through the front door!';
}
