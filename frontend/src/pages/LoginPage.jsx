/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Globe, MessageCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useLogin from "../hooks/useLogin.js";
import { API_BASE_URL } from "../lib/config.js";

const LoginPage = () => {
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified! You can now log in.");
    }
    if (searchParams.get("error") === "oauth_failed") {
      toast.error("Google sign-in failed. Please try again.");
    }
  }, [searchParams]);

  const { isPending, error, loginMutation } = useLogin();

  const handleGoogleAuth = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation(loginData);
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_18%_18%,rgba(20,201,203,0.24),transparent_30%),radial-gradient(circle_at_82%_82%,rgba(22,118,196,0.24),transparent_34%),linear-gradient(135deg,#071524_0%,#0A1A2F_42%,#0F2E52_100%)] p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="my-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#0B1728]/88 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl lg:min-h-[680px] lg:flex-row"
      >
        {/* Left Side - Login Form */}
        <div className="w-full lg:w-1/2 p-4 sm:p-5 lg:p-6 flex flex-col justify-center text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-[44px] h-[44px] flex-shrink-0">
              <Globe size={44} strokeWidth={1.6} className="text-white" />
              <div
                className="absolute right-[6%] top-[56%] w-[36%] h-[36%] rounded-md flex items-center justify-center"
                style={{ background: "#06B6D4" }}
              >
                <MessageCircle
                  size={44 * 0.18}
                  strokeWidth={1.6}
                  className="text-white"
                />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-semibold">
                Lang<span className="font-bold text-cyan-300">Bridge</span>
              </h1>
              <p className="text-xs text-gray-200">
                Connecting the world, one language at a time
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-400 text-red-100 px-4 py-2 rounded mb-3 text-sm">
              {error.response?.data?.message || "Login failed. Try again."}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-1">
                Welcome Back!!
              </h2>
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
                className="w-full rounded-lg border border-cyan-200/15 bg-slate-950/55 px-5 py-2.5 text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="e.g. password"
                  className="w-full rounded-lg border border-cyan-200/15 bg-slate-950/55 px-5 py-2.5 pr-12 text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/30"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-200 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
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

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/25" />
              <span className="text-xs text-gray-200">or</span>
              <div className="h-px flex-1 bg-white/25" />
            </div>

            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-full h-10 rounded-lg bg-white text-[#1f2937] font-medium transition-all duration-200 flex items-center justify-center gap-2 hover:bg-gray-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.73 1.22 9.23 3.6l6.88-6.88C35.93 2.33 30.31 0 24 0 14.64 0 6.54 5.38 2.56 13.22l8 6.21C12.44 13.59 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.5 24.5c0-1.68-.15-3.29-.43-4.84H24v9.17h12.65c-.55 2.96-2.21 5.47-4.7 7.16l7.34 5.7c4.3-3.96 6.81-9.79 6.81-17.19z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.56 28.57a14.57 14.57 0 0 1 0-9.14l-8-6.21a24.03 24.03 0 0 0 0 21.56l8-6.21z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.31 0 11.61-2.08 15.48-5.65l-7.34-5.7c-2.04 1.37-4.65 2.18-8.14 2.18-6.26 0-11.56-4.09-13.44-9.93l-8 6.21C6.54 42.62 14.64 48 24 48z"
                />
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-sm mt-1 text-gray-200">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-semibold text-cyan-200 underline-offset-4 hover:text-white hover:underline"
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
          className="hidden w-1/2 items-center justify-center border-l border-cyan-300/10 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-transparent backdrop-blur-lg lg:flex"
        >
          <div className="text-center text-white px-5 py-5 space-y-3 max-w-md">
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1 }}
              src="/logi.png"
              alt="Language connection illustration"
              className="w-full rounded-xl drop-shadow-lg"
            />
            <h2 className="text-xl font-semibold">Learn. Practice. Speak.</h2>
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
