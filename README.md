# LangBridge

LangBridge is a real-time language exchange platform for finding practice partners,
chatting with translation and correction tools, saving useful phrases, and tracking
learning activity.

The project is built as a modular monolith: one backend application with clear
feature boundaries, a React frontend, Socket.IO realtime communication, Redis-backed
presence/caching/rate limits, MongoDB persistence, and optional Kafka workers for
background events.

## Features

- Email/password authentication, email verification, Google OAuth, and onboarding.
- Language profile setup with native language, learning language, proficiency,
  timezone, location, interests, and bio.
- Partner discovery with filters, match scores, match reasons, and online state.
- Friend request flow, friends list, unfollow, block, and report actions.
- Realtime one-to-one chat with typing indicators, read receipts, offline queueing,
  attachments, voice notes, and call signaling.
- Learning tools for translation, draft correction, partner corrections, saved
  phrases, and a learning dashboard.
- Moderation queue for reports.
- Health, readiness, metrics, structured logging, rate limiting, and Docker support.

## Tech Stack

**Frontend**

- React 19
- Vite
- React Router
- TanStack Query
- Zustand
- Tailwind CSS
- Socket.IO client
- Framer Motion
- Lucide icons

**Backend**

- Node.js
- Express
- MongoDB with Mongoose
- Socket.IO
- Redis / ioredis
- KafkaJS
- Passport Google OAuth
- Zod and express-validator
- Vitest and Supertest

**Infrastructure**

- Docker and Docker Compose
- MongoDB
- Redis
- Kafka
- Nginx for the frontend Docker image

## Project Structure

```txt
LangBridge/
  backend/
    src/
      config/
      core/
      infrastructure/
      modules/
      shared/
      workers/
  frontend/
    src/
      app/
      features/
      shared/
      pages/
      components/
      hooks/
      lib/
      store/
  docs/
  docker-compose.yml
```

The backend is organized by feature modules such as `auth`, `chat`,
`friendships`, `learning`, `matching`, `moderation`, `presence`, and `users`.
The frontend keeps compatibility with existing page/component files while adding
`app`, `features`, and `shared` entrypoints for a feature-based structure.

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm
- Docker Desktop, if using Docker Compose
- MongoDB and Redis for non-Docker local runs

### Install Dependencies

```bash
npm install --prefix backend
npm install --prefix frontend
```

### Environment Variables

Create `backend/.env` for local backend configuration. At minimum:

```bash
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
MONGO_URI=mongodb://localhost:27017/langbridge
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=replace-with-a-long-random-secret
SESSION_SECRET=replace-with-another-long-random-secret
KAFKA_ENABLED=false
```

For frontend local development, create `frontend/.env` only if you need to
override defaults:

```bash
VITE_BACKEND_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3000/api
```

Never commit real `.env` files or production secrets.

## Run Locally Without Docker

Start the backend:

```bash
npm run dev --prefix backend
```

Start the frontend:

```bash
npm run dev --prefix frontend
```

Open:

```txt
http://localhost:5173
```

Backend health endpoints:

```txt
http://localhost:3000/healthz
http://localhost:3000/readyz
http://localhost:3000/metrics
```

## Run With Docker

The Compose stack includes MongoDB, Redis, Kafka, backend API, event worker, and
frontend.

```bash
docker compose up --build
```

Open the app:

```txt
http://localhost:5173
```

API:

```txt
http://localhost:3000
```

Worker metrics, when enabled:

```txt
http://localhost:3001/metrics
```

## Scripts

From the repository root:

```bash
npm run lint
npm run test
npm run build
npm run ci
```

Backend:

```bash
npm run dev --prefix backend
npm run start --prefix backend
npm run test --prefix backend
npm run worker:events --prefix backend
npm run seed:demo --prefix backend
```

Frontend:

```bash
npm run dev --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend
npm run preview --prefix frontend
```

## Testing And Quality

- Backend tests use Vitest and Supertest.
- Frontend linting uses ESLint.
- Root `npm run ci` runs frontend lint, backend tests, and frontend production
  build.

```bash
npm run ci
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment notes.

Recommended first deployment:

- Frontend: Vercel, Render Static Site, or any static hosting provider.
- Backend API: Render Web Service, Railway, Fly.io, or a container platform.
- Database: MongoDB Atlas.
- Redis: Upstash Redis, Redis Cloud, Render Key Value, Railway Redis, or
  ElastiCache.
- Kafka: optional for the first demo; enable later with Upstash Kafka,
  Confluent Cloud, Redpanda Cloud, MSK, or Railway Kafka.

For a simple first production deploy, set `KAFKA_ENABLED=false` and run the
backend API as a long-running Node service because Socket.IO requires a persistent
server.

## Notes

- The backend preserves REST API and Socket.IO event compatibility while using a
  modular monolith layout.
- The frontend can run behind Nginx in Docker; `/api` and `/socket.io` are
  proxied to the backend service.
- Rotate any credentials that were ever shared publicly, and keep secrets out of
  Git.

