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

vi.mock("./friendships.emitters.js", () => ({
  emitFriendRequestAccepted: vi.fn(),
  emitFriendRequestReceived: vi.fn(),
}));

vi.mock("../../infrastructure/messaging/event-bus.js", () => ({
  publishEvent: vi.fn(),
}));

vi.mock("../../infrastructure/redis/cache.store.js", () => ({
  cacheKeys: {
    friends: ({ userId, page, limit }) => `friends:${userId}:${page}:${limit}`,
  },
  invalidateUserListCaches: vi.fn(),
  readJsonCache: vi.fn(() => Promise.resolve(null)),
  writeJsonCache: vi.fn(),
}));

vi.mock("../../infrastructure/realtime/socket.js", () => ({
  refreshPresenceForUsers: vi.fn(),
}));

vi.mock("./friendships.repository.js", () => ({
  addFriend: vi.fn(),
  createFriendRequest: vi.fn(),
  deleteFriendRequestsBetween: vi.fn(),
  findFriendRequestBetween: vi.fn(),
  findFriendRequestById: vi.fn(),
  findFriendsByIds: vi.fn(),
  findUserById: vi.fn(),
  findUserFriends: vi.fn(),
  listReceivedAndAcceptedRequests: vi.fn(),
  listSentPendingRequests: vi.fn(),
  removeFriend: vi.fn(),
}));

const friendshipsRepository = await import("./friendships.repository.js");
const { publishEvent } = await import("../../infrastructure/messaging/event-bus.js");
const { emitFriendRequestReceived } = await import(
  "./friendships.emitters.js"
);
const { listFriends, sendFriendRequest } = await import("./friendships.service.js");

describe("friendships service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists friends in the user's stored order", async () => {
    friendshipsRepository.findUserFriends.mockResolvedValue({
      friends: ["friend-2", "friend-1"],
    });
    friendshipsRepository.findFriendsByIds.mockResolvedValue([
      { _id: "friend-1" },
      { _id: "friend-2" },
    ]);

    const { responseBody } = await listFriends({
      userId: "user-1",
      query: { page: "1", limit: "20" },
    });

    expect(responseBody.friends).toEqual([
      { _id: "friend-2" },
      { _id: "friend-1" },
    ]);
    expect(responseBody.pagination.total).toBe(2);
  });

  it("creates friend requests and emits notification side effects", async () => {
    friendshipsRepository.findUserById.mockResolvedValue({ friends: [] });
    friendshipsRepository.findFriendRequestBetween.mockResolvedValue(null);
    friendshipsRepository.createFriendRequest.mockResolvedValue({
      _id: "request-1",
    });

    const request = await sendFriendRequest({
      sender: { id: "sender-1", fullName: "Sender" },
      recipientId: "recipient-1",
    });

    expect(request).toEqual({ _id: "request-1" });
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "friend_request.created",
        key: "request-1",
      }),
    );
    expect(emitFriendRequestReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "recipient-1",
        request,
      }),
    );
  });
});
