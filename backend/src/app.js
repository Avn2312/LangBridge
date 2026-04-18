import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import { RedisStore } from "connect-redis";
import passport from "passport";
import { sessionRedisClient } from "./lib/redis.js";

// Initialize Passport strategies (Google OAuth)
import "./lib/passport.js";

// Import route handlers
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import messageRoutes from "./routes/message.route.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";

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
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

// Express session — Redis-backed for production-safe persistence and scaling.
app.use(
  session({
    store: new RedisStore({
      client: sessionRedisClient,
      prefix: "langbridge:sess:",
      ttl: 7 * 24 * 60 * 60,
    }),
    name: "lb.sid",
    secret:
      process.env.SESSION_SECRET ||
      process.env.JWT_SECRET_KEY ||
      "dev-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    },
  }),
);

// Parse JSON request bodies (req.body for POST/PUT requests)
app.use(express.json());

// Parse cookies from incoming requests (req.cookies for JWT)
app.use(cookieParser());

// Initialize Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// ──── API ROUTES ────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

// ──── PRODUCTION STATIC FILES ────
// In production, Express serves the React build files
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../frontend/dist")));

  // For any route not handled by our API, serve index.html (React app)
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
  });
}

export default app;
