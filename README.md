# BikeDash

Tiny multiplayer bike game: **Phaser + Vite + TypeScript** client, **Express + Socket.IO** server.

## Run locally

**1. Server** (from repo root):

```bash
cd server && npm install && npm start
```

**2. Client** (new terminal):

```bash
cd client && npm install && npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Use **WASD** or **arrow keys** to ride. **Green circle** = pickup, **blue** = drop. Chat and name controls are bottom-left.

Optional: copy `client/.env.example` to `client/.env` and set `VITE_SERVER_URL` to your Socket.IO server URL.

## Deploy (Vercel — frontend only)

In Vercel import settings:

- **Root Directory:** `client`
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

Add environment variable **`VITE_SERVER_URL`** pointing to wherever you host the Node server (Railway, Render, Fly.io, etc.). The static Vercel app cannot run Socket.IO by itself.

## Version

BikeDash v0.1-alpha (shown in-game).
