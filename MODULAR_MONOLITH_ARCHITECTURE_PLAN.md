# LangBridge Modular Monolith Architecture Plan

## Goal

LangBridge should evolve from a messy production-style monolith into a clean, scalable modular monolith.

The goal is not to rewrite the product, change API behavior, redesign the database, or prematurely split into microservices. The goal is to preserve all existing behavior while improving boundaries, maintainability, debugging, onboarding, and future scalability.

Preserve:

- Existing REST API paths
- Existing request and response formats
- Existing Socket.IO event names and payload expectations
- Existing MongoDB schemas
- Existing Redis behavior
- Existing Docker setup
- Existing frontend compatibility

Avoid:

- Feature rewrites
- Business logic rewrites
- Frontend behavior changes
- Premature microservices
- Kubernetes or distributed-system complexity
- Unnecessary abstractions

## Current Architecture Problems

The backend is currently organized mostly by technical layer:

```txt
backend/src/
  controllers/
  routes/
  models/
  lib/
  validation/
  middlewares/
  workers/
```

This worked early, but the app has outgrown it. As features increased, unrelated domains started sharing the same folders and infrastructure helpers.

Main problems:

- Controllers mix HTTP handling, business rules, Mongoose queries, cache invalidation, Kafka publishing, Socket.IO emits, validation, and response formatting.
- `backend/src/lib/socket.js` owns too many responsibilities: Socket.IO bootstrapping, JWT parsing, presence, Redis online users, chat message persistence, validation, rate limiting, read receipts, call signaling, Kafka events, and metrics.
- `backend/src/lib/` is becoming a dumping ground for infrastructure, domain utilities, observability, auth helpers, Redis, Kafka, Cloudinary, pagination, cache, blocking, and language assistance.
- Redis responsibilities are not clearly separated. Cache, sessions, pub/sub, rate limiting, JWT blacklist, presence, and worker idempotency all share conceptual space.
- Message and media logic are mixed. Chat attachment upload is handled inside the message controller even though Cloudinary/media handling should be isolated.
- Matching/recommendation logic lives inside user controller logic instead of a dedicated matching module.
- Notifications exist through Kafka events and direct socket emits, but there is no clear notifications module.
- Socket emitters are called directly from controllers through `getIO()`, which creates coupling between HTTP modules and realtime infrastructure.
- Workers are centralized in one file, making future event handling harder to grow cleanly.

## Architectural Smells By Area

### Auth

Current smells:

- Controller directly queries `User`.
- Controller handles JWT generation, cookies, email verification, Redis token blacklist, cache invalidation, and event publishing.
- OAuth callback logic lives directly in the route file.

Target:

- Controller only handles `req` and `res`.
- `auth.service.js` owns signup, login, logout, verification, onboarding.
- `auth.repository.js` owns user persistence for auth use cases.
- Cookie/token helpers stay isolated.
- Email verification becomes a clear auth use case.

### Users, Friendships, Blocking, Reports

Current smells:

- `user.controller.js` handles recommendations, friends, friend requests, blocking, reporting, cache invalidation, presence refreshes, Kafka events, and socket notifications.
- User discovery and matching are mixed with user CRUD/profile concerns.
- Friendships are a separate domain but currently live under users.
- Reports belong closer to moderation.

Target:

- `users/` handles profiles and user lookup.
- `friendships/` handles friend requests, accept/reject, unfollow, friendship state.
- `matching/` handles recommendations and partner scoring.
- `moderation/` handles reports and moderation queue.
- `notifications/` handles notification events and emitters.

### Chat

Current smells:

- HTTP message history and realtime message sending are split across `message.controller.js` and `lib/socket.js`.
- Socket handler directly validates payload, writes messages, handles idempotency, publishes Kafka events, invalidates cache, emits messages, and records metrics.
- Read receipts exist in both HTTP flow and socket flow.

Target:

- `chat.service.js` owns business logic for sending messages, reading messages, listing conversations, and marking messages read.
- `chat.repository.js` owns MongoDB queries only.
- `chat.sockets.js` registers Socket.IO event handlers.
- `chat.emitters.js` owns outgoing socket event names and payloads.
- HTTP controllers and socket handlers both call the same service.

### Socket.IO

Current smells:

- One large socket file handles multiple domains.
- Socket setup, authentication, room management, presence, chat, calls, and read receipts are mixed together.
- Other modules import `getIO()` directly.

Target:

- Central Socket.IO initialization.
- Module-based socket registration.
- Dedicated socket auth middleware.
- Dedicated room abstraction.
- Dedicated emitters per module.
- Preserve all existing event names.

Existing event names to preserve:

```txt
onlineUsers
sendMessage
newMessage
typing
stopTyping
markAsRead
messagesRead
friendRequest
newCorrection
call:invite
call:incoming
call:accept
call:accepted
call:reject
call:rejected
call:end
call:ended
webrtc:offer
webrtc:answer
webrtc:ice-candidate
error
```

