import React, { useState } from "react";
import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  Globe,
  MessageCircle,
  HomeIcon,
  UserIcon,
  BellIcon,
  X,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Sidebar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { path: "/", label: "Home", icon: <HomeIcon className="size-5" /> },
    { path: "/friends", label: "Friends", icon: <UserIcon className="size-5" /> },
    { path: "/notifications", label: "Notifications", icon: <BellIcon className="size-5" /> },
  ];

  const toggleSidebar = () => setIsOpen((prev) => !prev);

  return (
    <>
      {/* ========= DESKTOP SIDEBAR ========= */}
      <aside className="hidden lg:flex flex-col justify-between w-64 h-screen sticky top-0 bg-gradient-to-b from-[#0C1B2E] via-[#0E213A] to-[#0A1525] text-gray-100 border-r border-blue-500/10 backdrop-blur-xl shadow-[inset_0_0_15px_rgba(0,0,0,0.4)]">
        {/* =================== LOGO SECTION =================== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="p-6 border-b border-blue-500/10"
        >
          <Link to="/" className="flex items-center gap-4 group">
            <motion.div
              whileHover={{
                scale: 1.08,
                boxShadow:
                  "0 0 25px rgba(80,200,255,0.4), 0 0 50px rgba(0,180,255,0.3)",
              }}
              className="relative w-[52px] h-[52px] flex-shrink-0"
            >
              <Globe size={52} strokeWidth={1.5} className="text-[#4fc3f7]" />
              <div
                className="absolute right-[4%] top-[55%] w-[36%] h-[36%] rounded-md flex items-center justify-center"
                style={{ background: "#06B6D4" }}
              >
                <MessageCircle
                  size={52 * 0.18}
                  strokeWidth={1.6}
                  className="text-white"
                />
              </div>
            </motion.div>

            <div className="flex flex-col leading-tight">
              <span className="text-2xl font-semibold tracking-wide bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Lang<span className="font-bold text-white">Bridge</span>
              </span>
              <small className="text-xs text-gray-400">
                Connecting the world, one language at a time
              </small>
            </div>
          </Link>
        </motion.div>

        {/* =================== NAV LINKS =================== */}
        <nav className="flex-1 p-5 space-y-2">
          {navLinks.map((link, index) => {
            const isActive = currentPath === link.path;
            return (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={link.path}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/30"
                      : "text-gray-300 hover:text-white hover:bg-blue-500/10"
                  }`}
                >
                  {link.icon}
                  <span className="font-medium text-sm">{link.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* =================== PROFILE =================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-5 border-t border-blue-500/10 mt-auto"
        >
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-blue-400/30 group-hover:ring-cyan-400/60 transition-all duration-300">
                <img
                  src={authUser?.profilePic}
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-[#0C1B2E]" />
            </div>

            <div className="flex flex-col">
              <p className="font-semibold text-sm text-white">
                {authUser?.fullName || "User"}
              </p>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-400 inline-block" />
                Online
              </p>
            </div>
          </div>
        </motion.div>
      </aside>

      {/* ========= MOBILE SIDEBAR TOGGLE BUTTON ========= */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#0E213A]/80 text-white rounded-lg shadow-lg backdrop-blur-md"
      >
        <Menu size={22} />
      </button>

      {/* ========= MOBILE SIDEBAR DRAWER ========= */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* BACKDROP */}
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
            />
            {/* SIDEBAR PANEL */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 120 }}
              className="fixed top-0 left-0 h-full w-64 bg-gradient-to-b from-[#0C1B2E] via-[#0E213A] to-[#0A1525] text-gray-100 border-r border-blue-500/10 shadow-lg z-50 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between p-5 border-b border-blue-500/10">
                <Link
                  to="/"
                  className="flex items-center gap-3"
                  onClick={toggleSidebar}
                >
                  <Globe size={32} className="text-[#4fc3f7]" />
                  <span className="text-xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Lang<span className="text-white">Bridge</span>
                  </span>
                </Link>
                <button onClick={toggleSidebar}>
                  <X size={22} className="text-gray-300 hover:text-white" />
                </button>
              </div>

              <nav className="flex-1 p-5 space-y-2">
                {navLinks.map((link) => {
                  const isActive = currentPath === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={toggleSidebar}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-xl transition-all duration-300 ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/30"
                          : "text-gray-300 hover:text-white hover:bg-blue-500/10"
                      }`}
                    >
                      {link.icon}
                      <span className="font-medium text-sm">{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-5 border-t border-blue-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-blue-400/30">
                    <img
                      src={authUser?.profilePic}
                      alt="User Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">
                      {authUser?.fullName || "User"}
                    </p>
                    <p className="text-xs text-emerald-400">Online</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;