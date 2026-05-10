import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Languages,
  MessageCircle,
  PenLine,
  Send,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser.js";
import { LANGUAGES } from "../constants/index.js";

const PAGE_SIZE = 3;
const MAX_MOMENT_LENGTH = 280;
const MotionArticle = motion.article;

const starterMoments = [
  {
    id: "moment-1",
    text: "I tried ordering coffee entirely in Spanish today. I froze for two seconds, then remembered: para llevar. Tiny win.",
    language: "Spanish",
    author: {
      name: "Maya Chen",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=maya",
    },
    comments: [
      {
        id: "comment-1",
        author: "Rafael",
        text: "Nice! You can also say cafe para llevar if you want to be direct.",
      },
      {
        id: "comment-2",
        author: "Lucia",
        text: "That pause is real progress. You stayed in the language.",
      },
    ],
    createdAt: "12 min ago",
  },
  {
    id: "moment-2",
    text: "German word order is starting to click when I read it slowly, but speaking still feels like moving furniture in my head.",
    language: "German",
    author: {
      name: "Jon Bell",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jon",
    },
    comments: [
      {
        id: "comment-3",
        author: "Anika",
        text: "Try shadowing one sentence pattern at a time. It gets lighter.",
      },
    ],
    createdAt: "34 min ago",
  },
  {
    id: "moment-3",
    text: "Today's Hindi practice: asking follow-up questions instead of switching back to English. Hard, but conversations felt warmer.",
    language: "Hindi",
    author: {
      name: "Priya Nair",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",
    },
    comments: [
      {
        id: "comment-4",
        author: "Dev",
        text: "That is such a good milestone. Follow-ups keep the exchange alive.",
      },
      {
        id: "comment-5",
        author: "Asha",
        text: "Correction: you can say aur bataiye for a polite nudge.",
      },
      {
        id: "comment-6",
        author: "Mira",
        text: "Love this goal.",
      },
    ],
    createdAt: "1 hr ago",
  },
  {
    id: "moment-4",
    text: "I learned that Japanese listening practice gets easier when I stop translating every word and listen for the shape of the sentence.",
    language: "Japanese",
    author: {
      name: "Noah Park",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=noah",
    },
    comments: [
      {
        id: "comment-7",
        author: "Yui",
        text: "Exactly. Rhythm first, details second.",
      },
    ],
    createdAt: "2 hrs ago",
  },
  {
    id: "moment-5",
    text: "French nasal vowels: still mysterious, but recording myself made the difference obvious. Tomorrow's plan is five minutes, no drama.",
    language: "French",
    author: {
      name: "Elena Ruiz",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=elena",
    },
    comments: [
      {
        id: "comment-8",
        author: "Camille",
        text: "Five minutes is perfect. Try bon, bien, bain as a small set.",
      },
    ],
    createdAt: "3 hrs ago",
  },
];

const getInitials = (name = "Learner") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const MomentCard = ({ moment, commentDraft, onDraftChange, onAddComment }) => (
  <MotionArticle
    layout
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    className="lb-surface-card lb-surface-card-hover"
  >
    <div className="flex items-start gap-3">
      <img
        src={moment.author.avatar}
        alt=""
        className="h-11 w-11 rounded-full object-cover ring-2 ring-cyan-300/25"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {moment.author.name}
          </h3>
          <span className="text-xs text-slate-500">{moment.createdAt}</span>
        </div>
        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-100">
          <Languages className="h-3.5 w-3.5" />
          {moment.language}
        </span>
      </div>
    </div>

    <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-100">
      {moment.text}
    </p>

    <div className="mt-5 rounded-xl border border-slate-700/70 bg-slate-950/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
          <MessageCircle className="h-4 w-4 text-cyan-300" />
          Corrections and comments
        </div>
        <span className="text-xs text-slate-500">
          {moment.comments.length} {moment.comments.length === 1 ? "reply" : "replies"}
        </span>
      </div>

      <div className="space-y-3">
        {moment.comments.map((comment) => (
          <div key={comment.id} className="rounded-lg bg-white/[0.04] p-3">
            <p className="text-xs font-semibold text-cyan-100">
              {comment.author}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {comment.text}
            </p>
          </div>
        ))}
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onAddComment(moment.id);
        }}
      >
        <label className="sr-only" htmlFor={`comment-${moment.id}`}>
          Add correction or comment
        </label>
        <input
          id={`comment-${moment.id}`}
          value={commentDraft}
          onChange={(event) => onDraftChange(moment.id, event.target.value)}
          placeholder="Add a correction or helpful comment"
          className="input input-bordered min-h-11 flex-1 border-white/10 bg-slate-950/60 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50"
        />
        <button type="submit" className="lb-btn-primary min-h-11 shrink-0">
          <PenLine className="h-4 w-4" />
          Add
        </button>
      </form>
    </div>
  </MotionArticle>
);

