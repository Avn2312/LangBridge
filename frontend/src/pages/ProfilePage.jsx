import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  BookOpenCheck,
  Camera,
  CheckCircle2,
  Clock,
  Edit3,
  Languages,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { motion as Motion } from "framer-motion";
import useAuthUser from "../hooks/useAuthUser.js";
import { updateMyProfile, uploadProfilePhoto } from "../lib/api.js";
import { LANGUAGES } from "../constants/index.js";

const FALLBACK_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback";
const PROFICIENCY_CHOICES = ["beginner", "intermediate", "advanced"];

const formatValue = (value) => {
  if (!value) return "Not set";
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
};

const splitInterests = (value) =>
  value
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean)
    .slice(0, 8);

const getInitialFormState = (user) => ({
  fullName: user?.fullName || "",
  bio: user?.bio || "",
  nativeLanguage: user?.nativeLanguage || "",
  learningLanguage: user?.learningLanguage || "",
  location: user?.location || "",
  timezone:
    user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  proficiencyLevel: user?.proficiencyLevel || "",
  profilePic: user?.profilePic || "",
  interestsText: Array.isArray(user?.interests) ? user.interests.join(", ") : "",
});

const getProfileCompletionItems = (profile, interests) => [
  {
    label: "Native language",
    done: Boolean(profile?.nativeLanguage),
    hint: "Helps find learners who need a language you speak.",
  },
  {
    label: "Practice language",
    done: Boolean(profile?.learningLanguage),
    hint: "Helps find native speakers of the language you want.",
  },
  {
    label: "Proficiency",
    done: Boolean(profile?.proficiencyLevel),
    hint: "Keeps expectations clear before the first chat.",
  },
  {
    label: "Location",
    done: Boolean(profile?.location),
    hint: "Improves region and timezone matching.",
  },
  {
    label: "Timezone",
    done: Boolean(profile?.timezone),
    hint: "Makes online conversations easier to schedule.",
  },
  {
    label: "Interests",
    done: interests.length > 0,
    hint: "Creates stronger shared-interest match reasons.",
  },
  {
    label: "Short bio",
    done: Boolean(profile?.bio),
    hint: "Tells partners what kind of practice you want.",
  },
];

