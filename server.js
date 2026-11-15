// ═══════════════════════════════════════════════
// PUNK CITY — Multiplayer Server
// Node.js + Express + Socket.IO  (deploy on Render free tier)
// Modes: story (first to finish 10 missions) · race (laps, validated checkpoints) · chase (cops vs robber)
// ═══════════════════════════════════════════════
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const Modes    = require('./modes');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] }, pingTimeout: 20000, pingInterval: 10000 });

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const rooms = {};
const PLAYER_COLORS = ['#00ffcc','#ff4433','#ffcc00','#ff44cc'];
const MAX_PLAYERS   = 3;
const TOTAL_MISSIONS = 10;   // story missions (bonus challenges don't count)
const ROOM_TIMEOUT_MS = 60 * 60 * 1000;
const MODES = ['story', 'race', 'chase'];

function genCode() { return Math.random().toString(36).substr(2, 5).toUpperCase(); }
function getRoomCode(id) { return Object.keys(rooms).find(c => rooms[c].players[id]); }
function broadcastRoom(code) { if (rooms[code]) io.to(code).emit('roomUpdate', rooms[code].players); }
function newPlayer(name, carModel, color) {
  return { name: (name||'PLAYER').slice(0,12).toUpperCase(), carModel: (carModel|0) % 5, color, x: 4, z: 4, angle: 0, speed: 0, hidden: false, role: null, score: 0, money: 0, missions: {} };
}
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(code => { if (now - rooms[code].createdAt > ROOM_TIMEOUT_MS) { io.to(code).emit('roomClosed', 'Room expired'); delete rooms[code]; } });
}, 10 * 60 * 1000);

function raceRows(room) {
  const rows = Modes.raceStandings(room.race, Date.now());
  return rows.map(r => ({ id: r.id, pos: r.pos, lap: r.lap, cp: r.cp, c: r.c, finishedAt: r.finishedAt, name: room.players[r.id] ? room.players[r.id].name : '?' }));
}
function endRace(code) {
  const room = rooms[code]; if (!room || !room.race || room.race.over) return;
  room.race.over = true;
  io.to(code).emit('raceEnd', raceRows(room));
}
function endChase(code) {
  const room = rooms[code]; if (!room || !room.chase) return;
  io.to(code).emit('chaseEnd', { winner: room.chase.winner, reason: room.chase.reason, robber: room.chase.robber });
}
function leaveRoom(socket, code) {
  const room = rooms[code]; if (!room) return;
  delete room.players[socket.id]; socket.leave(code);
  io.to(code).emit('playerLeft', socket.id);
  if (room.race && room.race.st[socket.id]) { delete room.race.st[socket.id]; if (room.started && Object.keys(room.race.st).length && Modes.raceCheckEnd(room.race, Date.now())) endRace(code); }
  if (room.chase && !room.chase.over) {
    if (room.chase.robber === socket.id) { Modes.chaseRobberLeft(room.chase); endChase(code); }
    else { room.chase.cops = room.chase.cops.filter(c => c !== socket.id); if (!room.chase.cops.length) { room.chase.over = true; room.chase.winner = 'robber'; room.chase.reason = 'ALL THE COPS LEFT'; endChase(code); } }
  }
  broadcastRoom(code);
  if (Object.keys(room.players).length === 0) delete rooms[code];
}

// 4 Hz mode loop: standings, bust meter, end conditions
setInterval(() => {
  Object.keys(rooms).forEach(code => {
    const room = rooms[code]; if (!room.started) return;
    if (room.race && room.race.startedAt !== null && !room.race.over) {
      io.to(code).emit('raceState', raceRows(room));
      if (Modes.raceCheckEnd(room.race, Date.now())) endRace(code);
    }
    if (room.chase && room.chaseLive && !room.chase.over) {
      const pos = {}, hid = {}; Object.keys(room.players).forEach(id => { pos[id] = { x: room.players[id].x, z: room.players[id].z }; hid[id] = room.players[id].hidden; });
      Modes.chaseTick(room.chase, pos, 0.25, hid);
      io.to(code).emit('chaseState', { t: room.chase.t, bust: room.chase.bust });
      if (room.chase.over) endChase(code);
    }
  });
}, 250);

