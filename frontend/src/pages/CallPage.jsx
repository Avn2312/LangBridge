import { useNavigate } from "react-router";
import { Video, ArrowLeft } from "lucide-react";

/**
 * CallPage — placeholder until video calling is implemented.
 * Stream Video has been removed; a custom WebRTC solution is planned.
 */
const CallPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#091520] to-[#0C1B2E] text-white px-4">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <Video size={36} className="text-cyan-400" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Video Calling</h1>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            Video calls are coming soon. We're building a custom WebRTC solution
            to replace the old Stream Video integration.
          </p>
        </div>

        <button
          id="call-page-back-button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-all"
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
      </div>
    </div>
  );
};

export default CallPage;