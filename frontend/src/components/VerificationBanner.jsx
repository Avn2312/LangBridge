import { useMutation } from "@tanstack/react-query";
import { ShieldAlertIcon, SendIcon } from "lucide-react";
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
    <div className="border-b border-amber-300/40 bg-amber-100/95 text-amber-900">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <div className="flex items-start gap-2">
          <ShieldAlertIcon className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm font-medium">
            Verify your email to unlock friend requests, chat, and calls.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-sm border-none bg-amber-500 text-white hover:bg-amber-600"
          onClick={() => resendMutation()}
          disabled={isPending}
        >
          <SendIcon className="size-4" />
          {isPending ? "Sending..." : "Resend verification email"}
        </button>
      </div>
    </div>
  );
};

export default VerificationBanner;
