/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser.js";
import { BellIcon, LogOutIcon, UserRound } from "lucide-react";
import useLogout from "../hooks/useLogout.js";
import { motion } from "framer-motion";
import { useSocketStore } from "../store/socketStore.js";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const { logoutMutation } = useLogout();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const friendRequestCount = useSocketStore((s) => s.friendRequestCount);
  const clearFriendRequestCount = useSocketStore(
    (s) => s.clearFriendRequestCount,
  );

  // Clear the badge whenever the user is on the notification page
  useEffect(() => {
    if (location.pathname === "/notifications") {
      clearFriendRequestCount();
    }
  }, [location.pathname, clearFriendRequestCount]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-[#1f3d66] bg-gradient-to-br from-[#081a33] via-[#0d264d] to-[#133b6c] shadow-md backdrop-blur-lg sm:h-20"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center px-4 sm:px-8 lg:px-12">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100 sm:text-base">
            {authUser?.fullName || "LangBridge"}
          </p>
          <p className="hidden text-xs text-slate-400 sm:block">
            {authUser?.verified ? "Ready to practice" : "Verification pending"}
          </p>
        </div>

        {/* RIGHT: controls */}
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <Link to={"/notifications"}>
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.95 }}
              className="relative grid h-10 w-10 place-items-center rounded-full border border-blue-300/20 bg-blue-950/40 text-[#9bb7d4] transition-colors duration-200 hover:border-cyan-300/40 hover:text-[#4fc3f7]"
              aria-label="Open notifications"
            >
              <BellIcon className="h-5 w-5" />
              {friendRequestCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#06B6D4] rounded-full min-w-[16px] h-4 flex items-center justify-center text-[10px] text-white font-bold px-1">
                  {friendRequestCount > 9 ? "9+" : friendRequestCount}
                </span>
              )}
            </motion.button>
          </Link>

          <div className="relative" ref={profileMenuRef}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className="avatar ring ring-[#06B6D4]/40 ring-offset-2 ring-offset-[#0d264d] transition-all duration-200 hover:ring-[#06B6D4]/70"
              aria-label="Open profile menu"
              aria-expanded={isProfileMenuOpen}
            >
              <div className="w-9 sm:w-10 rounded-full">
                <img
                  src={
                    authUser?.profilePic ||
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"
                  }
                  alt="User Avatar"
                />
              </div>
            </motion.button>

            {isProfileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute right-0 top-14 z-50 w-52 overflow-hidden rounded-xl border border-blue-300/20 bg-[#0C1B2E] shadow-2xl shadow-black/35"
              >
                <Link
                  to="/profile"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                </Link>
              </motion.div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.95 }}
            onClick={logoutMutation}
            className="grid h-10 w-10 place-items-center rounded-full border border-blue-300/20 bg-blue-950/40 text-[#9bb7d4] transition-colors duration-200 hover:border-red-300/40 hover:text-[#ff6961]"
            aria-label="Log out"
          >
            <LogOutIcon className="h-5 w-5" />
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
