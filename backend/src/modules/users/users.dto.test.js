import { describe, expect, it } from "vitest";
import { serializePublicUserProfile } from "./users.dto.js";

describe("users DTOs", () => {
  it("serializes public profile fields and block state", () => {
    const payload = serializePublicUserProfile({
      user: {
        _id: "user-1",
        fullName: "Asha Rao",
        profilePic: "pic.png",
        nativeLanguage: "hindi",
        learningLanguage: "english",
        timezone: "Asia/Kolkata",
        proficiencyLevel: "intermediate",
        interests: undefined,
        bio: "Learning daily",
        location: "Delhi",
        isOnboarded: true,
        verified: true,
      },
      blockState: {
        isBlockedByViewer: false,
        hasBlockedViewer: true,
      },
    });

    expect(payload).toEqual({
      _id: "user-1",
      fullName: "Asha Rao",
      profilePic: "pic.png",
      nativeLanguage: "hindi",
      learningLanguage: "english",
      timezone: "Asia/Kolkata",
      proficiencyLevel: "intermediate",
      interests: [],
      bio: "Learning daily",
      location: "Delhi",
      isOnboarded: true,
      verified: true,
      isBlockedByMe: false,
      hasBlockedMe: true,
    });
  });
});
