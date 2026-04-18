import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useSocketStore } from "../store/socketStore.js";
import { useQueryClient } from "@tanstack/react-query";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

/**
 * useSocket — manages the Socket.IO connection lifecycle.
 *
 * Call this once, high up in the tree (e.g. App.jsx or a layout wrapper),
 * passing the authenticated user. When `authUser` is truthy the hook
 * connects; when it becomes null (logout) it disconnects.
 *
 * All incoming events are funnelled into the Zustand socketStore so any
 * component in the tree can reactively read them without prop drilling.
 */
const useSocket = (authUser) => {
  const socketRef = useRef(null);
  const queryClient = useQueryClient();

  const {
    setSocket,
    setOnlineUsers,
    appendMessage,
    setTyping,
    incrementUnread,
    incrementFriendRequestCount,
  } = useSocketStore();

  useEffect(() => {
    // Only connect when there is an authenticated user
    if (!authUser?._id) return;

    // Avoid double-connecting (React StrictMode fires effects twice in dev)
    if (socketRef.current?.connected) return;

    console.log("🔌 Connecting socket for user:", authUser._id);

    const socket = io(BACKEND_URL, {
      withCredentials: true,          // send the JWT httpOnly cookie
      transports: ["polling", "websocket"], // match server config
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,     // exponential backoff up to 8 s
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;
    setSocket(socket);

    // ── Presence ────────────────────────────────────────────────────────────
    socket.on("onlineUsers", (userIds) => {
      setOnlineUsers(userIds);
    });

    // ── Messages ─────────────────────────────────────────────────────────────
    // Server emits newMessage to both sender room and receiver room.
    // We append to the conversation keyed by the OTHER user's id.
    socket.on("newMessage", (message) => {
      const otherId =
        message.sender === authUser._id ? message.receiver : message.sender;

      appendMessage(otherId, message);

      // If the message is NOT from us, bump the unread counter
      // (ChatPage will call markAsRead + clearUnread when open)
      if (message.sender !== authUser._id) {
        incrementUnread(message.sender);
      }

      // Invalidate the conversations sidebar so the last-message preview updates
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    // ── Typing indicators ────────────────────────────────────────────────────
    socket.on("typing", ({ senderId }) => {
      setTyping(senderId, true);
    });

    socket.on("stopTyping", ({ senderId }) => {
      setTyping(senderId, false);
    });

    // ── Friend request events ────────────────────────────────────────────────
    // Emitted by user.controller when someone sends or accepts a request.
    socket.on("friendRequest", () => {
      incrementFriendRequestCount();
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    });

    socket.on("friendRequestAccepted", () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    });

    // ── Lifecycle logs ───────────────────────────────────────────────────────
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    // ── Cleanup — runs on logout or unmount ──────────────────────────────────
    return () => {
      console.log("🔌 Disconnecting socket");
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [authUser?._id]); // re-run only when user identity changes
};

export default useSocket;
