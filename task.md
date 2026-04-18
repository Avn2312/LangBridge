# LangBridge — Task Checklist

---

## Phase 1: Fix Bugs & Convert Backend to CommonJS
> Make the app actually start without crashing

- [ ] **1.1** Remove `"type": "module"` from `backend/package.json`
- [ ] **1.2** Convert `backend/src/lib/db.js` to CommonJS
- [ ] **1.3** Convert `backend/src/lib/redis.js` to CommonJS + fix variable collision
- [ ] **1.4** Fix `backend/src/lib/passport.js` — fix `findONe` typo, fix callback URL, fix field names
- [ ] **1.5** Convert `backend/src/models/User.js` to CommonJS + add `googleId`, `provider` fields + make `password` optional
- [ ] **1.6** Convert `backend/src/models/FriendRequest.js` to CommonJS
- [ ] **1.7** Convert `backend/src/middlewares/auth.middleware.js` to CommonJS
- [ ] **1.8** Create `backend/src/lib/auth.utils.js` — shared JWT + cookie helper functions
- [ ] **1.9** Convert `backend/src/controllers/auth.controller.js` to CommonJS + use shared auth utils + fix cookie inconsistency
- [ ] **1.10** Convert `backend/src/controllers/user.controller.js` to CommonJS
- [ ] **1.11** Delete `backend/src/controllers/chat.controller.js` (Stream-specific, being replaced)
- [ ] **1.12** Convert `backend/src/routes/auth.route.js` to CommonJS + fix OAuth callback to use JWT
- [ ] **1.13** Convert `backend/src/routes/user.route.js` to CommonJS
- [ ] **1.14** Delete `backend/src/routes/chat.route.js` (Stream-specific)
- [ ] **1.15** Delete `backend/src/lib/stream.js` (Stream-specific)
- [ ] **1.16** Convert `backend/src/server.js` to CommonJS + remove Stream references
- [ ] **1.17** Remove `stream-chat` from backend dependencies
- [ ] **1.18** Test: `npm run dev` → server starts without errors
- [ ] **1.19** Test: POST `/api/auth/signup` → returns user + sets JWT cookie

---

## Phase 2: Redis Setup & Configuration
> Get Redis running and connected

- [ ] **2.1** Install Redis locally (`brew install redis`)
- [ ] **2.2** Start Redis service (`brew services start redis`)
- [ ] **2.3** Verify Redis works (`redis-cli ping` → PONG)
- [ ] **2.4** Install `connect-redis` for Express session store
- [ ] **2.5** Install `@socket.io/redis-adapter` for Socket.IO scaling
- [ ] **2.6** Update `backend/src/lib/redis.js` — create pub/sub client pair for adapter
- [ ] **2.7** Configure Express sessions with Redis store in `server.js`
- [ ] **2.8** Test: Server logs "Redis connected successfully"
- [ ] **2.9** Test: Sessions persist after server restart

---

## Phase 3: Socket.IO Server + Event Architecture
> Build our own real-time communication layer

- [ ] **3.1** Install `socket.io` on backend
- [ ] **3.2** Create `backend/src/lib/socket.js` — Socket.IO server setup
  - [ ] 3.2a: Initialize Socket.IO with CORS config
  - [ ] 3.2b: Attach Redis adapter for horizontal scaling
  - [ ] 3.2c: JWT authentication middleware for WebSocket connections
  - [ ] 3.2d: Online users tracking (Redis Set)
  - [ ] 3.2e: Event handlers: `sendMessage`, `typing`, `stopTyping`, `markAsRead`
  - [ ] 3.2f: Presence broadcasting: `userOnline`, `userOffline`
- [ ] **3.3** Create `backend/src/models/Message.js` — message schema
- [ ] **3.4** Create `backend/src/controllers/message.controller.js`
  - [ ] 3.4a: `getMessages()` — paginated message history for a conversation
  - [ ] 3.4b: `getConversations()` — list all conversations with last message
- [ ] **3.5** Create `backend/src/routes/message.route.js`
- [ ] **3.6** Update `backend/src/server.js` — use `http.createServer`, attach Socket.IO
- [ ] **3.7** Update `backend/src/controllers/user.controller.js` — emit real-time events on friend requests
- [ ] **3.8** Test: Connect via Socket.IO client → "connection" event fires
- [ ] **3.9** Test: Send message via socket → arrives on another socket in real-time
- [ ] **3.10** Test: Online/offline presence updates broadcast correctly

---

## Phase 4: Frontend WebSocket Integration
> Connect React to our Socket.IO server, build custom chat UI

- [ ] **4.1** Install `socket.io-client` on frontend
- [ ] **4.2** Remove Stream packages (`stream-chat`, `stream-chat-react`, `@stream-io/video-react-sdk`)
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
- [ ] **4.7** Rebuild `frontend/src/pages/ChatPage.jsx` — custom chat UI with our Socket.IO
- [ ] **4.8** Update `frontend/src/pages/HomePage.jsx` — online status dots on friend cards
- [ ] **4.9** Update `frontend/src/pages/NotificationPage.jsx` — real-time friend request alerts
- [ ] **4.10** Update/Remove `frontend/src/pages/CallPage.jsx` — remove Stream Video
- [ ] **4.11** Update `frontend/src/main.jsx` — remove Stream CSS, add socket initialization
- [ ] **4.12** Remove `VITE_STREAM_API_KEY` from frontend `.env`
- [ ] **4.13** Test: Login → socket connects → online status shows
- [ ] **4.14** Test: Two browser tabs → full chat flow works
- [ ] **4.15** Test: Friend request → notification appears in real-time (no refresh)

---

## Phase 5: OAuth Production-Ready
> Make Google OAuth work end-to-end with JWT

- [ ] **5.1** Verify passport.js findOne fix + field mapping works
- [ ] **5.2** Update OAuth callback to generate JWT + set same cookie as email/password login
- [ ] **5.3** Handle "onboarding needed" redirect for new OAuth users
- [ ] **5.4** Add "Sign in with Google" button on `LoginPage.jsx`
- [ ] **5.5** Add "Sign in with Google" button on `SignUpPage.jsx`
- [ ] **5.6** Test: Full OAuth flow → Google → callback → JWT cookie → home page
- [ ] **5.7** Test: Existing email user → account linking works (google login connects to email account)

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
