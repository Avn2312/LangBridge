/* eslint-disable no-unused-vars */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  getRecommendedUsers,
  getUserFriends,
  getOutgoingFriendReqs,
  sendFriendRequest,
} from "../lib/api.js";
import { Link } from "react-router";
import { RotateCcwIcon, SlidersHorizontalIcon, UsersIcon } from "lucide-react";
import { motion } from "framer-motion";
import FriendCard from "../components/FriendCard.jsx";
import NoFriendsFound from "../components/NoFriendsFound.jsx";
import NoRecommendedUser from "../components/NoRecommendedUser.jsx";
import useAuthUser from "../hooks/useAuthUser.js";
import toast from "react-hot-toast";
import { useSocketStore } from "../store/socketStore.js";
import RecommendedUserCard from "../components/RecommendedUserCard.jsx";
import { LANGUAGES } from "../constants/index.js";

const PROFICIENCY_OPTIONS = ["beginner", "intermediate", "advanced"];

const defaultDiscoveryFilters = {
  targetLanguage: "",
  nativeLanguage: "",
  proficiency: "",
  onlineNow: false,
};

const hasActiveDiscoveryFilters = (filters) =>
  Boolean(
    filters.targetLanguage ||
      filters.nativeLanguage ||
      filters.proficiency ||
      filters.onlineNow,
  );

const HomePage = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());
  const [discoveryFilters, setDiscoveryFilters] = useState(
    defaultDiscoveryFilters,
  );
  const isVerified = Boolean(authUser?.verified);

  // Real-time online presence
  const onlineUsers = useSocketStore((s) => s.onlineUsers);

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users", discoveryFilters],
    queryFn: () =>
      getRecommendedUsers({
        ...discoveryFilters,
        onlineNow: discoveryFilters.onlineNow ? "true" : "",
      }),
  });

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
    enabled: isVerified,
  });

  const { mutate: sendRequestMutation, isPending } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] }),
    onError: (error) => {
      console.error("❌ Friend request failed:", error);
    },
  });

  const hasDiscoveryFilters = hasActiveDiscoveryFilters(discoveryFilters);

  useEffect(() => {
    if (!isVerified) {
      setOutgoingRequestsIds(new Set());
      return;
    }

    const outgoingIds = new Set();
    if (outgoingFriendReqs && outgoingFriendReqs.length > 0) {
      outgoingFriendReqs.forEach((req) => {
        outgoingIds.add(req.recipient._id);
      });
      setOutgoingRequestsIds(outgoingIds);
    }
  }, [outgoingFriendReqs, isVerified]);

  return (
    <div className="lb-page-shell bg-gradient-to-b from-[#0A1A2F] via-[#0F223D] to-[#08101D]">
      <div className="lb-page-container">
        {/* ================= FRIENDS SECTION ================= */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lb-page-header"
        >
          <div>
            <h2 className="lb-page-title">Your Friends</h2>
            <p className="lb-page-subtitle">
              Keep active conversations flowing with your language partners.
            </p>
          </div>
          <Link
            to="/notifications"
            className="inline-flex items-center gap-2 rounded-xl border border-blue-300/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition-colors duration-200 hover:bg-blue-500/20"
          >
            <UsersIcon className="size-4" />
            Friend Requests
          </Link>
        </motion.div>

        {loadingFriends ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : friends.length === 0 ? (
          <NoFriendsFound />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {friends.map((friend) => (
              <FriendCard
                key={friend._id}
                friend={friend}
                isOnline={onlineUsers.has(friend._id)}
              />
            ))}
          </motion.div>
        )}

        {/* ================= RECOMMENDED USERS ================= */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 sm:mb-8"
          >
            <h2 className="lb-page-title bg-gradient-to-r from-indigo-300 to-cyan-300">
              Meet New Learners
            </h2>
            <p className="lb-page-subtitle max-w-2xl">
              Discover language exchange partners based on your profile and
              learning goals.
            </p>
          </motion.div>

          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <SlidersHorizontalIcon className="size-4 text-cyan-300" />
                  Discovery filters
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Tune recommendations by practice goals, exchange fit, and availability.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-400/20 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setDiscoveryFilters(defaultDiscoveryFilters)}
                disabled={!hasDiscoveryFilters}
              >
                <RotateCcwIcon className="size-3.5" />
                Reset
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="form-control">
                <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                  Language I want to practice
                </span>
                <select
                  value={discoveryFilters.targetLanguage}
                  onChange={(event) =>
                    setDiscoveryFilters((filters) => ({
                      ...filters,
                      targetLanguage: event.target.value,
                    }))
                  }
                  className="select select-bordered min-h-11 w-full border-white/10 bg-slate-950/60 text-sm text-slate-100"
                >
                  <option value="">Any practice language</option>
                  {LANGUAGES.map((language) => (
                    <option key={`target-${language}`} value={language.toLowerCase()}>
                      {language}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                  My native language
                </span>
                <select
                  value={discoveryFilters.nativeLanguage}
                  onChange={(event) =>
                    setDiscoveryFilters((filters) => ({
                      ...filters,
                      nativeLanguage: event.target.value,
                    }))
                  }
                  className="select select-bordered min-h-11 w-full border-white/10 bg-slate-950/60 text-sm text-slate-100"
                >
                  <option value="">Any exchange fit</option>
                  {LANGUAGES.map((language) => (
                    <option key={`native-${language}`} value={language.toLowerCase()}>
                      {language}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                  Proficiency
                </span>
                <select
                  value={discoveryFilters.proficiency}
                  onChange={(event) =>
                    setDiscoveryFilters((filters) => ({
                      ...filters,
                      proficiency: event.target.value,
                    }))
                  }
                  className="select select-bordered min-h-11 w-full border-white/10 bg-slate-950/60 text-sm text-slate-100"
                >
                  <option value="">Any level</option>
                  {PROFICIENCY_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <span className="text-sm font-medium text-slate-200">
                  Online now
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-info toggle-sm"
                  checked={discoveryFilters.onlineNow}
                  onChange={(event) =>
                    setDiscoveryFilters((filters) => ({
                      ...filters,
                      onlineNow: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : recommendedUsers.length === 0 ? (
            <NoRecommendedUser
              filters={discoveryFilters}
              hasActiveFilters={hasDiscoveryFilters}
              profile={authUser}
              onResetFilters={() => setDiscoveryFilters(defaultDiscoveryFilters)}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
            >
              {recommendedUsers.map((user, i) => {
                const hasRequestBeenSent = outgoingRequestsIds.has(user._id);

                return (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <RecommendedUserCard
                      user={user}
                      hasRequestBeenSent={hasRequestBeenSent}
                      isVerified={isVerified}
                      isOnline={user.isOnline || onlineUsers.has(user._id)}
                      isPending={isPending}
                      onRequest={() => {
                        if (!isVerified) {
                          toast.error(
                            "Please verify your email to send friend requests.",
                          );
                          return;
                        }

                        sendRequestMutation(user._id);
                      }}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
