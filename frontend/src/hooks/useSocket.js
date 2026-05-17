import { createElement, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useSocketStore } from "../store/socketStore.js";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  listOfflineMessages,
  removeOfflineMessage,
} from "../lib/offlineOutbox.js";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);
const OUTBOX_ACK_TIMEOUT_MS = Number(
  import.meta.env.VITE_MESSAGE_ACK_TIMEOUT_MS || 2500,
);

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

  const setSocket = useSocketStore((s) => s.setSocket);
  const setOnlineUsers = useSocketStore((s) => s.setOnlineUsers);
  const appendMessage = useSocketStore((s) => s.appendMessage);
  const markConversationAsRead = useSocketStore(
    (s) => s.markConversationAsRead,
  );
  const setTyping = useSocketStore((s) => s.setTyping);
  const setMessageStatusByClientId = useSocketStore(
    (s) => s.setMessageStatusByClientId,
  );
  const incrementUnread = useSocketStore((s) => s.incrementUnread);
  const incrementFriendRequestCount = useSocketStore(
    (s) => s.incrementFriendRequestCount,
  );

  useEffect(() => {
    // Only connect when there is an authenticated user
    if (!authUser?._id) return;

    // Avoid double-connecting (React StrictMode fires effects twice in dev)
    if (socketRef.current?.connected) return;

    console.log("🔌 Connecting socket for user:", authUser._id);

    const socket = io(BACKEND_URL, {
      withCredentials: true, // send the JWT httpOnly cookie
      transports: ["polling", "websocket"], // match server config
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000, // exponential backoff up to 8 s
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;
    setSocket(socket);

    const flushOfflineOutbox = async () => {
      const queuedMessages = await listOfflineMessages(authUser._id);
      if (queuedMessages.length === 0) {
        return;
      }

      toast.success(`Sending ${queuedMessages.length} queued message(s).`);

      for (const queuedMessage of queuedMessages) {
        if (!socket.connected) {
          return;
        }

        const {
          clientMessageId,
          receiverId,
          text,
          attachments,
        } = queuedMessage;

        setMessageStatusByClientId(receiverId, clientMessageId, {
          status: "pending",
          errorCode: null,
          lastAttemptAt: new Date().toISOString(),
        });

        socket.timeout(OUTBOX_ACK_TIMEOUT_MS).emit(
          "sendMessage",
          {
            receiverId,
            text,
            attachments,
            clientMessageId,
          },
          async (error, ack = {}) => {
            if (error || !ack.ok) {
              setMessageStatusByClientId(receiverId, clientMessageId, {
                status: "queued",
                errorCode: error ? "ACK_TIMEOUT" : ack.code,
              });
              return;
            }

            await removeOfflineMessage(clientMessageId);
            setMessageStatusByClientId(receiverId, clientMessageId, {
              status: "sent",
              errorCode: null,
              serverMessageId: ack.messageId || null,
            });
          },
        );
      }
    };

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
    // The backend emits ONE event "friendRequest" for both cases,
    // distinguished by the `type` field:
    //   type: "received"  → someone sent US a request  → bump badge + refetch
    //   type: "accepted"  → our request was accepted   → refetch friends list
    socket.on("friendRequest", ({ type } = {}) => {
      if (type === "received") {
        // Incoming request — show badge on notification bell
        incrementFriendRequestCount();
        queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      } else if (type === "accepted") {
        // Our request was accepted — update friends list + notification page
        queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
        queryClient.invalidateQueries({ queryKey: ["friends"] });
      } else {
        // Fallback: unknown type — just refetch everything to be safe
        queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
        queryClient.invalidateQueries({ queryKey: ["friends"] });
      }
    });

    socket.on("messagesRead", ({ readBy, readAt } = {}) => {
      if (!readBy) return;

      markConversationAsRead(readBy, readAt);
      queryClient.invalidateQueries({ queryKey: ["messages", readBy] });
    });



    socket.on("newCorrection", (correction = {}) => {
      const authorId = String(correction.author || "");
      const receiverId = String(correction.receiver || "");
      const otherId = authorId === authUser._id ? receiverId : authorId;

      queryClient.invalidateQueries({ queryKey: ["learningDashboard"] });
      if (otherId) {
        queryClient.invalidateQueries({
          queryKey: ["partnerCorrections", otherId],
        });
      }

      if (receiverId === authUser._id) {
        toast.success("You received a new correction.");
      }
    });

    socket.on("error", (err = {}) => {
      const message = err?.message || "A socket error occurred.";
      console.error("Socket error:", err);
      toast.error(message);
    });

    // video call events
    socket.on("call:incoming", ({ callerId, callId }) => {
      toast(
        (t) =>
          createElement(
            "div",
            {
              className: "space-y-3",
            },
            createElement(
              "p",
              {
                className: "text-sm font-medium text-slate-900",
              },
              "Incoming video call",
            ),
            createElement(
              "div",
              {
                className: "flex gap-2",
              },
              createElement(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    toast.dismiss(t.id);
                    socket.emit("call:accept", { callerId, callId });
                    window.location.href = `/call/${callerId}?callId=${callId}`;
                  },
                  className:
                    "rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-white",
                },
                "Accept",
              ),
              createElement(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    toast.dismiss(t.id);
                    socket.emit("call:reject", { callerId, callId });
                  },
                  className:
                    "rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-800",
                },
                "Decline",
              ),
            ),
          ),
        { duration: 30000 },
      );
    });

    // ── Lifecycle logs ───────────────────────────────────────────────────────
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      flushOfflineOutbox().catch((error) => {
        console.error("Failed to flush offline outbox:", error);
      });
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
  }, [
    authUser?._id,
    appendMessage,
    incrementFriendRequestCount,
    incrementUnread,
    markConversationAsRead,
    queryClient,
    setMessageStatusByClientId,
    setOnlineUsers,
    setSocket,
    setTyping,
  ]); // re-run only when user identity changes or socket helpers change
};

export default useSocket;
