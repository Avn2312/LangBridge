/* eslint-disable no-unused-vars */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Clock,
  UserMinus,
  BellIcon,
  MessageCircle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getUserFriends,
  getOutgoingFriendReqs,
  unfollowUser,
} from "../lib/api.js";
import { getLanguageFlag as getLanguageFlagUtil } from "../lib/language.js";
import NoFriendsFound from "../components/NoFriendsFound.jsx";
import useAuthUser from "../hooks/useAuthUser.js";
import { useSocketStore } from "../store/socketStore.js";

const FALLBACK_AVATAR =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

// ─── Tab IDs ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "friends", label: "My Friends", icon: Users },
  { id: "sent", label: "Sent Requests", icon: Clock },
];

const FriendPage = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const unreadCounts = useSocketStore((s) => s.unreadCounts);
  const [activeTab, setActiveTab] = useState("friends");

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: sentRequests = [], isLoading: loadingSent } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
    enabled: isVerified,
  });

  // ── Unfollow mutation ───────────────────────────────────────────────────────
  const [unfollowingId, setUnfollowingId] = useState(null);

  const { mutate: unfollowMutation } = useMutation({
    mutationFn: unfollowUser,
    onMutate: (userId) => setUnfollowingId(userId),
    onSuccess: () => {
      toast.success("Unfollowed successfully.");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to unfollow.");
    },
    onSettled: () => setUnfollowingId(null),
  });

  // ── Verification gate ───────────────────────────────────────────────────────
  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#0a1520] to-[#0c1b2e]">
        <div className="max-w-md rounded-2xl border border-amber-300/40 bg-amber-100/95 p-6 text-amber-900 text-center">
          <h2 className="text-xl font-semibold">Email verification required</h2>
          <p className="mt-2 text-sm">
            Verify your email to manage friends and requests.
          </p>
        </div>
      </div>
    );
  }

  const isLoading = loadingFriends || loadingSent;

  return (
    <div className="lb-page-shell bg-gradient-to-b from-[#0a1520] to-[#0c1b2e]">
      <div className="lb-page-container">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lb-page-header"
        >
          <div>
            <h1 className="lb-page-title">Friends</h1>
            <p className="lb-page-subtitle">
              Manage your connections and pending requests
            </p>
          </div>

          <Link to="/notifications" className="lb-btn-soft">
            <BellIcon size={16} />
            Received Requests
          </Link>
        </motion.div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-xl border border-blue-300/15 bg-[#0C1A2B]/70 p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`friend-tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-cyan-500/20 text-cyan-100"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={15} />
              {label}
              {id === "sent" && sentRequests.length > 0 && (
                <span className="ml-1 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                  {sentRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ── MY FRIENDS tab ─────────────────────────────────────────── */}
            {activeTab === "friends" && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {friends.length === 0 ? (
                  <NoFriendsFound />
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {friends.map((friend) => {
                      const isOnline = onlineUsers.has(friend._id);
                      const isUnfollowing = unfollowingId === friend._id;
                      const unread = unreadCounts[friend._id] || 0;
                      return (
                        <motion.div
                          key={friend._id}
                          whileHover={{ scale: 1.02 }}
                          transition={{ type: "spring", stiffness: 250 }}
                          className="lb-surface-card lb-surface-card-hover flex flex-col gap-4"
                        >
                          {/* Avatar + info */}
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-blue-500/30">
                                <img
                                  src={friend.profilePic || FALLBACK_AVATAR}
                                  alt={friend.fullName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {isOnline && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-[#0e1c2d]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">
                                {friend.fullName}
                              </p>
                              <p
                                className={`text-xs ${isOnline ? "text-emerald-400" : "text-gray-500"}`}
                              >
                                {isOnline ? "Online" : "Offline"}
                              </p>
                            </div>
                          </div>

                          {/* Language badges */}
                          <div className="flex flex-wrap gap-1.5">
                            <span className="lb-pill-blue">
                              {getLanguageFlagUtil(friend.nativeLanguage)}
                              Native: {friend.nativeLanguage}
                            </span>
                            <span className="lb-pill-cyan">
                              {getLanguageFlagUtil(friend.learningLanguage)}
                              Learning: {friend.learningLanguage}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-auto">
                            <Link
                              to={`/chat/${friend._id}`}
                              className="lb-btn-primary flex-1"
                            >
                              <MessageCircle size={14} />
                              Message
                              {unread > 0 && (
                                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1.5 text-[10px] font-bold text-slate-950">
                                  {unread > 9 ? "9+" : unread}
                                </span>
                              )}
                            </Link>
                            <button
                              id={`unfollow-${friend._id}`}
                              onClick={() => unfollowMutation(friend._id)}
                              disabled={isUnfollowing}
                              className="lb-btn-danger disabled:cursor-not-allowed disabled:opacity-50"
                              title="Unfollow"
                            >
                              {isUnfollowing ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <UserMinus size={14} />
                              )}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── SENT REQUESTS tab ──────────────────────────────────────── */}
            {activeTab === "sent" && (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {sentRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
                    <Clock size={44} className="opacity-40" />
                    <p className="text-sm">No pending sent requests.</p>
                    <Link
                      to="/"
                      className="text-cyan-400 text-sm hover:underline"
                    >
                      Discover new people →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sentRequests.map((req) => (
                      <motion.div
                        key={req._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="lb-surface-card flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-blue-500/20 flex-shrink-0">
                            <img
                              src={req.recipient?.profilePic || FALLBACK_AVATAR}
                              alt={req.recipient?.fullName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              {req.recipient?.fullName}
                            </p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {req.recipient?.nativeLanguage && (
                                <span className="lb-pill-blue">
                                  {getLanguageFlagUtil(
                                    req.recipient.nativeLanguage,
                                  )}
                                  Native: {req.recipient.nativeLanguage}
                                </span>
                              )}
                              {req.recipient?.learningLanguage && (
                                <span className="lb-pill-cyan">
                                  {getLanguageFlagUtil(
                                    req.recipient.learningLanguage,
                                  )}
                                  Learning: {req.recipient.learningLanguage}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 flex-shrink-0">
                          <Clock size={11} />
                          Pending
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default FriendPage;
