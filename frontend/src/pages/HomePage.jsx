import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  getRecommendedUsers,
  getUserFriends,
  getOutgoingFriendReqs,
  sendFriendRequest,
} from "../lib/api.js";
import { Link } from "react-router";
import {
  CheckCircleIcon,
  MapPinIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { capitialize } from "../lib/utils.js";
import FriendCard, { getLanguageFlag } from "../components/FriendCard.jsx";
import NoFriendsFound from "../components/NoFriendsFound.jsx";
import NoRecommendedUser from "../components/NoRecommendedUser.jsx";
import { useThemeStore } from "../store/useThemeStore.js";
import useAuthUser from "../hooks/useAuthUser.js";
import toast from "react-hot-toast";

const HomePage = () => {
  const queryClient = useQueryClient();
  const { theme } = useThemeStore();
  const { authUser } = useAuthUser();
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());
  const isVerified = Boolean(authUser?.verified);

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
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
    <div
      className={`min-h-screen p-6 sm:p-10 transition-colors duration-300 ${
        theme === "night"
          ? "bg-gradient-to-b from-[#0A1A2F] via-[#0F223D] to-[#08101D] text-white"
          : "bg-base-100 text-base-content"
      }`}
    >
      <div className="container mx-auto space-y-16">
        {/* ================= FRIENDS SECTION ================= */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Your Friends
          </h2>
          <Link
            to="/notifications"
            className="flex items-center gap-2 border border-blue-400/40 text-blue-300 hover:text-white hover:bg-blue-500/20 rounded-xl px-4 py-2 transition-all duration-300"
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {friends.map((friend) => (
              <motion.div
                key={friend._id}
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <FriendCard friend={friend} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ================= RECOMMENDED USERS ================= */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-10 sm:mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Meet New Learners
            </h2>
            <p className="text-gray-300 mt-2 text-sm sm:text-base">
              Discover perfect language exchange partners based on your
              interests and learning goals.
            </p>
          </motion.div>

          {loadingUsers ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : recommendedUsers.length === 0 ? (
            <NoRecommendedUser />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {recommendedUsers.map((user, i) => {
                const hasRequestBeenSent = outgoingRequestsIds.has(user._id);

                return (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{
                      scale: 1.02,
                      boxShadow:
                        "0 0 25px rgba(0, 153, 255, 0.25), 0 0 50px rgba(0, 102, 255, 0.15)",
                    }}
                    className="bg-[#0E1C2D]/80 backdrop-blur-xl border border-blue-400/10 rounded-2xl p-6 space-y-5 hover:border-blue-400/40 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-blue-500/40">
                        <img
                          src={user.profilePic}
                          alt={user.fullName}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div>
                        <h3 className="font-semibold text-lg text-white">
                          {user.fullName}
                        </h3>
                        {user.location && (
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <MapPinIcon className="size-3 mr-1 text-blue-400" />
                            {user.location}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LANGUAGES */}
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs flex items-center gap-1">
                        {getLanguageFlag(user.nativeLanguage)}
                        Native: {capitialize(user.nativeLanguage)}
                      </span>
                      <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs flex items-center gap-1">
                        {getLanguageFlag(user.learningLanguage)}
                        Learning: {capitialize(user.learningLanguage)}
                      </span>
                    </div>

                    {user.bio && (
                      <p className="text-sm text-gray-300 leading-relaxed">
                        {user.bio}
                      </p>
                    )}

                    {/* ACTION BUTTON */}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 ${
                        hasRequestBeenSent || !isVerified
                          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg"
                      }`}
                      onClick={() => {
                        if (!isVerified) {
                          toast.error(
                            "Please verify your email to send friend requests.",
                          );
                          return;
                        }

                        sendRequestMutation(user._id);
                      }}
                      disabled={hasRequestBeenSent || isPending || !isVerified}
                    >
                      {hasRequestBeenSent ? (
                        <>
                          <CheckCircleIcon className="size-4" />
                          Request Sent
                        </>
                      ) : !isVerified ? (
                        <>
                          <UserPlusIcon className="size-4" />
                          Verify Email Required
                        </>
                      ) : (
                        <>
                          <UserPlusIcon className="size-4" />
                          Send Friend Request
                        </>
                      )}
                    </motion.button>
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
