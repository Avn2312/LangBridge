import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFriendRequests, acceptFriendRequest, rejectFriendRequest } from "../lib/api.js";
import {
  BellIcon,
  ClockIcon,
  MessageSquareIcon,
  UserCheckIcon,
  UserX,
} from "lucide-react";
import toast from "react-hot-toast";
import NoNotificationsFound from "../components/NoNotificationsFound.jsx";
import { motion } from "framer-motion";
import useAuthUser from "../hooks/useAuthUser.js";
import { useEffect, useState } from "react";
import { useSocketStore } from "../store/socketStore.js";

const FALLBACK_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";

const NotificationPage = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);
  const clearFriendRequestCount = useSocketStore((s) => s.clearFriendRequestCount);
  const friendRequestCount = useSocketStore((s) => s.friendRequestCount);

  // Clear the badge as soon as the user opens this page
  useEffect(() => {
    clearFriendRequestCount();
  }, [clearFriendRequestCount]);

  // Re-fetch when new real-time friend request arrives
  useEffect(() => {
    if (friendRequestCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    }
  }, [friendRequestCount, queryClient]);

  const { data: friendRequests, isLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled: isVerified,
  });

  // Track which request is in flight so only THAT button shows a spinner
  const [processingId, setProcessingId] = useState(null);

  const { mutate: acceptRequestMutation } = useMutation({
    mutationFn: acceptFriendRequest,
    onMutate: (id) => setProcessingId(id),
    onSuccess: () => {
      toast.success("Friend request accepted!");
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to accept."),
    onSettled: () => setProcessingId(null),
  });

  const { mutate: rejectRequestMutation } = useMutation({
    mutationFn: rejectFriendRequest,
    onMutate: (id) => setProcessingId(id),
    onSuccess: () => {
      toast.success("Friend request declined.");
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to decline."),
    onSettled: () => setProcessingId(null),
  });

  const incomingRequests = friendRequests?.incomingReqs || [];
  const acceptedRequests = friendRequests?.acceptedReqs || [];

  // Filter out any entries where the populated user reference is null
  // (can happen if the user account was deleted after the request was sent)
  const safeIncoming = incomingRequests.filter((r) => r.sender != null);
  const safeAccepted = acceptedRequests.filter((r) => r.recipient != null);

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0d1b2a] via-[#1b263b] to-[#0d1b2a] text-[#e2e8f0] py-12 px-4 sm:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-2xl border border-amber-300/40 bg-amber-100/95 p-6 text-amber-900">
            <h2 className="text-xl font-semibold">
              Email verification required
            </h2>
            <p className="mt-2 text-sm">
              Verify your email from the banner to view and manage friend
              requests.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d1b2a] via-[#1b263b] to-[#0d1b2a] text-[#e2e8f0] py-12 px-4 sm:px-8">
      <div className="container mx-auto max-w-4xl space-y-10">
        {/* HEADER */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl font-bold text-center bg-gradient-to-r from-[#60a5fa] to-[#38bdf8] bg-clip-text text-transparent tracking-wide"
        >
          Notifications
        </motion.h1>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg text-[#60a5fa]"></span>
          </div>
        ) : (
          <>
            {/* FRIEND REQUESTS */}
            {safeIncoming.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-semibold flex items-center gap-2 text-[#93c5fd]">
                  <UserCheckIcon className="h-6 w-6 text-[#60a5fa]" />
                  Friend Requests
                  <span className="badge bg-[#2563eb] border-none ml-2 text-white">
                    {safeIncoming.length}
                  </span>
                </h2>

                <div className="space-y-4">
                  {safeIncoming.map((request) => (
                    <motion.div
                      key={request._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="card bg-[#1e3a8a]/10 border border-[#3b82f6]/20 shadow-lg hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all backdrop-blur-sm"
                    >
                      <div className="card-body p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="avatar w-14 h-14 rounded-full overflow-hidden border-2 border-[#38bdf8]/60">
                            <img
                              src={request.sender?.profilePic || FALLBACK_AVATAR}
                              alt={request.sender?.fullName}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-white">
                              {request.sender?.fullName}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1 text-sm">
                              <span className="badge bg-[#38bdf8]/20 text-[#93c5fd] border border-[#38bdf8]/40">
                                Native: {request.sender?.nativeLanguage}
                              </span>
                              <span className="badge bg-transparent border border-[#38bdf8]/40 text-[#bae6fd]">
                                Learning: {request.sender?.learningLanguage}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            id={`accept-${request._id}`}
                            className="btn btn-sm bg-[#2563eb] hover:bg-[#1e40af] text-white border-none transition-colors duration-200 min-w-[80px]"
                            onClick={() => acceptRequestMutation(request._id)}
                            disabled={processingId === request._id}
                          >
                            {processingId === request._id ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              "Accept"
                            )}
                          </button>
                          <button
                            id={`reject-${request._id}`}
                            className="btn btn-sm bg-transparent border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors duration-200"
                            onClick={() => rejectRequestMutation(request._id)}
                            disabled={processingId === request._id}
                            title="Decline"
                          >
                            <UserX size={15} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ACCEPTED CONNECTIONS */}
            {safeAccepted.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-semibold flex items-center gap-2 text-[#86efac]">
                  <BellIcon className="h-6 w-6 text-[#4ade80]" />
                  New Connections
                </h2>

                <div className="space-y-4">
                  {safeAccepted.map((notification) => (
                    <motion.div
                      key={notification._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="card bg-[#1e3a8a]/10 border border-[#22c55e]/20 shadow-md hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all backdrop-blur-sm"
                    >
                      <div className="card-body p-5 flex items-start gap-4">
                        <div className="avatar size-12 rounded-full overflow-hidden border-2 border-[#22c55e]/60">
                          <img
                            src={notification.recipient?.profilePic || FALLBACK_AVATAR}
                            alt={notification.recipient?.fullName}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-lg">
                            {notification.recipient?.fullName}
                          </h3>
                          <p className="text-sm text-[#cbd5e1]/80 my-1">
                            {notification.recipient?.fullName} accepted your
                            friend request
                          </p>
                          <p className="text-xs flex items-center text-[#94a3b8]/70">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            Recently
                          </p>
                        </div>
                        <div className="badge bg-[#22c55e]/20 border border-[#22c55e]/40 text-[#bbf7d0]">
                          <MessageSquareIcon className="h-3 w-3 mr-1" />
                          New Friend
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* NO NOTIFICATIONS */}
            {safeIncoming.length === 0 && safeAccepted.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <NoNotificationsFound />
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationPage;
