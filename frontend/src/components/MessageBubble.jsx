import { useEffect, useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  AlertCircle,
  BookmarkPlus,
  Check,
  CheckCheck,
  Clock3,
  Eye,
  EyeOff,
  Languages,
  Loader2,
  Sparkles,
} from "lucide-react";

const FALLBACK_AVATAR =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

const ACTION_BUTTON_BASE =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/**
 * MessageBubble — displays a single chat message.
 *
 * Props:
 *   message  — {_id, sender, receiver, text, createdAt, read}
 *   isOwn    — boolean, true if sent by the logged-in user
 *   senderPic — URL string for avatar (only shown on received messages)
 */
const MessageBubble = ({
  message,
  isOwn,
  senderPic,
  onTranslate,
  onCorrect,
  onSavePhrase,
  translation,
  correction,
  isTranslating,
  isCorrecting,
  isSavingPhrase,
}) => {
  const [showTranslation, setShowTranslation] = useState(false);

  const translatedText =
    typeof translation === "string" ? translation : translation?.translated;
  const targetLanguage =
    typeof translation === "object" ? translation?.targetLanguage : "";
  const confidence =
    typeof translation === "object" ? translation?.confidence : null;
  const correctedText = correction?.correctedText || correction?.corrected;
  const correctionNote = correction?.note || correction?.explanation;
  const confidenceLabel =
    typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : null;
  const hasText = Boolean(message.text?.trim());
  const canUseLearningActions = hasText && !message._id?.startsWith?.("tmp-");
  const statusTone =
    message.status === "failed"
      ? "text-rose-300"
      : message.status === "queued"
        ? "text-amber-300"
        : message.status === "pending" || message.status === "retried"
          ? "text-cyan-200"
          : "text-slate-400";

  useEffect(() => {
    if (translatedText) {
      setShowTranslation(true);
    }
  }, [translatedText]);

  const formatTime = (date) => {
    const d = new Date(date);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
    return format(d, "MMM d, h:mm a");
  };

  const getOwnMessageStatus = () => {
    if (!isOwn) return null;

    if (message.status === "failed") {
      if (message.errorCode === "MESSAGE_RATE_LIMITED") {
        return {
          icon: AlertCircle,
          label: "Failed (rate limited)",
          title: "Failed: rate limited",
        };
      }
      return { icon: AlertCircle, label: "Failed", title: "Failed" };
    }

    if (message.status === "retried") {
      return { icon: Clock3, label: "Retrying...", title: "Retrying" };
    }
    if (message.status === "queued") {
      return { icon: Clock3, label: "Queued", title: "Queued offline" };
    }
    if (message.status === "pending") {
      return { icon: Clock3, label: "Sending...", title: "Sending" };
    }

    return message.read
      ? { icon: CheckCheck, label: "Read", title: "Read" }
      : { icon: Check, label: "Sent", title: "Sent" };
  };

  const ownMessageStatus = getOwnMessageStatus();
  const StatusIcon = ownMessageStatus?.icon;

  return (
    <div
      className={`flex items-end gap-2 mb-4 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar — only show for received messages */}
      {!isOwn && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-blue-400/30">
          <img
            src={senderPic || FALLBACK_AVATAR}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`relative max-w-[82%] group sm:max-w-[72%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}
      >
        <div
          className={`min-w-32 px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
            isOwn
              ? "bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-br-sm"
              : "bg-[#152232] text-gray-100 border border-blue-500/15 rounded-bl-sm"
          }`}
        >
          {hasText ? (
            <div className="space-y-2">
              <p>{message.text}</p>
              {translatedText && showTranslation ? (
                <div
                  className={`rounded-xl border px-3 py-2 ${
                    isOwn
                      ? "border-white/20 bg-white/10 text-cyan-50"
                      : "border-cyan-300/20 bg-cyan-500/10 text-cyan-50"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-cyan-100/80">
                    <Languages size={12} />
                    <span>
                      {targetLanguage ? `Translation · ${targetLanguage}` : "Translation"}
                    </span>
                  </div>
                  <p>{translatedText}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {Array.isArray(message.attachments) &&
            message.attachments.length > 0 && (
              <div className={`${message.text ? "mt-2" : ""} space-y-2`}>
                {message.attachments.map((attachment, index) => {
                  const key = `${attachment.url || "att"}-${index}`;

                  if (attachment.type === "image") {
                    return (
                      <a
                        key={key}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <img
                          src={attachment.url}
                          alt={attachment.filename || "image attachment"}
                          className="max-h-56 w-full max-w-xs rounded-lg object-cover"
                        />
                      </a>
                    );
                  }

                  if (attachment.type === "audio") {
                    return (
                      <audio
                        key={key}
                        controls
                        src={attachment.url}
                        className="w-64 max-w-full"
                      >
                        <a href={attachment.url}>Play voice note</a>
                      </audio>
                    );
                  }

                  return (
                    <a
                      key={key}
                      href={attachment.url}
                      download={attachment.filename || "attachment"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-xs items-center rounded-md border border-white/20 bg-black/20 px-2 py-1 text-xs text-white/90 hover:bg-black/30"
                    >
                      {attachment.filename || "Download attachment"}
                    </a>
                  );
                })}
              </div>
            )}
        </div>

        <div
          className={`mt-1 flex items-center gap-1.5 text-[10px] text-gray-500 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 ${
            isOwn ? "text-right" : "text-left"
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOwn && ownMessageStatus && StatusIcon ? (
            <span
              className={`inline-flex items-center gap-1 ${statusTone}`}
              title={ownMessageStatus.title}
            >
              <StatusIcon size={11} />
              <span>{ownMessageStatus.label}</span>
            </span>
          ) : null}
        </div>

        {translatedText ? (
          <div
            className={`mt-2 flex flex-wrap items-center gap-2 text-[11px] ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            <button
              type="button"
              onClick={() => setShowTranslation((current) => !current)}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5 font-medium text-cyan-100 hover:bg-cyan-500/20"
            >
              {showTranslation ? <EyeOff size={13} /> : <Eye size={13} />}
              {showTranslation ? "Hide translation" : "Show translation"}
            </button>
            <span className="text-slate-500">
              {confidenceLabel ? `${confidenceLabel} confidence` : "Saved for this message"}
            </span>
          </div>
        ) : null}

        {correction ? (
          <div
            className={`mt-2 max-w-sm rounded-xl border border-fuchsia-400/20 bg-fuchsia-950/30 px-3 py-2.5 text-xs leading-relaxed text-fuchsia-50 ${
              isOwn ? "text-right" : "text-left"
            }`}
          >
            <p className="inline-flex items-center gap-1.5 font-semibold text-fuchsia-100">
              <Sparkles size={13} />
              Correction preview
            </p>
            <p className="mt-1.5 rounded-lg bg-black/15 px-2 py-1.5 text-sm text-white">
              {correctedText}
            </p>
            {correctionNote ? (
              <p className="mt-1.5 text-fuchsia-100/70">{correctionNote}</p>
            ) : null}
          </div>
        ) : null}

        {hasText ? (
          <div
            className={`mt-2 flex flex-wrap gap-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            <button
              type="button"
              onClick={() => onTranslate?.(message)}
              disabled={!canUseLearningActions || isTranslating}
              className={`${ACTION_BUTTON_BASE} border-cyan-400/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20`}
              title="Translate with context"
            >
              {isTranslating ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Languages size={14} />
              )}
              <span>Translate</span>
            </button>
            <button
              type="button"
              onClick={() => onSavePhrase?.(message)}
              disabled={!canUseLearningActions || isSavingPhrase}
              className={`${ACTION_BUTTON_BASE} border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20`}
              title="Save phrase"
            >
              {isSavingPhrase ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <BookmarkPlus size={14} />
              )}
              <span>Save</span>
            </button>
            {!isOwn ? (
              <button
                type="button"
                onClick={() => onCorrect?.(message)}
                disabled={!canUseLearningActions || isCorrecting}
                className={`${ACTION_BUTTON_BASE} border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20`}
                title="Correct this message"
              >
                {isCorrecting ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>Correct</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MessageBubble;
