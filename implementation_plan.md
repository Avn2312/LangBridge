# LangBridge — Production Upgrade Plan (Final)

> **Decisions Made:**
> - ✅ Backend uses **CommonJS** (`require/module.exports`) throughout
> - ✅ Frontend stays with **ESM** (`import/export`) — required by React/Vite
> - ✅ **Remove Stream.io entirely** (Chat + Video) — build our own real-time system
> - ✅ **Redis setup included** (local installation + configuration)

---

## Phase 1: Fix Existing Bugs & Convert to CommonJS

> **Goal:** Make the app actually start and run without crashes.

### Bug 1: Module System Mismatch
**Problem:** `package.json` has `"type": "module"` but files mix `import` and `require`
**Fix:** Remove `"type": "module"` from backend `package.json`, convert ALL files to CommonJS

**Files affected:**
- [server.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/server.js) — convert imports to require
- [auth.controller.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/controllers/auth.controller.js) — convert to CJS
- [chat.controller.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/controllers/chat.controller.js) — convert to CJS
- [user.controller.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/controllers/user.controller.js) — convert to CJS
- [User.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/models/User.js) — convert to CJS
- [FriendRequest.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/models/FriendRequest.js) — convert to CJS
- [db.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/lib/db.js) — convert to CJS
- [stream.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/lib/stream.js) — will be DELETED (Stream removed)
- [passport.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/lib/passport.js) — already CJS, fix bugs
- [redis.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/lib/redis.js) — fix variable collision + convert
- [auth.middleware.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/middlewares/auth.middleware.js) — convert to CJS
- [auth.route.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/routes/auth.route.js) — convert to CJS
- [chat.route.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/routes/chat.route.js) — will be DELETED (Stream removed)
- [user.route.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/routes/user.route.js) — convert to CJS

### Bug 2: Redis Variable Collision
**Problem:** `import redis from 'ioredis'` then `const redis = new Redis()` — same name, crash
**Fix:** Use `const Redis = require("ioredis")` then `const redis = new Redis()`

### Bug 3: passport.js Typo
**Problem:** `User.findONe()` instead of `User.findOne()`
**Fix:** Correct the typo

### Bug 4: User Model Missing OAuth Fields
**Problem:** Passport strategy creates users with `googleId` and `provider` but model doesn't have these
**Fix:** Add `googleId`, `provider` fields; make `password` not required (for OAuth users)

### Bug 5: OAuth Callback URL Mismatch
**Problem:** Passport says `localhost:5000/auth/google/callback` but server is on port 5001 with `/api` prefix
**Fix:** Change to `http://localhost:5001/api/auth/google/callback`

### Bug 6: Inconsistent Cookie Settings
**Problem:** Signup uses `sameSite: "strict"`, login uses `sameSite: "none"` — different behavior
**Fix:** Create a shared `setAuthCookie()` helper with consistent settings

---

## Phase 2: Redis Setup & Configuration

> **Goal:** Get Redis running locally and connected to the backend.

