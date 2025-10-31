import React from "react";
import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser.js";
import { Globe, MessageCircle, BellIcon, LogOutIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector.jsx";
import useLogout from "../hooks/useLogout.js";
import { motion } from "framer-motion";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const isChatPage = location.pathname?.startsWith("/chat");
  const { logoutMutation } = useLogout();

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 80, damping: 15 }}
      className="sticky top-0 z-40 h-20 flex items-center shadow-md 
      bg-gradient-to-br from-[#081a33] via-[#0d264d] to-[#133b6c] backdrop-blur-lg border-b border-[#1f3d66]"
    >
      <div className="container mx-auto px-4 sm:px-8 lg:px-12 flex items-center">
        {/* LEFT: logo (ONLY on chat pages) */}
        <div className="flex items-center">
          {isChatPage && (
            <Link to="/" className="flex items-center gap-3 group cursor-pointer">
              <motion.div
                whileHover={{
                  scale: 1.08,
                  boxShadow:
                    "0 0 25px rgba(80,200,255,0.35), 0 0 50px rgba(0,180,255,0.22)",
                }}
                transition={{ duration: 0.25 }}
                className="relative w-[48px] h-[48px] flex-shrink-0"
              >
                <Globe
                  size={48}
                  strokeWidth={1.6}
                  className="text-[#4fc3f7] group-hover:text-[#8de3ff] transition-colors duration-300"
                />
                <div
                  className="absolute right-[3%] top-[56%] w-[36%] h-[36%] rounded-md flex items-center justify-center bg-[#06B6D4] transition-shadow"
                  style={{ boxShadow: "0 0 0 rgba(6,182,212,0)" }}
                >
                  <MessageCircle
                    size={48 * 0.18}
                    strokeWidth={1.7}
                    className="text-white"
                  />
                </div>
              </motion.div>

              <motion.div
                whileHover={{ x: 3 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="flex flex-col leading-tight"
              >
                <span className="font-inter text-[#4fc3f7] text-2xl sm:text-3xl font-semibold tracking-wide">
                  Lang<span className="font-bold text-white">Bridge</span>
                </span>
                <small className="text-[#b0c4de] text-xs sm:text-sm">
                  Connecting the world, one language at a time
                </small>
              </motion.div>
            </Link>
          )}
        </div>

        {/* RIGHT: controls */}
        <div className="flex items-center gap-4 sm:gap-5 ml-auto">
          <Link to={"/notifications"}>
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.95 }}
              className="btn btn-ghost btn-circle relative group"
            >
              <BellIcon className="h-6 w-6 text-[#9bb7d4] group-hover:text-[#4fc3f7] transition-colors" />
              <span className="absolute top-1 right-1 bg-[#06B6D4] rounded-full w-2 h-2"></span>
            </motion.button>
          </Link>

          <ThemeSelector />

          <motion.div whileHover={{ scale: 1.08 }} className="avatar ring ring-[#06B6D4]/40 ring-offset-2">
            <div className="w-9 sm:w-10 rounded-full">
              <img src={authUser?.profilePic} alt="User Avatar" />
            </div>
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.95 }}
            onClick={logoutMutation}
            className="btn btn-ghost btn-circle group"
          >
            <LogOutIcon className="h-6 w-6 text-[#9bb7d4] group-hover:text-[#ff6961] transition-colors" />
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;