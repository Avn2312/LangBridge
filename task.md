# LangBridge — Task Checklist

> **Module System Decision:** Staying with **ES Modules** (`import`/`export`) throughout — not converting to CommonJS.

---

## Phase 1: Fix Bugs & Ensure ES Module Consistency
> Make the app actually start without crashing — using ES modules everywhere

- [x] **1.1** Keep `"type": "module"` in `backend/package.json` (ES modules confirmed)
- [x] **1.2** `backend/src/lib/db.js` — uses ES module syntax ✅
- [x] **1.3** `backend/src/lib/redis.js` — uses ES module syntax, variable collision fixed ✅
- [x] **1.4** `backend/src/lib/passport.js` — `findONe` typo fixed, callback URL correct, field names corrected ✅
- [x] **1.5** `backend/src/models/User.js` — ES modules + `googleId`, `provider` fields added + `password` made optional ✅
- [x] **1.6** `backend/src/models/FriendRequest.js` — uses ES module syntax ✅
- [x] **1.7** `backend/src/middlewares/auth.middleware.js` — uses ES module syntax + token blacklist via Redis ✅
- [x] **1.8** `backend/src/lib/auth.utils.js` — created with `generateToken`, `generateVerificationToken`, `setAuthCookie`, `clearAuthCookie` ✅
- [x] **1.9** `backend/src/controllers/auth.controller.js` — uses ES modules + shared auth utils + cookie consistency ✅
- [x] **1.10** `backend/src/controllers/user.controller.js` — uses ES module syntax ✅
- [x] **1.11** Deleted `backend/src/controllers/chat.controller.js` (Stream-specific) ✅
- [x] **1.12** `backend/src/routes/auth.route.js` — ES modules + OAuth callback generates JWT cookie ✅
- [x] **1.13** `backend/src/routes/user.route.js` — uses ES module syntax ✅
- [x] **1.14** Deleted `backend/src/routes/chat.route.js` (Stream-specific) ✅
- [x] **1.15** Deleted `backend/src/lib/stream.js` (Stream-specific) ✅
- [x] **1.16** `backend/server.js` — ES modules, imports app.js cleanly, no Stream references ✅
- [x] **1.17** `stream-chat` removed from `backend/package.json` ✅
- [x] **1.18** `frontend/tailwind.config.js` — fixed mixed `require("daisyui")` → uses imported `daisyui` variable ✅
- [x] **1.19** `frontend/vite.config.js` — removed dead Stream chunk splitter config ✅
- [x] **1.20** Test: `npm run dev` → server starts without errors ✅ (Redis + MongoDB connected, port 3000)
- [x] **1.21** Test: POST `/api/auth/signup` → returns 201 + user object + `jwt` httpOnly cookie set ✅

---

## Phase 2: Redis Setup & Configuration
> Get Redis running and connected

- [x] **2.1** `ioredis` + `redis` packages installed in `backend/package.json` ✅
- [x] **2.2** `connect-redis` installed ✅
- [x] **2.3** `backend/src/lib/redis.js` — `redis` (ioredis) + `sessionRedisClient` (node-redis) created ✅
- [x] **2.4** `backend/src/app.js` — Express sessions configured with `RedisStore` ✅
- [x] **2.5** Using **cloud Redis** (RedisLabs) via `.env` — no local install needed ✅
- [x] **2.6** Cloud Redis always running — no local service required ✅
- [x] **2.7** `@socket.io/redis-adapter` installed ✅
- [x] **2.8** `backend/src/lib/redis.js` — `pubClient` + `subClient` ioredis pair added ✅
- [x] **2.9** Test: All 4 Redis connections logged on startup (main, pub, sub, session store) ✅
- [x] **2.10** Test: JWT cookie persists across requests — `GET /api/auth/me` returns user from saved cookie ✅

---

## Phase 3: Socket.IO Server + Event Architecture
> Build our own real-time communication layer

- [x] **3.1** `socket.io` installed in `backend/package.json` ✅
- [x] **3.2** Created `backend/src/lib/socket.js` — Socket.IO server setup ✅
  - [x] 3.2a: Initialized with CORS config (credentials, frontend origin) ✅
  - [x] 3.2b: Redis adapter attached (`pubClient`/`subClient`) ✅
  - [x] 3.2c: JWT cookie auth middleware for WebSocket connections ✅
  - [x] 3.2d: Online users tracked in Redis Set (`langbridge:online_users`) ✅
  - [x] 3.2e: Events: `sendMessage`, `typing`, `stopTyping`, `markAsRead` ✅
  - [x] 3.2f: Presence broadcasting: `onlineUsers` on connect/disconnect ✅
