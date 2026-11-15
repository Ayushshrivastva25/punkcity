// ═══════════════════════════════════════════════
// MULTIPLAYER — lobby, remote cars, and three room modes
//   story : first to finish all 10 missions
//   race  : same lap for everyone, server-validated checkpoints, podium
//   chase : one robber vs police players
// ═══════════════════════════════════════════════
var mp = { socket: null, active: false, mode: 'story', pickMode: 'story', code: null, myId: null, players: {}, remotes: {},
           hidden: false, lbT: 0, role: null, start: null, info: null, c: 0, pending: false, pendT: 0, raceRows: null, chase: null, lastCp: null, raceT0: 0, ended: false };
var MODE_INFO = {
  story: { name: 'STORY RACE', css: '#0ffcd4', desc: 'First to finish all 10 missions' },
  race:  { name: 'STREET RACE', css: '#00ff88', desc: 'Race 2 laps — first across the line wins' },
  chase: { name: 'COPS VS ROBBER', css: '#ff4466', desc: 'One robber runs, the rest drive police' }
};

function mpSetInside(b) { mp.hidden = !!b; }
function setupMpHud() { show('mp-hud', mp.active, 'block'); }
function mpErr(m) { var e = $('mp-error'); if (e) e.textContent = m || ''; }

// ───────── socket wiring (each handler is a plain function so it can be tested) ─────────
function mpConnect() {
  if (mp.socket) return true;
  if (typeof io === 'undefined') { mpErr('Multiplayer server not reachable'); return false; }
  var s = mp.socket = io();
  s.on('connect', function () { mp.myId = s.id; });
  s.on('roomCreated', function (code, ci, mode) { mp.code = code; mp.mode = mode || 'story'; mpShowWaiting(); });
  s.on('joinOK', function (code, ci, players, mode) { mp.code = code; mp.players = players; mp.mode = mode || 'story'; mpShowWaiting(); mpRenderPlayers(); });
  s.on('joinFail', mpErr); s.on('startFail', mpErr);
  s.on('roomUpdate', function (players) { mp.players = players; mpRenderPlayers(); });
  s.on('roomClosed', function () { location.reload(); });
  s.on('gameStart', mpOnGameStart);
  s.on('playerMoved', mpRemoteUpdate);
  s.on('playerLeft', function (id) { mpRemoteRemove(id); delete mp.players[id]; });
  s.on('gameWin', mpOnStoryWin);
  s.on('countdown', mpOnCountdown);
  s.on('cpOK', mpOnCpOK); s.on('cpNo', function () { mp.pending = false; });
  s.on('raceState', function (rows) { mp.raceRows = rows; });
  s.on('raceFinish', mpOnRaceFinish); s.on('raceEnd', mpOnRaceEnd);
  s.on('chaseState', function (c) { mp.chase = c; });
  s.on('chaseEnd', mpOnChaseEnd);
  return true;
}
function mpShowWaiting() {
  ['title-btns', 'mp-join-row', 'car-chips', 'mode-chips', 'mp-name', 'title-help'].forEach(function (id) { $(id).style.display = 'none'; });
  $('mp-waiting').style.display = 'flex'; $('mp-room-code').textContent = mp.code; mpErr('');
  var mi = MODE_INFO[mp.mode] || MODE_INFO.story; var t = $('mp-mode-tag'); t.textContent = mi.name + ' — ' + mi.desc; t.style.color = mi.css;
}
function mpRenderPlayers() {
  var h = '';
  Object.keys(mp.players).forEach(function (id) { var p = mp.players[id]; h += '<div class="mp-player-row"><div class="mp-player-dot" style="background:' + p.color + '"></div><span>' + p.name + (id === mp.myId ? ' (YOU)' : '') + '</span></div>'; });
  $('mp-players-list').innerHTML = h;
}

