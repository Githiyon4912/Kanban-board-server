# Kanban Board — Backend

Node.js API for the real-time collaborative Kanban board. Handles authentication, boards, lists, cards, and live Socket.io sync.

## What this service does

- **Auth** — signup, login, logout, profile update/delete with JWT in httpOnly cookies
- **Boards** — create, list, join via invite code, rename, delete (delete only when the board has no lists; owner only)
- **Lists & cards** — CRUD, reorder lists, move/reorder cards (including `assignedTo`)
- **Real-time** — Socket.io rooms per `boardId`; membership checked before every mutation

REST is used for auth, board management, and initial board load. Socket.io is used for live in-board updates so collaborators see changes without refreshing.

## Tech stack

| Piece        | Library                          |
|--------------|----------------------------------|
| Runtime      | Node.js (ES modules)             |
| HTTP         | Express                          |
| Database     | MongoDB + Mongoose               |
| Auth         | JWT + bcryptjs + cookie-parser   |
| Real-time    | Socket.io                        |
| Dev server   | nodemon                          |

## Folder structure

```
backend/
├── config/db.js              # MongoDB connection
├── models/                   # User, Board, List, Card
├── controllers/              # Route handlers
├── routes/                   # Express routers
├── middleware/authMiddleware.js
├── sockets/socketHandler.js  # Board room events
├── utils/boardAccess.js      # Membership helpers
├── server.js                 # App entry (HTTP + Socket.io)
├── .env.example
└── package.json
```

## Setup

```bash
cd backend
cp .env.example .env
# Set MONGO_URI and JWT_SECRET
npm install
npm run dev
```

API base: `http://localhost:5000`  
Health check: `GET /api/health` → `{ "ok": true }`

## Environment variables

| Variable     | Description |
|--------------|-------------|
| `PORT`       | Server port (default `5000`) |
| `MONGO_URI`  | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `CLIENT_URL` | Comma-separated frontend origins for CORS (e.g. `http://localhost:5173,https://kanbanbordpor.netlify.app`) |
| `NODE_ENV`   | `development` or `production` |

## Main REST routes

### Auth (`/api/auth`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/signup` | No | Create account, set cookie |
| POST | `/login` | No | Login, set cookie |
| POST | `/logout` | Yes | Clear cookie |
| GET | `/me` | Yes | Current user |
| PATCH | `/me` | Yes | Update name/email/password |
| DELETE | `/me` | Yes | Delete account (password required) |

### Boards (`/api/boards`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Boards you own or joined (+ `listCount`) |
| POST | `/` | Create board |
| POST | `/join` | Join with `{ inviteCode }` |
| GET | `/:id` | Full board (lists + cards + members) |
| PATCH | `/:id` | Rename board |
| DELETE | `/:id` | Delete board (owner only, no lists allowed) |

### Lists (`/api/lists`) & Cards (`/api/cards`)

Create, update, delete, reorder lists, and move cards. All routes require auth and board membership.

## Socket.io

- Client connects with `withCredentials: true` so the JWT **httpOnly cookie** is sent on the handshake (no separate socket token).
- Events: `board:join` / `board:leave`, `list:*`, `card:*`
- Server verifies membership, writes to MongoDB, then `socket.to(boardId).emit(...)` (not back to sender).

## Scripts

```bash
npm run dev    # nodemon (development)
npm start      # node server.js (production)
```

## Deploy notes

Use a **persistent** host (Render, Railway, etc.) — Socket.io does not work well on serverless. Set `CLIENT_URL` to your frontend URL and enable CORS credentials.
