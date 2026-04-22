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
import { getUserFriends, getOutgoingFriendReqs, unfollowUser } from "../lib/api.js";
import { getLanguageFlag } from "../components/FriendCard.jsx";
import NoFriendsFound from "../components/NoFriendsFound.jsx";
import useAuthUser from "../hooks/useAuthUser.js";
import { useSocketStore } from "../store/socketStore.js";

const FALLBACK_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

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
          <p className="mt-2 text-sm">Verify your email to manage friends and requests.</p>
        </div>
      </div>
    );
  }

  const isLoading = loadingFriends || loadingSent;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1520] to-[#0c1b2e] text-white px-4 sm:px-8 py-10">
      <div className="container mx-auto max-w-5xl space-y-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Friends
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage your connections and pending requests
            </p>
          </div>

          <Link
            to="/notifications"
            className="flex items-center gap-2 border border-blue-400/40 text-blue-300 hover:text-white hover:bg-blue-500/20 rounded-xl px-4 py-2 transition-all duration-300 text-sm"
          >
            <BellIcon size={16} />
            Received Requests
          </Link>
        </motion.div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`friend-tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {friends.map((friend) => {
                      const isOnline = onlineUsers.has(friend._id);
                      const isUnfollowing = unfollowingId === friend._id;
                      return (
                        <motion.div
                          key={friend._id}
                          whileHover={{ scale: 1.02 }}
                          transition={{ type: "spring", stiffness: 250 }}
                          className="bg-[#0e1c2d]/80 backdrop-blur-xl border border-blue-400/10 rounded-2xl p-5 hover:border-blue-400/30 transition-all duration-300 flex flex-col gap-4"
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
                              <p className="font-semibold text-white truncate">{friend.fullName}</p>
                              <p className={`text-xs ${isOnline ? "text-emerald-400" : "text-gray-500"}`}>
                                {isOnline ? "Online" : "Offline"}
                              </p>
                            </div>
                          </div>

                          {/* Language badges */}
                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-2.5 py-1 bg-blue-500/15 text-blue-300 rounded-lg text-[11px] flex items-center gap-1">
                              {getLanguageFlag(friend.nativeLanguage)}
                              Native: {friend.nativeLanguage}
                            </span>
                            <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-[11px] flex items-center gap-1">
                              {getLanguageFlag(friend.learningLanguage)}
                              Learning: {friend.learningLanguage}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-auto">
                            <Link
                              to={`/chat/${friend._id}`}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition"
                            >
                              <MessageCircle size={14} />
                              Message
                            </Link>
                            <button
                              id={`unfollow-${friend._id}`}
                              onClick={() => unfollowMutation(friend._id)}
                              disabled={isUnfollowing}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
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
                    <Link to="/" className="text-cyan-400 text-sm hover:underline">
                      Discover new people →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sentRequests.map((req) => (
                      <motion.div
                        key={req._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center justify-between gap-4 bg-[#0e1c2d]/80 border border-blue-400/10 rounded-2xl px-5 py-4 hover:border-blue-400/25 transition-all"
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
                            <p className="font-semibold text-white">{req.recipient?.fullName}</p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {req.recipient?.nativeLanguage && (
                                <span className="text-[11px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  {getLanguageFlag(req.recipient.nativeLanguage)}
                                  Native: {req.recipient.nativeLanguage}
                                </span>
                              )}
                              {req.recipient?.learningLanguage && (
                                <span className="text-[11px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  {getLanguageFlag(req.recipient.learningLanguage)}
                                  Learning: {req.recipient.learningLanguage}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-400/30 text-amber-300 px-3 py-1.5 rounded-full flex-shrink-0">
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