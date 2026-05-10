# LangBridge Deployment Guide

This guide covers a production-style deployment for the API, worker, frontend,
MongoDB, Redis, and Kafka.

## Runtime Services

- **Frontend**: static Vite build served by Render Static Site, Railway static
  deploy, Fly.io nginx image, S3/CloudFront, or similar.
- **Backend API**: Node service running `npm start` from `backend`.
- **Event worker**: separate Node service running `npm run worker:events` from
  `backend`.
- **MongoDB**: MongoDB Atlas or a managed MongoDB instance.
- **Redis**: Upstash, Redis Cloud, Railway Redis, Render Redis, or ElastiCache.
- **Kafka**: Upstash Kafka, Confluent Cloud, Redpanda Cloud, MSK, or Railway
  Kafka for demos.

## Required Environment

Set these on the backend API and worker:

```bash
NODE_ENV=production
PORT=3000
BASE_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com
MONGO_URI=mongodb+srv://...
REDIS_URL=redis://...
JWT_SECRET_KEY=replace-with-a-long-random-secret
SESSION_SECRET=replace-with-a-different-long-random-secret
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=none
KAFKA_ENABLED=true
KAFKA_BROKERS=broker-1:9092,broker-2:9092
KAFKA_CLIENT_ID=langbridge-api
KAFKA_GROUP_ID=langbridge-worker
METRICS_PORT=3001
LOG_LEVEL=info
```

If Google OAuth is enabled, also set:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.example.com/api/auth/google/callback
```

## Local Reproducible Run

```bash
docker compose up --build
```

The local stack starts MongoDB, Redis, Kafka, the backend API, the event worker,
and the frontend. API health endpoints are:

- `GET /healthz`
- `GET /readyz`
- API `GET /metrics`
- Worker `GET /metrics` on `METRICS_PORT` when enabled

To create demo accounts locally:

```bash
npm run seed:demo --prefix backend
```

All demo users use the password `DemoPass123!`.

## Render

1. Create a Static Site from `frontend`; build command `npm ci && npm run build`,
   publish directory `dist`.
2. Create a Web Service from `backend`; build command `npm ci`, start command
   `npm start`.
3. Create a Background Worker from `backend`; build command `npm ci`, start
   command `npm run worker:events`.
4. Attach managed MongoDB, Redis, and Kafka providers through environment
   variables.
5. Set `FRONTEND_URL`, `BASE_URL`, and `CORS_ORIGINS` to the deployed domains.

## Railway

1. Add services for frontend, backend, worker, MongoDB, Redis, and Kafka.
2. Use `backend/Dockerfile` for API and worker. Override the worker command to
   `npm run worker:events`.
3. Use `frontend/Dockerfile` for the frontend.
4. Set the required environment variables on API and worker services.

## Fly.io

1. Deploy the backend Dockerfile as the API app and expose port `3000`.
2. Deploy a second Fly app or process group for `npm run worker:events`.
3. Deploy the frontend Dockerfile or serve `frontend/dist` from a CDN.
4. Use managed external MongoDB, Redis, and Kafka. Keep secrets in `fly secrets`.

## AWS

1. Put the frontend in S3 behind CloudFront.
2. Run backend API and worker as separate ECS services.
3. Use DocumentDB or MongoDB Atlas, ElastiCache Redis, and MSK or a managed Kafka
   provider.
4. Place the API behind an ALB and terminate TLS there.
5. Scrape `/metrics` with Prometheus or ship it through your observability agent.

## Operational Checks

- `/readyz` must return `200` before routing traffic.
- API `/metrics` exposes request latency, error counts, socket ack latency,
  retry counts, and Kafka publish counts.
- Worker `/metrics` exposes Kafka consumer event counts and lag gauges when
  `METRICS_PORT` is configured.
- JSON logs include `requestId`, `traceId`, and `spanId` for correlation across
  API logs and downstream work.
- Keep the API and worker on separate processes so Kafka jobs cannot block user
  requests.
