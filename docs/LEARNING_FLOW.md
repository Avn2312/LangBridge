# LangBridge Learning Flow

This document explains how LangBridge turns a normal language-exchange chat into
learning history. It follows the current modular monolith structure and the
frontend learning UI.

## One-Screen Map

```txt
Browser
  -> auth signup/login
  -> httpOnly JWT cookie
  -> onboarding saves language profile
  -> discovery recommends practice partners
  -> friend request creates FriendRequest
  -> accepted request updates both User.friends arrays
  -> chat input emits Socket.IO sendMessage
  -> chat service validates, rate-limits, checks blocking, saves Message
  -> chat emitters send newMessage to sender and receiver rooms
  -> chat learning actions call /api/learning
  -> learning service writes LearningActivity
  -> Learning page reads /api/learning/dashboard
```

## Auth And Verified Access

Signup and login create a JWT and store it as an httpOnly `jwt` cookie. The
frontend Axios client sends credentials with API requests, so protected routes
can authenticate the user without storing tokens in browser JavaScript.

REST routes use `protectRoute` from
`backend/src/core/middleware/auth.middleware.js`. It verifies the cookie token,
loads the user, and attaches the user to `req.user`.

Learning routes also require a verified account:

```txt
router.use(protectRoute, requireVerifiedUser)
```

That means translation, correction, saved phrases, partner corrections, and the
learning dashboard are available only after authentication and verification.

Socket.IO uses the same cookie-based identity through
`backend/src/infrastructure/realtime/socket.auth.js`, then stores the user id on
`socket.userId`.

## Onboarding Powers Learning

The onboarding form saves the user's language profile:

- `nativeLanguage`
- `learningLanguage`
- `proficiencyLevel`
- `timezone`
- `location`
- `interests`
- `bio`

Those fields are used beyond the profile page. Discovery uses them for partner
matching, and learning helpers use the language profile as context for
translations and corrections.

## Discovery To Friends

Partner discovery is handled through the users and matching modules:

- `GET /api/users` returns recommended users.
- `GET /api/users/friends` returns accepted friends.
- `POST /api/users/follow/:id` sends a friend request.
- `PATCH /api/users/follow/accept/:id` accepts a request.
- `PATCH /api/users/follow/reject/:id` rejects a request.

Friend requests are stored as `FriendRequest` documents. Accepted friendships
are stored on both users' `friends` arrays. Presence refreshes after friendship
changes so the UI can show friend-scoped online users.

The frontend listens for the `friendRequest` Socket.IO event to update badges and
friend request pages without waiting for a full refresh.

## Chat Message Flow

Chat messages are delivered in realtime but persisted in MongoDB.

1. `ChatInput.jsx` creates a `clientMessageId`.
2. The message is optimistically inserted into the frontend socket store.
3. The client emits `sendMessage` with:

   ```js
   { receiverId, text, attachments, clientMessageId }
   ```

4. `backend/src/modules/chat/chat.sockets.js` receives the event.
5. `chat.service.js` validates the payload, rate-limits sending, checks blocking
   rules, and prevents duplicate sends by checking `clientMessageId`.
6. `chat.repository.js` writes the durable `Message` document.
7. `chat.emitters.js` emits `newMessage` to both the sender and receiver rooms.
8. The frontend `useSocket.js` listener merges the server message with the
   optimistic message and updates unread counts.
9. Opening a chat loads history with `GET /api/messages/:userId`.
10. Read state is updated through `markAsRead` and `messagesRead`.

The important rule: Socket.IO is the live delivery channel, but MongoDB
`Message` is the source of truth.

## Attachments And Voice Notes

Chat attachments are uploaded before sending the Socket.IO message:

```txt
POST /api/messages/attachments
```

The upload path delegates to the media module:

- `backend/src/modules/media/media.controller.js`
- `backend/src/modules/media/media.service.js`
- `backend/src/modules/media/media.storage.js`
- `backend/src/infrastructure/storage/cloudinary.client.js`

