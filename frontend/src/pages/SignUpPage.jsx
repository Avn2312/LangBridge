import React, { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Globe, MessageCircle } from "lucide-react";
import { Link } from "react-router";
// import { useQueryClient } from "@tanstack/react-query";
import useSignUp from "../hooks/useSignUp.js";

const SignUpPage = () => {
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const { isPending, error, signupMutation } = useSignUp();

  const handleGoogleAuth = () => {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
    window.location.href = `${apiBaseUrl}/auth/google`;
  };

  const handleSignup = (e) => {
    e.preventDefault();
    signupMutation(signupData);
  };

  return (
    <div
      className="h-screen overflow-hidden flex items-center justify-center p-3 sm:p-4 bg-gradient-to-br from-[#0a1f3c] via-[#0f2e52] to-[#153e6a] text-white"
      data-theme="night"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="border border-white/10 flex flex-col lg:flex-row w-full h-full max-h-[920px] max-w-5xl mx-auto bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* LEFT SIDE - SIGNUP FORM */}
        <div className="w-full lg:w-1/2 p-4 sm:p-5 lg:p-6 flex flex-col">
          {/* Logo with hover animation */}
          <motion.div className="flex items-center gap-3 mb-3 cursor-pointer">
            <div className="relative w-[44px] h-[44px] flex-shrink-0">
              <Globe size={44} strokeWidth={1.5} className="text-[#4fc3f7]" />
              <div
                className="absolute right-[4%] top-[55%] w-[36%] h-[36%] rounded-md flex items-center justify-center"
                style={{ background: "#06B6D4" }}
              >
                <MessageCircle
                  size={44 * 0.18}
                  strokeWidth={1.6}
                  className="text-white"
                />
              </div>
            </div>

            <div className="flex flex-col leading-tight">
              <span className="font-inter text-[#4fc3f7] text-2xl font-semibold tracking-wide">
                Lang<span className="font-bold text-white">Bridge</span>
              </span>
              <small className="text-[#b0c4de] text-xs">
                Connecting the world, one language at a time
              </small>
            </div>
          </motion.div>

          {/* Error message */}
          {error && (
            <div className="alert alert-error mb-3 bg-red-500/20 border border-red-400/30 p-2 rounded-md text-sm">
              <span>{error.response.data.message}</span>
            </div>
          )}

          {/* Signup form */}
          <form
            onSubmit={handleSignup}
            className="flex flex-col gap-3 sm:gap-4"
          >
            <motion.h2
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-xl sm:text-2xl font-semibold mb-0"
            >
              Create an Account
            </motion.h2>

            {/* Full Name */}
            <div>
              <label className="label text-sm opacity-80 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                className="input  w-full bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                value={signupData.fullName}
                onChange={(e) =>
                  setSignupData({ ...signupData, fullName: e.target.value })
                }
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="label text-sm opacity-80 mb-1">Email</label>
              <input
                type="email"
                placeholder="e.g. johndoe123@gmail.com"
                className="input  w-full bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                value={signupData.email}
                onChange={(e) =>
                  setSignupData({ ...signupData, email: e.target.value })
                }
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="label text-sm opacity-80 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="e.g. John@123"
                  className="input w-full pr-11 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                  value={signupData.password}
                  onChange={(e) =>
                    setSignupData({ ...signupData, password: e.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-[#b0c4de] hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-[#b0c4de] mt-1 leading-snug">
                Password must be at least 8 characters long.
              </p>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2 text-[11px] leading-snug text-[#b0c4de]">
              <input
                type="checkbox"
                required
                className="checkbox checkbox-xs"
              />
              <p>
                I agree with the{" "}
                <span className="text-[#4fc3f7] hover:underline cursor-pointer">
                  terms of services
                </span>{" "}
                and{" "}
                <span className="text-[#4fc3f7] hover:underline cursor-pointer">
                  privacy policies
                </span>
                .
              </p>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="btn w-full min-h-0 h-10 bg-[#1676c4] hover:bg-[#0f5ca2] text-white font-semibold rounded-lg shadow-md transition-all duration-300"
              type="submit"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  &nbsp;Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </motion.button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/25" />
              <span className="text-xs text-[#b0c4de]">or</span>
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

            <p className="text-center text-sm mt-1 text-[#b0c4de]">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-[#4fc3f7] hover:text-[#82d4ff] transition-colors underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>

        {/* RIGHT SIDE - Illustration */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden lg:flex w-full lg:w-1/2 bg-gradient-to-tl from-[#113456]/60 via-[#0f2c4d]/40 to-transparent backdrop-blur-md items-center justify-center"
        >
          <div className="max-w-md p-5 text-center">
            <motion.img
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4 }}
              src="/vci.png"
              alt="Language connection illustration"
              className="w-full h-full drop-shadow-lg"
            />
            <p className="text-base font-medium text-[#cde6ff] mt-4 leading-relaxed">
              <span className="font-semibold text-[#4fc3f7]">Learn</span>,
              <span className="font-semibold text-[#4fc3f7]"> Practice</span>,
              and <span className="font-semibold text-[#4fc3f7]">Speak</span>.
              <br /> LangBridge connects you with language partners worldwide in
              real time — start your journey today!
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default SignUpPage;