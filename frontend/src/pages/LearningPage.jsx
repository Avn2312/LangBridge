import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BookOpenCheck,
  Bookmark,
  Check,
  Clipboard,
  Languages,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { getLearningDashboard } from "../lib/api.js";

const EMPTY_ACTIVITIES = [];

const tabs = [
  {
    key: "savedPhrases",
    label: "Saved phrases",
    empty: "Saved chat phrases will appear here.",
    icon: Bookmark,
  },
  {
    key: "corrections",
    label: "Corrections",
    empty: "Corrected drafts and partner corrections will appear here.",
    icon: Sparkles,
  },
  {
    key: "translations",
    label: "Translations",
    empty: "Translated messages will appear here.",
    icon: Languages,
  },
];

const weeklyCards = [
  {
    key: "weeklyProgress",
    label: "Reviews this week",
    icon: BookOpenCheck,
    tone: "text-cyan-200",
  },
  {
    key: "activeDays",
    label: "Active days",
    icon: Activity,
    tone: "text-emerald-200",
  },
  {
    key: "savedPhrases",
    label: "Saved phrases",
    icon: Bookmark,
    tone: "text-blue-200",
  },
  {
    key: "corrections",
    label: "Corrections",
    icon: Sparkles,
    tone: "text-fuchsia-200",
  },
];

const normalizeActivityType = (type) => {
  if (type === "partner_correction" || type === "correction") {
    return "corrections";
  }
  if (type === "translation") return "translations";
  if (type === "saved_phrase") return "savedPhrases";
  return "other";
};

const getPartnerName = (activity) => {
  if (activity?.partner?.fullName) return activity.partner.fullName;
  if (activity?.partnerName) return activity.partnerName;
  if (activity?.metadata?.partnerName) return activity.metadata.partnerName;
  return "";
};

const formatActivityTime = (date) =>
  date
    ? new Date(date).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

const getActivityLabel = (activity) => {
  if (activity.type === "partner_correction") return "Partner correction";
  if (activity.type === "correction") return "Draft correction";
  if (activity.type === "translation") return "Translation";
  if (activity.type === "saved_phrase") return "Saved phrase";
  return "Practice";
};

const copyText = async (text) => {
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
};

const ReviewCard = ({ activity, canCopy, copied, onCopy }) => {
  const partnerName = getPartnerName(activity);
  const confidence = activity.metadata?.confidence;
  const confidenceLabel =
    typeof confidence === "number"
      ? `${Math.round(confidence * 100)}% confidence`
      : "";
  const note = activity.metadata?.note || activity.metadata?.explanation || "";
  const hasResult =
    activity.resultText && activity.resultText !== activity.sourceText;

  return (
    <article className="lb-surface-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="lb-pill-cyan">{getActivityLabel(activity)}</span>
        <span className="text-xs text-slate-500">
          {formatActivityTime(activity.createdAt)}
        </span>
      </div>

      {partnerName ? (
        <p className="mt-3 text-xs text-slate-500">With {partnerName}</p>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700/80 bg-slate-950/35 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Original
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
            {activity.sourceText || "No original text captured."}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">
              {activity.type === "saved_phrase" ? "Saved" : "Result"}
            </p>
            {canCopy ? (
              <button
                type="button"
                onClick={() => onCopy(activity)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-300/10"
              >
                {copied ? <Check size={13} /> : <Clipboard size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-cyan-50">
            {hasResult
              ? activity.resultText
              : activity.resultText || activity.sourceText || "No result text captured."}
          </p>
        </div>
      </div>

      {(activity.targetLanguage || confidenceLabel || note) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {activity.targetLanguage ? (
            <span>Language: {activity.targetLanguage}</span>
          ) : null}
          {confidenceLabel ? <span>{confidenceLabel}</span> : null}
          {note ? <span>Note: {note}</span> : null}
        </div>
      )}
    </article>
  );
};

const LearningPage = () => {
  const [activeTab, setActiveTab] = useState("savedPhrases");
  const [copiedId, setCopiedId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["learningDashboard"],
    queryFn: () => getLearningDashboard({ limit: 100 }),
  });

  const summary = data?.summary || {};
  const activitiesByTab = useMemo(
    () =>
      (data?.recentActivities || EMPTY_ACTIVITIES).reduce(
        (groups, activity) => {
          const key = normalizeActivityType(activity.type);
          if (!groups[key]) return groups;

          return {
            ...groups,
            [key]: [...groups[key], activity],
          };
        },
        { savedPhrases: [], corrections: [], translations: [] },
      ),
    [data?.recentActivities],
  );

  const activeActivities = activitiesByTab[activeTab] || [];
  const activeTabConfig = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const ActiveIcon = activeTabConfig.icon;

  const handleCopyPhrase = async (activity) => {
    const textToCopy = activity.resultText || activity.sourceText;

    try {
      const copied = await copyText(textToCopy);
      if (!copied) throw new Error("Copy failed");

      setCopiedId(activity._id);
      toast.success("Phrase copied.");
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      toast.error("Could not copy phrase.");
    }
  };

  return (
    <div className="lb-page-shell bg-gradient-to-b from-[#08131F] via-[#0C1D30] to-[#08101D]">
      <div className="lb-page-container">
        <div className="lb-page-header">
          <div>
            <h2 className="lb-page-title">Learning Review</h2>
            <p className="lb-page-subtitle">
              Revisit saved phrases, corrections, and translations from chat.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <>
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Weekly summary
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    A quick pulse on the practice you created this week.
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-100">
                  {summary.translations || 0} translations
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {weeklyCards.map((card) => {
                  const StatIcon = card.icon;
                  return (
                    <div key={card.key} className="lb-surface-card">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">{card.label}</p>
                        <StatIcon className={`h-5 w-5 ${card.tone}`} />
                      </div>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {summary[card.key] || 0}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Chat review
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Filter by activity type and compare original text with what
                    you learned.
                  </p>
                </div>

                <div className="inline-flex rounded-xl border border-blue-300/15 bg-slate-950/30 p-1">
                  {tabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-cyan-500/15 text-cyan-100"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                        }`}
                      >
                        <TabIcon size={14} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span>{activitiesByTab[tab.key]?.length || 0}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
                <ActiveIcon className="h-4 w-4 text-cyan-300" />
                <span>{activeTabConfig.label}</span>
              </div>

              {activeActivities.length === 0 ? (
                <div className="lb-empty-state text-sm text-slate-400">
                  {activeTabConfig.empty}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {activeActivities.map((activity) => (
                    <ReviewCard
                      key={activity._id}
                      activity={activity}
                      canCopy={activeTab === "savedPhrases"}
                      copied={copiedId === activity._id}
                      onCopy={handleCopyPhrase}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default LearningPage;
