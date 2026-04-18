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
export const useSocketStore = create((set, get) => ({
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

  appendMessage: (otherUserId, message) =>
    set((state) => {
      const prev = state.messages[otherUserId] || [];
      // Deduplicate by _id in case sender+receiver both get the echo
      if (prev.some((m) => m._id === message._id)) return state;
      return {
        messages: {
          ...state.messages,
          [otherUserId]: [...prev, message],
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
