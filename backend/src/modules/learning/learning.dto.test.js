import { describe, expect, it } from "vitest";
import {
  serializeCorrectionActivity,
  serializeLearningDashboard,
} from "./learning.dto.js";

describe("learning DTOs", () => {
  it("serializes partner correction activities for the existing API shape", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");

    expect(
      serializeCorrectionActivity({
        _id: "activity-1",
        user: "learner-1",
        partner: "partner-1",
        message: "message-1",
        type: "partner_correction",
        sourceText: "helo",
        resultText: "hello",
        metadata: {
          note: "Small typo",
          status: "active",
          author: "partner-1",
          receiver: "learner-1",
        },
        createdAt,
        updatedAt,
      }),
    ).toEqual({
      _id: "activity-1",
      user: "learner-1",
      partner: "partner-1",
      message: "message-1",
      type: "partner_correction",
      originalText: "helo",
      correctedText: "hello",
      note: "Small typo",
      status: "active",
      author: "partner-1",
      receiver: "learner-1",
      createdAt,
      updatedAt,
    });
  });

  it("serializes dashboard summary totals from weekly counts", () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    const recentActivities = [
      { createdAt: new Date("2026-01-01T10:00:00.000Z") },
      { createdAt: new Date("2026-01-01T12:00:00.000Z") },
      { createdAt: new Date("2026-01-03T10:00:00.000Z") },
    ];

    const payload = serializeLearningDashboard({
      since,
      recentActivities,
      totalSavedPhrases: 7,
      weeklyCounts: [
        { _id: "correction", count: 2 },
        { _id: "partner_correction", count: 3 },
        { _id: "translation", count: 4 },
        { _id: "saved_phrase", count: 5 },
      ],
    });

    expect(payload.summary).toEqual({
      corrections: 5,
      translations: 4,
      savedPhrases: 7,
      activeDays: 2,
      weeklyProgress: 14,
    });
    expect(payload.recentActivities).toBe(recentActivities);
  });
});