### Redis

Current smells:

- Redis is used correctly, but conceptual responsibilities are mixed together.
- Cache, pub/sub, session store, presence, rate limiting, JWT blacklist, and worker idempotency are not separated at the code boundary.

Target:

Keep one Redis container, but separate code into dedicated adapters:

```txt
infrastructure/redis/
  redis.clients.js
  cache.store.js
  pubsub.store.js
  session.store.js
  rate-limit.store.js
  presence.store.js
  token-blacklist.store.js
  idempotency.store.js
```

### Learning And Translation

Current smells:

- Learning activity persistence, translation, correction, partner correction, message access checks, socket emitting, and DTO serialization live together.
- Translation/correction generation is mixed with learning dashboard persistence.

Target:

- `learning/` owns learning activities and dashboards.
- `translation/` owns translation and correction generation.
- `learning.emitters.js` owns `newCorrection` socket emissions.

### Media

Current smells:

- Cloudinary upload logic lives inside the message controller.
- Attachment metadata construction is tied directly to chat controller logic.

Target:

- `media.service.js` uploads files.
- `media.storage.js` wraps Cloudinary.
- `chat` consumes returned attachment DTOs.
- Existing `/api/messages/attachments` route can remain for compatibility, even if internally delegated to `media`.

### Workers And Events

Current smells:

- `eventWorker.js` contains all Kafka handlers in one file.
- Event handling is not grouped by domain.

Target:

```txt
workers/
  event-worker.js
  handlers/
    analytics.handler.js
    ai-correction.handler.js
    notification.handler.js
    moderation.handler.js
```

## Target Backend Structure

```txt
backend/
  src/
    app.js
    server.js

    config/
      env.js
      cors.config.js
      session.config.js

    core/
      errors/
        app-error.js
        error-handler.js
      http/
        api-response.js
        pagination.js
      middleware/
        request-logger.js
        auth.middleware.js
      observability/
        logger.js
        metrics.js
        tracing.js
        health.js
      security/
        password.js
        jwt.js

    infrastructure/
      database/
        mongoose.js
      redis/
        redis.clients.js
        cache.store.js
        pubsub.store.js
        session.store.js
        rate-limit.store.js
        presence.store.js
        token-blacklist.store.js
        idempotency.store.js
      messaging/
        kafka.client.js
        event-bus.js
        event-topics.js
      realtime/
        socket.server.js
        socket.auth.js
        socket.rooms.js
        socket.registry.js
      storage/
        cloudinary.client.js

    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
        auth.repository.js
        auth.validators.js
        auth.dto.js
        auth.cookies.js
        auth.events.js

      users/
        users.routes.js
        users.controller.js
        users.service.js
        users.repository.js
        users.validators.js
        users.dto.js

      friendships/
        friendships.routes.js
        friendships.controller.js
        friendships.service.js
        friendships.repository.js
        friendships.events.js
        friendships.emitters.js

      matching/
        matching.service.js
        matching.repository.js
        matching.dto.js

      chat/
        chat.routes.js
        chat.controller.js
        chat.service.js
        chat.repository.js
        chat.validators.js
        chat.dto.js
        chat.sockets.js
        chat.emitters.js
        chat.events.js

      calls/
        calls.sockets.js
        calls.emitters.js

      presence/
        presence.service.js
        presence.sockets.js

      learning/
        learning.routes.js
        learning.controller.js
        learning.service.js
        learning.repository.js
        learning.validators.js
        learning.dto.js
        learning.emitters.js

      translation/
        translation.service.js
        translation.dto.js

      media/
        media.routes.js
        media.controller.js
        media.service.js
        media.validators.js
        media.storage.js

      moderation/
        moderation.routes.js
        moderation.controller.js
        moderation.service.js
        moderation.repository.js
        moderation.validators.js

      notifications/
        notifications.service.js
        notifications.events.js
        notifications.emitters.js

    shared/
      models/
        User.js
        Message.js
        FriendRequest.js
        LearningActivity.js
        Report.js
      constants/
      validators/
      dto/
      utils/

    workers/
      event-worker.js
      handlers/

    tests/
```

## Dependency Rules

Use this dependency direction:

```txt
routes -> controllers -> services -> repositories -> models
                         |
                         -> infrastructure adapters
                         -> domain events
                         -> socket emitters
```

Rules:

- Controllers only handle HTTP input/output.
- Controllers should not import Mongoose models.
- Controllers should not import Redis clients.
- Controllers should not call `getIO()` directly.
- Services contain business logic.
- Services should not know Express `req` or `res`.
- Repositories contain database access only.
- Repositories should not publish Kafka events.
- Repositories should not emit Socket.IO events.
- Socket handlers should call services, not write business logic directly.
- Emitters own outgoing Socket.IO event names and payload shape.
- Validators validate external input.
- DTO files shape output payloads where formatting is non-trivial.
- Modules should depend on public module APIs, not internal files from other modules.