function mpOnGameStart(players, info) {
  info = info || { mode: 'story' };
  mp.players = players; mp.info = info; mp.mode = info.mode || 'story'; mp.active = true; mp.ended = false;
  mp.role = players[mp.myId] ? players[mp.myId].role : null;
  mp.start = (info.starts && info.starts[mp.myId]) || null;
  mp.c = 0; mp.pending = false; mp.raceRows = null; mp.chase = null; mp.lastCp = null;
  G.gm = mp.mode;
  document.body.classList.remove('gm-story', 'gm-race', 'gm-chase'); document.body.classList.add('gm-' + mp.mode);
  startGame();
  if (mp.mode !== 'story') { G.freeze = true; mpBigText('GET READY', 2800); }
  mpStartLoops();
}
function mpBigText(txt, ms) {
  var e = $('countdown'); e.textContent = txt; e.style.display = 'block';
  if (ms) setTimeout(function () { if (e.textContent === txt) e.style.display = 'none'; }, ms);
}
function mpOnCountdown(n) {
  if (n > 0) { mpBigText(String(n), 0); playTone(440, 0.12, 'square', 0.05); }
  else { G.freeze = false; mp.raceT0 = performance.now(); mpBigText('GO!', 900); playTone(880, 0.3, 'square', 0.06); }
}
function mpStartLoops() {
  if (mp._loop) return;
  mp._loop = setInterval(function () {
    if (!mp.socket || !G.car || !G.running) return;
    var c = G.car;
    mp.socket.emit('playerMove', { x: c.x, z: c.z, angle: c.a, vx: c.vx, vz: c.vz, hidden: mp.hidden, model: G.selCar });
  }, 100);
}

// ───────── per-frame mode logic (called from the main loop in car mode) ─────────
function mpModeUpdate(dt) {
  if (!mp.active || mp.mode !== 'race' || G.freeze || mp.ended || !mp.info) return;
  var cps = mp.info.cps, idx = (mp.c + 1) % cps.length, cp = cps[idx];
  if (mp.pending) { mp.pendT -= dt; if (mp.pendT <= 0) mp.pending = false; return; }
  if (Math.hypot(G.car.x - cp.x, G.car.z - cp.z) < 18) { mp.pending = true; mp.pendT = 1.2; mp.socket && mp.socket.emit('cpHit', { idx: idx }); }
}
function mpOnCpOK(c) {
  mp.c = c; mp.pending = false; playCoin();
  var cps = mp.info.cps, total = mp.info.laps * cps.length;
  mp.lastCp = cps[c % cps.length];
  if (c < total) toast(c % cps.length === 0 ? 'LAP ' + (Math.floor(c / cps.length) + 1) + '/' + mp.info.laps : 'CHECKPOINT', 900, '#00ff88');
}
function mpOnRaceFinish(id, name, ms) {
  if (id === mp.myId) { toast('YOU FINISHED!  ' + (ms / 1000).toFixed(1) + 's', 3500, '#ffcc00'); }
  else toast(name + ' FINISHED  ' + (ms / 1000).toFixed(1) + 's', 2500, '#ffffff');
}
function mpEndScreen(title, sub, listHtml) {
  mp.ended = true; G.running = false; G.over = true; stopSiren(); updateEngineSound(0, 0, false);
  $('countdown').style.display = 'none';
  $('mp-win-name').textContent = title; $('mp-win-sub').textContent = sub || ''; $('mp-win-list').innerHTML = listHtml || '';
  $('mp-winner').classList.add('show');
}
function fmtTime(ms) { var s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s - m * 60 < 10 ? '0' : '') + (s - m * 60).toFixed(1); }
function mpOnRaceEnd(rows) {
  var medals = ['🥇', '🥈', '🥉'], h = '', me = null;
  rows.forEach(function (r, i) { if (r.id === mp.myId) me = r; h += '<div>' + (medals[i] || (i + 1) + '.') + ' ' + r.name + ' — ' + (r.finishedAt !== null ? fmtTime(r.finishedAt) : 'DNF') + '</div>'; });
  var won = rows.length && rows[0].id === mp.myId;
  mpEndScreen(won ? 'YOU WIN!' : (me ? 'POSITION ' + me.pos : 'RACE OVER'), 'STREET RACE RESULTS', h);
}
function mpOnChaseEnd(res) {
  var iAmRobber = mp.role === 'robber', won = (res.winner === 'robber') === iAmRobber;
  mpEndScreen(won ? 'YOU WIN!' : 'YOU LOSE', res.reason, '<div>' + (res.winner === 'robber' ? 'ROBBER WINS' : 'POLICE WIN') + '</div>');
}
function mpOnStoryWin(id, name) {
  if (id === mp.myId) { triggerWin(); return; }
  mpEndScreen(name + ' WINS!', 'THEY FINISHED ALL 10 MISSIONS FIRST', '');
}
function mpMissionDone(id, n) {
  if (!mp.active || !mp.socket || mp.mode !== 'story') return;
  var done = {}; for (var i = 0; i < n; i++) done[MAIN[i].id] = true;
  mp.socket.emit('missionDone', { key: id, missions: done, score: G.score, money: Math.floor(G.money) });
}

