import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import { RedisStore } from "connect-redis";
import passport from "passport";
import { getSessionRedisClient } from "./infrastructure/redis/session.store.js";
import { runtimeConfig } from "./config/env.js";
import { sendError } from "./core/http/api-response.js";
import { getLiveness, getReadiness } from "./core/observability/health.js";
import { renderMetrics } from "./core/observability/metrics.js";
import { traceContextMiddleware } from "./core/observability/tracing.js";
import { requestLogger } from "./core/middleware/request-logger.js";
import { errorHandler } from "./core/errors/error-handler.js";

// Initialize Passport strategies (Google OAuth)
import "./modules/auth/auth.passport.js";

// Import route handlers
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import learningRoutes from "./modules/learning/learning.routes.js";
import moderationRoutes from "./modules/moderation/moderation.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";
const frontendDistPath = path.join(__dirname, "../../frontend/dist");
const allowedOrigins = new Set([
  ...runtimeConfig.corsOrigins,
  runtimeConfig.frontendUrl,
]);
const sessionRedisClient = getSessionRedisClient();

const app = express();

if (isProduction) {
  app.set("trust proxy", 1);
}

// ──── MIDDLEWARE SETUP ────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: isProduction ? undefined : false,
  }),
);

// CORS — allows the frontend (localhost:5173) to make requests to our backend
// WHY credentials:true? Because we send JWT in httpOnly cookies,
//     and the browser won't send cookies cross-origin unless CORS allows it.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(traceContextMiddleware);
app.use(requestLogger);

app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "LangBridge API is running" });
});

app.get("/healthz", (req, res) => {
  res.status(200).json(getLiveness());
});

app.get("/readyz", async (req, res, next) => {
  try {
    const readiness = await getReadiness();
    res.status(readiness.status === "ok" ? 200 : 503).json(readiness);
  } catch (error) {
    next(error);
  }
});

app.get("/metrics", (req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.status(200).send(renderMetrics());
});

// Express session — Redis-backed for production-safe persistence and scaling.
app.use(
  session({
    store: isTest
      ? undefined
      : new RedisStore({
          client: sessionRedisClient,
          prefix: "langbridge:sess:",
          ttl: runtimeConfig.session.ttlSeconds,
        }),
    name: runtimeConfig.session.name,
    secret: runtimeConfig.session.secret,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      maxAge: runtimeConfig.session.maxAgeMs,
      httpOnly: true,
      secure: runtimeConfig.session.secure,
      sameSite: runtimeConfig.session.sameSite,
      domain: runtimeConfig.session.domain,
    },
  }),
);

// Parse JSON request bodies (req.body for POST/PUT requests)
app.use(express.json({ limit: runtimeConfig.requestBodyLimit }));
app.use(
  express.urlencoded({ extended: true, limit: runtimeConfig.requestBodyLimit }),
);

// Parse cookies from incoming requests (req.cookies for JWT)
app.use(cookieParser());

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ──── API ROUTES ────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", chatRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/moderation", moderationRoutes);

app.use("/api", (req, res) => {
  sendError(res, 404, "API route not found.", { code: "NOT_FOUND" });
});

// ──── PRODUCTION STATIC FILES ────
// In production, Express serves the React build files
if (isProduction && fs.existsSync(path.join(frontendDistPath, "index.html"))) {
  app.use(express.static(frontendDistPath));

  // For any route not handled by our API, serve index.html (React app)
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return sendError(res, 404, "API route not found.", {
        code: "NOT_FOUND",
      });
    }

    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.use(errorHandler);

export default app;
