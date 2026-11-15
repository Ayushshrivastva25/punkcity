// ═══════════════════════════════════════════════
// MULTIPLAYER — lobby, remote cars, leaderboard, race to finish all missions
// ═══════════════════════════════════════════════
var mp = { socket: null, active: false, code: null, myId: null, players: {}, remotes: {}, hidden: false, lbT: 0 };

function mpSetInside(b) { mp.hidden = !!b; }
function setupMpHud() { show('mp-hud', mp.active, 'block'); }

function mpErr(m) { var e = $('mp-error'); if (e) e.textContent = m || ''; }
function mpConnect() {
  if (mp.socket) return true;
  if (typeof io === 'undefined') { mpErr('Multiplayer server not reachable'); return false; }
  var s = mp.socket = io();
  s.on('connect', function () { mp.myId = s.id; });
  s.on('roomCreated', function (code) { mp.code = code; mpShowWaiting(); });
  s.on('joinOK', function (code, ci, players) { mp.code = code; mp.players = players; mpShowWaiting(); mpRenderPlayers(); });
  s.on('joinFail', function (m) { mpErr(m); });
  s.on('roomUpdate', function (players) { mp.players = players; mpRenderPlayers(); });
  s.on('roomClosed', function () { location.reload(); });
  s.on('gameStart', function (players) { mp.players = players; mp.active = true; startGame(); mpStartLoops(); });
  s.on('playerMoved', function (id, d) { mpRemoteUpdate(id, d); });
  s.on('playerLeft', function (id) { mpRemoteRemove(id); delete mp.players[id]; });
  s.on('gameWin', function (id, name) {
    if (id === mp.myId) { triggerWin(); return; }
    G.over = true; G.running = false; stopSiren();
    $('mp-win-name').textContent = name + ' WINS!'; $('mp-win-sub').textContent = 'THEY FINISHED ALL 10 MISSIONS FIRST';
    $('mp-winner').classList.add('show');
  });
  return true;
}
function mpShowWaiting() {
  $('title-btns').style.display = 'none'; $('mp-join-row').style.display = 'none'; $('car-chips').style.display = 'none';
  $('mp-name').style.display = 'none'; $('title-help').style.display = 'none';
  $('mp-waiting').style.display = 'flex'; $('mp-room-code').textContent = mp.code; mpErr('');
}
function mpRenderPlayers() {
  var h = '';
  Object.keys(mp.players).forEach(function (id) { var p = mp.players[id]; h += '<div class="mp-player-row"><div class="mp-player-dot" style="background:' + p.color + '"></div><span>' + p.name + (id === mp.myId ? ' (YOU)' : '') + '</span></div>'; });
  $('mp-players-list').innerHTML = h;
}
function mpStartLoops() {
  setInterval(function () {
    if (!mp.socket || !G.car || !G.running) return;
    var c = G.car;
    mp.socket.emit('playerMove', { x: c.x, z: c.z, angle: c.a, vx: c.vx, vz: c.vz, hidden: mp.hidden, model: G.selCar });
  }, 100);
}
function mpMissionDone(id, n) {
  if (!mp.active || !mp.socket) return;
  var done = {}; for (var i = 0; i < n; i++) done[MAIN[i].id] = true;
  mp.socket.emit('missionDone', { key: id, missions: done, score: G.score, money: Math.floor(G.money) });
}

function mpRemoteUpdate(id, d) {
  if (!G.built || !W.root) return;
  var r = mp.remotes[id];
  if (!r) {
    var pl = mp.players[id] || { name: d.name || 'PLAYER', color: '#ffffff' };
    var m = CAR_MODELS[d.model || 0] || CAR_MODELS[0];
    var mesh = buildCarMesh({ color: m.color, accent: m.accent, roof: m.roof, stripe: m.stripe });
    W.root.add(mesh);
    var lb = document.createElement('div'); lb.className = 'other-label'; lb.style.color = pl.color; lb.style.borderColor = pl.color; lb.textContent = pl.name; document.body.appendChild(lb);
    r = mp.remotes[id] = { mesh: mesh, car: Core.makeCar(d.x, d.z, d.angle), label: lb, color: pl.color, hidden: false, tx: d.x, tz: d.z, ta: d.angle };
  }
  r.tx = d.x; r.tz = d.z; r.ta = d.angle; r.hidden = !!d.hidden; r.car.vx = d.vx || 0; r.car.vz = d.vz || 0;
}
function mpRemoteRemove(id) {
  var r = mp.remotes[id]; if (!r) return;
  W.root.remove(r.mesh); if (r.label.parentNode) r.label.parentNode.removeChild(r.label); delete mp.remotes[id];
}
function mpUpdateRemotes(dt) {
  var ids = Object.keys(mp.remotes); if (!ids.length) return;
  var show = G.running && G.mode === 'car' && !G.paused, v = new THREE.Vector3();
  ids.forEach(function (id) {
    var r = mp.remotes[id], c = r.car, k = 1 - Math.exp(-12 * dt);
    c.x += (r.tx - c.x) * k; c.z += (r.tz - c.z) * k; c.a += Core.angDiff(c.a, r.ta) * k;
    c.vf = c.vx * Math.sin(c.a) + c.vz * Math.cos(c.a); c.vl = 0;
    r.mesh.visible = !r.hidden;
    syncCarMesh(r.mesh, c, dt, W.dayF === undefined ? 0 : 1 - W.dayF);
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
  for (var id in mp.remotes) { var q = mp.remotes[id]; if (q.hidden) continue; var p = P(q.car.x, q.car.z); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); }
}
function mpUpdateHud() {
  if (!mp.active) return;
  var now = performance.now(); if (now - mp.lbT < 500) return; mp.lbT = now;
  var rows = Object.keys(mp.players).map(function (id) { var p = mp.players[id]; var n = Object.keys(p.missions || {}).filter(function (k) { return p.missions[k]; }).length; if (id === mp.myId) n = G.m ? G.m.cur : n; return { p: p, n: n, me: id === mp.myId }; });
  rows.sort(function (a, b) { return b.n - a.n; });
  $('mp-lb-rows').innerHTML = rows.map(function (r) { return '<div class="mh-row"><div class="mh-dot" style="background:' + r.p.color + '"></div><span class="mh-name">' + r.p.name + (r.me ? ' ★' : '') + '</span><span class="mh-tasks">' + r.n + '/10</span></div>'; }).join('');
}

window.addEventListener('load', function () {
  $('btn-create-room').addEventListener('click', function () { var n = ($('mp-name').value || 'PLAYER').toUpperCase(); G.name = n; if (mpConnect()) mp.socket.emit('createRoom', { name: n, carModel: G.selCar }); });
  $('btn-show-join').addEventListener('click', function () { $('mp-join-row').style.display = 'flex'; });
  $('btn-join-room').addEventListener('click', function () { var n = ($('mp-name').value || 'PLAYER').toUpperCase(), c = ($('mp-code-input').value || '').toUpperCase().trim(); if (!c) { mpErr('Enter a room code'); return; } G.name = n; if (mpConnect()) mp.socket.emit('joinRoom', { name: n, code: c, carModel: G.selCar }); });
  $('btn-mp-start').addEventListener('click', function () { if (mp.socket) mp.socket.emit('startGame', { roomCode: mp.code }); });
  $('btn-mp-leave').addEventListener('click', function () { if (mp.socket) mp.socket.emit('leaveRoom'); location.reload(); });
});
