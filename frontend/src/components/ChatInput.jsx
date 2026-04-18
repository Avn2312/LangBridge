import { useState, useRef, useEffect } from "react";
import { SendHorizonal, Smile } from "lucide-react";
import { useSocketStore } from "../store/socketStore.js";
import EmojiPicker from "emoji-picker-react";

const TYPING_DEBOUNCE_MS = 1000; // stop-typing fires 1 s after last keystroke

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
  const typingTimerRef = useRef(null);
  const isTypingRef = useRef(false);
  const socket = useSocketStore((s) => s.socket);

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

  const stopTyping = () => {
    clearTimeout(typingTimerRef.current);
    if (isTypingRef.current && socket) {
      socket.emit("stopTyping", { receiverId });
      isTypingRef.current = false;
    }
  };

  useEffect(() => {
    return () => stopTyping(); // cleanup on unmount
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !socket || !receiverId || disabled) return;

    stopTyping();
    socket.emit("sendMessage", { receiverId, text: trimmed });
    setText("");
    setShowEmoji(false);
    onSend?.();
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

  return (
    <div className="relative border-t border-blue-500/10 bg-[#0A1525]/80 backdrop-blur-xl px-4 py-3">
      {/* Emoji picker */}
      {showEmoji && (
        <div className="absolute bottom-full mb-2 right-4 z-50">
          <EmojiPicker
            onEmojiClick={onEmojiClick}
            theme="dark"
            height={350}
            width={320}
            lazyLoadEmojis
          />
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Emoji toggle */}
        <button
          type="button"
          id="emoji-picker-toggle"
          onClick={() => setShowEmoji((v) => !v)}
          className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
        >
          <Smile size={20} />
        </button>

        {/* Text area */}
        <textarea
          id="chat-message-input"
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 resize-none bg-[#152232] text-gray-100 placeholder-gray-500 text-sm px-4 py-2.5 rounded-xl outline-none border border-blue-500/20 focus:border-cyan-500/50 transition-colors max-h-32 overflow-y-auto"
          style={{ fieldSizing: "content" }}
        />

        {/* Send button */}
        <button
          id="chat-send-button"
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          <SendHorizonal size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
