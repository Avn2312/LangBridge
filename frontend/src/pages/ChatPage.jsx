/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Flag,
  Languages,
  Loader2,
  MoreHorizontal,
  ShieldAlert,
  WifiOff,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import useAuthUser from "../hooks/useAuthUser.js";
import { useSocketStore } from "../store/socketStore.js";
import {
  blockUser,
  createPartnerCorrection,
  getPartnerCorrections,
  getMessages,
  getUserById,
  reportUser,
  savePhrase,
  translateMessage,
  unblockUser,
} from "../lib/api.js";
import MessageBubble from "../components/MessageBubble.jsx";
import ChatInput from "../components/ChatInput.jsx";
import CallButton from "../components/CallButton.jsx";

// Stable empty array — MUST be module-level so it's the same reference every render.
// If this were inline (|| []), Zustand would see a new object each call → infinite loop.
const EMPTY_MESSAGES = [];
const FALLBACK_AVATAR =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);

  const messagesEndRef = useRef(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [translations, setTranslations] = useState({});
  const [translatingId, setTranslatingId] = useState(null);
  const [corrections, setCorrections] = useState({});
  const [correctionModal, setCorrectionModal] = useState(null);
  const [correctedText, setCorrectedText] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");
  const [showSafetyActions, setShowSafetyActions] = useState(false);

  // ── Socket store selectors ──────────────────────────────────────────────────
  const socket = useSocketStore((s) => s.socket);
  // Use EMPTY_MESSAGES (stable ref) as fallback — NOT inline `|| []`
  // Inline `|| []` creates a new array each call → triggers infinite re-render
  const storeMessages = useSocketStore(
    (s) => s.messages[targetUserId] ?? EMPTY_MESSAGES,
  );
  const setMessages = useSocketStore((s) => s.setMessages);
  const typingUsers = useSocketStore((s) => s.typingUsers);
  const clearUnread = useSocketStore((s) => s.clearUnread);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);

  const isTargetOnline = onlineUsers.has(targetUserId);
  const isTargetTyping = Boolean(typingUsers[targetUserId]);

  const blockMutation = useMutation({
    mutationFn: () => blockUser(targetUserId),
    onSuccess: () => {
      toast.success("User blocked.");
      queryClient.invalidateQueries({ queryKey: ["user", targetUserId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to block user.");
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(targetUserId),
    onSuccess: () => {
      toast.success("User unblocked.");
      queryClient.invalidateQueries({ queryKey: ["user", targetUserId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to unblock user.");
    },
  });

  const reportMutation = useMutation({
    mutationFn: (reason) => reportUser(targetUserId, reason),
    onSuccess: () => {
      toast.success("Report submitted.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to submit report.");
    },
  });

  const savePhraseMutation = useMutation({
    mutationFn: (message) =>
      savePhrase({
        phrase: message.text,
        messageId: message._id?.startsWith?.("tmp-") ? undefined : message._id,
        partnerId: targetUserId,
        language: targetUser?.learningLanguage,
      }),
    onSuccess: () => {
      toast.success("Phrase saved.");
      queryClient.invalidateQueries({ queryKey: ["learningDashboard"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to save phrase.");
    },
  });

  const partnerCorrectionMutation = useMutation({
    mutationFn: ({ messageId, correctedText: nextText, note }) =>
      createPartnerCorrection({
        messageId,
        correctedText: nextText,
        note,
      }),
    onSuccess: (data) => {
      const correction = data?.correction;

      if (correction?.message) {
        setCorrections((prev) => ({
          ...prev,
          [correction.message]: correction,
        }));
      }

      setCorrectionModal(null);
      setCorrectedText("");
      setCorrectionNote("");
      toast.success("Correction sent.");
      queryClient.invalidateQueries({ queryKey: ["learningDashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["partnerCorrections", targetUserId],
      });
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.message || "Failed to send correction.",
      );
    },
  });

  const handleTranslateMessage = async (message) => {
    if (!message?.text || translatingId) return;

    setTranslatingId(message._id);
    try {
      const data = await translateMessage({
        text: message.text,
        messageId: message._id?.startsWith?.("tmp-") ? undefined : message._id,
        partnerId: targetUserId,
        targetLanguage: authUser?.nativeLanguage || "english",
      });
      setTranslations((prev) => ({
        ...prev,
        [message._id]: data.translation,
      }));
      queryClient.invalidateQueries({ queryKey: ["learningDashboard"] });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to translate.");
    } finally {
      setTranslatingId(null);
    }
  };

  const handleCorrectMessage = (message) => {
    if (!message?.text || message._id?.startsWith?.("tmp-")) return;

    setCorrectionModal(message);
    setCorrectedText(message.text);
    setCorrectionNote("");
  };

  const handleVideoCall = () => {
    if (!targetUserId || isBlockedEitherWay) return;

    // Navigate to call page with query param to indicate it's a new call
    navigate(`/call/${targetUserId}?start=1`);
  };

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

  const { data: partnerCorrectionsData } = useQuery({
    queryKey: ["partnerCorrections", targetUserId],
    queryFn: () => getPartnerCorrections(targetUserId),
    enabled: !!targetUserId && isVerified,
  });

  const fetchedCorrections = (partnerCorrectionsData?.corrections || []).reduce(
    (byMessage, correction) => {
      if (!correction.message || byMessage[correction.message]) {
        return byMessage;
      }

      return {
        ...byMessage,
        [correction.message]: correction,
      };
    },
    {},
  );

  const correctionByMessage = {
    ...fetchedCorrections,
    ...corrections,
  };

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
      <div className="flex min-h-dvh items-center justify-center px-4">
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
  const isBlockedByMe = Boolean(targetUser?.isBlockedByMe);
  const hasBlockedMe = Boolean(targetUser?.hasBlockedMe);
  const isBlockedEitherWay = isBlockedByMe || hasBlockedMe;
  const learningPairLabel = [
    targetUser?.nativeLanguage,
    targetUser?.learningLanguage,
  ]
    .filter(Boolean)
    .join(" -> ");

  return (
    <div className="flex h-dvh flex-col bg-gradient-to-b from-[#08131F] via-[#0B1828] to-[#0C1B2E]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-50 flex flex-shrink-0 items-center gap-2 sm:gap-3 border-b border-blue-500/10 bg-[#0A1525]/85 px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur-xl">
        <button
          id="chat-back-button"
          onClick={() => navigate(-1)}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-blue-500/10 transition"
        >
          <ArrowLeft size={20} />
        </button>

        {loadingUser ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-500/20 animate-pulse shrink-0" />
            <div className="h-4 w-28 rounded bg-blue-500/20 animate-pulse" />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            {/* Avatar with online dot */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden ring-2 ring-blue-500/30">
                <img
                  src={targetUser?.profilePic || FALLBACK_AVATAR}
                  alt={targetUser?.fullName}
                  className="w-full h-full object-cover"
                />
              </div>
              {isTargetOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#0A1525]" />
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1 justify-center">
              <p className="font-semibold text-white text-sm leading-tight truncate">
                {targetUser?.fullName}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
                <span
                  className={isTargetOnline ? "text-emerald-400 font-medium" : "text-gray-500"}
                >
                  {isTargetOnline ? "Online" : "Offline"}
                </span>
                {learningPairLabel ? (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-300/15 bg-cyan-500/10 px-2 py-0.5 text-[10px] sm:text-[11px] text-cyan-100">
                    <Languages size={11} className="shrink-0" />
                    <span className="truncate">{learningPairLabel}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <div className="relative ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          <CallButton handleVideoCall={handleVideoCall} />
          <button
            type="button"
            onClick={() => setShowSafetyActions((current) => !current)}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
            title="Safety actions"
          >
            <MoreHorizontal size={18} />
          </button>

          <AnimatePresence>
            {showSafetyActions ? (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 z-50 w-48 sm:w-52 rounded-xl border border-slate-700 bg-[#0B1726] p-2 shadow-2xl"
              >
                <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Safety
                </div>
                {isBlockedByMe ? (
                  <button
                    type="button"
                    onClick={() => unblockMutation.mutate()}
                    disabled={unblockMutation.isPending}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    <ShieldAlert size={14} />
                    {unblockMutation.isPending ? "Unblocking..." : "Unblock partner"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => blockMutation.mutate()}
                    disabled={blockMutation.isPending}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    <Ban size={14} />
                    {blockMutation.isPending ? "Blocking..." : "Block partner"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const reason =
                      window.prompt("Report reason (optional):", "") || "";
                    reportMutation.mutate(reason);
                  }}
                  disabled={reportMutation.isPending}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <Flag size={14} />
                  {reportMutation.isPending ? "Reporting..." : "Report conversation"}
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Connection status */}
          {!socket?.connected && (
            <div className="hidden items-center gap-1 text-xs text-amber-400 sm:flex">
              <WifiOff size={14} />
              Reconnecting…
            </div>
          )}
        </div>
      </header>

      {isBlockedEitherWay && (
        <div className="mx-4 mt-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {isBlockedByMe
            ? "You blocked this user. Unblock to resume chatting."
            : "This user has blocked you. Messaging is unavailable."}
        </div>
      )}

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
                src={targetUser?.profilePic || FALLBACK_AVATAR}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-center text-sm">
              Start a practice chat with{" "}
              <span className="text-cyan-400">{targetUser?.fullName}</span>!
            </p>
            <p className="max-w-sm text-center text-xs text-slate-600">
              Translate, save useful phrases, and exchange corrections as the
              conversation grows.
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
                    senderPic={targetUser?.profilePic || FALLBACK_AVATAR}
                    onTranslate={handleTranslateMessage}
                    onCorrect={handleCorrectMessage}
                    onSavePhrase={(message) =>
                      savePhraseMutation.mutate(message)
                    }
                    translation={translations[msg._id]}
                    correction={correctionByMessage[msg._id]}
                    isTranslating={translatingId === msg._id}
                    isCorrecting={
                      partnerCorrectionMutation.isPending &&
                      correctionModal?._id === msg._id
                    }
                    isSavingPhrase={savePhraseMutation.isPending}
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
                      src={targetUser?.profilePic || FALLBACK_AVATAR}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-blue-500/15 bg-[#152232] px-4 py-2 text-xs text-cyan-100">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                    <span className="ml-1 text-slate-400">typing</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {correctionModal ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.form
              className="w-full max-w-lg rounded-xl border border-cyan-400/20 bg-[#0D1B2E] p-5 shadow-2xl"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              onSubmit={(event) => {
                event.preventDefault();
                partnerCorrectionMutation.mutate({
                  messageId: correctionModal._id,
                  correctedText,
                  note: correctionNote,
                });
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Send a correction
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Preview what your partner will see before you submit.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectionModal(null)}
                  className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400">
                    Original
                  </label>
                  <div className="mt-1 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
                    {correctionModal.text}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="correctedText"
                    className="text-xs font-medium text-slate-400"
                  >
                    Corrected version
                  </label>
                  <textarea
                    id="correctedText"
                    value={correctedText}
                    onChange={(event) => setCorrectedText(event.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="mt-1 w-full resize-none rounded-lg border border-cyan-400/20 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="correctionNote"
                    className="text-xs font-medium text-slate-400"
                  >
                    Learning note
                  </label>
                  <textarea
                    id="correctionNote"
                    value={correctionNote}
                    onChange={(event) => setCorrectionNote(event.target.value)}
                    rows={2}
                    maxLength={500}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                    placeholder="Optional"
                  />
                </div>

                {correctedText.trim() ? (
                  <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-950/25 px-3 py-2 text-xs text-fuchsia-50">
                    <p className="font-semibold text-fuchsia-100">
                      Correction preview
                    </p>
                    <p className="mt-1 rounded-lg bg-black/15 px-2 py-1.5 text-sm text-white">
                      {correctedText}
                    </p>
                    {correctionNote.trim() ? (
                      <p className="mt-1.5 text-fuchsia-100/70">
                        {correctionNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectionModal(null)}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    partnerCorrectionMutation.isPending || !correctedText.trim()
                  }
                  className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {partnerCorrectionMutation.isPending
                    ? "Sending..."
                    : "Submit"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <ChatInput
        receiverId={targetUserId}
        disabled={isLoading || isBlockedEitherWay}
        onSend={scrollToBottom}
      />
    </div>
  );
};

export default ChatPage;