- [x] **3.3** Created `backend/src/models/Message.js` — message schema (sender, receiver, text, read, compound index) ✅
- [x] **3.4** Created `backend/src/controllers/message.controller.js` ✅
  - [x] 3.4a: `getMessages()` — paginated + marks as read on fetch ✅
  - [x] 3.4b: `getConversations()` — MongoDB aggregation with unread counts ✅
- [x] **3.5** Created `backend/src/routes/message.route.js` ✅
- [x] **3.6** Updated `backend/server.js` — `http.createServer`, Socket.IO attached ✅
- [x] **3.7** Updated `user.controller.js` — `friendRequest` + `accepted` events emitted in real-time ✅
- [x] **3.8** Test: Socket.IO client connects — `connection` event fired ✅ (id: klifDkXveIVLz2GfAAAC)
- [x] **3.9** Test: Message saved to MongoDB + delivered via socket to receiver room ✅ (saved `_id` confirmed)
- [x] **3.10** Test: `onlineUsers` broadcast fires on connect ✅

---

## Phase 4: Frontend WebSocket Integration
> Connect React to our Socket.IO server, build custom chat UI

- [ ] **4.1** Install `socket.io-client` on frontend
- [ ] **4.2** Remove Stream packages (`stream-chat`, `stream-chat-react`, `@stream-io/video-react-sdk`) from `frontend/package.json`
- [ ] **4.3** Create `frontend/src/store/socketStore.js` — Zustand store for real-time state
  - [ ] 4.3a: `onlineUsers` set
  - [ ] 4.3b: `messages` map (conversationId → messages[])
  - [ ] 4.3c: `typingUsers` map
  - [ ] 4.3d: `unreadCounts` map
- [ ] **4.4** Create `frontend/src/hooks/useSocket.js` — Socket.IO connection hook
  - [ ] 4.4a: Connect on auth, disconnect on logout
  - [ ] 4.4b: Reconnection with exponential backoff
  - [ ] 4.4c: Event listeners that sync to Zustand store
- [ ] **4.5** Create `frontend/src/components/MessageBubble.jsx`
- [ ] **4.6** Create `frontend/src/components/ChatInput.jsx` — with typing indicator emission
- [ ] **4.7** Rebuild `frontend/src/pages/ChatPage.jsx` — custom chat UI with Socket.IO
- [ ] **4.8** Update `frontend/src/pages/HomePage.jsx` — online status dots on friend cards
- [ ] **4.9** Update `frontend/src/pages/NotificationPage.jsx` — real-time friend request alerts
- [ ] **4.10** Update/Remove `frontend/src/pages/CallPage.jsx` — remove Stream Video
- [ ] **4.11** Update `frontend/src/main.jsx` — remove Stream CSS imports, add socket initialization
- [ ] **4.12** Remove `VITE_STREAM_API_KEY` from frontend `.env`
- [ ] **4.13** Test: Login → socket connects → online status shows
- [ ] **4.14** Test: Two browser tabs → full chat flow works
- [ ] **4.15** Test: Friend request → notification appears in real-time (no refresh)

---

## Phase 5: OAuth Production-Ready
> Make Google OAuth work end-to-end with JWT

- [x] **5.1** `passport.js` — `findONe` typo fixed + field mapping correct ✅
- [x] **5.2** OAuth callback generates JWT + sets same cookie as email/password login ✅
- [x] **5.3** "Onboarding needed" redirect handled in OAuth callback (`isOnboarded` check) ✅
- [ ] **5.4** Add "Sign in with Google" button on `LoginPage.jsx`
- [ ] **5.5** Add "Sign in with Google" button on `SignUpPage.jsx`
- [ ] **5.6** Test: Full OAuth flow → Google → callback → JWT cookie → home page
- [ ] **5.7** Test: Existing email user → account linking works (Google login connects to email account)

---

## Phase 6: Logging & Observability
> Replace console.log with structured, debuggable logging

- [ ] **6.1** Create `backend/src/lib/logger.js` — structured logger with levels
- [ ] **6.2** Create `backend/src/middlewares/errorHandler.js` — global error handler
- [ ] **6.3** Replace all `console.log` / `console.error` across backend with logger
- [ ] **6.4** Add request logging middleware (method, path, status, duration)
- [ ] **6.5** Add Socket.IO event logging (connection, disconnect, message, errors)
- [ ] **6.6** Add Redis event logging (connect, disconnect, pub/sub events)
- [ ] **6.7** Test: All logs show with `{ timestamp, level, message, context }` format

---

## 🎓 Post-Implementation: Interview Prep
> After all phases are done

- [ ] Practice: "Explain your project end-to-end"
- [ ] Practice: "How does your WebSocket scaling work?"
- [ ] Practice: "What role does Redis play in your architecture?"
- [ ] Practice: "How would you handle 1 million concurrent users?"
- [ ] Practice: "Walk me through what happens when User A sends a message to User B"
