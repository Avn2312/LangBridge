/* eslint-disable no-unused-vars */
import React from "react";
import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser.js";
import {
  Globe,
  MessageCircle,
  HomeIcon,
  UserIcon,
  BookOpenCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSocketStore } from "../store/socketStore.js";

const Sidebar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const currentPath = location.pathname;
  const unreadCounts = useSocketStore((s) => s.unreadCounts);

  const unreadMessageCount = Object.values(unreadCounts).reduce(
    (total, count) => total + Number(count || 0),
    0,
  );

  const isDevOrAdmin =
    import.meta.env.DEV ||
    authUser?.role === "admin" ||
    authUser?.isAdmin === true;

  const navLinks = [
    { path: "/", label: "Home", icon: HomeIcon, match: ["/"] },
    {
      path: "/messages",
      label: "Messages",
      icon: MessageCircle,
      count: unreadMessageCount,
      match: ["/messages", "/chat"],
    },
    {
      path: "/learning",
      label: "Learning",
      icon: BookOpenCheck,
      match: ["/learning"],
    },
    { path: "/friends", label: "Friends", icon: UserIcon, match: ["/friends"] },
    { path: "/profile", label: "Profile", icon: UserRound, match: ["/profile"] },
  ];

  const mobileNavLinks = navLinks.filter((link) =>
    ["/", "/messages", "/learning", "/friends", "/profile"].includes(link.path),
  );

  const isLinkActive = (link) =>
    link.match.some((path) =>
      path === "/" ? currentPath === "/" : currentPath.startsWith(path),
    );

  const renderBadge = (count, mobile = false) =>
    count > 0 ? (
      <span
        className={
          mobile
            ? "absolute right-4 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-300 px-1 text-[9px] font-bold text-slate-950"
            : "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1.5 text-[10px] font-bold text-slate-950"
        }
      >
        {count > 9 ? "9+" : count}
      </span>
    ) : null;

  return (
    <>
      {/* ========= DESKTOP SIDEBAR ========= */}
      <aside className="hidden h-full w-64 shrink-0 flex-col justify-between border-r border-blue-500/10 bg-gradient-to-b from-[#0C1B2E] via-[#0E213A] to-[#0A1525] text-gray-100 shadow-[inset_0_0_15px_rgba(0,0,0,0.4)] lg:flex">
        {/* =================== LOGO SECTION =================== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="border-b border-blue-500/10 p-6"
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
        <nav className="flex-1 space-y-2 p-5" aria-label="Primary navigation">
          {navLinks.map((link, index) => {
            const isActive = isLinkActive(link);
            const Icon = link.icon;
            return (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={link.path}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-cyan-400/15 text-cyan-100 shadow-[inset_3px_0_0_#67e8f9]"
                      : "text-gray-300 hover:bg-blue-500/10 hover:text-white"
                  }`}
                >
                  <Icon className="size-5" />
                  <span>{link.label}</span>
                  {renderBadge(link.count)}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {isDevOrAdmin && (
          <div className="px-5 pb-4">
            <Link
              to="/moderation"
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors ${
                currentPath.startsWith("/moderation")
                  ? "bg-cyan-400/15 text-cyan-100"
                  : "text-slate-400 hover:bg-blue-500/10 hover:text-slate-100"
              }`}
            >
              <ShieldCheck className="size-4" />
              Admin tools
            </Link>
          </div>
        )}

        {/* =================== PROFILE =================== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-auto border-t border-blue-500/10 p-5"
        >
          <Link
            to="/profile"
            className={`flex items-center gap-3 rounded-xl p-2 transition-colors duration-200 ${
              currentPath.startsWith("/profile")
                ? "bg-cyan-400/15"
                : "hover:bg-blue-500/10"
            }`}
          >
            <div className="relative group shrink-0">
              <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-blue-400/30 group-hover:ring-cyan-400/60 transition-all duration-300">
                <img
                  src={
                    authUser?.profilePic ||
                    "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"
                  }
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-[#0C1B2E]" />
            </div>

            <div className="min-w-0 flex flex-col">
              <p className="font-semibold text-sm text-white">
                {authUser?.fullName || "User"}
              </p>
              <p className="text-xs text-emerald-400">Online</p>
            </div>
          </Link>
        </motion.div>
      </aside>

      {/* ========= MOBILE BOTTOM NAV ========= */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-blue-300/15 bg-[#071524]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden"
        aria-label="Primary navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNavLinks.map((link) => {
            const isActive = isLinkActive(link);
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors ${
                  isActive
                    ? "bg-cyan-400/15 text-cyan-100"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate">{link.label}</span>
                {renderBadge(link.count, true)}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
