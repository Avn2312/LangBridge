import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import useAuthUser from "../hooks/useAuthUser.js";
import { useSocketStore } from "../store/socketStore.js";
import { getMessages, getUserById } from "../lib/api.js";
import MessageBubble from "../components/MessageBubble.jsx";
import ChatInput from "../components/ChatInput.jsx";

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);

  const messagesEndRef = useRef(null);
  const [pageLoaded, setPageLoaded] = useState(false);

  // ── Socket store selectors ──────────────────────────────────────────────────
  const socket = useSocketStore((s) => s.socket);
  const storeMessages = useSocketStore((s) => s.messages[targetUserId] || []);
  const setMessages = useSocketStore((s) => s.setMessages);
  const typingUsers = useSocketStore((s) => s.typingUsers);
  const clearUnread = useSocketStore((s) => s.clearUnread);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);

  const isTargetOnline = onlineUsers.has(targetUserId);
  const isTargetTyping = Boolean(typingUsers[targetUserId]);

  // ── Fetch the other user's profile ────────────────────────────────────────
  const { data: targetUser, isLoading: loadingUser } = useQuery({
    queryKey: ["user", targetUserId],
    queryFn: () => getUserById(targetUserId),
    enabled: !!targetUserId,
  });

  // ── Fetch historical messages from REST API ────────────────────────────────
  const { data: historyData, isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", targetUserId],
    queryFn: () => getMessages(targetUserId),
    enabled: !!targetUserId && isVerified,
  });

  // ── Seed store with REST history on first load ─────────────────────────────
  useEffect(() => {
    if (historyData?.messages) {
      setMessages(targetUserId, historyData.messages);
      setPageLoaded(true);
    }
  }, [historyData, targetUserId, setMessages]);

  // ── Mark messages as read whenever this chat is open ──────────────────────
  useEffect(() => {
    if (!socket || !targetUserId) return;
    socket.emit("markAsRead", { senderId: targetUserId });
    clearUnread(targetUserId);
  }, [socket, targetUserId, storeMessages.length, clearUnread]);

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [storeMessages.length, isTargetTyping]);

  // ── Guard: email not verified ──────────────────────────────────────────────
  if (!isVerified) {
    return (
      <div className="h-[93vh] flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-amber-300/60 bg-amber-50 p-6 text-center text-amber-900">
          <h2 className="text-xl font-semibold">Email verification required</h2>
          <p className="mt-2 text-sm">
            Verify your email from the banner above to unlock chat.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = loadingUser || loadingMessages || !pageLoaded;

  return (
    <div className="flex flex-col h-[93vh] bg-gradient-to-b from-[#091520] to-[#0C1B2E]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-blue-500/10 bg-[#0A1525]/80 backdrop-blur-xl flex-shrink-0">
        <button
          id="chat-back-button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-blue-500/10 transition"
        >
          <ArrowLeft size={20} />
        </button>

        {loadingUser ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 animate-pulse" />
            <div className="h-4 w-28 rounded bg-blue-500/20 animate-pulse" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Avatar with online dot */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-blue-500/30">
                <img
                  src={targetUser?.profilePic}
                  alt={targetUser?.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              {isTargetOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#0A1525]" />
              )}
            </div>

            <div>
              <p className="font-semibold text-white text-sm leading-tight">
                {targetUser?.fullName}
              </p>
              <p
                className={`text-xs ${isTargetOnline ? "text-emerald-400" : "text-gray-500"}`}
              >
                {isTargetOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
        )}

        {/* Connection status */}
        {!socket?.connected && (
          <div className="ml-auto flex items-center gap-1 text-xs text-amber-400">
            <WifiOff size={14} />
            Reconnecting…
          </div>
        )}
      </header>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
          </div>
        ) : storeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
            <div className="w-16 h-16 rounded-full overflow-hidden opacity-50">
              <img
                src={targetUser?.profilePic}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm">
              No messages yet. Say hello to{" "}
              <span className="text-cyan-400">{targetUser?.fullName}</span>!
            </p>
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {storeMessages.map((msg) => (
                <motion.div
                  key={msg._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <MessageBubble
                    message={msg}
                    isOwn={
                      msg.sender === authUser?._id ||
                      msg.sender?._id === authUser?._id
                    }
                    senderPic={targetUser?.profilePic}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isTargetTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-end gap-2"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-blue-400/30">
                    <img
                      src={targetUser?.profilePic}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-[#152232] border border-blue-500/15 rounded-2xl rounded-bl-sm px-4 py-2 flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <ChatInput
        receiverId={targetUserId}
        disabled={!socket?.connected || isLoading}
        onSend={scrollToBottom}
      />
    </div>
  );
};

export default ChatPage;