// car wrecked in a non-story mode (story uses gameOver)
function mpWrecked() {
  if (mp.mode === 'chase' && mp.role === 'robber') { mp.socket && mp.socket.emit('robberWrecked'); G.car.health = 1; G.car.vx = G.car.vz = 0; toast('WRECKED!', 2000, '#ff4433'); return; }
  mpRespawn(); toast('WRECKED — back on track', 1800, '#ff4433');
}
function mpRespawn() {
  var c = G.car;
  if (mp.mode === 'race' && mp.info) {
    var cps = mp.info.cps, p = mp.lastCp || cps[0], n = cps[(mp.c + 1) % cps.length];
    c.x = p.x; c.z = p.z; c.a = Math.atan2(n.x - p.x, n.z - p.z);
  } else if (mp.start) { c.x = mp.start.x; c.z = mp.start.z; c.a = mp.start.a; }
  c.vx = c.vz = c.w = 0; c.health = 100; G.grace = 2; setCarCameraSnap();
}

// ───────── HUD hooks used by missions.js when G.gm != 'story' ─────────
function mpMyRow() { if (!mp.raceRows) return null; for (var i = 0; i < mp.raceRows.length; i++) if (mp.raceRows[i].id === mp.myId) return mp.raceRows[i]; return null; }
function mpHudInfo() {
  if (mp.mode === 'race' && mp.info) {
    var r = mpMyRow(), n = Object.keys(mp.players).length, cps = mp.info.cps.length;
    var lap = Math.min(mp.info.laps, Math.floor(mp.c / cps) + 1), el = G.freeze ? 0 : (performance.now() - mp.raceT0);
    return { title: 'LAP ' + lap + '/' + mp.info.laps + ' · POS ' + (r ? r.pos : '-') + '/' + n, sub: 'Checkpoint ' + (mp.c % cps) + '/' + cps + '  ·  ' + fmtTime(el) };
  }
  if (mp.mode === 'chase') {
    var b = mp.chase ? Math.round(mp.chase.bust / 5 * 100) : 0;
    if (mp.role === 'robber') return { title: 'ESCAPE THE POLICE!', sub: 'Survive the clock. Bust meter: ' + b + '%' };
    return { title: 'CATCH THE ROBBER', sub: 'Stay close — hold him for 5s. Bust meter: ' + b + '%' };
  }
  return { title: '', sub: '' };
}
function mpTarget() {
  if (mp.mode === 'race' && mp.info && !G.freeze) { var cps = mp.info.cps, i = (mp.c + 1) % cps.length; return { x: cps[i].x, z: cps[i].z, r: 16, label: i === 0 ? 'FINISH LINE' : 'CHECKPOINT ' + i, color: 0x00ff88 }; }
  if (mp.mode === 'chase' && mp.role === 'cop' && mp.info) { var r = mp.remotes[mp.info.robber]; if (r && !r.hidden) return { x: r.car.x, z: r.car.z, r: 8, label: 'ROBBER', color: 0xff3344 }; }
  return null;
}
function mpTimer() { return (mp.mode === 'chase' && mp.chase && !G.freeze) ? mp.chase.t : null; }

