# LangBridge Learning Flow

This note explains the current app flow before adding more language-learning
features. It is based on the code in this repo, especially auth, onboarding,
friend requests, chat sockets, messages, and learning activity.

## One-Screen Map

```text
Browser
  -> REST auth/signup/login
  -> httpOnly jwt cookie
  -> protectRoute loads req.user
  -> onboarding saves language profile on User
  -> friend request writes FriendRequest, accept writes User.friends
  -> chat input emits Socket.IO sendMessage
  -> backend validates, saves MongoDB Message
  -> backend emits newMessage to sender and receiver rooms
  -> frontend socket store appends message to the open conversation
  -> translate/save/correct call /api/learning
  -> backend writes LearningActivity
  -> Learning page reads /api/learning/dashboard
```

## Auth: Signup/Login -> JWT Cookie -> protectRoute

Local signup and login both end by calling the same helpers:

- `generateToken(user._id)` creates a JWT with `{ id: userId }`.
- `setAuthCookie(res, token)` stores it as an httpOnly `jwt` cookie.
- Frontend Axios uses `withCredentials: true`, so the browser sends that cookie
  with API requests.

Protected REST routes use `protectRoute`. It reads `req.cookies.jwt`, rejects
missing/revoked/expired tokens, verifies the JWT, loads the `User` from MongoDB,
removes the password field, and attaches the result as `req.user`.

Socket.IO uses the same cookie idea. During the socket handshake,
`backend/src/lib/socket.js` parses the cookie header, verifies the JWT, and
stores the user id on `socket.userId`. That keeps REST and realtime auth aligned:
there is no second socket-only auth system.

## Onboarding: Profile -> User

After signup/login, the frontend calls `/api/auth/me` to know whether the user is
authenticated and onboarded. If not onboarded, `App.jsx` sends them to
`/onboarding`.

The onboarding form posts to `POST /api/auth/onboarding`. The controller updates
the current `User` with:

- `fullName`, `bio`, `profilePic`, `location`, `timezone`
- `nativeLanguage`
- `learningLanguage`
- `proficiencyLevel`
- `interests`
- `isOnboarded: true`

Those fields are not just profile decoration. Recommendations use them to rank
language-exchange partners, and chat/learning tools use them as defaults for
translation and correction context.

## Friends: Request -> Accepted Friend -> Friends List

Friend requests live in `FriendRequest`; accepted friendships live on both
users' `friends` arrays.

1. `POST /api/users/follow/:id` creates a pending `FriendRequest`.
2. The backend emits `friendRequest` with `type: "received"` to the recipient's
   personal Socket.IO room.
3. `NotificationPage` reads incoming requests from
   `GET /api/users/received/requests`.
4. `PATCH /api/users/follow/accept/:id` verifies the current user is the
   recipient, marks the request as accepted, then uses `$addToSet` to add each
   user to the other's `friends` array.
5. The backend invalidates friend caches, refreshes friend-scoped presence, and
   emits `friendRequest` with `type: "accepted"` to the original sender.
6. `HomePage` and `MessagesPage` read `GET /api/users/friends`, so the accepted
   friend becomes visible there.

This means `FriendRequest` is the audit/notification object, while
`User.friends` is the fast product state used by friends lists and presence.

## Chat: Frontend Input -> MongoDB Message -> Receiver UI

Here is the exact path for one message:

1. The user types in `ChatInput.jsx` and presses send.
2. The frontend creates a `clientMessageId`, immediately inserts an optimistic
   message into `socketStore`, and emits Socket.IO event `sendMessage` with
   `{ receiverId, text, attachments, clientMessageId }`.
3. The socket connection is already authenticated from the JWT cookie, so the
   backend knows the sender from `socket.userId`.
4. `backend/src/lib/socket.js` rate-limits the send, validates text and
   attachments, checks blocking rules, and normalizes `clientMessageId`.
5. The backend looks for an existing message with the same sender and
   `clientMessageId`. If it exists, the send is treated as a retry/replay. If it
   does not exist, the backend creates a MongoDB `Message`.
6. After the message exists in MongoDB, the backend invalidates conversation
   caches, publishes the message event for background workers, emits
   `newMessage` to the receiver's personal room, and emits `newMessage` to the
   sender's personal room.
7. `useSocket.js` listens for `newMessage`. It computes the other participant id
   and appends the server message to the correct conversation in `socketStore`.
   The store uses `clientMessageId` to replace/merge the optimistic message
   instead of showing a duplicate.
8. If the message came from someone else, the frontend increments that
   conversation's unread count and invalidates the conversations query so
   previews update.
9. When a chat page opens, `GET /api/messages/:userId` loads historical MongoDB
   messages, seeds `socketStore`, and marks unread messages as read. The chat
   also emits `markAsRead`, which updates `Message.read` and notifies the sender
   with `messagesRead`.

The important invariant is: Socket.IO is the delivery path for new messages, but
MongoDB `Message` is the durable source of truth.

## Learning: Translate/Save/Correct -> LearningActivity -> Dashboard

Learning actions are separate from messages on purpose. The relevant API group
is mounted at `/api/learning`:

- `POST /api/learning/translate`
- `POST /api/learning/correct`
- `POST /api/learning/phrases`
- `GET /api/learning/dashboard`

Each write creates a `LearningActivity` for the current user. A learning
activity can optionally point back to:

- `partner`: the other user in the conversation
- `message`: the original `Message`

It also stores:

- `type`: `translation`, `correction`, or `saved_phrase`
- `sourceText`: the original text
- `resultText`: the translated/corrected/saved output
- `targetLanguage`
- `metadata`: confidence, context hints, correction explanation, or changes

The dashboard does not scan messages to infer learning history. It reads
`LearningActivity` documents directly and summarizes recent practice.

## Why Translation and Correction Belong Under `/api/learning`

Translation and correction are learning annotations, not message delivery.

`/api/messages` and Socket.IO answer: "How do users communicate?" They create,
read, deliver, and mark chat messages as read.

`/api/learning` answers: "What did this user learn from the conversation?" It
records a personal study action that may reference a message but should not
change the original message. This matters because:

- A translation is user-specific. Two users can translate the same message into
  different target languages.
- A correction is an annotation. Editing another user's original `Message.text`
  would rewrite chat history and confuse the sender/receiver record.
- Saved phrases, corrections, and translations all feed the same learning
  dashboard, so they belong in one learning activity model.
- Learning features can later swap local helpers for real providers without
  touching the message transport contract.

So the message stays as the source conversation artifact, and
`LearningActivity` stores the learner's interaction with that artifact.

## Consistency Check

`geminiPlan.md` Phase 0 matches the current code:

- Signup/login use JWT cookies and `protectRoute`.
- Onboarding saves languages, interests, and proficiency on `User`.
- Friend request acceptance writes both users' `friends` arrays, which drives
  friends lists.
- Chat sends through Socket.IO, persists to MongoDB `Message`, then emits
  `newMessage`.
- Translate/save/correct create `LearningActivity` rows used by the dashboard.

`PLAN.md` is intentionally only a short pointer. `geminiPlan.md` remains the
roadmap, and this file is the Phase 0 architecture note that keeps the roadmap
grounded in the current implementation.
