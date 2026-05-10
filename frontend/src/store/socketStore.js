import { create } from "zustand";

/**
 * socketStore — single source of truth for all real-time state.
 *
 * Shape:
 *   socket         — the raw socket.io-client instance (null when disconnected)
 *   onlineUsers    — Set of userId strings currently online
 *   messages       — Map<conversationUserId, Message[]>  (chronological)
 *   typingUsers    — Map<conversationUserId, boolean>
 *   unreadCounts   — Map<conversationUserId, number>
 */
export const useSocketStore = create((set) => ({
  // ─── Socket instance ──────────────────────────────────────────────────────
  socket: null,
  setSocket: (socket) => set({ socket }),

  // ─── Online users ─────────────────────────────────────────────────────────
  onlineUsers: new Set(),
  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),

  // ─── Messages per conversation ────────────────────────────────────────────
  // Map<otherUserId → Message[]>
  messages: {},

  setMessages: (userId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [userId]: msgs },
    })),

  upsertOptimisticMessage: (otherUserId, message) =>
    set((state) => {
      const prev = state.messages[otherUserId] || [];
      const next = [...prev];
      const byClientId = message.clientMessageId
        ? next.findIndex((m) => m.clientMessageId === message.clientMessageId)
        : -1;
      const byId = message._id
        ? next.findIndex((m) => m._id === message._id)
        : -1;
      const index = byClientId >= 0 ? byClientId : byId;

      if (index >= 0) {
        next[index] = {
          ...next[index],
          ...message,
        };
      } else {
        next.push(message);
      }

      return {
        messages: {
          ...state.messages,
          [otherUserId]: next,
        },
      };
    }),

  appendMessage: (otherUserId, message) =>
    set((state) => {
      const prev = state.messages[otherUserId] || [];
      // Replace matching optimistic message when server echo lands.
      if (message.clientMessageId) {
        const optimisticIndex = prev.findIndex(
          (m) => m.clientMessageId === message.clientMessageId,
        );

        if (optimisticIndex >= 0) {
          const next = [...prev];
          next[optimisticIndex] = {
            ...prev[optimisticIndex],
            ...message,
            status: "sent",
            isOptimistic: false,
          };

          return {
            messages: {
              ...state.messages,
              [otherUserId]: next,
            },
          };
        }
      }

      // Deduplicate by _id in case sender+receiver both get the echo.
      if (message._id && prev.some((m) => m._id === message._id)) {
        return state;
      }

      return {
        messages: {
          ...state.messages,
          [otherUserId]: [...prev, message],
        },
      };
    }),

  markConversationAsRead: (otherUserId, readAt = new Date().toISOString()) =>
    set((state) => {
      const prev = state.messages[otherUserId] || [];
      if (prev.length === 0) return state;

      let didChange = false;
      const next = prev.map((message) => {
        if (message.sender === otherUserId || message.read) {
          return message;
        }

        didChange = true;
        return {
          ...message,
          read: true,
          readAt,
        };
      });

      if (!didChange) return state;

      return {
        messages: {
          ...state.messages,
          [otherUserId]: next,
        },
      };
    }),

  setMessageStatusByClientId: (otherUserId, clientMessageId, updates) =>
    set((state) => {
      if (!clientMessageId) return state;

      const prev = state.messages[otherUserId] || [];
      const index = prev.findIndex(
        (m) => m.clientMessageId === clientMessageId,
      );
      if (index < 0) return state;

      const next = [...prev];
      next[index] = {
        ...next[index],
        ...updates,
      };

      return {
        messages: {
          ...state.messages,
          [otherUserId]: next,
        },
      };
    }),

  // ─── Typing indicators ────────────────────────────────────────────────────
  typingUsers: {},

  setTyping: (userId, isTyping) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: isTyping },
    })),

  // ─── Unread counts ────────────────────────────────────────────────────────
  unreadCounts: {},

  incrementUnread: (userId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: (state.unreadCounts[userId] || 0) + 1,
      },
    })),

  clearUnread: (userId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
    })),

  // ─── Notification badge for friend requests ───────────────────────────────
  // incremented when a friendRequest/accepted socket event arrives
  friendRequestCount: 0,
  incrementFriendRequestCount: () =>
    set((state) => ({ friendRequestCount: state.friendRequestCount + 1 })),
  clearFriendRequestCount: () => set({ friendRequestCount: 0 }),
}));
