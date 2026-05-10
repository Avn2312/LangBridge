import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import {
  getModerationReports,
  updateModerationReport,
} from "../lib/api.js";

const statuses = ["open", "reviewing", "actioned", "closed"];

const ModerationPage = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["moderationReports", "open"],
    queryFn: () => getModerationReports("open"),
  });

  const mutation = useMutation({
    mutationFn: ({ reportId, status }) =>
      updateModerationReport(reportId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderationReports"] });
      toast.success("Report updated.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not update report.");
    },
  });

  const reports = data?.reports || [];

  return (
    <div className="lb-page-shell bg-gradient-to-b from-[#0A1A2F] via-[#0F223D] to-[#08101D]">
      <div className="lb-page-container">
        <div className="lb-page-header">
          <div>
            <h2 className="lb-page-title">Moderation Queue</h2>
            <p className="lb-page-subtitle">
              Review reported users and messages from one operational queue.
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 text-cyan-300" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : reports.length === 0 ? (
          <div className="lb-surface-card text-sm text-slate-300">
            No open reports right now.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <article key={report._id} className="lb-surface-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">Reported user</p>
                    <h3 className="text-lg font-semibold text-white">
                      {report.reported?.fullName || "Unknown user"}
                    </h3>
                  </div>
                  <span className="lb-pill-blue capitalize">{report.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {report.reason || "No reason provided."}
                </p>
                {report.message?.text ? (
                  <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
                    {report.message.text}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        mutation.mutate({ reportId: report._id, status })
                      }
                      disabled={mutation.isPending || report.status === status}
                      className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium capitalize text-cyan-100 disabled:opacity-40"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModerationPage;
