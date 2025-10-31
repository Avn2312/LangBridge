import React, { useState } from "react";
import { motion } from "framer-motion";
import { Globe, MessageCircle } from "lucide-react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import useSignUp from "../hooks/useSignUp.js";

const SignUpPage = () => {
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const queryClient = useQueryClient();
  
  // this is how we made initial hook
  // const {
  //   mutate: signupMutation,
  //   isPending,
  //   error,
  // } = useMutation({
  //   mutationFn: signup,
  //   onSuccess: () =>
  //     queryClient.invalidateQueries({
  //       queryKey: ["authUser"],
  //     }),
  // });

  // this is our custom hook
  const { isPending, error, signupMutation } = useSignUp();

  const handleSignup = (e) => {
    e.preventDefault();
    signupMutation(signupData);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gradient-to-br from-[#0a1f3c] via-[#0f2e52] to-[#153e6a] text-white"
      data-theme="night"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="border border-white/10 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* LEFT SIDE - SIGNUP FORM */}
        <div className="w-full lg:w-1/2 p-6 sm:p-10 flex flex-col">
          {/* Logo with hover animation */}
          <motion.div className="flex items-center gap-4 mb-6 cursor-pointer">
            <div className="relative w-[52px] h-[52px] flex-shrink-0">
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
            </div>

            <div className="flex flex-col leading-tight">
              <span className="font-inter text-[#4fc3f7] text-3xl font-semibold tracking-wide">
                Lang<span className="font-bold text-white">Bridge</span>
              </span>
              <small className="text-[#b0c4de] text-xs">
                Connecting the world, one language at a time
              </small>
            </div>
          </motion.div>

          {/* Error message */}
          {error && (
            <div className="alert alert-error mb-4 bg-red-500/20 border border-red-400/30 p-2 rounded-md text-sm">
              <span>{error.response.data.message}</span>
            </div>
          )}

          {/* Signup form */}
          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            <motion.h2
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-2xl font-semibold mb-2"
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
              <input
                type="password"
                placeholder="e.g. John@123"
                className="input  w-full bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4fc3f7]"
                value={signupData.password}
                onChange={(e) =>
                  setSignupData({ ...signupData, password: e.target.value })
                }
                required
              />
              <p className="text-xs text-[#b0c4de] mt-1">
                Password must be at least 8 characters long.
              </p>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2 text-xs text-[#b0c4de]">
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
              className="btn w-full bg-[#1676c4] hover:bg-[#0f5ca2] text-white font-semibold rounded-lg shadow-md transition-all duration-300"
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

            <p className="text-center text-sm mt-4 text-[#b0c4de]">
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
          <div className="max-w-md p-8 text-center">
            <motion.img
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4 }}
              src="/vci.png"
              alt="Language connection illustration"
              className="w-full h-full drop-shadow-lg"
            />
            <p className="text-lg font-medium text-[#cde6ff] mt-6 leading-relaxed">
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
