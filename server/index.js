const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 3000;

/** Must match client `src/constants.ts` (duplicated for V1). */
const WORLD = { width: 2400, height: 1600 };
const ZONES = {
  pickup: { x: 320, y: 340, r: 72 },
  drop: { x: 2080, y: 1260, r: 72 },
};

const COLORS = ['#e94560', '#0f3460', '#533483', '#f39c12', '#1abc9c', '#9b59b6', '#2ecc71'];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function randomSpawn() {
  const margin = 120;
  return {
    x: margin + Math.random() * (WORLD.width - margin * 2),
    y: margin + Math.random() * (WORLD.height - margin * 2),
    rotation: Math.random() * Math.PI * 2,
  };
}

function createPlayerState(id) {
  const spawn = randomSpawn();
  return {
    id,
    x: spawn.x,
    y: spawn.y,
    rotation: spawn.rotation,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    name: `Rider_${id.slice(0, 4)}`,
    coins: 0,
    hasPackage: false,
  };
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.get('/health', (_req, res) => res.json({ ok: true, players: Object.keys(players).length }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const players = {};

function playerCount() {
  return Object.keys(players).length;
}

function broadcastPlayersOnline() {
  io.emit('playersOnline', playerCount());
}

io.on('connection', (socket) => {
  players[socket.id] = createPlayerState(socket.id);

  socket.emit('init', {
    selfId: socket.id,
    world: WORLD,
    zones: ZONES,
    players: Object.values(players),
    coins: players[socket.id].coins,
    hasPackage: players[socket.id].hasPackage,
  });

  socket.broadcast.emit('playerJoined', players[socket.id]);
  broadcastPlayersOnline();

  socket.on('setName', (name) => {
    const p = players[socket.id];
    if (!p || typeof name !== 'string') return;
    const trimmed = name.trim().slice(0, 20) || p.name;
    p.name = trimmed;
    io.emit('playerMeta', { id: socket.id, name: p.name });
  });

  socket.on('move', (payload) => {
    const p = players[socket.id];
    if (!p || !payload || typeof payload.x !== 'number' || typeof payload.y !== 'number') return;
    p.x = Math.max(0, Math.min(WORLD.width, payload.x));
    p.y = Math.max(0, Math.min(WORLD.height, payload.y));
    if (typeof payload.rotation === 'number') p.rotation = payload.rotation;
    socket.broadcast.emit('playerMoved', {
      id: socket.id,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
    });

    if (!p.hasPackage) {
      if (dist(p.x, p.y, ZONES.pickup.x, ZONES.pickup.y) <= ZONES.pickup.r) {
        p.hasPackage = true;
        socket.emit('deliveryState', { hasPackage: true, coins: p.coins });
      }
    } else {
      if (dist(p.x, p.y, ZONES.drop.x, ZONES.drop.y) <= ZONES.drop.r) {
        p.hasPackage = false;
        p.coins += 10;
        socket.emit('deliveryState', { hasPackage: false, coins: p.coins });
        socket.emit('deliveryComplete', { coins: p.coins });
      }
    }
  });

  socket.on('chat', (text) => {
    if (typeof text !== 'string') return;
    const message = text.trim().slice(0, 200);
    if (!message) return;
    const p = players[socket.id];
    io.emit('chatMessage', {
      id: socket.id,
      name: p ? p.name : 'Unknown',
      message,
      ts: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
    broadcastPlayersOnline();
  });
});

server.listen(PORT, () => {
  console.log(`BikeDash server on http://localhost:${PORT}`);
});
