import { describe, expect, it } from "vitest";
import {
  serializeFriendsList,
  serializeFriendshipMessage,
  serializeReceivedRequests,
  serializeSentRequests,
} from "./friendships.dto.js";

describe("friendship DTOs", () => {
  it("serializes friendship list and request pagination", () => {
    expect(
      serializeFriendsList({
        friends: [{ _id: "friend-1" }],
        page: 1,
        limit: 20,
        total: 1,
      }),
    ).toMatchObject({
      success: true,
      friends: [{ _id: "friend-1" }],
      pagination: { total: 1 },
    });

    expect(
      serializeReceivedRequests({
        incomingReqs: [{ _id: "incoming-1" }],
        acceptedReqs: [{ _id: "accepted-1" }],
        page: 1,
        limit: 20,
        incomingTotal: 1,
        acceptedTotal: 1,
      }),
    ).toMatchObject({
      incomingReqs: [{ _id: "incoming-1" }],
      acceptedReqs: [{ _id: "accepted-1" }],
      pagination: {
        incoming: { total: 1 },
        accepted: { total: 1 },
      },
    });

    expect(
      serializeSentRequests({
        requests: [{ _id: "request-1" }],
        page: 1,
        limit: 20,
        total: 1,
      }),
    ).toMatchObject({
      success: true,
      requests: [{ _id: "request-1" }],
    });
  });

  it("serializes friendship action messages", () => {
    expect(serializeFriendshipMessage("Done.")).toEqual({ message: "Done." });
  });
});
