import { useState, useRef, useEffect, useCallback } from "react";
import {
  AudioLines,
  Loader2,
  Mic,
  Paperclip,
  SendHorizonal,
  Smile,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useSocketStore } from "../store/socketStore.js";
import EmojiPicker from "emoji-picker-react";
import useAuthUser from "../hooks/useAuthUser.js";
import toast from "react-hot-toast";
import { enqueueOfflineMessage } from "../lib/offlineOutbox.js";
import { correctMessageDraft, uploadMessageAttachment } from "../lib/api.js";

const TYPING_DEBOUNCE_MS = 1000; // stop-typing fires 1 s after last keystroke
const MESSAGE_ACK_TIMEOUT_MS = Number(
  import.meta.env.VITE_MESSAGE_ACK_TIMEOUT_MS || 2500,
);
const MESSAGE_MAX_RETRIES = Number(
  import.meta.env.VITE_MESSAGE_MAX_RETRIES || 2,
);
const MESSAGE_RETRY_BACKOFF_MS = Number(
  import.meta.env.VITE_MESSAGE_RETRY_BACKOFF_MS || 600,
);
const MAX_ATTACHMENTS = Number(import.meta.env.VITE_MAX_ATTACHMENTS || 3);
const MAX_ATTACHMENT_BYTES = Number(
  import.meta.env.VITE_MAX_ATTACHMENT_BYTES || 5 * 1024 * 1024,
);

