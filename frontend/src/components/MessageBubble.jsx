import { format, isToday, isYesterday } from "date-fns";

/**
 * MessageBubble — displays a single chat message.
 *
 * Props:
 *   message  — {_id, sender, receiver, text, createdAt, read}
 *   isOwn    — boolean, true if sent by the logged-in user
 *   senderPic — URL string for avatar (only shown on received messages)
 */
const MessageBubble = ({ message, isOwn, senderPic }) => {
  const formatTime = (date) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
    return format(d, "MMM d, h:mm a");
  };

  return (
    <div
      className={`flex items-end gap-2 mb-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar — only show for received messages */}
      {!isOwn && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-blue-400/30">
          <img
            src={senderPic}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`relative max-w-[70%] group ${isOwn ? "items-end" : "items-start"} flex flex-col`}
      >
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
            isOwn
              ? "bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-br-sm"
              : "bg-[#152232] text-gray-100 border border-blue-500/15 rounded-bl-sm"
          }`}
        >
          {message.text}
        </div>

        {/* Timestamp */}
        <span
          className={`text-[10px] text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
            isOwn ? "text-right" : "text-left"
          }`}
        >
          {formatTime(message.createdAt)}
          {isOwn && (
            <span className="ml-1">{message.read ? "✓✓" : "✓"}</span>
          )}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