## Safe Migration Strategy

Refactor incrementally. Do not move everything together.

### Phase 1: Baseline Safety

- Add or expand smoke tests around existing endpoints.
- Capture important response shapes for auth, users, messages, learning, and moderation.
- Add basic socket event tests if practical.
- Run current tests before every refactor step.

Recommended checks:

```bash
cd backend
npm test
```

### Phase 2: Create Architecture Shell

Create the target folders without moving risky logic yet:

```txt
backend/src/modules
backend/src/core
backend/src/infrastructure
backend/src/shared
```

This lets future changes be small and reviewable.

### Phase 3: Move Pure Shared/Core Utilities

Move low-risk files first:

- `apiResponse.js` -> `core/http/api-response.js`
- `pagination.js` -> `core/http/pagination.js`
- `logger.js` -> `core/observability/logger.js`
- `metrics.js` -> `core/observability/metrics.js`
- `tracing.js` -> `core/observability/tracing.js`
- `health.js` -> `core/observability/health.js`
- `runtimeConfig.js` -> `config/env.js`

Only update imports. Do not change behavior.

### Phase 4: Extract Repositories

Create repositories while keeping existing controllers mostly intact.

Examples:

```txt
modules/users/users.repository.js
modules/chat/chat.repository.js
modules/friendships/friendships.repository.js
modules/learning/learning.repository.js
modules/moderation/moderation.repository.js
```

Start replacing direct model calls with repository calls.

### Phase 5: Extract Auth

Target files:

```txt
modules/auth/auth.routes.js
modules/auth/auth.controller.js
modules/auth/auth.service.js
modules/auth/auth.repository.js
modules/auth/auth.validators.js
```

Keep these existing endpoints unchanged:

```txt
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/onboarding
GET  /api/auth/verify-email
POST /api/auth/resend-verification
GET  /api/auth/google
GET  /api/auth/google/callback
```

### Phase 6: Extract Chat HTTP

Move message history, conversation list, read marking, and attachment route delegation into `chat`.

Keep these existing endpoints unchanged:

```txt
GET  /api/messages/conversations
GET  /api/messages/:userId
POST /api/messages/attachments
```

### Phase 7: Extract Chat Socket

Move these handlers out of `lib/socket.js`:

```txt
sendMessage
typing
stopTyping
markAsRead
```

The socket handler should call `chat.service.js`.

### Phase 8: Extract Presence

Move these responsibilities:

- Online user Redis set
- Friend-scoped presence snapshots
- Presence refresh after friendship/block changes
- `onlineUsers` emit behavior

Target:

```txt
modules/presence/presence.service.js
infrastructure/redis/presence.store.js
```

### Phase 9: Extract Friendships And Notifications

Move:

- Send friend request
- Accept request
- Reject request
- Unfollow
- Friend request socket emitters
- Friend request notification events

Target:

```txt
modules/friendships/
modules/notifications/
```

### Phase 10: Extract Learning And Translation

Move:

- Learning activity persistence to `learning`
- Translation/correction generation to `translation`
- `newCorrection` socket emitting to `learning.emitters.js`

### Phase 11: Extract Media

Move Cloudinary and upload logic:

```txt
modules/media/media.service.js
modules/media/media.storage.js
infrastructure/storage/cloudinary.client.js
```

Keep `/api/messages/attachments` compatible.

### Phase 12: Clean Workers

Split `eventWorker.js` handlers into domain-specific handlers.

Keep the worker process and Docker setup unchanged.

## Socket.IO Target Design

Target initialization:

```js
export const initSocket = (httpServer) => {
  const io = createSocketServer(httpServer);

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    registerPresenceSocketHandlers(io, socket);
    registerChatSocketHandlers(io, socket);
    registerCallSocketHandlers(io, socket);
  });

  return io;
};
```

Target files:

```txt
infrastructure/realtime/socket.server.js
infrastructure/realtime/socket.auth.js
infrastructure/realtime/socket.registry.js
infrastructure/realtime/socket.rooms.js
modules/chat/chat.sockets.js
modules/chat/chat.emitters.js
modules/calls/calls.sockets.js
modules/calls/calls.emitters.js
modules/presence/presence.sockets.js
```

## Redis Target Design

One Redis deployment is enough for now. The improvement is code separation, not more containers.

Redis responsibilities:

- Caching: recommendation, friend, conversation cache
- Pub/sub: Socket.IO Redis adapter
- Sessions: Express session store
- Rate limiting: auth, message, typing, HTTP rate limits
- Presence: online users
- Token blacklist: logout/JWT revocation
- Worker idempotency: processed Kafka event IDs

