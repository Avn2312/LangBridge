import { useMemo, useRef, useState } from "react";
import useAuthUser from "../hooks/useAuthUser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { completeOnboarding, uploadProfilePhoto } from "../lib/api.js";
import {
  CameraIcon,
  CheckCircleIcon,
  ClockIcon,
  GlobeIcon,
  LanguagesIcon,
  LoaderIcon,
  MapPinIcon,
  MessageCircleIcon,
  ShuffleIcon,
  UploadIcon,
  UserRoundIcon,
} from "lucide-react";
import { LANGUAGES } from "../constants";

const PROFICIENCY_CHOICES = [
  {
    value: "beginner",
    label: "Beginner",
    description: "I know basics and want patient practice.",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "I can chat and want more fluency.",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "I want nuance, speed, and confidence.",
  },
];

const splitInterests = (value) =>
  value
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean)
    .slice(0, 8);

const OnboardingPage = () => {
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [formState, setFormState] = useState({
    fullName: authUser?.fullName || "",
    bio: authUser?.bio || "",
    nativeLanguage: authUser?.nativeLanguage || "",
    learningLanguage: authUser?.learningLanguage || "",
    location: authUser?.location || "",
    profilePic: authUser?.profilePic || "",
    timezone:
      authUser?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "",
    proficiencyLevel: authUser?.proficiencyLevel || "",
    interestsText: Array.isArray(authUser?.interests)
      ? authUser.interests.join(", ")
      : "",
  });

  const interestPreview = useMemo(
    () => splitInterests(formState.interestsText),
    [formState.interestsText],
  );

  const { mutate: onboardingMutation, isPending } = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      toast.success("Profile onboarded successfully.");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not save profile.");
    },
  });

  const updateField = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!formState.proficiencyLevel) {
      toast.error("Choose your proficiency level to finish your profile.");
      return;
    }

    onboardingMutation({
      ...formState,
      interests: interestPreview,
    });
  };

  const handleRandomAvatar = () => {
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    updateField("profilePic", randomAvatar);
    toast.success("Avatar changed successfully.");
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
      toast.success("Profile photo uploaded.");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Could not upload profile photo.",
      );
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  };

  return (
    <div className="lb-page-shell flex items-start bg-gradient-to-b from-[#0A1A2F] via-[#0F223D] to-[#08101D] lg:items-center">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <aside className="lb-surface-card self-start">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-200">
              <GlobeIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Complete Your Profile
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                These details power partner recommendations.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              "Native language finds people learning what you speak.",
              "Practice language finds people who can help you improve.",
              "Interests and bio create useful match reasons.",
              "Location and timezone help with live conversations.",
            ].map((item) => (
              <p
                key={item}
                className="flex gap-2 text-sm leading-6 text-slate-300"
              >
                <CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="lb-surface-card">
            <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
              <UserRoundIcon className="h-5 w-5 text-cyan-300" />
              Public Identity
            </div>

            <div className="grid gap-6 lg:grid-cols-[180px_1fr] lg:items-start">
              <div className="flex flex-col items-center gap-3">
                <div className="lb-avatar-ring h-32 w-32 shrink-0 overflow-hidden bg-slate-950/70">
                  {formState.profilePic ? (
                    <img
                      src={formState.profilePic}
                      alt="Profile preview"
                      className="h-full w-full object-cover"
                      onError={() => updateField("profilePic", "")}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <CameraIcon className="h-10 w-10 text-slate-500" />
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

                <div className="grid w-full gap-2">
                  <button
                    type="button"
                    onClick={handleRandomAvatar}
                    className="lb-btn-soft w-full px-3"
                  >
                    <ShuffleIcon className="h-4 w-4" />
                    Generate random avatar
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="lb-btn-soft w-full px-3 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploadingPhoto ? (
                      <LoaderIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadIcon className="h-4 w-4" />
                    )}
                    Upload picture
                  </button>
                </div>

                <p className="max-w-40 text-center text-xs leading-5 text-slate-500">
                  JPG, PNG, or WebP up to 5 MB.
                </p>
              </div>

              <div className="space-y-4">
                <label className="form-control">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Full name
                  </span>
                  <input
                    type="text"
                    name="fullName"
                    value={formState.fullName}
                    onChange={(event) =>
                      updateField("fullName", event.target.value)
                    }
                    className="lb-field"
                    placeholder="Your full name"
                    required
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Short bio
                  </span>
                  <textarea
                    name="bio"
                    value={formState.bio}
                    onChange={(event) => updateField("bio", event.target.value)}
                    className="lb-textarea-field min-h-32 resize-y"
                    placeholder="Example: I want to practice everyday conversation and can help with Hindi or English."
                    required
                  />
                  <span className="mt-1.5 text-xs text-slate-500">
                    A specific goal gives recommendations better reasons to show.
                  </span>
                </label>
              </div>
            </div>
          </section>

          <section className="lb-surface-card">
            <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
              <LanguagesIcon className="h-5 w-5 text-cyan-300" />
              Language Exchange
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                  Native language
                </span>
                <select
                  name="nativeLanguage"
                  value={formState.nativeLanguage}
                  onChange={(event) =>
                    updateField("nativeLanguage", event.target.value)
                  }
                  className="lb-field appearance-none"
                  required
                >
                  <option value="">Language you can help with</option>
                  {LANGUAGES.map((lang) => (
                    <option key={`native-${lang}`} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                  Language I want to practice
                </span>
                <select
                  name="learningLanguage"
                  value={formState.learningLanguage}
                  onChange={(event) =>
                    updateField("learningLanguage", event.target.value)
                  }
                  className="lb-field appearance-none"
                  required
                >
                  <option value="">Language you want to learn</option>
                  {LANGUAGES.map((lang) => (
                    <option key={`learning-${lang}`} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5">
              <p className="mb-3 text-xs font-medium text-slate-300">
                Proficiency
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {PROFICIENCY_CHOICES.map((choice) => {
                  const isSelected = formState.proficiencyLevel === choice.value;

                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() =>
                        updateField("proficiencyLevel", choice.value)
                      }
                      className={`lb-choice-card ${
                        isSelected
                          ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-50 ring-2 ring-cyan-300/15"
                          : "text-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {choice.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {choice.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="lb-surface-card">
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
                <MapPinIcon className="h-5 w-5 text-cyan-300" />
                Location
              </div>

              <label className="form-control">
                <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                  City, country
                </span>
                <input
                  type="text"
                  name="location"
                  value={formState.location}
                  onChange={(event) =>
                    updateField("location", event.target.value)
                  }
                  className="lb-field"
                  placeholder="Mumbai, India"
                  required
                />
              </label>
            </div>

            <div className="lb-surface-card">
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
                <ClockIcon className="h-5 w-5 text-cyan-300" />
                Timezone
              </div>

              <label className="form-control">
                <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                  Timezone
                </span>
                <input
                  type="text"
                  name="timezone"
                  value={formState.timezone}
                  onChange={(event) =>
                    updateField("timezone", event.target.value)
                  }
                  className="lb-field"
                  placeholder="Asia/Kolkata"
                />
                <span className="mt-1.5 text-xs text-slate-500">
                  Optional, but useful for finding partners online at similar times.
                </span>
              </label>
            </div>
          </section>

          <section className="lb-surface-card">
            <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
              <MessageCircleIcon className="h-5 w-5 text-cyan-300" />
              Conversation Interests
            </div>

            <label className="form-control">
              <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                Interests
              </span>
              <input
                type="text"
                name="interests"
                value={formState.interestsText}
                onChange={(event) =>
                  updateField("interestsText", event.target.value)
                }
                className="lb-field"
                placeholder="travel, cricket, music"
              />
              <span className="mt-1.5 text-xs text-slate-500">
                Add up to 8 comma-separated topics.
              </span>
            </label>

            {interestPreview.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {interestPreview.map((interest) => (
                  <span key={interest} className="lb-pill-cyan">
                    {interest}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <button
            className="lb-btn-primary w-full py-3 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {!isPending ? (
              <>
                <GlobeIcon className="h-5 w-5" />
                Complete Onboarding
              </>
            ) : (
              <>
                <LoaderIcon className="h-5 w-5 animate-spin" />
                Saving profile
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