### Steps:
1. Install Redis via Homebrew: `brew install redis`
2. Start Redis: `brew services start redis`
3. Verify connection: `redis-cli ping` → should return `PONG`
4. Install backend dependencies: `@socket.io/redis-adapter`, `connect-redis`
5. Update [redis.js](file:///Users/avn2312/Desktop/LangBridge/backend/src/lib/redis.js) with proper connection + error handling
6. Add Redis as Express session store (replaces in-memory sessions)

### Why Redis? (Interview Answer)

```
Without Redis:
  Server 1 knows about User A's session
  Server 2 has NO idea User A is logged in → "Unauthorized"!

With Redis (shared session store):
  Server 1 stores session in Redis
  Server 2 reads session from Redis → "User A is authenticated" ✅
```

Redis serves THREE purposes in our app:
1. **Session Store** — shared sessions across server instances
2. **Pub/Sub** — forward WebSocket events between server instances
3. **Online Users Cache** — track who's online in real-time (Redis Set)

---

## Phase 3: Socket.IO Server + Event Architecture

> **Goal:** Build our own real-time communication layer.

### New Files:
- **[NEW]** `backend/src/lib/socket.js` — Socket.IO server with Redis adapter
- **[NEW]** `backend/src/models/Message.js` — Message schema for chat persistence
- **[NEW]** `backend/src/controllers/message.controller.js` — Message history, conversations
- **[NEW]** `backend/src/routes/message.route.js` — Message API routes

### Socket.IO Event Architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    EVENT FLOW MAP                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CLIENT → SERVER Events:                                │
│  ─────────────────────                                  │
│  "sendMessage"      → save to MongoDB → emit to target  │
│  "typing"           → forward to target user             │
│  "stopTyping"       → forward to target user             │
│  "markAsRead"       → update readAt in MongoDB           │
│                                                         │
│  SERVER → CLIENT Events:                                │
│  ─────────────────────                                  │
│  "newMessage"       → new message received               │
│  "userOnline"       → a friend came online               │
│  "userOffline"      → a friend went offline              │
│  "typing"           → someone is typing to you           │
│  "stopTyping"       → they stopped typing                │
│  "newFriendRequest" → someone sent you a friend request  │
│  "friendRequestAccepted" → your request was accepted     │
│  "messageRead"      → your message was read              │
│                                                         │
│  CONNECTION Events:                                     │
│  ─────────────────                                      │
│  "connection"       → authenticate JWT, join user room   │
│  "disconnect"       → remove from online set, notify     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### How the Redis Adapter Works (Key Interview Concept):

```
User A (Server 1) sends message to User B (Server 2):

1. Client A emits "sendMessage" to Server 1
2. Server 1 saves message to MongoDB
3. Server 1 does: io.to(userB_room).emit("newMessage", msg)
4. Redis Adapter intercepts this ↑
5. Adapter PUBLISHES to Redis channel: "socket.io#/#userB_room#"
6. Server 2 is SUBSCRIBED to that channel
7. Server 2 receives the publish, finds User B's socket
8. Server 2 emits "newMessage" to User B's socket
9. User B sees the message instantly ✅
```

**Without Redis Adapter:** Step 3 would only check Server 1's local sockets → User B never gets the message ❌

---

## Phase 4: Frontend WebSocket Integration

> **Goal:** Connect React to Socket.IO, replace Stream Chat entirely.

### New Files:
- **[NEW]** `frontend/src/hooks/useSocket.js` — Socket.IO connection + event management
- **[NEW]** `frontend/src/store/socketStore.js` — Real-time state (online users, messages, typing)
- **[NEW]** `frontend/src/pages/ChatPage.jsx` — Custom chat UI (replaces Stream Chat UI)
- **[NEW]** `frontend/src/components/MessageBubble.jsx` — Individual message component
- **[NEW]** `frontend/src/components/ChatInput.jsx` — Message input with typing indicator

### Modified Files:
- `frontend/src/main.jsx` — Remove Stream CSS, add Socket provider
- `frontend/src/pages/HomePage.jsx` — Online status dots on friend cards
- `frontend/src/pages/NotificationPage.jsx` — Real-time friend request alerts
- `frontend/src/pages/CallPage.jsx` — Removed (Stream Video removed) OR kept as placeholder
- `frontend/package.json` — Add `socket.io-client`, remove all Stream packages

### How Real Apps Manage Real-Time UI (Interview Gold):

```
WhatsApp Architecture:
  - WebSocket for message delivery
  - Local SQLite/IndexedDB for offline message cache
  - "Last seen" = Redis sorted set with timestamps
  - Blue ticks = separate "messageRead" event back to sender

Slack Architecture:
  - WebSocket for real-time (messages, typing, presence)
  - REST API for history (pagination, search)
  - Redux store synced with WS events
  - Optimistic UI updates (message appears before server confirms)

Our LangBridge (same pattern!):
  - Socket.IO for real-time (messages, typing, presence, notifications)
  - REST API for history (TanStack Query with pagination)
  - Zustand store synced with socket events
  - Optimistic message sending
```

---

## Phase 5: OAuth Production-Ready

> **Goal:** Make Google OAuth work properly with JWT-based auth.

### The OAuth + JWT Flow:

```
1. User clicks "Sign in with Google"
2. Frontend redirects to: GET /api/auth/google
3. Passport redirects to: Google's consent screen
4. User approves → Google redirects to: /api/auth/google/callback
5. Passport strategy runs:
   a. Finds or creates user in MongoDB
   b. Syncs Google profile pic
6. Callback handler:
   a. Generates JWT (same as email/password login)
   b. Sets JWT in httpOnly cookie (same as email/password login)
   c. Redirects to frontend: http://localhost:5173/
7. Frontend loads → calls /api/auth/me → cookie sent → user authenticated ✅
```

**Key insight:** OAuth and email/password login CONVERGE at the JWT step. After authentication (however it happens), the system works identically.

---

## Phase 6: Logging & Observability

### Structured Logger:
- Replace all `console.log` with a proper logger
- Log levels: `debug`, `info`, `warn`, `error`
- Include context: `{ userId, event, timestamp, duration }`

### WebSocket Debugging:
- Log every connection/disconnection with user ID
- Log Redis Pub/Sub publish/subscribe events
- Track message delivery latency

---

## Verification Plan

### After Each Phase:
| Phase | Test |
|-------|------|
| Phase 1 | `npm run dev` → server starts without crashes |
| Phase 2 | `redis-cli ping` → PONG, server logs "Redis connected" |
| Phase 3 | Two browser tabs → send message → arrives in real-time |
| Phase 4 | Full chat UI works, typing indicators, online status |
| Phase 5 | "Sign in with Google" → lands on home page, authenticated |
| Phase 6 | Structured logs appear in console with timestamps + context |
