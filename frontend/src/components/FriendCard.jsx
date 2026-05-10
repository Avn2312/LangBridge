/* eslint-disable no-unused-vars */
import { Link } from "react-router";
import { motion } from "framer-motion";
import useAuthUser from "../hooks/useAuthUser.js";
import { getLanguageFlag as getLanguageFlagUtil } from "../lib/language.js";
import { MessageCircle } from "lucide-react";

const FALLBACK_AVATAR =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

const FriendCard = ({ friend, isOnline = false }) => {
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 250 }}
      className="group lb-surface-card lb-surface-card-hover h-full"
    >
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-center gap-3.5">
          <div className="lb-avatar-ring relative h-14 w-14 shrink-0 overflow-hidden">
            <img
              src={friend.profilePic || FALLBACK_AVATAR}
              alt={friend.fullName}
              className="h-full w-full object-cover"
            />
            {isOnline && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#0C1A2B]" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-[1.03rem] font-semibold tracking-tight text-white">
              {friend.fullName}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {isOnline ? "Online now" : "Last seen recently"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="lb-pill-blue">
            {getLanguageFlagUtil(friend.nativeLanguage)}
            Native: {friend.nativeLanguage}
          </span>
          <span className="lb-pill-cyan">
            {getLanguageFlagUtil(friend.learningLanguage)}
            Learning: {friend.learningLanguage}
          </span>
        </div>

        <div className="mt-auto">
          {isVerified ? (
            <Link to={`/chat/${friend._id}`} className="lb-btn-primary w-full">
              <MessageCircle className="h-4 w-4" />
              Open Chat
            </Link>
          ) : (
            <button
              type="button"
              className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-400/20 bg-slate-500/10 px-4 py-2.5 text-sm font-medium text-slate-400"
              title="Verify email to start chat"
            >
              Verify Email Required
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default FriendCard;
