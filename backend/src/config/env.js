import { z } from "zod";

const DEFAULT_FRONTEND_URL = "http://localhost:5173";
const DEFAULT_BASE_URL = "http://localhost:3000";

const parseBoolean = (value, fallback = false) => {
  if (value == null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().optional(),
    MONGO_URI: z.string().optional(),
    JWT_SECRET_KEY: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    BASE_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().url().optional(),
    CORS_ORIGINS: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    REQUEST_BODY_LIMIT: z.string().optional(),
    METRICS_PORT: z.coerce.number().int().positive().optional(),
    SESSION_COOKIE_NAME: z.string().optional(),
    SESSION_COOKIE_SAMESITE: z
      .enum(["strict", "lax", "none", "Strict", "Lax", "None"])
      .optional(),
    SESSION_COOKIE_SECURE: z.string().optional(),
    SESSION_COOKIE_DOMAIN: z.string().optional(),
    SESSION_COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().optional(),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().optional(),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional(),
    AUTH_LOCK_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
    AUTH_MAX_FAILURES: z.coerce.number().int().positive().optional(),
    RESEND_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
    RESEND_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional(),
    MESSAGE_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
    MESSAGE_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional(),
    TYPING_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
    TYPING_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional(),
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().int().positive().optional(),
    REDIS_PASSWORD: z.string().optional(),
    KAFKA_ENABLED: z.string().optional(),
    KAFKA_BROKERS: z.string().optional(),
    KAFKA_CLIENT_ID: z.string().optional(),
    KAFKA_GROUP_ID: z.string().optional(),
    KAFKA_RETRIES: z.coerce.number().int().nonnegative().optional(),
    AI_AUTO_CORRECTION_EVENTS: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    for (const key of ["MONGO_URI", "JWT_SECRET_KEY", "SESSION_SECRET"]) {
      if (!env[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required in production.`,
        });
      }
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid runtime environment: ${details}`);
}

export const env = parsedEnv.data;

export const runtimeConfig = {
  nodeEnv: env.NODE_ENV,
  baseUrl: env.BASE_URL || DEFAULT_BASE_URL,
  frontendUrl: env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
  corsOrigins: parseList(env.CORS_ORIGINS || env.CORS_ORIGIN, [
    DEFAULT_FRONTEND_URL,
  ]),
  requestBodyLimit: env.REQUEST_BODY_LIMIT || "10kb",
  metricsPort: env.METRICS_PORT,
  session: {
    name: env.SESSION_COOKIE_NAME || "lb.sid",
    secret:
      env.SESSION_SECRET ||
      env.JWT_SECRET_KEY ||
      "dev-session-secret-change-me",
    sameSite:
      env.SESSION_COOKIE_SAMESITE?.toLowerCase() ||
      (env.NODE_ENV === "production" ? "none" : "lax"),
    secure: parseBoolean(
      env.SESSION_COOKIE_SECURE,
      env.NODE_ENV === "production",
    ),
    domain: env.SESSION_COOKIE_DOMAIN || undefined,
    maxAgeMs: parseInteger(
      env.SESSION_COOKIE_MAX_AGE_MS,
      7 * 24 * 60 * 60 * 1000,
    ),
    ttlSeconds: parseInteger(env.SESSION_TTL_SECONDS, 7 * 24 * 60 * 60),
  },
  rateLimit: {
    authWindowSeconds: parseInteger(
      env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      15 * 60,
    ),
    authMaxRequests: parseInteger(env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10),
    authLockWindowSeconds: parseInteger(
      env.AUTH_LOCK_WINDOW_SECONDS,
      15 * 60,
    ),
    authMaxFailures: parseInteger(env.AUTH_MAX_FAILURES, 5),
    resendWindowSeconds: parseInteger(
      env.RESEND_RATE_LIMIT_WINDOW_SECONDS,
      60 * 60,
    ),
    resendMaxRequests: parseInteger(
      env.RESEND_RATE_LIMIT_MAX_REQUESTS,
      5,
    ),
    messageWindowSeconds: parseInteger(
      env.MESSAGE_RATE_LIMIT_WINDOW_SECONDS,
      60,
    ),
    messageMaxRequests: parseInteger(
      env.MESSAGE_RATE_LIMIT_MAX_REQUESTS,
      30,
    ),
    typingWindowSeconds: parseInteger(
      env.TYPING_RATE_LIMIT_WINDOW_SECONDS,
      10,
    ),
    typingMaxRequests: parseInteger(
      env.TYPING_RATE_LIMIT_MAX_REQUESTS,
      60,
    ),
  },
  kafka: {
    enabled: parseBoolean(env.KAFKA_ENABLED, false),
    brokers: parseList(env.KAFKA_BROKERS, ["localhost:9092"]),
    clientId: env.KAFKA_CLIENT_ID || "langbridge-api",
    groupId: env.KAFKA_GROUP_ID || "langbridge-worker",
    retries: parseInteger(env.KAFKA_RETRIES, 3),
  },
  ai: {
    autoCorrectionEvents: parseBoolean(env.AI_AUTO_CORRECTION_EVENTS, false),
  },
};

export const getFrontendUrl = () =>
  runtimeConfig.frontendUrl.replace(/\/$/, "");
export const getBaseUrl = () => runtimeConfig.baseUrl.replace(/\/$/, "");
