import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../moderation/blocking.service.js", () => ({
  getBlockState: vi.fn(() =>
    Promise.resolve({
      isBlockedEitherWay: false,
      isBlockedByViewer: false,
      hasBlockedViewer: false,
    }),
  ),
}));

vi.mock("./learning.emitters.js", () => ({
  emitNewCorrection: vi.fn(),
}));

vi.mock("./learning.repository.js", () => ({
  aggregateWeeklyActivityCounts: vi.fn(),
  countSavedPhrases: vi.fn(),
  createLearningActivity: vi.fn(),
  findMessageById: vi.fn(),
  findPartnerCorrectionActivities: vi.fn(),
  findRecentActivitiesForUser: vi.fn(),
  findRecentConversationMessages: vi.fn(),
}));

const learningRepository = await import("./learning.repository.js");
const { emitNewCorrection } = await import("./learning.emitters.js");
const { correctMessage, createPartnerCorrection, translateMessage } = await import(
  "./learning.service.js"
);

describe("learning service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates learner-owned corrections from raw text", async () => {
    learningRepository.createLearningActivity.mockResolvedValue({
      _id: "activity-1",
    });

    const result = await correctMessage({
      user: {
        _id: "user-1",
        learningLanguage: "english",
      },
      body: {
        text: "i dont know",
        tone: "friendly",
      },
    });

    expect(learningRepository.createLearningActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "user-1",
        type: "correction",
        sourceText: "i dont know",
      }),
    );
    expect(result).toMatchObject({
      success: true,
      activityId: "activity-1",
    });
    expect(result.correction.corrected).toContain("I");
  });

  it("creates partner corrections and emits them to both users", async () => {
    learningRepository.findMessageById.mockResolvedValue({
      _id: "message-1",
      sender: { toString: () => "sender-1" },
      receiver: { toString: () => "receiver-1" },
      text: "helo",
    });
    learningRepository.createLearningActivity.mockResolvedValue({
      _id: "activity-1",
      toObject: () => ({
        _id: "activity-1",
        user: "sender-1",
        partner: "receiver-1",
        message: "message-1",
        type: "partner_correction",
        sourceText: "helo",
        resultText: "hello",
        metadata: {
          author: "receiver-1",
          receiver: "sender-1",
          status: "active",
        },
      }),
    });

    const result = await createPartnerCorrection({
      user: {
        _id: { toString: () => "receiver-1" },
        nativeLanguage: "english",
      },
      body: {
        messageId: "507f1f77bcf86cd799439011",
        correctedText: "hello",
      },
    });

    expect(emitNewCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: "sender-1",
        receiverId: "receiver-1",
      }),
    );
    expect(result).toMatchObject({
      success: true,
      activityId: "activity-1",
    });
  });

  it("translates user text and logs learning activity", async () => {
    learningRepository.createLearningActivity.mockResolvedValue({
      _id: "activity-trans-1",
    });

    const result = await translateMessage({
      user: {
        _id: "user-1",
        nativeLanguage: "spanish",
      },
      body: {
        text: "Thank you",
        targetLanguage: "spanish",
      },
    });

    expect(result.success).toBe(true);
    expect(result.activityId).toBe("activity-trans-1");
    expect(result.translation.translated.toLowerCase()).toContain("gracias");
  });
});
