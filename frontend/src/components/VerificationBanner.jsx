import { useMutation } from "@tanstack/react-query";
import { Loader2Icon, ShieldAlertIcon, SendIcon } from "lucide-react";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser.js";
import { resendVerificationEmail } from "../lib/api.js";

const VerificationBanner = () => {
  const { authUser } = useAuthUser();

  const { mutate: resendMutation, isPending } = useMutation({
    mutationFn: resendVerificationEmail,
    onSuccess: (data) => {
      toast.success(data?.message || "Verification email sent.");
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ||
        "Could not resend verification email. Please try again.";
      toast.error(message);
    },
  });

  if (!authUser || authUser.verified) {
    return null;
  }

  return (
    <div className="border-b border-cyan-300/15 bg-[#0B1728]/95 text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
            <ShieldAlertIcon className="size-5" />
          </div>
          <p className="pt-1 text-sm font-medium leading-6 text-slate-200">
            <span className="font-semibold text-amber-100">
              Verify your email
            </span>{" "}
            to unlock friend requests, chat, and calls.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-amber-300 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
          onClick={() => resendMutation()}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SendIcon className="size-4" />
          )}
          {isPending ? "Sending..." : "Resend verification email"}
        </button>
      </div>
    </div>
  );
};

export default VerificationBanner;
