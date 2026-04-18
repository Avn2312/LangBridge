import React from 'react'
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getUserFriends } from '../lib/api.js';
import FriendCard, { getLanguageFlag } from "../components/FriendCard.jsx";
import NoFriendsFound from "../components/NoFriendsFound.jsx";


const FriendPage = () => {

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  return (
    <div>

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

    </div>
  )
}

export default FriendPage;