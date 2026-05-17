import { describe, expect, it } from "vitest";
import {
  serializeConversationsResult,
  serializeMessagesResult,
  serializeRealtimeMessageResult,
} from "./chat.dto.js";

describe("chat DTOs", () => {
  it("serializes paginated message history in chronological order", () => {
    const newestFirst = [{ _id: "m2" }, { _id: "m1" }];
    const payload = serializeMessagesResult({
      messages: newestFirst,
      page: 1,
      limit: 2,
      total: 3,
    });

    expect(payload.messages).toEqual([{ _id: "m1" }, { _id: "m2" }]);
    expect(payload.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });

  it("serializes conversations and realtime send results", () => {
    const conversations = [{ userId: "user-2" }];
    const message = { _id: "message-1", clientMessageId: "client-1" };

    expect(
      serializeConversationsResult({
        conversations,
        page: 1,
        limit: 20,
        total: 1,
      }),
    ).toMatchObject({
      success: true,
      conversations,
    });
    expect(
      serializeRealtimeMessageResult({
        code: "SENT",
        receiverId: "receiver-1",
        message,
        wasDuplicate: false,
      }),
    ).toEqual({
      ok: true,
      code: "SENT",
      receiverId: "receiver-1",
      message,
      messageId: "message-1",
      clientMessageId: "client-1",
      wasDuplicate: false,
    });
  });
});
