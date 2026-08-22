import { describe, expect, it, vi } from "vitest";
import {
  createContextAwareTranslation,
  createCorrection,
  resolveLanguageCode,
  scorePartnerMatch,
} from "./translation.service.js";

describe("translation.service", () => {
  describe("resolveLanguageCode", () => {
    it("maps full language names to standard ISO 639-1 codes", () => {
      expect(resolveLanguageCode("Spanish")).toBe("es");
      expect(resolveLanguageCode("hindi")).toBe("hi");
      expect(resolveLanguageCode("French")).toBe("fr");
      expect(resolveLanguageCode("Japanese")).toBe("ja");
      expect(resolveLanguageCode("german")).toBe("de");
    });

    it("passes valid short language codes directly", () => {
      expect(resolveLanguageCode("es")).toBe("es");
      expect(resolveLanguageCode("hi")).toBe("hi");
      expect(resolveLanguageCode("fr")).toBe("fr");
    });

    it("defaults unknown long language strings to en", () => {
      expect(resolveLanguageCode("unknownlanguage")).toBe("en");
      expect(resolveLanguageCode("")).toBe("en");
    });
  });

  describe("createContextAwareTranslation", () => {
    it("returns empty structure when text is empty", async () => {
      const result = await createContextAwareTranslation({
        text: "",
        targetLanguage: "spanish",
      });

      expect(result).toEqual({
        original: "",
        translated: "",
        targetLanguage: "spanish",
        confidence: 1.0,
        contextHint: "",
      });
    });

    it("translates text using Google Translate when API call succeeds", async () => {
      const result = await createContextAwareTranslation({
        text: "Hello my friend",
        targetLanguage: "spanish",
      });

      expect(result.original).toBe("Hello my friend");
      expect(result.translated.toLowerCase()).toContain("hola");
      expect(result.targetLanguage).toBe("spanish");
      expect(result.targetCode).toBe("es");
      expect(result.provider).toBe("google-translate");
    });

    it("gracefully falls back when translation API encounters an error", async () => {
      const ggtModule = await import("@vitalets/google-translate-api");
      const spy = vi.spyOn(ggtModule, "translate").mockRejectedValueOnce(new Error("Network Error"));

      const result = await createContextAwareTranslation({
        text: "hello friend",
        targetLanguage: "spanish",
      });

      expect(result).toMatchObject({
        original: "hello friend",
        targetLanguage: "spanish",
        provider: "fallback-local",
      });
      expect(result.translated.toLowerCase()).toContain("hola");

      spy.mockRestore();
    });
  });

  describe("createCorrection", () => {
    it("corrects informal typos and adds punctuation", () => {
      const result = createCorrection({ text: "i dont know thx", tone: "friendly" });

      expect(result.corrected).toBe("I don't know thanks.");
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it("handles formal tone replacements", () => {
      const result = createCorrection({ text: "thanks for help", tone: "formal" });

      expect(result.corrected).toContain("thank you");
    });
  });

  describe("scorePartnerMatch", () => {
    it("scores language exchange candidates correctly", () => {
      const user = { nativeLanguage: "English", learningLanguage: "Spanish" };
      const candidate = {
        nativeLanguage: "Spanish",
        learningLanguage: "English",
        interests: ["music", "coding"],
      };

      const match = scorePartnerMatch(user, candidate);

      expect(match.isBestExchangeMatch).toBe(true);
      expect(match.score).toBeGreaterThanOrEqual(65);
    });
  });
});
