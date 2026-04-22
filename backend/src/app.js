import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import { RedisStore } from "connect-redis";
import passport from "passport";
import { sessionRedisClient } from "./lib/redis.js";
import { runtimeConfig } from "./lib/runtimeConfig.js";
import { sendError } from "./lib/apiResponse.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// Initialize Passport strategies (Google OAuth)
import "./lib/passport.js";

// Import route handlers
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import messageRoutes from "./routes/message.route.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = new Set([
  ...runtimeConfig.corsOrigins,
  runtimeConfig.frontendUrl,
]);

const app = express();

if (isProduction) {
  app.set("trust proxy", 1);
}

// ──── MIDDLEWARE SETUP ────

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

app.use(requestLogger);

// Express session — Redis-backed for production-safe persistence and scaling.
app.use(
  session({
    store: new RedisStore({
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
app.use("/api/messages", messageRoutes);

app.use("/api", (req, res) => {
  sendError(res, 404, "API route not found.", { code: "NOT_FOUND" });
});

// ──── PRODUCTION STATIC FILES ────
// In production, Express serves the React build files
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../frontend/dist")));

  // For any route not handled by our API, serve index.html (React app)
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return sendError(res, 404, "API route not found.", {
        code: "NOT_FOUND",
      });
    }

    res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
  });
}

app.use(errorHandler);

export default app;
