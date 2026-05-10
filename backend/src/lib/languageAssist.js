const COMMON_FIXES = [
  [/\bi am\b/gi, "I am"],
  [/\bi'm\b/gi, "I'm"],
  [/\bi\b/g, "I"],
  [/\bdont\b/gi, "don't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bim\b/gi, "I'm"],
  [/\bu\b/g, "you"],
  [/\bur\b/gi, "your"],
  [/\bpls\b/gi, "please"],
  [/\bthx\b/gi, "thanks"],
  [/\bteh\b/gi, "the"],
  [/\blangauge\b/gi, "language"],
  [/\brecieve\b/gi, "receive"],
];

const TONE_PREFIX = {
  friendly: "Friendly",
  formal: "Polished",
  concise: "Concise",
  casual: "Natural",
};

const wordLists = {
  english: {
    hello: "hello",
    thanks: "thanks",
    "thank you": "thank you",
    please: "please",
    yes: "yes",
    no: "no",
    friend: "friend",
    language: "language",
    practice: "practice",
  },
  hindi: {
    hello: "namaste",
    thanks: "dhanyavaad",
    "thank you": "dhanyavaad",
    please: "kripya",
    yes: "haan",
    no: "nahin",
    friend: "dost",
    language: "bhasha",
    practice: "abhyaas",
  },
  spanish: {
    hello: "hola",
    thanks: "gracias",
    "thank you": "gracias",
    please: "por favor",
    yes: "si",
    no: "no",
    friend: "amigo",
    language: "idioma",
    practice: "practica",
  },
  japanese: {
    hello: "konnichiwa",
    thanks: "arigato",
    "thank you": "arigato",
    please: "onegaishimasu",
    yes: "hai",
    no: "iie",
    friend: "tomodachi",
    language: "gengo",
    practice: "renshu",
  },
};

const normalizeLanguage = (value = "") => String(value).trim().toLowerCase();

const sentenceCase = (text) =>
  text.replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, (match) =>
    match.toUpperCase(),
  );

export const createCorrection = ({ text, tone = "friendly" }) => {
  const original = String(text || "").trim();
  if (!original) {
    return {
      original,
      corrected: "",
      explanation: "Add a message to receive a correction.",
      changes: [],
      tone,
    };
  }

  let corrected = original.replace(/\s+/g, " ").trim();
  const changes = [];

  for (const [pattern, replacement] of COMMON_FIXES) {
    if (pattern.test(corrected)) {
      pattern.lastIndex = 0;
      corrected = corrected.replace(pattern, replacement);
      changes.push(`Replaced "${replacement.toLowerCase()}" with "${replacement}".`);
    }
  }

  corrected = sentenceCase(corrected);
  if (!/[.!?]$/.test(corrected)) {
    corrected += ".";
    changes.push("Added ending punctuation.");
  }

  if (tone === "formal") {
    corrected = corrected.replace(/\bthanks\b/gi, "thank you");
  }
  if (tone === "concise") {
    corrected = corrected.replace(/\bI would like to\b/gi, "I want to");
  }

  return {
    original,
    corrected,
    explanation:
      corrected === original
        ? "This already reads naturally. I would keep it as-is."
        : `${TONE_PREFIX[tone] || "Natural"} correction with grammar, casing, and punctuation cleanup.`,
    changes: changes.length > 0 ? [...new Set(changes)] : ["No major grammar issues found."],
    tone,
  };
};

export const createContextAwareTranslation = ({
  text,
  targetLanguage,
  contextMessages = [],
}) => {
  const source = String(text || "").trim();
  const target = normalizeLanguage(targetLanguage || "english");
  const dictionary = wordLists[target] || wordLists.english;
  let translated = source.toLowerCase();

  for (const [from, to] of Object.entries(dictionary)) {
    translated = translated.replace(
      new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
      to,
    );
  }

  translated = sentenceCase(translated);
  const contextHint = contextMessages
    .map((message) => message.text)
    .filter(Boolean)
    .slice(-3)
    .join(" ")
    .slice(0, 180);

  return {
    original: source,
    translated,
    targetLanguage: target,
    confidence: dictionary === wordLists.english ? 0.62 : 0.74,
    contextHint,
    note:
      "Local deterministic translation preview. Swap this helper with an LLM/provider call for production-grade translation.",
  };
};

const tokenize = (value = "") =>
  new Set(
    String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 2),
  );

export const scorePartnerMatch = (currentUser, candidate) => {
  let score = 0;
  const reasons = [];
  const candidateSpeaksTarget =
    normalizeLanguage(candidate.nativeLanguage) ===
    normalizeLanguage(currentUser.learningLanguage);
  const candidateLearnsNative =
    normalizeLanguage(candidate.learningLanguage) ===
    normalizeLanguage(currentUser.nativeLanguage);

  if (candidateSpeaksTarget) {
    score += 35;
    reasons.push(`Native ${candidate.nativeLanguage} speaker`);
  }

  if (candidateLearnsNative) {
    score += 30;
    reasons.push(`Learning ${currentUser.nativeLanguage}, which you speak`);
  }

  if (
    currentUser.location &&
    candidate.location &&
    normalizeLanguage(currentUser.location).split(",").pop()?.trim() ===
      normalizeLanguage(candidate.location).split(",").pop()?.trim()
  ) {
    score += 10;
    reasons.push("Similar region or timezone signal");
  }

  const currentTokens = tokenize(`${currentUser.bio || ""} ${(currentUser.interests || []).join(" ")}`);
  const candidateTokens = tokenize(`${candidate.bio || ""} ${(candidate.interests || []).join(" ")}`);
  const shared = [...currentTokens].filter((token) => candidateTokens.has(token));
  if (shared.length > 0) {
    score += Math.min(shared.length * 4, 20);
    reasons.push(`Shared interests: ${shared.slice(0, 3).join(", ")}`);
  }

  if (candidate.proficiencyLevel) {
    score += 5;
    reasons.push(`${candidate.proficiencyLevel} proficiency`);
  }

  return {
    score,
    isBestExchangeMatch: candidateSpeaksTarget && candidateLearnsNative,
    reasons: reasons.length > 0 ? reasons : ["Recently active language learner"],
  };
};
