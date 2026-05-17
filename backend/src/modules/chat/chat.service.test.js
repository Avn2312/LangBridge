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

vi.mock("../../infrastructure/redis/cache.store.js", () => ({
  cacheKeys: {
    conversations: ({ userId, page, limit }) =>
      `conversations:${userId}:${page}:${limit}`,
  },
  invalidateConversationCaches: vi.fn(),
  readJsonCache: vi.fn(() => Promise.resolve(null)),
  writeJsonCache: vi.fn(),
}));

vi.mock("../../infrastructure/redis/rate-limit.store.js", () => ({
  consumeRateLimit: vi.fn(() => Promise.resolve({ allowed: true })),
}));

vi.mock("../../infrastructure/messaging/event-bus.js", () => ({
  publishEvent: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  runtimeConfig: {
    ai: { autoCorrectionEvents: false },
    rateLimit: {
      messageWindowSeconds: 60,
      messageMaxRequests: 10,
      typingWindowSeconds: 10,
      typingMaxRequests: 20,
    },
  },
}));

vi.mock("./chat.repository.js", () => ({
  aggregateConversationsForUser: vi.fn(),
  createMessage: vi.fn(),
  findMessageByClientMessageId: vi.fn(),
  findMessagesBetweenUsers: vi.fn(),
  markMessagesRead: vi.fn(),
  markMessagesReadAt: vi.fn(),
}));

const chatRepository = await import("./chat.repository.js");
const { publishEvent } = await import("../../infrastructure/messaging/event-bus.js");
const { listMessagesWithUser, sendRealtimeMessage } = await import(
  "./chat.service.js"
);

describe("chat service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists message history and marks received messages as read", async () => {
    chatRepository.findMessagesBetweenUsers.mockResolvedValue({
      messages: [{ _id: "m2" }, { _id: "m1" }],
      total: 2,
    });

    const result = await listMessagesWithUser({
      viewerId: "viewer-1",
      otherUserId: "other-1",
      query: { page: "1", limit: "2" },
    });

    expect(result.messages).toEqual([{ _id: "m1" }, { _id: "m2" }]);
    expect(result.pagination.total).toBe(2);
    expect(chatRepository.markMessagesRead).toHaveBeenCalledWith({
      senderId: "other-1",
      receiverId: "viewer-1",
    });
  });

  it("sends realtime messages and publishes the message event", async () => {
    chatRepository.findMessageByClientMessageId.mockResolvedValue(null);
    chatRepository.createMessage.mockResolvedValue({
      _id: "message-1",
      text: "hello",
      attachments: [],
      clientMessageId: "client-1",
    });

    const result = await sendRealtimeMessage({
      senderId: "sender-1",
      socketId: "socket-1",
      payload: {
        receiverId: "receiver-1",
        text: " hello ",
        clientMessageId: "client-1",
      },
    });

    expect(chatRepository.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: "sender-1",
        receiverId: "receiver-1",
        text: "hello",
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "message.sent",
        key: "message-1",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      code: "SENT",
      receiverId: "receiver-1",
      messageId: "message-1",
      clientMessageId: "client-1",
      wasDuplicate: false,
    });
  });
});