const ProfilePage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [formState, setFormState] = useState(() => getInitialFormState(authUser));

  const interests = Array.isArray(authUser?.interests)
    ? authUser.interests.filter(Boolean)
    : [];
  const completionItems = getProfileCompletionItems(authUser, interests);
  const completedCount = completionItems.filter((item) => item.done).length;
  const completionPercent = Math.round(
    (completedCount / completionItems.length) * 100,
  );
  const missingItems = completionItems.filter((item) => !item.done);

  const updateProfileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["authUser"], { user: data.user });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setFormState(getInitialFormState(data.user));
      setIsEditing(false);
      toast.success("Profile updated.");
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not update profile.");
    },
  });

  const details = [
    {
      label: "Native Language",
      value: formatValue(authUser?.nativeLanguage),
      icon: Languages,
    },
    {
      label: "Learning",
      value: formatValue(authUser?.learningLanguage),
      icon: BookOpenCheck,
    },
    {
      label: "Level",
      value: formatValue(authUser?.proficiencyLevel),
      icon: ShieldCheck,
    },
    {
      label: "Timezone",
      value: authUser?.timezone || "Not set",
      icon: Clock,
    },
  ];

  const updateField = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const startEditing = () => {
    setFormState(getInitialFormState(authUser));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setFormState(getInitialFormState(authUser));
    setIsEditing(false);
  };

  const handleRandomAvatar = () => {
    const idx = Math.floor(Math.random() * 100) + 1;
    updateField("profilePic", `https://avatar.iran.liara.run/public/${idx}.png`);
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile photo must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const photo = await uploadProfilePhoto(file);
      updateField("profilePic", photo.url);
      toast.success("Profile photo uploaded. Save to keep it.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not upload profile photo.",
      );
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    updateProfileMutation.mutate({
      fullName: formState.fullName,
      bio: formState.bio,
      nativeLanguage: formState.nativeLanguage,
      learningLanguage: formState.learningLanguage,
      location: formState.location,
      timezone: formState.timezone,
      proficiencyLevel: formState.proficiencyLevel,
      profilePic: formState.profilePic,
      interests: splitInterests(formState.interestsText),
    });
  };

  return (
    <div className="lb-page-shell bg-gradient-to-b from-[#0a1520] to-[#0c1b2e]">
      <div className="lb-page-container max-w-5xl">
        <Motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lb-page-header"
        >
          <div>
            <h1 className="lb-page-title">Profile</h1>
            <p className="lb-page-subtitle">
              Your language identity, goals, and public details.
            </p>
          </div>

          {isEditing ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={cancelEditing}
                className="lb-btn-soft flex-1 sm:flex-none"
                disabled={updateProfileMutation.isPending}
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="submit"
                form="profile-update-form"
                className="lb-btn-primary flex-1 sm:flex-none"
                disabled={updateProfileMutation.isPending || isUploadingPhoto}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEditing} className="lb-btn-primary">
              <Edit3 className="h-4 w-4" />
              Update Profile
            </button>
          )}
        </Motion.div>

        {isEditing ? (
          <form
            id="profile-update-form"
            onSubmit={handleSubmit}
            className="lb-surface-card space-y-6"
          >
            <div className="grid gap-6 lg:grid-cols-[190px_1fr]">
              <div className="flex flex-col items-center gap-3">
                <div className="lb-avatar-ring h-32 w-32 overflow-hidden bg-slate-950/70">
                  {formState.profilePic ? (
                    <img
                      src={formState.profilePic}
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                      onError={() => updateField("profilePic", "")}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Camera className="h-10 w-10 text-slate-500" />
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />

                <button
                  type="button"
                  onClick={handleRandomAvatar}
                  className="lb-btn-soft w-full px-3"
                >
                  <Shuffle className="h-4 w-4" />
                  Random avatar
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="lb-btn-soft w-full px-3 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload picture
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Full name
                  </span>
                  <input
                    type="text"
                    value={formState.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    className="lb-field"
                    required
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Native language
                  </span>
                  <select
                    value={formState.nativeLanguage}
                    onChange={(event) =>
                      updateField("nativeLanguage", event.target.value)
                    }
                    className="lb-field appearance-none"
                    required
                  >
                    <option value="">Choose native language</option>
                    {LANGUAGES.map((language) => (
                      <option key={`native-${language}`} value={language.toLowerCase()}>
                        {language}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Learning language
                  </span>
                  <select
                    value={formState.learningLanguage}
                    onChange={(event) =>
                      updateField("learningLanguage", event.target.value)
                    }
                    className="lb-field appearance-none"
                    required
                  >
                    <option value="">Choose learning language</option>
                    {LANGUAGES.map((language) => (
                      <option
                        key={`learning-${language}`}
                        value={language.toLowerCase()}
                      >
                        {language}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Proficiency
                  </span>
                  <select
                    value={formState.proficiencyLevel}
                    onChange={(event) =>
                      updateField("proficiencyLevel", event.target.value)
                    }
                    className="lb-field appearance-none"
                  >
                    <option value="">Choose level</option>
                    {PROFICIENCY_CHOICES.map((level) => (
                      <option key={level} value={level}>
                        {formatValue(level)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Location
                  </span>
                  <input
                    type="text"
                    value={formState.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    className="lb-field"
                    required
                  />
                </label>

                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Timezone
                  </span>
                  <input
                    type="text"
                    value={formState.timezone}
                    onChange={(event) => updateField("timezone", event.target.value)}
                    className="lb-field"
                  />
                </label>

                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Short bio
                  </span>
                  <textarea
                    value={formState.bio}
                    onChange={(event) => updateField("bio", event.target.value)}
                    className="lb-textarea-field min-h-28"
                    required
                  />
                </label>

                <label className="form-control md:col-span-2">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Interests
                  </span>
                  <input
                    type="text"
                    value={formState.interestsText}
                    onChange={(event) =>
                      updateField("interestsText", event.target.value)
                    }
                    className="lb-field"
                    placeholder="travel, music, films, food"
                  />
                  <span className="mt-1.5 text-xs text-slate-500">
                    Separate interests with commas. Up to 8 will be saved.
                  </span>
                </label>
              </div>
            </div>
          </form>
        ) : (
          <>
            <section className="lb-surface-card flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="lb-avatar-ring h-28 w-28 shrink-0 overflow-hidden">
                <img
                  src={authUser?.profilePic || FALLBACK_AVATAR}
                  alt={authUser?.fullName || "User Avatar"}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Online
                </p>
                <h1 className="mt-3 break-words text-3xl font-bold text-white sm:text-4xl">
                  {authUser?.fullName || "User"}
                </h1>
                {authUser?.location ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="h-4 w-4 text-cyan-300" />
                    {authUser.location}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {details.map((detail) => {
                const Icon = detail.icon;
                return (
                  <div key={detail.label} className="lb-surface-card">
                    <Icon className="h-5 w-5 text-cyan-300" />
                    <p className="mt-4 text-xs font-semibold uppercase text-slate-500">
                      {detail.label}
                    </p>
                    <p className="mt-1 text-base font-semibold text-slate-100">
                      {detail.value}
                    </p>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="lb-surface-card">
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  <UserRound className="h-5 w-5 text-cyan-300" />
                  Bio
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {authUser?.bio || "No bio added yet."}
                </p>
              </div>

              <div className="lb-surface-card">
                <h2 className="text-lg font-semibold text-white">Interests</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Shared topics make first messages easier.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {interests.length > 0 ? (
                    interests.map((interest) => (
                      <span key={interest} className="lb-pill-cyan">
                        {interest}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No interests added yet. Add topics like travel, music,
                      films, sports, food, or work.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        <section className="lb-surface-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <Sparkles className="h-5 w-5 text-cyan-300" />
                Matching Strength
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Complete language, availability, and conversation details to
                make recommendations easier to understand.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-cyan-100">
                {completionPercent}%
              </p>
              <p className="text-xs font-medium text-cyan-200">
                profile complete
              </p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {completionItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border p-3 ${
                  item.done
                    ? "border-emerald-300/20 bg-emerald-400/10"
                    : "border-white/10 bg-slate-950/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      item.done ? "text-emerald-300" : "text-slate-600"
                    }`}
                  />
                  <p className="text-sm font-semibold text-slate-100">
                    {item.label}
                  </p>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {item.done ? "Added to your matching profile." : item.hint}
                </p>
              </div>
            ))}
          </div>

          {missingItems.length > 0 ? (
            <p className="mt-4 text-sm text-slate-300">
              Next best update: {missingItems[0].label.toLowerCase()}.
            </p>
          ) : (
            <p className="mt-4 text-sm text-emerald-300">
              Your profile has the core signals discovery needs.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
