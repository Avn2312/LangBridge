import {
  CheckCircleIcon,
  GraduationCapIcon,
  MapPinIcon,
  MessageCircleIcon,
  SparklesIcon,
  UserPlusIcon,
} from "lucide-react";
import { capitialize } from "../lib/utils.js";
import { getLanguageFlag } from "../lib/language.js";

const FALLBACK_AVATAR =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

const formatValue = (value) => (value ? capitialize(value) : "Not set");

const RecommendedUserCard = ({
  user,
  hasRequestBeenSent,
  isVerified,
  isOnline = false,
  isPending,
  onRequest,
}) => {
  const matchReasons = Array.isArray(user.matchReasons)
    ? user.matchReasons.filter(Boolean)
    : [];
  const interests = Array.isArray(user.interests)
    ? user.interests.filter(Boolean)
    : [];
  const shouldShowScore =
    typeof user.matchScore === "number" &&
    (user.matchScore >= 50 || matchReasons.length === 0);

  return (
    <article className="group lb-surface-card lb-surface-card-hover">
      <div className="flex items-center gap-4">
        <div className="lb-avatar-ring h-16 w-16 shrink-0 overflow-hidden">
          <img
            src={user.profilePic || FALLBACK_AVATAR}
            alt={user.fullName}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight text-white">
            {user.fullName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {user.location ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <span className="truncate">{user.location}</span>
              </span>
            ) : (
              <span className="text-slate-500">Location not set</span>
            )}
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Online now
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {user.isBestExchangeMatch ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
            <SparklesIcon className="h-3.5 w-3.5" />
            Best exchange match
          </span>
        ) : null}
        <span className="lb-pill-blue">
          {getLanguageFlag(user.nativeLanguage)}
          Native: {formatValue(user.nativeLanguage)}
        </span>
        <span className="lb-pill-cyan">
          {getLanguageFlag(user.learningLanguage)}
          Learning: {formatValue(user.learningLanguage)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-100">
          <GraduationCapIcon className="h-3.5 w-3.5" />
          {formatValue(user.proficiencyLevel)} level
        </span>
        {shouldShowScore ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            {user.matchScore}% match
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Why this match
        </p>
        {matchReasons.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {matchReasons.slice(0, 3).map((reason) => (
              <li
                key={reason}
                className="flex gap-2 text-xs leading-relaxed text-slate-300"
              >
                <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            Add languages, interests, and a short bio to your profile to unlock stronger match reasons.
          </p>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <MessageCircleIcon className="h-3.5 w-3.5 text-cyan-300" />
          Interests
        </div>
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {interests.slice(0, 4).map((interest) => (
              <span
                key={interest}
                className="rounded-md bg-slate-800/70 px-2 py-1 text-[11px] text-slate-300"
              >
                {interest}
              </span>
            ))}
            {interests.length > 4 ? (
              <span className="rounded-md bg-slate-800/70 px-2 py-1 text-[11px] text-slate-400">
                +{interests.length - 4} more
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No interests listed yet.</p>
        )}
      </div>

      <p className="mt-4 min-h-[44px] text-sm leading-relaxed text-slate-300">
        {user.bio ||
          "Open to language exchange sessions and regular practice chats."}
      </p>

      <button
        className={`mt-5 w-full ${
          hasRequestBeenSent || !isVerified
            ? "inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-400/20 bg-slate-500/10 px-4 py-2.5 text-sm font-semibold text-slate-400"
            : "lb-btn-primary"
        }`}
        onClick={onRequest}
        disabled={hasRequestBeenSent || isPending || !isVerified}
      >
        {hasRequestBeenSent ? (
          <>
            <CheckCircleIcon className="h-4 w-4" />
            Request Sent
          </>
        ) : isPending ? (
          <>
            <span className="loading loading-spinner loading-xs" />
            Sending
          </>
        ) : !isVerified ? (
          <>
            <UserPlusIcon className="h-4 w-4" />
            Verify Email Required
          </>
        ) : (
          <>
            <UserPlusIcon className="h-4 w-4" />
            Send Friend Request
          </>
        )}
      </button>
    </article>
  );
};

export default RecommendedUserCard;
