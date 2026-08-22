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

import { translate } from "@vitalets/google-translate-api";

const LANGUAGE_CODE_MAP = {
  english: "en",
  en: "en",
  spanish: "es",
  es: "es",
  hindi: "hi",
  hi: "hi",
  french: "fr",
  fr: "fr",
  german: "de",
  de: "de",
  japanese: "ja",
  ja: "ja",
  chinese: "zh-CN",
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-tw": "zh-TW",
  arabic: "ar",
  ar: "ar",
  russian: "ru",
  ru: "ru",
  portuguese: "pt",
  pt: "pt",
  italian: "it",
  it: "it",
  korean: "ko",
  ko: "ko",
  dutch: "nl",
  nl: "nl",
  turkish: "tr",
  tr: "tr",
  polish: "pl",
  pl: "pl",
  swedish: "sv",
  sv: "sv",
  vietnamese: "vi",
  vi: "vi",
  thai: "th",
  th: "th",
  greek: "el",
  el: "el",
  hebrew: "he",
  he: "he",
};

export const resolveLanguageCode = (targetLanguage = "english") => {
  const normalized = String(targetLanguage || "english").trim().toLowerCase();
  return LANGUAGE_CODE_MAP[normalized] || (normalized.length <= 3 && normalized.length > 0 ? normalized : "en");
};

export const createContextAwareTranslation = async ({
  text,
  targetLanguage = "english",
  contextMessages = [],
}) => {
  const source = String(text || "").trim();
  const targetCode = resolveLanguageCode(targetLanguage);
  const contextHint = contextMessages
    .map((message) => message.text)
    .filter(Boolean)
    .slice(-3)
    .join(" ")
    .slice(0, 180);

  if (!source) {
    return {
      original: "",
      translated: "",
      targetLanguage,
      confidence: 1.0,
      contextHint,
    };
  }

  try {
    const res = await translate(source, { to: targetCode });
    const detectedLanguage = res?.raw?.src || res?.from?.language?.iso || "auto";
    const confidence = res?.raw?.confidence || 0.95;

    return {
      original: source,
      translated: res.text || source,
      targetLanguage,
      targetCode,
      detectedLanguage,
      confidence,
      contextHint,
      provider: "google-translate",
    };
  } catch (error) {
    let translatedFallback = source;
    const dictionary = wordLists[normalizeLanguage(targetLanguage)] || wordLists.english;
    if (dictionary) {
      let temp = source.toLowerCase();
      for (const [from, to] of Object.entries(dictionary)) {
        temp = temp.replace(
          new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
          to,
        );
      }
      translatedFallback = sentenceCase(temp);
    }

    return {
      original: source,
      translated: translatedFallback,
      targetLanguage,
      targetCode,
      confidence: 0.5,
      contextHint,
      provider: "fallback-local",
      note: "Google Translate API call failed; returned fallback preview.",
    };
  }
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
