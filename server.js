// ═══════════════════════════════════════════════
// PUNK CITY — Multiplayer Server
// Node.js + Express + Socket.IO
// Deploy on Render.com (free tier)
// ═══════════════════════════════════════════════
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  pingTimeout: 20000,
  pingInterval: 10000
});

// Serve the game client from /public
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ─── Room State ───────────────────────────────
// rooms[code] = {
//   players: { [socketId]: { name, carModel, color, x, z, angle, speed, score, money, missions:{} } },
//   started: false,
//   createdAt: Date
// }
const rooms = {};
const PLAYER_COLORS = ['#00ffcc','#ff4433','#ffcc00','#ff44cc'];
const MAX_PLAYERS   = 3;
const TOTAL_MISSIONS = 14;
const ROOM_TIMEOUT_MS = 60 * 60 * 1000; // auto-clean rooms after 1 hour

// ─── Helpers ──────────────────────────────────
function genCode() {
  return Math.random().toString(36).substr(2, 5).toUpperCase();
}
function getRoom(socketId) {
  return Object.values(rooms).find(r => r.players[socketId]);
}
function getRoomCode(socketId) {
  return Object.keys(rooms).find(c => rooms[c].players[socketId]);
}
function broadcastRoom(code) {
  io.to(code).emit('roomUpdate', rooms[code].players);
}
function cleanOldRooms() {
  const now = Date.now();
  Object.keys(rooms).forEach(code => {
    if (now - rooms[code].createdAt > ROOM_TIMEOUT_MS) {
      io.to(code).emit('roomClosed', 'Room expired');
      delete rooms[code];
    }
  });
}
setInterval(cleanOldRooms, 10 * 60 * 1000);

// ─── Socket Handlers ──────────────────────────
io.on('connection', socket => {
  console.log('connect', socket.id);

  // ── CREATE ROOM ──
  socket.on('createRoom', ({ name, carModel }) => {
    // Leave any existing room first
    const oldCode = getRoomCode(socket.id);
    if (oldCode) {
      delete rooms[oldCode].players[socket.id];
      socket.leave(oldCode);
      broadcastRoom(oldCode);
    }

    let code;
    let tries = 0;
    do { code = genCode(); tries++; }
    while (rooms[code] && tries < 20);

    const colorIdx = 0;
    rooms[code] = {
      players: {
        [socket.id]: {
          name: (name||'PLAYER').slice(0,12).toUpperCase(),
          carModel: carModel || 0,
          color: PLAYER_COLORS[colorIdx],
          x: 4, z: 4, angle: 0, speed: 0,
          score: 0, money: 0, missions: {}
        }
      },
      started: false,
      createdAt: Date.now()
    };
    socket.join(code);
    socket.emit('roomCreated', code, colorIdx);
    broadcastRoom(code);
    console.log(`Room ${code} created by ${name}`);
  });

  // ── JOIN ROOM ──
  socket.on('joinRoom', ({ name, code, carModel }) => {
    const room = rooms[code];
    if (!room) { socket.emit('joinFail', 'Room not found'); return; }
    if (room.started) { socket.emit('joinFail', 'Game already started'); return; }
    const count = Object.keys(room.players).length;
    if (count >= MAX_PLAYERS) { socket.emit('joinFail', 'Room is full (max 3)'); return; }

    const colorIdx = count;
    const oldCode = getRoomCode(socket.id);
    if (oldCode && oldCode !== code) {
      delete rooms[oldCode].players[socket.id];
      socket.leave(oldCode);
      broadcastRoom(oldCode);
    }

    room.players[socket.id] = {
      name: (name||'PLAYER').slice(0,12).toUpperCase(),
      carModel: carModel || 0,
      color: PLAYER_COLORS[colorIdx],
      x: 4, z: 4, angle: 0, speed: 0,
      score: 0, money: 0, missions: {}
    };
    socket.join(code);
    socket.emit('joinOK', code, colorIdx, room.players);
    broadcastRoom(code);
    console.log(`${name} joined room ${code}`);
  });

  // ── START GAME ──
  socket.on('startGame', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[socket.id]) return;
    if (room.started) return;
    room.started = true;
    io.to(roomCode).emit('gameStart', room.players);
    console.log(`Room ${roomCode} game started`);
  });

  // ── PLAYER POSITION UPDATE (high-frequency, from every client) ──
  socket.on('playerMove', (data) => {
    const code = getRoomCode(socket.id);
    if (!code) return;
    const p = rooms[code].players[socket.id];
    if (!p) return;
    p.x = data.x; p.z = data.z;
    p.angle = data.angle; p.speed = data.speed;
    // Broadcast to others only (not sender)
    socket.to(code).emit('playerMoved', socket.id, {
      x: p.x, z: p.z, angle: p.angle, speed: p.speed, name: p.name
    });
  });

  // ── MISSION COMPLETE ──
  socket.on('missionDone', ({ key, missions, score, money }) => {
    const code = getRoomCode(socket.id);
    if (!code) return;
    const p = rooms[code].players[socket.id];
    if (!p) return;
    p.missions = missions || p.missions;
    p.score    = score   || p.score;
    p.money    = money   || p.money;
    // Broadcast updated leaderboard
    broadcastRoom(code);

    // Check win: first player to complete all missions
    const done = Object.keys(p.missions).length;
    if (done >= TOTAL_MISSIONS) {
      io.to(code).emit('gameWin', socket.id, p.name);
      console.log(`${p.name} wins room ${code}!`);
    }
  });

  // ── LEAVE ROOM ──
  socket.on('leaveRoom', () => {
    const code = getRoomCode(socket.id);
    if (!code) return;
    delete rooms[code].players[socket.id];
    socket.leave(code);
    io.to(code).emit('playerLeft', socket.id);
    broadcastRoom(code);
    if (Object.keys(rooms[code].players).length === 0) delete rooms[code];
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    const code = getRoomCode(socket.id);
    if (code && rooms[code]) {
      delete rooms[code].players[socket.id];
      io.to(code).emit('playerLeft', socket.id);
      broadcastRoom(code);
      if (Object.keys(rooms[code].players).length === 0) delete rooms[code];
    }
    console.log('disconnect', socket.id);
  });
});

// ─── Start ────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Punk City server running on :${PORT}`));
