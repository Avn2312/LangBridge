import Redis from "ioredis";
import { createClient } from "redis";

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

// ─── Helper: build ioredis options from env ───────────────────────────────────
const buildIoRedisOptions = () =>
  process.env.REDIS_URL
    ? { lazyConnect: true }                               // URL parsed by ioredis directly
    : { host: redisHost, port: redisPort, password: redisPassword, lazyConnect: true };

// ─── Main Redis client ────────────────────────────────────────────────────────
// Used for general commands: SET, GET, DEL (e.g. JWT blacklist, online-user sets)
// INTERVIEW: "Why ioredis instead of the official `redis` package?"
//   → ioredis has built-in auto-reconnect, cluster support, and is widely used
//     in production Node.js stacks. It's also what the Socket.IO Redis adapter expects.
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({ host: redisHost, port: redisPort, password: redisPassword });

// ─── Pub/Sub client pair for Socket.IO Redis Adapter ────────────────────────
// WHY TWO SEPARATE CLIENTS?
//   Redis protocol rule: once a connection enters SUBSCRIBE mode it can ONLY
//   run pub/sub commands (SUBSCRIBE, UNSUBSCRIBE, PSUBSCRIBE…).
//   Any other command (GET, SET, etc.) on a subscribed connection will throw.
//   So we need:
//     pubClient  → publishes events FROM this server instance to other instances
//     subClient  → subscribes to events FROM other server instances
//   The main `redis` client above stays free for all general-purpose work.
// INTERVIEW: "How do you scale Socket.IO across multiple Node processes?"
//   → "@socket.io/redis-adapter — each server publishes events to Redis;
//      all other servers are subscribed and forward the event to their local sockets."
const pubClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({ host: redisHost, port: redisPort, password: redisPassword });

const subClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({ host: redisHost, port: redisPort, password: redisPassword });

// ─── Session store client (node-redis / @node-redis) ─────────────────────────
// connect-redis requires the official `redis` package (node-redis), not ioredis.
// WHY SEPARATE PACKAGE? The two libraries have different APIs —
//   connect-redis calls `.sendCommand()` internally which only exists on node-redis.
const sessionRedisClient = createClient(
  process.env.REDIS_URL
    ? { url: process.env.REDIS_URL }
    : {
        socket: { host: redisHost, port: redisPort },
        password: redisPassword,
      },
);

// ─── Event listeners ──────────────────────────────────────────────────────────
redis.on("connect", () => console.log("✅ Redis (main) connected."));
redis.on("error", (err) => console.error("❌ Redis (main) error:", err));

pubClient.on("connect", () => console.log("✅ Redis (pub) connected."));
pubClient.on("error", (err) => console.error("❌ Redis (pub) error:", err));

subClient.on("connect", () => console.log("✅ Redis (sub) connected."));
subClient.on("error", (err) => console.error("❌ Redis (sub) error:", err));

sessionRedisClient.on("connect", () => console.log("✅ Redis (session store) connected."));
sessionRedisClient.on("error", (err) => console.error("❌ Redis (session store) error:", err));

sessionRedisClient.connect().catch((err) => {
  console.error("❌ Failed to connect Redis session store:", err);
});

export { redis, pubClient, subClient, sessionRedisClient, Redis };
