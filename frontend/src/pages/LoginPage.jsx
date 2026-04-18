import React, { useEffect, useState } from "react";
import { Globe, MessageCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useLogin from "../hooks/useLogin.js";

const LoginPage = () => {
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified! You can now log in.");
    }
  }, [searchParams]);

  const { isPending, error, loginMutation } = useLogin();

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation(loginData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f4c75] via-[#1676c4] to-[#14c9cb] px-4 sm:px-6 md:px-8 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 bg-white/20 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-[#00c6ff]/20 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col lg:flex-row w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20"
      >
        {/* Left Side - Login Form */}
        <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="relative w-12 h-12 flex-shrink-0">
              <Globe size={48} strokeWidth={1.6} className="text-white" />
              <div
                className="absolute right-[6%] top-[56%] w-[36%] h-[36%] rounded-md flex items-center justify-center"
                style={{ background: "#06B6D4" }}
              >
                <MessageCircle
                  size={48 * 0.18}
                  strokeWidth={1.6}
                  className="text-white"
                />
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-semibold">
                Lang<span className="font-bold text-[#06B6D4]">Bridge</span>
              </h1>
              <p className="text-xs text-gray-200">
                Connecting the world, one language at a time
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-400 text-red-100 px-4 py-2 rounded mb-4 text-sm">
              {error.response?.data?.message || "Login failed. Try again."}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-1">Welcome Back 👋</h2>
              <p className="text-sm text-gray-200">
                Sign in to continue your language journey
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-200">
                Email
              </label>
              <input
                type="email"
                placeholder="e.g. johndoe@gmail.com"
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg placeholder-gray-300 text-white focus:ring-2 focus:ring-[#06B6D4] outline-none transition-all"
                value={loginData.email}
                onChange={(e) =>
                  setLoginData({ ...loginData, email: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-200">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg placeholder-gray-300 text-white focus:ring-2 focus:ring-[#06B6D4] outline-none transition-all"
                value={loginData.password}
                onChange={(e) =>
                  setLoginData({ ...loginData, password: e.target.value })
                }
                required
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-lg bg-[#06B6D4]/90 hover:bg-[#06B6D4] text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#06B6D4]/30"
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>

            <p className="text-center text-sm mt-4 text-gray-200">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-[#06B6D4] font-semibold hover:underline"
              >
                Create Account
              </Link>
            </p>
          </form>
        </div>

        {/* Right Side - Illustration */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9 }}
          className="hidden lg:flex w-1/2 items-center justify-center bg-white/10 backdrop-blur-lg border-l border-white/20"
        >
          <div className="text-center text-white px-8 space-y-4 max-w-md">
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1 }}
              src="/logi.png"
              alt="Language connection illustration"
              className="w-full rounded-xl drop-shadow-lg"
            />
            <h2 className="text-2xl font-semibold">
              Learn. Practice. Speak.
            </h2>
            <p className="text-sm text-gray-200">
              LangBridge connects you with language partners around the world
              for real-time conversations and cultural exchange.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginPage;