import { BellIcon } from "lucide-react";
import { motion } from "framer-motion";

function NoNotificationsFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-gradient-to-b from-[#0d1b2a] via-[#1b263b] to-[#0d1b2a] rounded-2xl shadow-lg border border-[#1e3a8a]/40">
      {/* ICON */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring" }}
        className="relative flex items-center justify-center size-20 rounded-full bg-gradient-to-tr from-[#2563eb] via-[#1e40af] to-[#60a5fa] shadow-[0_0_25px_rgba(37,99,235,0.5)] mb-6"
      >
        <BellIcon className="size-10 text-white drop-shadow-md" />
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#3b82f6]/20 to-[#60a5fa]/10 blur-lg"
        />
      </motion.div>

      {/* TEXT */}
      <motion.h3
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl sm:text-3xl font-semibold text-[#e2e8f0] mb-2"
      >
        No Notifications Yet
      </motion.h3>

      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-base sm:text-lg text-[#cbd5e1]/80 max-w-md leading-relaxed"
      >
        When you receive new friend requests or messages, they’ll appear here.
      </motion.p>
    </div>
  );
}

export default NoNotificationsFound;
