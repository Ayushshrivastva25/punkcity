# PUNK CITY — Multiplayer Deployment Guide

## Folder structure
```
punk-city-server/
├── server.js          ← Node.js + Socket.IO backend
├── package.json       
├── .gitignore         
└── public/
    └── index.html     ← The full game (auto-served by server)
```

---

## Deploy on Render.com (FREE — recommended)

Render keeps WebSocket connections alive unlike Vercel/Netlify.

### Steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "punk city multiplayer"
   git remote add origin https://github.com/YOUR_USERNAME/punk-city.git
   git push -u origin main
   ```

2. **Create Render Web Service**
   - Go to https://render.com → New → Web Service
   - Connect your GitHub repo
   - Set these fields:
     | Field | Value |
     |---|---|
     | Runtime | Node |
     | Build Command | `npm install` |
     | Start Command | `npm start` |
     | Instance Type | Free |

3. **Done!** Render gives you a URL like `https://punk-city-xxxx.onrender.com`

   Share this URL — players open it in browser, no install needed.

---

## How multiplayer works

- Player opens the URL → sees lobby screen
- **Create Room** → gets a 5-letter room code (e.g. `AB3XZ`)
- **Join Room** → enter the code a friend shared
- Max 3 players per room
- Host clicks **START GAME** when ready
- First player to complete ALL 14 missions wins
- Other players' cars are visible in real-time on your screen
- Live leaderboard shows missions done + score for each player

---

## Local development

```bash
npm install
npm start
# Open http://localhost:3000
```

---

## Notes

- Free Render instances sleep after 15 min of inactivity (first request wakes it, ~30s delay)
- To avoid sleep: upgrade to Render Starter ($7/mo) or ping the URL every 10 min with UptimeRobot (free)
- Room codes are auto-cleaned after 1 hour of inactivity
- Solo play still works — click "SOLO PLAY" on the lobby screen to skip multiplayer
