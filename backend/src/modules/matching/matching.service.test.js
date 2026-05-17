import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../infrastructure/redis/cache.store.js", () => ({
  cacheKeys: {
    recommendations: ({ userId, page, limit, filters }) =>
      `recommendations:${userId}:${page}:${limit}:${filters}`,
  },
  readJsonCache: vi.fn(() => Promise.resolve(null)),
  writeJsonCache: vi.fn(),
}));

vi.mock("../../infrastructure/realtime/socket.js", () => ({
  getOnlineUserIds: vi.fn(() => Promise.resolve(["candidate-1"])),
}));

vi.mock("./matching.repository.js", () => ({
  findRecommendedUsers: vi.fn(),
  findUsersWhoBlocked: vi.fn(),
}));

const matchingRepository = await import("./matching.repository.js");
const { listRecommendations } = await import("./matching.service.js");

describe("matching service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scores and sorts recommendation payloads", async () => {
    matchingRepository.findUsersWhoBlocked.mockResolvedValue([]);
    matchingRepository.findRecommendedUsers.mockResolvedValue({
      total: 2,
      users: [
        {
          _id: "candidate-2",
          nativeLanguage: "spanish",
          learningLanguage: "french",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          _id: "candidate-1",
          nativeLanguage: "hindi",
          learningLanguage: "english",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const result = await listRecommendations({
      currentUser: {
        id: "user-1",
        nativeLanguage: "english",
        learningLanguage: "hindi",
        friends: [],
        blockedUsers: [],
      },
      query: { page: "1", limit: "20" },
    });

    expect(result.users[0]).toMatchObject({
      _id: "candidate-1",
      isOnline: true,
      isBestExchangeMatch: true,
    });
    expect(result.users[0].matchScore).toBeGreaterThan(result.users[1].matchScore);
    expect(result.pagination.total).toBe(2);
  });
});