The returned attachment DTO is then included in the `sendMessage` Socket.IO
payload. Voice notes are treated as audio attachments and displayed in message
bubbles.

## Learning API

Learning actions live under `/api/learning`:

```txt
GET  /api/learning/dashboard
GET  /api/learning/partner-corrections
POST /api/learning/partner-corrections
POST /api/learning/correct
POST /api/learning/translate
POST /api/learning/phrases
```

These routes are implemented by:

- `backend/src/modules/learning/learning.routes.js`
- `backend/src/modules/learning/learning.controller.js`
- `backend/src/modules/learning/learning.service.js`
- `backend/src/modules/learning/learning.repository.js`
- `backend/src/modules/learning/learning.dto.js`
- `backend/src/modules/translation/translation.service.js`

Each learning write creates a `LearningActivity`. A learning activity can
reference:

- the current user
- the partner
- the source message
- the original text
- the result text
- the target language
- metadata such as confidence, explanation, notes, or correction changes

The current activity types are:

- `translation`
- `correction`
- `partner_correction`
- `saved_phrase`

## Translate Message

From the chat screen, a user can translate a message. The frontend calls:

```txt
POST /api/learning/translate
```

The request includes the message text, optional `messageId`, partner id, and
target language. The backend checks access to the referenced conversation,
generates the translation, stores a `LearningActivity`, and returns the
translation result for inline display below the message.

Translation does not edit the original `Message`. It is a personal learning
annotation.

## Correct Draft

Before sending a message, the user can correct their own draft from
`ChatInput.jsx`.

The frontend calls:

```txt
POST /api/learning/correct
```

The backend returns a corrected version and stores the correction as learning
history. The frontend can replace the draft text with the corrected result before
the user sends it.

## Partner Corrections

A user can correct a partner's message from the chat screen.

The frontend calls:

```txt
POST /api/learning/partner-corrections
```

The backend verifies that the current user is part of the message conversation,
checks blocking rules, creates a `partner_correction` activity, and emits:

```txt
newCorrection
```

That event is emitted to both sender and receiver rooms so the correction can
appear in chat. The chat page also reads existing corrections with:

```txt
GET /api/learning/partner-corrections?partnerId=...
```

## Saved Phrases

Users can save useful message text as a phrase:

```txt
POST /api/learning/phrases
```

The phrase is stored as a `saved_phrase` learning activity. Saved phrases appear
in the Learning page and can be copied from the review UI.

## Learning Dashboard

The Learning page reads:

```txt
GET /api/learning/dashboard
```

The dashboard is based on `LearningActivity`, not on scanning chat messages. It
shows:

- weekly review count
- active days
- saved phrase count
- correction count
- recent saved phrases
- recent corrections
- recent translations

The frontend groups activities into tabs:

- Saved phrases
- Corrections
- Translations

This keeps the review page focused on what the user learned, rather than simply
replaying the full chat history.

## Why Learning Is Separate From Messages

Messages answer: "What did users say to each other?"

Learning activities answer: "What did this user learn from the conversation?"

Keeping them separate matters because:

- A translation is personal and target-language-specific.
- A correction should not rewrite the original message history.
- Saved phrases are study artifacts, not chat delivery artifacts.
- Multiple learning actions can point to the same message.
- Future AI/provider changes can happen inside learning and translation modules
  without changing the chat transport contract.

## Current Boundary Summary

```txt
chat/
  Owns message history, realtime sending, read receipts, typing events.

media/
  Owns attachment and voice note upload.

learning/
  Owns learning activity persistence, dashboard data, saved phrases,
  corrections, and partner correction records.

translation/
  Owns translation and correction generation.

presence/
  Owns online user state and friend-scoped presence snapshots.

friendships/
  Owns friend request and accepted friend state.
```

The flow is intentionally modular, but still deployed as one backend service.
That keeps the product simple to run while making future changes local and safer.

