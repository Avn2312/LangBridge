import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { motion as Motion } from "framer-motion";
import {
  ArrowRight,
  Inbox,
  Loader2,
  MessageCircle,
  Search,
  Users,
  X,
} from "lucide-react";
import { getConversations } from "../lib/api.js";
import { getLanguageFlag } from "../lib/language.js";
import { useSocketStore } from "../store/socketStore.js";
import useAuthUser from "../hooks/useAuthUser.js";

const FALLBACK_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

const formatMessageTime = (date) => {
  if (!date) return "";

  const timestamp = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return timestamp.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

const getMessagePreview = (message) => {
  const text = message?.text?.trim();

  if (text) return text;
  if (message?.attachments?.length > 0) return "Sent an attachment";

  return "No messages yet";
};

const MessagesPage = () => {
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);
  const [searchTerm, setSearchTerm] = useState("");
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const liveMessages = useSocketStore((s) => s.messages);
  const unreadCounts = useSocketStore((s) => s.unreadCounts);

  const { data: conversationsData, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    enabled: isVerified,
  });

  const threads = useMemo(
    () => {
      const conversations = conversationsData?.conversations || [];

      return conversations
        .map((conversation) => {
          const userId = conversation.userId;
          const localThread = liveMessages[userId] || [];
          const latestLocalMessage = localThread.at(-1);
          const lastMessage = latestLocalMessage || conversation.lastMessage;
          const unread = Math.max(
            Number(conversation.unreadCount || 0),
            Number(unreadCounts[userId] || 0),
          );

          return {
            ...conversation,
            userId,
            lastMessage,
            unread,
            isOnline: onlineUsers.has(userId),
          };
        })
        .sort((a, b) => {
          const bTime = new Date(b.lastMessage?.createdAt || 0).getTime();
          const aTime = new Date(a.lastMessage?.createdAt || 0).getTime();

          if (bTime !== aTime) return bTime - aTime;
          return b.unread - a.unread;
        });
    },
    [conversationsData?.conversations, liveMessages, onlineUsers, unreadCounts],
  );

  const filteredThreads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return threads;

    return threads.filter((thread) =>
      thread.fullName?.toLowerCase().includes(query),
    );
  }, [searchTerm, threads]);

  const totalUnread = threads.reduce((total, thread) => total + thread.unread, 0);
  const onlineCount = threads.filter((thread) => thread.isOnline).length;

  if (!isVerified) {
    return (
      <div className="lb-page-shell bg-gradient-to-b from-[#0a1520] to-[#0c1b2e]">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-300/40 bg-amber-100/95 p-6 text-center text-amber-900">
          <h2 className="text-xl font-semibold">Email verification required</h2>
          <p className="mt-2 text-sm">Verify your email to message friends.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lb-page-shell bg-gradient-to-b from-[#0a1520] to-[#0c1b2e]">
      <div className="lb-page-container">
        <Motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lb-page-header"
        >
          <div>
            <h1 className="lb-page-title">Messages</h1>
            <p className="lb-page-subtitle">
              Resume active chats with the people you practice with most.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="lb-btn-soft pointer-events-none">
              <MessageCircle size={16} />
              {totalUnread} unread
            </div>
            <div className="lb-btn-soft pointer-events-none">
              <Users size={16} />
              {onlineCount} online
            </div>
          </div>
        </Motion.div>

        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search friends"
            className="h-12 w-full rounded-xl border border-blue-300/20 bg-[#0C1A2B]/90 pl-12 pr-12 text-sm font-medium text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/45"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
          </div>
        ) : threads.length === 0 ? (
          <div className="lb-empty-state">
            <Inbox className="mx-auto h-10 w-10 text-cyan-300/70" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              No conversations yet
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Start a chat from your friends list, then your recent conversations
              will appear here.
            </p>
            <Link to="/friends" className="lb-btn-primary mt-5">
              <Users size={16} />
              View Friends
            </Link>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="lb-empty-state">
            <Search className="mx-auto h-10 w-10 text-cyan-300/70" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              No matching conversations
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Try searching another friend name.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredThreads.map((thread) => {
              const preview = getMessagePreview(thread.lastMessage);
              const isFromMe =
                thread.lastMessage?.isFromMe ||
                thread.lastMessage?.sender === authUser?._id;
              return (
                <Motion.div
                  key={thread.userId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Link
                    to={`/chat/${thread.userId}`}
                    className={`lb-surface-card lb-surface-card-hover flex items-center justify-between gap-4 ${
                      thread.unread > 0 ? "border-cyan-300/45 bg-[#0F2235]" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-blue-400/30">
                        <img
                          src={thread.profilePic || FALLBACK_AVATAR}
                          alt={thread.fullName}
                          className="h-full w-full object-cover"
                        />
                        <span
                          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-[#0e1c2d] ${
                            thread.isOnline ? "bg-emerald-400" : "bg-slate-500"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-white">
                            {thread.fullName}
                          </h2>
                          {thread.unread > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1.5 text-[10px] font-bold text-slate-950">
                              {thread.unread > 9 ? "9+" : thread.unread}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-300">
                          {isFromMe && (
                            <span className="font-medium text-slate-500">
                              You:{" "}
                            </span>
                          )}
                          {preview}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {thread.isOnline ? "Online now" : "Offline"} ·{" "}
                          {formatMessageTime(thread.lastMessage?.createdAt)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {thread.nativeLanguage && (
                            <span className="lb-pill-blue">
                              {getLanguageFlag(thread.nativeLanguage)}
                              Native: {thread.nativeLanguage}
                            </span>
                          )}
                          {thread.learningLanguage && (
                            <span className="lb-pill-cyan">
                              {getLanguageFlag(thread.learningLanguage)}
                              Learning: {thread.learningLanguage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="hidden shrink-0 items-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 sm:inline-flex">
                      Open
                      <ArrowRight size={15} />
                    </span>
                  </Link>
                </Motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