## Frontend Target Structure

The frontend should also move toward feature-based organization.

Current frontend shape:

```txt
frontend/src/
  pages/
  components/
  hooks/
  lib/
  store/
```

Target:

```txt
frontend/src/
  app/
    router.jsx
    providers.jsx

  shared/
    api/
      axios.js
    ui/
    hooks/
    utils/
    config/

  features/
    auth/
      api.js
      hooks.js
      pages/
      components/

    users/
      api.js
      hooks.js
      pages/
      components/

    friendships/
      api.js
      hooks.js
      components/

    chat/
      api.js
      socket-events.js
      store.js
      hooks/
      pages/
      components/

    calls/
      socket-events.js
      hooks/
      pages/

    learning/
      api.js
      hooks.js
      pages/
      components/

    moderation/
      api.js
      hooks.js
      pages/

    notifications/
      api.js
      hooks.js
      pages/
      components/

    media/
      api.js
```

Frontend rules:

- Split `lib/api.js` by feature.
- Keep backward-compatible exports during migration.
- Keep React Query keys consistent and centralized.
- Keep socket lifecycle in one place.
- Keep feature state near the feature.
- Use shared UI only for genuinely reusable components.

## Naming Conventions

Backend file names:

```txt
*.routes.js
*.controller.js
*.service.js
*.repository.js
*.validators.js
*.dto.js
*.sockets.js
*.emitters.js
*.events.js
```

Preferred function names:

```txt
createUser
findUserById
findUserByEmail
sendMessage
markMessagesAsRead
getConversationHistory
emitNewMessage
emitFriendRequestReceived
registerChatSocketHandlers
```

Avoid vague file names:

```txt
utils.js
helpers.js
manager.js
common.js
misc.js
```

Only use shared utility files when the code is truly cross-domain.

## Code Organization Standards

Controllers:

- Read request params/body/query/user.
- Call one service method.
- Return response.
- Do not query MongoDB directly.
- Do not emit socket events directly.
- Do not publish Kafka directly.

Services:

- Own business rules.
- Coordinate repositories.
- Trigger events.
- Invalidate caches through infrastructure abstractions.
- Return plain data to controllers or socket handlers.

Repositories:

- Own MongoDB access.
- Return documents or plain objects.
- Do not contain business policy.
- Do not emit events.
- Do not know HTTP or Socket.IO.

Validators:

- Validate and normalize external input.
- Keep error formats compatible.

Emitters:

- Own event names.
- Own outgoing socket payload shape.
- Should be easy to grep.

Infrastructure:

- Wrap external systems: MongoDB, Redis, Kafka, Socket.IO, Cloudinary.
- Should not contain product business rules.

## Scaling Recommendations

Do now:

- Modularize first.
- Keep monolith deployment.
- Keep one backend container and one worker container.
- Keep Redis adapter for Socket.IO.
- Add module-level tests during extraction.
- Add contract tests for important API responses.
- Add socket event tests around chat and presence.
- Keep logs structured with request ID, user ID, socket ID, event name, and trace ID.

Do later:

- Add more precise MongoDB indexes only when query patterns require them.
- Add queue-specific abstractions if background work grows.
- Add separate worker types if event processing becomes heavy.
- Add service boundaries only after module boundaries are stable.

Do not do now:

- Do not split into microservices.
- Do not introduce Kubernetes.
- Do not redesign MongoDB schemas.
- Do not change REST or socket contracts.
- Do not rewrite the frontend.

## Future Microservice Extraction Strategy

Future extraction candidates, in likely order:

1. Media service
2. Notifications service
3. Translation or AI assistance service
4. Moderation service
5. Chat service

Only extract a module after it has:

- Clear service interface
- Isolated repository layer
- Isolated events
- Isolated infrastructure dependencies
- Tests around public behavior
- No direct imports from unrelated modules

A clean module can become a service later. A messy module split into a service becomes a distributed mess.

## Practical First Moves

Start with these low-risk steps:

1. Create `modules`, `core`, `infrastructure`, and `shared` folders.
2. Move pure utilities first.
3. Add repositories without changing behavior.
4. Extract auth service.
5. Extract chat service.
6. Break `lib/socket.js` into socket initialization plus module handlers.

Best first real refactor target:

```txt
backend/src/lib/socket.js
```

It has the highest coupling and the most future scaling risk.

Second best target:

```txt
backend/src/controllers/auth.controller.js
```

Auth is critical, but its boundaries are clear enough to extract safely.

## Final Advice

Do not try to clean the whole system in one heroic refactor.

Build the new architecture beside the old one, move one responsibility at a time, run tests after each step, and keep every external contract stable. The frontend should not know the backend internals changed.

The win is not making the code look fancy. The win is making every future change boring, local, and safe.
