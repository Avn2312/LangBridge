import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { pubClient, subClient, redis } from "./redis.js";
import Message from "../models/Message.js";

// ─── Module-level io reference ────────────────────────────────────────────────
// Exported via getIO() so other modules (e.g. user.controller) can emit events
// without importing Socket.IO at startup (avoids circular dependency issues).
let io;

export const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized — call initSocket first.");
  return io;
};

// ─── Cookie parser (lightweight, no external dep) ─────────────────────────────
const parseCookieHeader = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const [key, ...val] = pair.trim().split("=");
    if (key) acc[key.trim()] = decodeURIComponent(val.join("=").trim());
    return acc;
  }, {});
};

// ─── Redis keys ───────────────────────────────────────────────────────────────
const ONLINE_USERS_KEY = "langbridge:online_users"; // Redis Set of online userIds

// ─── Initialize Socket.IO ─────────────────────────────────────────────────────
// Called once from server.js with the raw http.Server instance.
// INTERVIEW: "Why attach Socket.IO to the http server, not the express app?"
//   → socket.io needs to intercept the HTTP upgrade handshake
//     (WebSocket starts as an HTTP request then upgrades).
//     Express app doesn't expose the raw server; http.createServer does.
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,         // allow cookies to be sent with WS handshake
      methods: ["GET", "POST"],
    },
    // INTERVIEW: "What transports do you support?"
    //   → "polling first (fallback), then upgrades to websocket.
    //      polling ensures it works behind proxies that block WS."
    transports: ["polling", "websocket"],
  });

  // ─── Attach Redis Pub/Sub Adapter ──────────────────────────────────────────
  // WHY: With only one server process, Socket.IO works fine in memory.
  //      But once you add a second server (horizontal scaling), sockets on
  //      server A can't reach clients on server B — they're in separate processes.
  //      The Redis adapter bridges this: when server A emits to a room,
  //      it publishes to Redis → server B reads from Redis → forwards to its clients.
  // INTERVIEW: "How do you scale WebSockets?"
  //   → "Redis pub/sub adapter — pubClient publishes, subClient subscribes.
  //      All server instances share the same Redis channel."
  io.adapter(createAdapter(pubClient, subClient));

  // ─── JWT Authentication Middleware ────────────────────────────────────────
  // Runs before the "connection" event — rejects unauthenticated sockets early.
  // INTERVIEW: "How do you authenticate WebSocket connections?"
  //   → "Parse the JWT from the HTTP-only cookie in the handshake headers.
  //      Same token as REST — unified auth, no separate WS token."
  io.use((socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = cookies["jwt"];

      if (!token) {
        return next(new Error("Authentication error: No token provided."));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      socket.userId = decoded.id; // attach userId to socket for use in handlers
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid or expired token."));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    const userId = socket.userId;
    console.log(`🔌 Socket connected: userId=${userId} socketId=${socket.id}`);

    // Each user joins a personal room named after their userId.
    // WHY: When we want to send a message to a specific user, we emit to
    //      their room — it reaches ALL their sockets (multiple tabs/devices).
    socket.join(userId);

    // Mark user as online in Redis Set
    await redis.sadd(ONLINE_USERS_KEY, userId);

    // Broadcast to all connected clients that this user is now online
    // WHY io.emit and not socket.broadcast.emit?
    //   io.emit sends to everyone including the sender — useful so the
    //   newly-connected user also gets their own "online" event to sync state.
    const onlineUsers = await redis.smembers(ONLINE_USERS_KEY);
    io.emit("onlineUsers", onlineUsers);

    // ── sendMessage ──────────────────────────────────────────────────────────
    // Client emits: { receiverId, text }
    // Server: saves to DB → emits to receiver's room → echoes back to sender
    socket.on("sendMessage", async ({ receiverId, text }) => {
      try {
        if (!receiverId || !text?.trim()) return;

        // Persist message to MongoDB
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          text: text.trim(),
        });

        // Send to receiver (may be on any server instance — Redis adapter handles routing)
        io.to(receiverId).emit("newMessage", message);

        // Echo back to sender (confirms delivery, syncs other tabs)
        io.to(userId).emit("newMessage", message);

        console.log(`💬 Message saved: ${userId} → ${receiverId}`);
      } catch (err) {
        console.error("❌ sendMessage error:", err.message);
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    // ── typing ───────────────────────────────────────────────────────────────
    // Client emits: { receiverId }
    // Server: forwards typing indicator to receiver
    socket.on("typing", ({ receiverId }) => {
      if (!receiverId) return;
      // Emit to receiver's room EXCEPT the sender (they know they're typing)
      socket.to(receiverId).emit("typing", { senderId: userId });
    });

    // ── stopTyping ───────────────────────────────────────────────────────────
    socket.on("stopTyping", ({ receiverId }) => {
      if (!receiverId) return;
      socket.to(receiverId).emit("stopTyping", { senderId: userId });
    });

    // ── markAsRead ───────────────────────────────────────────────────────────
    // Client emits: { senderId } — "I've read all messages from this user"
    socket.on("markAsRead", async ({ senderId }) => {
      try {
        await Message.updateMany(
          { sender: senderId, receiver: userId, read: false },
          { $set: { read: true } }
        );
        // Notify the sender their messages were read
        io.to(senderId).emit("messagesRead", { readBy: userId });
      } catch (err) {
        console.error("❌ markAsRead error:", err.message);
      }
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", async (reason) => {
      console.log(`🔌 Socket disconnected: userId=${userId} reason=${reason}`);

      // Only remove from online set if user has NO other active sockets
      // WHY: User might have two browser tabs open — closing one tab
      //      shouldn't mark them offline if the other tab is still connected.
      const userSockets = await io.in(userId).fetchSockets();
      if (userSockets.length === 0) {
        await redis.srem(ONLINE_USERS_KEY, userId);
        const onlineUsers = await redis.smembers(ONLINE_USERS_KEY);
        io.emit("onlineUsers", onlineUsers);
        console.log(`👋 User ${userId} is now offline`);
      }
    });
  });

  console.log("✅ Socket.IO initialized with Redis adapter.");
  return io;
};
