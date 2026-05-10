import { Link } from "react-router";
import { RotateCcwIcon, UserRoundCogIcon } from "lucide-react";

const missingProfileFields = (profile = {}) => {
  const fields = [];

  if (!profile.learningLanguage) fields.push("language you want to practice");
  if (!profile.nativeLanguage) fields.push("native language");
  if (!profile.proficiencyLevel) fields.push("proficiency level");
  if (!Array.isArray(profile.interests) || profile.interests.length === 0) {
    fields.push("interests");
  }
  if (!profile.bio) fields.push("short bio");

  return fields;
};

const NoRecommendedUser = ({
  filters = {},
  hasActiveFilters = false,
  profile,
  onResetFilters,
}) => {
  const missingFields = missingProfileFields(profile);

  return (
    <div className="lb-empty-state">
      <h3 className="text-lg font-semibold tracking-tight text-white">
        {hasActiveFilters
          ? "No partners match these filters"
          : "No recommendations available yet"}
      </h3>
      <p className="mt-2 text-sm text-slate-300">
        {hasActiveFilters
          ? "Try widening your filters, especially online status or proficiency."
          : "Matching improves when your language profile has enough detail."}
      </p>

      {hasActiveFilters ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-slate-400">
          {filters.targetLanguage ? (
            <span className="rounded-full border border-white/10 px-3 py-1">
              Practice: {filters.targetLanguage}
            </span>
          ) : null}
          {filters.nativeLanguage ? (
            <span className="rounded-full border border-white/10 px-3 py-1">
              Native: {filters.nativeLanguage}
            </span>
          ) : null}
          {filters.proficiency ? (
            <span className="rounded-full border border-white/10 px-3 py-1">
              Level: {filters.proficiency}
            </span>
          ) : null}
          {filters.onlineNow ? (
            <span className="rounded-full border border-white/10 px-3 py-1">
              Online now only
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/30 p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Improve matching with
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(missingFields.length > 0
            ? missingFields
            : ["languages", "proficiency", "interests", "bio"]
          ).map((field) => (
            <span
              key={field}
              className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-300"
            >
              {field}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-400/20 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <RotateCcwIcon className="h-4 w-4" />
            Reset filters
          </button>
        ) : null}
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          <UserRoundCogIcon className="h-4 w-4" />
          Update profile
        </Link>
      </div>
    </div>
  );
};

export default NoRecommendedUser;
