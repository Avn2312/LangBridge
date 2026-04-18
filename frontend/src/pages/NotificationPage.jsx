import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFriendRequests, acceptFriendRequest } from "../lib/api.js";
import {
  BellIcon,
  ClockIcon,
  MessageSquareIcon,
  UserCheckIcon,
} from "lucide-react";
import NoNotificationsFound from "../components/NoNotificationsFound.jsx";
import { motion } from "framer-motion";
import useAuthUser from "../hooks/useAuthUser.js";

const NotificationPage = () => {
  const queryClient = useQueryClient();
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);

  const { data: friendRequests, isLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled: isVerified,
  });

  const { mutate: acceptRequestMutation, isPending } = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const incomingRequests = friendRequests?.incomingReqs || [];
  const acceptedRequests = friendRequests?.acceptedReqs || [];

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
            {incomingRequests.length > 0 && (
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
                    {incomingRequests.length}
                  </span>
                </h2>

                <div className="space-y-4">
                  {incomingRequests.map((request) => (
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
                              src={request.sender.profilePic}
                              alt={request.sender.fullName}
                              className="object-cover w-full h-full"
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-white">
                              {request.sender.fullName}
                            </h3>
                            <div className="flex flex-wrap gap-2 mt-1 text-sm">
                              <span className="badge bg-[#38bdf8]/20 text-[#93c5fd] border border-[#38bdf8]/40">
                                Native: {request.sender.nativeLanguage}
                              </span>
                              <span className="badge bg-transparent border border-[#38bdf8]/40 text-[#bae6fd]">
                                Learning: {request.sender.learningLanguage}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          className="btn btn-sm bg-[#2563eb] hover:bg-[#1e40af] text-white border-none transition-colors duration-200"
                          onClick={() => acceptRequestMutation(request._id)}
                          disabled={isPending}
                        >
                          Accept
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ACCEPTED CONNECTIONS */}
            {acceptedRequests.length > 0 && (
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
                  {acceptedRequests.map((notification) => (
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
                            src={notification.recipient.profilePic}
                            alt={notification.recipient.fullName}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-lg">
                            {notification.recipient.fullName}
                          </h3>
                          <p className="text-sm text-[#cbd5e1]/80 my-1">
                            {notification.recipient.fullName} accepted your
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
            {incomingRequests.length === 0 && acceptedRequests.length === 0 && (
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