const MomentsPage = () => {
  const { authUser } = useAuthUser();
  const [moments, setMoments] = useState(starterMoments);
  const [composerText, setComposerText] = useState("");
  const [composerLanguage, setComposerLanguage] = useState(
    authUser?.learningLanguage || authUser?.targetLanguage || "Spanish",
  );
  const [commentDrafts, setCommentDrafts] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(moments.length / PAGE_SIZE));
  const remainingCharacters = MAX_MOMENT_LENGTH - composerText.length;
  const visibleMoments = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return moments.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, moments]);

  const handleCreateMoment = (event) => {
    event.preventDefault();
    const text = composerText.trim();

    if (!text) {
      toast.error("Write a moment before posting.");
      return;
    }

    const newMoment = {
      id: `moment-${Date.now()}`,
      text,
      language: composerLanguage,
      author: {
        name: authUser?.fullName || "You",
        avatar:
          authUser?.profilePic ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
            authUser?.fullName || "You",
          )}`,
      },
      comments: [],
      createdAt: "Just now",
    };

    setMoments((items) => [newMoment, ...items]);
    setComposerText("");
    setCurrentPage(1);
    toast.success("Moment posted.");
  };

  const handleAddComment = (momentId) => {
    const draft = commentDrafts[momentId]?.trim();
    if (!draft) {
      toast.error("Add a correction or comment first.");
      return;
    }

    setMoments((items) =>
      items.map((moment) =>
        moment.id === momentId
          ? {
              ...moment,
              comments: [
                ...moment.comments,
                {
                  id: `comment-${Date.now()}`,
                  author: authUser?.fullName || "You",
                  text: draft,
                },
              ],
            }
          : moment,
      ),
    );
    setCommentDrafts((drafts) => ({ ...drafts, [momentId]: "" }));
    toast.success("Comment added.");
  };

  return (
    <div className="lb-page-shell bg-gradient-to-b from-[#08131F] via-[#10233A] to-[#08101D]">
      <div className="lb-page-container">
        <div className="lb-page-header">
          <div>
            <h2 className="lb-page-title">Moments</h2>
            <p className="lb-page-subtitle">
              Share short learning wins, ask for corrections, and help other learners.
            </p>
          </div>
          <span className="lb-pill-cyan">
            {moments.length} public learning moments
          </span>
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-5">
            <form onSubmit={handleCreateMoment} className="lb-surface-card">
              <div className="flex items-center gap-3">
                {authUser?.profilePic ? (
                  <img
                    src={authUser.profilePic}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-cyan-300/25"
                  />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-100 ring-2 ring-cyan-300/25">
                    {getInitials(authUser?.fullName || "You")}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {authUser?.fullName || "You"}
                  </p>
                  <p className="text-xs text-slate-400">Posting to the public feed</p>
                </div>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-xs font-semibold uppercase text-slate-400">
                  Moment
                </span>
                <textarea
                  value={composerText}
                  onChange={(event) =>
                    setComposerText(event.target.value.slice(0, MAX_MOMENT_LENGTH))
                  }
                  placeholder="What did you learn, try, notice, or need help correcting?"
                  className="textarea textarea-bordered min-h-36 w-full resize-none border-white/10 bg-slate-950/60 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50"
                />
              </label>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="form-control">
                  <span className="label-text mb-1.5 text-xs font-medium text-slate-300">
                    Language
                  </span>
                  <select
                    value={composerLanguage}
                    onChange={(event) => setComposerLanguage(event.target.value)}
                    className="select select-bordered min-h-11 w-full border-white/10 bg-slate-950/60 text-sm text-slate-100"
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                  <span
                    className={`text-xs ${
                      remainingCharacters < 30 ? "text-amber-200" : "text-slate-500"
                    }`}
                  >
                    {remainingCharacters} left
                  </span>
                  <button type="submit" className="lb-btn-primary min-h-11">
                    <Send className="h-4 w-4" />
                    Post
                  </button>
                </div>
              </div>
            </form>

            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/10 p-5">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100">
                <Sparkles className="h-4 w-4" />
                Correction etiquette
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Keep corrections specific, kind, and useful. A quick example sentence
                is often better than a long explanation.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {visibleMoments.map((moment) => (
              <MomentCard
                key={moment.id}
                moment={moment}
                commentDraft={commentDrafts[moment.id] || ""}
                onDraftChange={(momentId, value) =>
                  setCommentDrafts((drafts) => ({ ...drafts, [momentId]: value }))
                }
                onAddComment={handleAddComment}
              />
            ))}

            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-blue-300/20 bg-[#0C1A2B]/80 p-4 sm:flex-row">
              <p className="text-sm text-slate-400">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="lb-btn-soft disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous moments page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  className="lb-btn-soft disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next moments page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MomentsPage;
