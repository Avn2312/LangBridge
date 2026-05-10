import Redis from "ioredis";
import { createClient } from "redis";
import { EventEmitter } from "node:events";
import { logger } from "./logger.js";

const isTest = process.env.NODE_ENV === "test";
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const createMemoryRedisClient = () => {
  const emitter = new EventEmitter();
  const values = new Map();
  const sets = new Map();
  const expiries = new Map();
  const client = {};

  const isExpired = (key) => {
    const expiresAt = expiries.get(key);
    if (!expiresAt || expiresAt > Date.now()) return false;

    values.delete(key);
    sets.delete(key);
    expiries.delete(key);
    return true;
  };

  const getAllKeys = () => {
    for (const key of [...values.keys(), ...sets.keys()]) {
      isExpired(key);
    }

    return [...new Set([...values.keys(), ...sets.keys()])];
  };

  const matchesPattern = (key, pattern) => {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(key);
  };

  Object.assign(client, {
    on: (...args) => {
      emitter.on(...args);
      return client;
    },
    connect: async () => {},
    disconnect: async () => {},
    quit: async () => {},
    ping: async () => "PONG",
    get: async (key) => {
      if (isExpired(key)) return null;
      return values.get(key) ?? null;
    },
    set: async (key, value, ...args) => {
      if (args.includes("NX") && values.has(key) && !isExpired(key)) {
        return null;
      }

      values.set(key, String(value));

      const exIndex = args.findIndex((arg) => String(arg).toUpperCase() === "EX");
      if (exIndex >= 0 && args[exIndex + 1]) {
        expiries.set(key, Date.now() + Number(args[exIndex + 1]) * 1000);
      }

      return "OK";
    },
    del: async (...keys) => {
      let deleted = 0;
      for (const key of keys) {
        if (values.delete(key) || sets.delete(key)) {
          deleted += 1;
        }
        expiries.delete(key);
      }
      return deleted;
    },
    incr: async (key) => {
      if (isExpired(key)) values.delete(key);
      const nextValue = Number(values.get(key) || 0) + 1;
      values.set(key, String(nextValue));
      return nextValue;
    },
    expire: async (key, seconds) => {
      if (!values.has(key) && !sets.has(key)) return 0;
      expiries.set(key, Date.now() + Number(seconds) * 1000);
      return 1;
    },
    ttl: async (key) => {
      if (isExpired(key)) return -2;
      const expiresAt = expiries.get(key);
      if (!values.has(key) && !sets.has(key)) return -2;
      if (!expiresAt) return -1;
      return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    },
    sadd: async (key, ...members) => {
      const set = sets.get(key) || new Set();
      let added = 0;
      for (const member of members) {
        const value = String(member);
        if (!set.has(value)) added += 1;
        set.add(value);
      }
      sets.set(key, set);
      return added;
    },
    srem: async (key, ...members) => {
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const member of members) {
        if (set.delete(String(member))) removed += 1;
      }
      return removed;
    },
    smembers: async (key) => [...(sets.get(key) || new Set())],
    scanStream: ({ match = "*" } = {}) => {
      const stream = new EventEmitter();
      queueMicrotask(() => {
        stream.emit(
          "data",
          getAllKeys().filter((key) => matchesPattern(key, match)),
        );
        stream.emit("end");
      });
      return stream;
    },
    pipeline: () => {
      const commands = [];
      const pipelineClient = {
        del: (key) => {
          commands.push(["del", key]);
          return pipelineClient;
        },
        exec: async () =>
          Promise.all(commands.map(([, key]) => values.delete(key))),
      };
      return pipelineClient;
    },
    sendCommand: async ([command, ...args] = []) => {
      const method = String(command || "").toLowerCase();
      if (method === "ping") return "PONG";
      if (method === "get") return values.get(args[0]) ?? null;
      if (method === "set") {
        values.set(args[0], String(args[1]));
        return "OK";
      }
      if (method === "del") return values.delete(args[0]) ? 1 : 0;
      return null;
    },
  });

  return client;
};

// ─── Helper: build ioredis options from env ───────────────────────────────────
const buildIoRedisOptions = () =>
  process.env.REDIS_URL
    ? { lazyConnect: true } // URL parsed by ioredis directly
    : {
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        lazyConnect: true,
      };

// ─── Main Redis client ────────────────────────────────────────────────────────
// Used for general commands: SET, GET, DEL (e.g. JWT blacklist, online-user sets)
// INTERVIEW: "Why ioredis instead of the official `redis` package?"
//   → ioredis has built-in auto-reconnect, cluster support, and is widely used
//     in production Node.js stacks. It's also what the Socket.IO Redis adapter expects.
const redis = isTest
  ? createMemoryRedisClient()
  : process.env.REDIS_URL
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
const pubClient = isTest
  ? createMemoryRedisClient()
  : process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis({ host: redisHost, port: redisPort, password: redisPassword });

const subClient = isTest
  ? createMemoryRedisClient()
  : process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis({ host: redisHost, port: redisPort, password: redisPassword });

// ─── Session store client (node-redis / @node-redis) ─────────────────────────
// connect-redis requires the official `redis` package (node-redis), not ioredis.
// WHY SEPARATE PACKAGE? The two libraries have different APIs —
//   connect-redis calls `.sendCommand()` internally which only exists on node-redis.
const sessionRedisClient = isTest
  ? createMemoryRedisClient()
  : createClient(
      process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            socket: { host: redisHost, port: redisPort },
            password: redisPassword,
          },
    );

// ─── Event listeners ──────────────────────────────────────────────────────────
redis.on("connect", () => logger.info("Redis connected", { client: "main" }));
redis.on("error", (err) =>
  logger.error("Redis connection error", { client: "main", error: err }),
);

pubClient.on("connect", () =>
  logger.info("Redis connected", { client: "pub" }),
);
pubClient.on("error", (err) =>
  logger.error("Redis connection error", { client: "pub", error: err }),
);

subClient.on("connect", () =>
  logger.info("Redis connected", { client: "sub" }),
);
subClient.on("error", (err) =>
  logger.error("Redis connection error", { client: "sub", error: err }),
);

sessionRedisClient.on("connect", () =>
  logger.info("Redis connected", { client: "session-store" }),
);
sessionRedisClient.on("error", (err) =>
  logger.error("Redis connection error", {
    client: "session-store",
    error: err,
  }),
);

if (!isTest) {
  sessionRedisClient.connect().catch((err) => {
    logger.error("Failed to connect Redis session store", err);
  });
}

export { redis, pubClient, subClient, sessionRedisClient, Redis };