// ───────── remote players ─────────
function mpRemoteUpdate(id, d) {
  if (!G.built || !W.root) return;
  var r = mp.remotes[id];
  if (!r) {
    var pl = mp.players[id] || { name: d.name || 'PLAYER', color: '#ffffff' };
    var m = CAR_MODELS[d.model || 0] || CAR_MODELS[0];
    var mesh = d.role === 'cop' ? buildCarMesh({ police: true, color: 0x15204a, accent: 0x0a0a18, roof: 0x0a0a14 }) : buildCarMesh({ color: m.color, accent: m.accent, roof: m.roof, stripe: m.stripe });
    W.root.add(mesh);
    var lb = document.createElement('div'); lb.className = 'other-label'; lb.style.color = pl.color; lb.style.borderColor = pl.color; lb.textContent = pl.name + (d.role === 'cop' ? ' 🚓' : d.role === 'robber' ? ' 💰' : ''); document.body.appendChild(lb);
    r = mp.remotes[id] = { mesh: mesh, car: Core.makeCar(d.x, d.z, d.angle), label: lb, color: pl.color, hidden: false, tx: d.x, tz: d.z, ta: d.angle, role: d.role };
    r.car.x = d.x; r.car.z = d.z;
  }
  r.tx = d.x; r.tz = d.z; r.ta = d.angle; r.hidden = !!d.hidden; r.car.vx = d.vx || 0; r.car.vz = d.vz || 0;
}
function mpRemoteRemove(id) {
  var r = mp.remotes[id]; if (!r) return;
  W.root.remove(r.mesh); if (r.label.parentNode) r.label.parentNode.removeChild(r.label); delete mp.remotes[id];
}
function mpUpdateRemotes(dt) {
  var ids = Object.keys(mp.remotes); if (!ids.length) return;
  var show = G.running && G.mode === 'car' && !G.paused, v = new THREE.Vector3(), t = G.t;
  ids.forEach(function (id) {
    var r = mp.remotes[id], c = r.car, k = 1 - Math.exp(-12 * dt);
    c.x += (r.tx - c.x) * k; c.z += (r.tz - c.z) * k; c.a += Core.angDiff(c.a, r.ta) * k;
    c.vf = c.vx * Math.sin(c.a) + c.vz * Math.cos(c.a); c.vl = 0;
    r.mesh.visible = !r.hidden;
    syncCarMesh(r.mesh, c, dt, W.dayF === undefined ? 0 : 1 - W.dayF);
    if (r.role === 'cop' && r.mesh.userData.sirenL) { var on = Math.floor(t * 6) % 2 === 0; r.mesh.userData.sirenL.material.color.setHex(on ? 0xff1100 : 0x330000); r.mesh.userData.sirenR.material.color.setHex(on ? 0x000833 : 0x1122ff); }
    var ok = show && !r.hidden;
    if (ok) { v.set(c.x, 3.6, c.z).project(W.camera); ok = v.z < 1; }
    r.label.style.display = ok ? 'block' : 'none';
    if (ok) { r.label.style.left = ((v.x * 0.5 + 0.5) * VW) + 'px'; r.label.style.top = ((-v.y * 0.5 + 0.5) * VH) + 'px'; }
  });
}
function mpCollide(dt) {
  for (var id in mp.remotes) {
    var r = mp.remotes[id]; if (r.hidden || G.grace > 0) continue;
    var rel = Core.collideCars(G.car, r.car, 1, 2.5);
    if (rel > 0 && G.car.hitCD <= 0) {
      G.car.hitCD = 0.25;
      var dmg = Core.crashDamage(rel, G.P.armor) * 0.7;
      if (dmg > 0) applyDamage(dmg, rel); else if (rel > 3) playBump(0.25);
    }
  }
}
function mpDrawMarkers(ctx, P, r) {
  for (var id in mp.remotes) { var q = mp.remotes[id]; if (q.hidden) continue; var p = P(q.car.x, q.car.z); ctx.fillStyle = q.role === 'cop' ? '#3355ff' : q.color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); }
}
function mpUpdateHud() {
  if (!mp.active) return;
  var now = performance.now(); if (now - mp.lbT < 400) return; mp.lbT = now;
  var h = '', ids = Object.keys(mp.players);
  if (mp.mode === 'race' && mp.raceRows) {
    $('mp-hud').firstElementChild.textContent = 'RACE · POSITIONS';
    h = mp.raceRows.map(function (r) { var p = mp.players[r.id] || { color: '#fff' }; return '<div class="mh-row"><div class="mh-dot" style="background:' + p.color + '"></div><span class="mh-name">' + r.pos + '. ' + r.name + (r.id === mp.myId ? ' ★' : '') + '</span><span class="mh-tasks">' + (r.finishedAt !== null ? 'DONE' : 'L' + r.lap) + '</span></div>'; }).join('');
  } else if (mp.mode === 'chase') {
    $('mp-hud').firstElementChild.textContent = 'COPS VS ROBBER';
    h = ids.map(function (id) { var p = mp.players[id]; return '<div class="mh-row"><div class="mh-dot" style="background:' + p.color + '"></div><span class="mh-name">' + p.name + (id === mp.myId ? ' ★' : '') + '</span><span class="mh-tasks">' + (p.role === 'robber' ? '💰 ROBBER' : '🚓 COP') + '</span></div>'; }).join('');
  } else {
    $('mp-hud').firstElementChild.textContent = 'RACE · ALL MISSIONS';
    var rows = ids.map(function (id) { var p = mp.players[id]; var n = Object.keys(p.missions || {}).filter(function (k) { return p.missions[k]; }).length; if (id === mp.myId) n = G.m ? G.m.cur : n; return { p: p, n: n, me: id === mp.myId }; });
    rows.sort(function (a, b) { return b.n - a.n; });
    h = rows.map(function (r) { return '<div class="mh-row"><div class="mh-dot" style="background:' + r.p.color + '"></div><span class="mh-name">' + r.p.name + (r.me ? ' ★' : '') + '</span><span class="mh-tasks">' + r.n + '/10</span></div>'; }).join('');
  }
  $('mp-lb-rows').innerHTML = h;
}