const createClientMessageId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatRecordingTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const getSupportedAudioMimeType = () => {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

/**
 * ChatInput — text area + send button + emoji picker + typing emission.
 *
 * Props:
 *   receiverId  — string, the other user's _id
 *   disabled    — boolean
 *   onSend      — optional extra callback after message sent (e.g. scroll down)
 */
const ChatInput = ({ receiverId, disabled, onSend }) => {
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const pendingAckTimersRef = useRef(new Map());
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);

  const { authUser } = useAuthUser();
  const senderId = authUser?._id;

  const socket = useSocketStore((s) => s.socket);
  const upsertOptimisticMessage = useSocketStore(
    (s) => s.upsertOptimisticMessage,
  );
  const setMessageStatusByClientId = useSocketStore(
    (s) => s.setMessageStatusByClientId,
  );

  const markMessageFailed = ({
    clientMessageId,
    targetReceiverId,
    errorCode,
    toastMessage,
    extraUpdates = {},
  }) => {
    setMessageStatusByClientId(targetReceiverId, clientMessageId, {
      status: "failed",
      errorCode,
      failedAt: new Date().toISOString(),
      ...extraUpdates,
    });
    toast.error(toastMessage);
  };

  const clearAckTimer = (clientMessageId) => {
    const timer = pendingAckTimersRef.current.get(clientMessageId);
    if (timer) {
      clearTimeout(timer);
      pendingAckTimersRef.current.delete(clientMessageId);
    }
  };

  const scheduleRetry = ({
    clientMessageId,
    messageText,
    messageAttachments,
    targetReceiverId,
    attempt,
  }) => {
    const nextAttempt = attempt + 1;
    if (nextAttempt > MESSAGE_MAX_RETRIES + 1) {
      markMessageFailed({
        clientMessageId,
        targetReceiverId,
        errorCode: "MAX_RETRIES_EXCEEDED",
        toastMessage: "Message failed to send. Tap retry or try again.",
      });
      return;
    }

    setTimeout(
      () => {
        sendWithRetry({
          clientMessageId,
          messageText,
          messageAttachments,
          targetReceiverId,
          attempt: nextAttempt,
        });
      },
      MESSAGE_RETRY_BACKOFF_MS * Math.max(1, attempt),
    );
  };

  const sendWithRetry = ({
    clientMessageId,
    messageText,
    messageAttachments,
    targetReceiverId,
    attempt,
  }) => {
    if (!socket?.connected) {
      const queuedAt = new Date().toISOString();
      enqueueOfflineMessage({
        clientMessageId,
        senderId,
        receiverId: targetReceiverId,
        text: messageText,
        attachments: messageAttachments,
        createdAt: queuedAt,
        queuedAt,
      }).catch(() => {
        markMessageFailed({
          clientMessageId,
          targetReceiverId,
          errorCode: "OUTBOX_WRITE_FAILED",
          toastMessage: "Message could not be queued offline.",
        });
      });
      setMessageStatusByClientId(targetReceiverId, clientMessageId, {
        status: "queued",
        errorCode: null,
        queuedAt,
      });
      toast.success("Message queued. It will send when you're back online.");
      return;
    }

    setMessageStatusByClientId(targetReceiverId, clientMessageId, {
      status: attempt > 1 ? "retried" : "pending",
      retryCount: attempt - 1,
      lastAttemptAt: new Date().toISOString(),
    });

    let settled = false;

    const handleRetryableFailure = (errorCode = "ACK_TIMEOUT") => {
      if (settled) return;
      settled = true;
      clearAckTimer(clientMessageId);

      setMessageStatusByClientId(targetReceiverId, clientMessageId, {
        errorCode,
      });

      scheduleRetry({
        clientMessageId,
        messageText,
        messageAttachments,
        targetReceiverId,
        attempt,
      });
    };

    socket.emit(
      "sendMessage",
      {
        receiverId: targetReceiverId,
        text: messageText,
        attachments: messageAttachments,
        clientMessageId,
      },
      (ack = {}) => {
        if (settled) return;

        if (ack.ok) {
          settled = true;
          clearAckTimer(clientMessageId);
          setMessageStatusByClientId(targetReceiverId, clientMessageId, {
            status: "sent",
            errorCode: null,
            serverMessageId: ack.messageId || null,
          });
          return;
        }

        if (ack.code === "MESSAGE_RATE_LIMITED") {
          settled = true;
          clearAckTimer(clientMessageId);
          markMessageFailed({
            clientMessageId,
            targetReceiverId,
            errorCode: ack.code,
            toastMessage: `You're sending too fast. Try again in ${ack.retryAfterSeconds || 1} seconds.`,
            extraUpdates: {
              retryAfterSeconds: ack.retryAfterSeconds,
            },
          });
          return;
        }

        handleRetryableFailure(ack.code || "ACK_REJECTED");
      },
    );

    const timer = setTimeout(() => {
      handleRetryableFailure("ACK_TIMEOUT");
    }, MESSAGE_ACK_TIMEOUT_MS);

    pendingAckTimersRef.current.set(clientMessageId, timer);
  };

  // ── Typing indicators ──────────────────────────────────────────────────────
  const emitTyping = () => {
    if (!socket || !receiverId) return;
    if (!isTypingRef.current) {
      socket.emit("typing", { receiverId });
      isTypingRef.current = true;
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("stopTyping", { receiverId });
      isTypingRef.current = false;
    }, TYPING_DEBOUNCE_MS);
  };

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimerRef.current);
    if (isTypingRef.current && socket) {
      socket.emit("stopTyping", { receiverId });
      isTypingRef.current = false;
    }
  }, [socket, receiverId]);

  useEffect(() => {
    const pendingTimers = pendingAckTimersRef.current;

    return () => {
      stopTyping(); // cleanup on unmount

      pendingTimers.forEach((timer) => {
        clearTimeout(timer);
      });
      pendingTimers.clear();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stopTyping]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      recordingStartedAtRef.current = null;
      return undefined;
    }

    recordingStartedAtRef.current = Date.now();
    const interval = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current || Date.now();
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(interval);
  }, [isRecording]);

  // Auto-expand textarea based on content value, max 128px (max-h-32)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "40px"; // Reset height to 40px default
    if (text) {
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 128)}px`;
    }
  }, [text]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = text.trim();
    if (
      (!trimmed && selectedAttachments.length === 0) ||
      !receiverId ||
      disabled ||
      isUploadingAttachment ||
      isRecording
    ) {
      return;
    }

    const clientMessageId = createClientMessageId();
    const targetReceiverId = receiverId;

    upsertOptimisticMessage(targetReceiverId, {
      _id: `tmp-${clientMessageId}`,
      clientMessageId,
      sender: senderId,
      receiver: targetReceiverId,
      text: trimmed,
      attachments: selectedAttachments,
      read: false,
      status: "pending",
      retryCount: 0,
      isOptimistic: true,
      createdAt: new Date().toISOString(),
    });

    stopTyping();
    sendWithRetry({
      clientMessageId,
      messageText: trimmed,
      messageAttachments: selectedAttachments,
      targetReceiverId,
      attempt: 1,
    });

    setText("");
    setSelectedAttachments([]);
    setShowEmoji(false);
    onSend?.();
  };

  const handleAttachmentPick = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const slotsLeft = Math.max(0, MAX_ATTACHMENTS - selectedAttachments.length);
    if (slotsLeft === 0) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
      event.target.value = "";
      return;
    }

    const selected = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      toast.error(`Only ${slotsLeft} more attachment(s) can be added.`);
    }

    setIsUploadingAttachment(true);
    try {
      const mapped = [];
      for (const file of selected) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name} exceeds the size limit.`);
          continue;
        }

        const attachment = await uploadMessageAttachment(file);
        mapped.push(attachment);
      }

      if (mapped.length > 0) {
        setSelectedAttachments((prev) => [...prev, ...mapped]);
      }
    } catch {
      toast.error("Failed to attach one or more files.");
    } finally {
      setIsUploadingAttachment(false);
      event.target.value = "";
    }
  };

  const removeAttachment = (index) => {
    setSelectedAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    emitTyping();
  };

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleCorrectDraft = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isCorrecting) return;

    setIsCorrecting(true);
    try {
      const data = await correctMessageDraft({
        text: trimmed,
        partnerId: receiverId,
      });
      setText(data.correction?.corrected || trimmed);
      toast.success("Draft polished.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not correct draft.");
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (disabled || isUploadingAttachment) return;

    if (selectedAttachments.length >= MAX_ATTACHMENTS) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        if (chunks.length === 0) {
          return;
        }

        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size > MAX_ATTACHMENT_BYTES) {
          toast.error("Voice note exceeds the size limit.");
          return;
        }

        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, {
          type: blob.type,
        });

        setIsUploadingAttachment(true);
        try {
          const attachment = await uploadMessageAttachment(file);
          setSelectedAttachments((prev) => [...prev, attachment]);
          toast.success("Voice note attached.");
        } catch (error) {
          toast.error(
            error?.response?.data?.message || "Failed to upload voice note.",
          );
        } finally {
          setIsUploadingAttachment(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      stopTyping();
    } catch (error) {
      toast.error(
        error?.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : "Could not start voice recording.",
      );
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    }
  };

  return (
    <div className="relative border-t border-blue-500/10 bg-[#0A1525]/85 px-2.5 py-2 sm:px-4 sm:py-3 backdrop-blur-xl">
      {/* Emoji picker */}
      {showEmoji && (
        <div className="absolute bottom-full mb-2 right-2 sm:right-4 z-50 max-w-[calc(100vw-2rem)]">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme="dark"
            height={320}
            width={300}
            lazyLoadEmojis
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleAttachmentPick}
      />

      {selectedAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedAttachments.map((attachment, index) => (
            <div
              key={`${attachment.filename}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100"
            >
              {attachment.type === "audio" ? <AudioLines size={13} /> : null}
              <span className="max-w-[140px] truncate">
                {attachment.type === "audio"
                  ? attachment.filename || "Voice note"
                  : attachment.filename || "Attachment"}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="text-cyan-200 hover:text-white"
                aria-label="Remove attachment"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isRecording ? (
        <div className="mb-2 sm:mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-rose-100">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20">
              <span className="absolute h-7 w-7 sm:h-8 sm:w-8 animate-ping rounded-full bg-rose-400/20" />
              <Mic size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">Recording voice note</p>
              <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5">
                {[0, 1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className="h-3 w-1 rounded-full bg-rose-200/80"
                    style={{
                      transform: `scaleY(${0.55 + (bar % 3) * 0.25})`,
                    }}
                  />
                ))}
                <span className="ml-1 font-mono text-[11px] text-rose-100/80">
                  {formatRecordingTime(recordingSeconds)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleRecording}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/20 bg-rose-950/30 px-2.5 py-1.5 text-xs font-medium text-rose-50 hover:bg-rose-950/50"
          >
            <Square size={13} />
            Stop
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-1 sm:gap-2">
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            id="chat-attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploadingAttachment || isRecording}
            className="rounded-lg p-1.5 sm:p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-cyan-400 disabled:opacity-40"
            title="Attach file"
          >
            {isUploadingAttachment ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Paperclip size={18} className="sm:w-5 sm:h-5" />
            )}
          </button>

          <button
            type="button"
            id="chat-record-button"
            onClick={handleToggleRecording}
            disabled={disabled || isUploadingAttachment}
            className={`rounded-lg p-1.5 sm:p-2 transition-colors disabled:opacity-40 ${
              isRecording
                ? "bg-rose-500/10 text-rose-300 hover:text-rose-200"
                : "text-gray-400 hover:bg-white/5 hover:text-cyan-400"
            }`}
            title={isRecording ? "Stop recording" : "Record voice note"}
          >
            {isRecording ? (
              <Square size={16} className="sm:w-[18px] sm:h-[18px]" />
            ) : (
              <Mic size={18} className="sm:w-5 sm:h-5" />
            )}
          </button>

          {/* Emoji toggle */}
          <button
            type="button"
            id="emoji-picker-toggle"
            onClick={() => setShowEmoji((v) => !v)}
            className="rounded-lg p-1.5 sm:p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-cyan-400"
            title="Add emoji"
          >
            <Smile size={18} className="sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            id="chat-correct-draft-button"
            onClick={handleCorrectDraft}
            disabled={!text.trim() || disabled || isCorrecting}
            className="rounded-lg p-1.5 sm:p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-cyan-400 disabled:opacity-40"
            title="Polish draft"
          >
            {isCorrecting ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Wand2 size={16} className="sm:w-[18px] sm:h-[18px]" />
            )}
          </button>
        </div>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          id="chat-message-input"
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            isRecording
              ? "Finish recording..."
              : "Write a message to practice..."
          }
          className="min-h-[40px] h-[40px] max-h-32 flex-1 resize-none overflow-y-auto rounded-xl border border-blue-500/20 bg-[#152232] px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-gray-100 outline-none transition-colors placeholder:text-gray-500 placeholder:truncate focus:border-cyan-500/50 disabled:opacity-60"
        />

        {text.trim() ? (
          <button
            type="button"
            onClick={() => setText("")}
            className="hidden shrink-0 rounded-lg p-1.5 sm:p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-gray-200 sm:block"
            title="Clear draft"
          >
            <Trash2 size={18} />
          </button>
        ) : null}

        {/* Send button */}
        <button
          id="chat-send-button"
          type="button"
          onClick={handleSend}
          disabled={
            (!text.trim() && selectedAttachments.length === 0) ||
            disabled ||
            isUploadingAttachment ||
            isRecording
          }
          className="shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 p-2 sm:p-2.5 text-white shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          title="Send message"
        >
          <SendHorizonal size={18} className="sm:w-[18px] sm:h-[18px]" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
