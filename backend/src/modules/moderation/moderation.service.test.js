import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../infrastructure/redis/cache.store.js", () => ({
  invalidateUserListCaches: vi.fn(),
}));

vi.mock("../../infrastructure/realtime/socket.js", () => ({
  refreshPresenceForUsers: vi.fn(),
}));

vi.mock("../../infrastructure/messaging/event-bus.js", () => ({
  publishEvent: vi.fn(),
}));

vi.mock("./moderation.repository.js", () => ({
  blockUser: vi.fn(),
  createReport: vi.fn(),
  deleteFriendRequestsBetween: vi.fn(),
  findUserById: vi.fn(),
  listReports: vi.fn(),
  removeFriendshipFromTarget: vi.fn(),
  unblockUser: vi.fn(),
  updateReportStatus: vi.fn(),
}));

const moderationRepository = await import("./moderation.repository.js");
const { publishEvent } = await import("../../infrastructure/messaging/event-bus.js");
const { getModerationQueue, reportUser } = await import("./moderation.service.js");

describe("moderation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits reports and normalizes unknown categories to other", async () => {
    moderationRepository.findUserById.mockResolvedValue({ _id: "reported-1" });
    moderationRepository.createReport.mockResolvedValue({ _id: "report-1" });

    const result = await reportUser({
      reporterId: "reporter-1",
      reportedId: "reported-1",
      body: { reason: "Bad behavior", category: "unknown" },
    });

    expect(moderationRepository.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterId: "reporter-1",
        reportedId: "reported-1",
        reason: "Bad behavior",
        category: "other",
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "user.reported",
        key: "report-1",
      }),
    );
    expect(result).toEqual({
      success: true,
      reportId: "report-1",
      message: "Report submitted successfully.",
    });
  });

  it("lists reports with pagination metadata", async () => {
    moderationRepository.listReports.mockResolvedValue({
      reports: [{ _id: "report-1" }],
      total: 1,
    });

    const result = await getModerationQueue({
      query: { status: "all", page: "1", limit: "20" },
    });

    expect(moderationRepository.listReports).toHaveBeenCalledWith(
      expect.objectContaining({ filter: {} }),
    );
    expect(result.pagination.total).toBe(1);
  });
});