window.addEventListener('load', function () {
  var box = $('mode-chips');
  Object.keys(MODE_INFO).forEach(function (k, i) {
    var m = MODE_INFO[k], d = document.createElement('div'); d.className = 'chip' + (i === 0 ? ' active' : ''); d.textContent = m.name; d.style.color = m.css; d.style.borderColor = m.css; d.title = m.desc;
    d.addEventListener('click', function () { mp.pickMode = k; Array.prototype.forEach.call(box.children, function (c) { c.classList.toggle('active', c === d); }); mpErr(m.desc + ' (applies to rooms you create)'); });
    box.appendChild(d);
  });
  $('btn-create-room').addEventListener('click', function () { var n = ($('mp-name').value || 'PLAYER').toUpperCase(); G.name = n; if (mpConnect()) mp.socket.emit('createRoom', { name: n, carModel: G.selCar, mode: mp.pickMode }); });
  $('btn-show-join').addEventListener('click', function () { $('mp-join-row').style.display = 'flex'; });
  $('btn-join-room').addEventListener('click', function () { var n = ($('mp-name').value || 'PLAYER').toUpperCase(), c = ($('mp-code-input').value || '').toUpperCase().trim(); if (!c) { mpErr('Enter a room code'); return; } G.name = n; if (mpConnect()) mp.socket.emit('joinRoom', { name: n, code: c, carModel: G.selCar }); });
  $('btn-mp-start').addEventListener('click', function () { if (mp.socket) mp.socket.emit('startGame', { roomCode: mp.code }); });
  $('btn-mp-leave').addEventListener('click', function () { if (mp.socket) mp.socket.emit('leaveRoom'); location.reload(); });
});