io.on('connection', socket => {
  socket.on('createRoom', ({ name, carModel, mode }) => {
    const old = getRoomCode(socket.id); if (old) leaveRoom(socket, old);
    let code, tries = 0; do { code = genCode(); tries++; } while (rooms[code] && tries < 20);
    const m = MODES.includes(mode) ? mode : 'story';
    rooms[code] = { players: { [socket.id]: newPlayer(name, carModel, PLAYER_COLORS[0]) }, started: false, createdAt: Date.now(), mode: m, host: socket.id };
    socket.join(code);
    socket.emit('roomCreated', code, 0, m);
    broadcastRoom(code);
  });

  socket.on('joinRoom', ({ name, code, carModel }) => {
    const room = rooms[code];
    if (!room) { socket.emit('joinFail', 'Room not found'); return; }
    if (room.started) { socket.emit('joinFail', 'Game already started'); return; }
    const count = Object.keys(room.players).length;
    if (count >= MAX_PLAYERS) { socket.emit('joinFail', 'Room is full (max 3)'); return; }
    const old = getRoomCode(socket.id); if (old && old !== code) leaveRoom(socket, old);
    room.players[socket.id] = newPlayer(name, carModel, PLAYER_COLORS[count]);
    socket.join(code);
    socket.emit('joinOK', code, count, room.players, room.mode);
    broadcastRoom(code);
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[socket.id] || room.started) return;
    const ids = Object.keys(room.players);
    if (room.mode === 'chase' && ids.length < 2) { socket.emit('startFail', 'Cops vs Robber needs at least 2 players'); return; }
    room.started = true;
    const info = { mode: room.mode };
    if (room.mode === 'race') {
      room.race = Modes.newRace(ids);
      const grid = Modes.raceStarts(ids.length); info.starts = {}; ids.forEach((id, i) => { info.starts[id] = grid[i]; });
      info.cps = Modes.RACE_CPS; info.laps = Modes.RACE_LAPS;
    } else if (room.mode === 'chase') {
      const robber = ids[Math.floor(Math.random() * ids.length)], cops = ids.filter(i => i !== robber);
      room.chase = Modes.newChase(robber, cops);
      const st = Modes.chaseStarts(cops.length); info.starts = {}; info.starts[robber] = st.robber; cops.forEach((id, i) => { info.starts[id] = st.cops[i]; });
      ids.forEach(id => { room.players[id].role = id === robber ? 'robber' : 'cop'; });
      info.robber = robber; info.time = Modes.CHASE_TIME;
    }
    io.to(roomCode).emit('gameStart', room.players, info);
    if (room.mode !== 'story') {
      [3, 2, 1].forEach((n, i) => setTimeout(() => { if (rooms[roomCode]) io.to(roomCode).emit('countdown', n); }, 3000 + i * 1000));
      setTimeout(() => {
        if (!rooms[roomCode]) return;
        if (room.race) room.race.startedAt = Date.now();
        if (room.chase) room.chaseLive = true;
        io.to(roomCode).emit('countdown', 0);
      }, 6000);
    }
  });

  socket.on('playerMove', (data) => {
    const code = getRoomCode(socket.id); if (!code) return;
    const p = rooms[code].players[socket.id]; if (!p) return;
    const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
    p.x = num(data.x); p.z = num(data.z); p.angle = num(data.angle); p.speed = num(data.speed); p.hidden = !!data.hidden;
    socket.to(code).emit('playerMoved', socket.id, { x: p.x, z: p.z, angle: p.angle, vx: num(data.vx), vz: num(data.vz), hidden: p.hidden, model: p.carModel, role: p.role, name: p.name });
  });

  // race: "I passed checkpoint idx"
  socket.on('cpHit', ({ idx }) => {
    const code = getRoomCode(socket.id); if (!code) return;
    const room = rooms[code]; if (!room.race) return;
    const p = room.players[socket.id];
    const r = Modes.raceHit(room.race, socket.id, idx | 0, { x: p.x, z: p.z }, Date.now());
    if (r.ok) { socket.emit('cpOK', r.c); if (r.finished) io.to(code).emit('raceFinish', socket.id, p.name, room.race.st[socket.id].finishedAt); }
    else socket.emit('cpNo', r.why);
  });

  // chase: only the robber can report being wrecked
  socket.on('robberWrecked', () => {
    const code = getRoomCode(socket.id); if (!code) return;
    const room = rooms[code];
    if (room.chase && room.chase.robber === socket.id && !room.chase.over) { Modes.chaseRobberWrecked(room.chase); endChase(code); }
  });

  socket.on('missionDone', ({ key, missions, score, money }) => {
    const code = getRoomCode(socket.id); if (!code) return;
    const room = rooms[code]; const p = room.players[socket.id];
    if (!p || room.mode !== 'story') return;
    const clean = {};
    if (missions && typeof missions === 'object') Object.keys(missions).slice(0, 20).forEach(k => { if (missions[k] === true) clean[k] = true; });
    p.missions = clean;
    p.score = Number.isFinite(score) ? score : p.score;
    p.money = Number.isFinite(money) ? money : p.money;
    broadcastRoom(code);
    if (Object.keys(p.missions).length >= TOTAL_MISSIONS) io.to(code).emit('gameWin', socket.id, p.name);
  });

  socket.on('leaveRoom', () => { const c = getRoomCode(socket.id); if (c) leaveRoom(socket, c); });
  socket.on('disconnect', () => { const c = getRoomCode(socket.id); if (c) leaveRoom(socket, c); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Punk City server running on :${PORT}`));
