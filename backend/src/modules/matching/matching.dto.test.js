import { describe, expect, it } from "vitest";
import {
  serializeRecommendedUser,
  serializeRecommendations,
} from "./matching.dto.js";

describe("matching DTOs", () => {
  it("adds match metadata to recommended users", () => {
    expect(
      serializeRecommendedUser({
        user: { _id: "user-1", fullName: "Asha" },
        isOnline: true,
        match: {
          score: 42,
          reasons: ["Native Hindi speaker"],
          isBestExchangeMatch: true,
        },
      }),
    ).toEqual({
      _id: "user-1",
      fullName: "Asha",
      isOnline: true,
      matchScore: 42,
      matchReasons: ["Native Hindi speaker"],
      isBestExchangeMatch: true,
    });
  });

  it("serializes recommendation pagination", () => {
    expect(
      serializeRecommendations({
        users: [{ _id: "user-1" }],
        page: 1,
        limit: 20,
        total: 1,
      }),
    ).toMatchObject({
      success: true,
      users: [{ _id: "user-1" }],
      pagination: { total: 1 },
    });
  });
});
