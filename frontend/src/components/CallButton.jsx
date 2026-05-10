import { VideoIcon } from "lucide-react";

function CallButton({ handleVideoCall }) {
  return (
    <button
      type="button"
      onClick={handleVideoCall}
      className="grid h-10 w-10 place-items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 transition hover:bg-emerald-500/20 hover:text-emerald-200"
      title="Start video call"
    >
      <VideoIcon className="size-5" />
    </button>
  );
}

export default CallButton;
