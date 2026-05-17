import { describe, expect, it } from "vitest";
import {
  serializeAuthSuccess,
  serializeAuthUser,
  serializeCurrentUser,
  serializeOnboardingResult,
} from "./auth.dto.js";

describe("auth DTOs", () => {
  it("serializes auth users without password fields", () => {
    const user = {
      _id: "user-1",
      email: "asha@example.com",
      fullName: "Asha Rao",
      profilePic: "pic.png",
      nativeLanguage: "hindi",
      learningLanguage: "english",
      password: "secret",
    };

    expect(serializeAuthUser(user)).toEqual({
      id: "user-1",
      email: "asha@example.com",
      fullName: "Asha Rao",
      profilePic: "pic.png",
      nativeLanguage: "hindi",
      learningLanguage: "english",
    });
  });

  it("serializes auth success and passthrough user wrappers", () => {
    const user = { _id: "user-1", email: "asha@example.com" };

    expect(serializeAuthSuccess({ message: "ok", user })).toMatchObject({
      success: true,
      message: "ok",
      user: {
        id: "user-1",
        email: "asha@example.com",
      },
    });
    expect(serializeCurrentUser(user)).toEqual({ success: true, user });
    expect(serializeOnboardingResult(user)).toEqual({ success: true, user });
  });
});
