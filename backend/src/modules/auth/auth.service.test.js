import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth.repository.js", () => ({
  createLocalUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByEmailWithPassword: vi.fn(),
  findUserById: vi.fn(),
  markUserVerified: vi.fn(),
  updateOnboardingProfile: vi.fn(),
}));

vi.mock("./auth.tokens.js", () => ({
  generateToken: vi.fn(() => "jwt-token"),
  generateVerificationToken: vi.fn(() => "verification-token"),
}));

vi.mock("../../services/mail.service.js", () => ({
  sendEmail: vi.fn(() => Promise.resolve({ messageId: "mail-1" })),
}));

vi.mock("../../infrastructure/messaging/event-bus.js", () => ({
  publishEvent: vi.fn(),
}));

vi.mock("../../infrastructure/redis/rate-limit.store.js", () => ({
  clearBruteForceTracking: vi.fn(),
  recordFailure: vi.fn(() => Promise.resolve({ locked: false })),
}));

vi.mock("../../infrastructure/redis/cache.store.js", () => ({
  deleteCachePatterns: vi.fn(),
  invalidateUserListCaches: vi.fn(),
}));

vi.mock("../../infrastructure/redis/token-blacklist.store.js", () => ({
  blacklistToken: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({
  getBaseUrl: () => "http://localhost:3000",
  getFrontendUrl: () => "http://localhost:5173",
  runtimeConfig: {
    rateLimit: {
      authWindowSeconds: 60,
      authMaxFailures: 5,
      authLockWindowSeconds: 300,
    },
  },
}));

const authRepository = await import("./auth.repository.js");
const { publishEvent } = await import("../../infrastructure/messaging/event-bus.js");
const { generateToken } = await import("./auth.tokens.js");
const { loginUser, signupUser } = await import("./auth.service.js");

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs up local users and returns the auth response DTO", async () => {
    authRepository.findUserByEmail.mockResolvedValue(null);
    authRepository.createLocalUser.mockResolvedValue({
      _id: "user-1",
      email: "asha@example.com",
      fullName: "Asha Rao",
      profilePic: "pic.png",
      nativeLanguage: "hindi",
      learningLanguage: "english",
      provider: "local",
      isOnboarded: false,
    });

    const result = await signupUser({
      email: "asha@example.com",
      password: "Password1",
      fullName: "Asha Rao",
    });

    expect(generateToken).toHaveBeenCalledWith("user-1");
    expect(publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "user.signed_up",
        key: "user-1",
      }),
    );
    expect(result).toEqual({
      token: "jwt-token",
      payload: {
        success: true,
        message: "Signup successful.",
        user: {
          id: "user-1",
          email: "asha@example.com",
          fullName: "Asha Rao",
          profilePic: "pic.png",
          nativeLanguage: "hindi",
          learningLanguage: "english",
        },
      },
    });
  });

  it("rejects login when the password does not match", async () => {
    authRepository.findUserByEmailWithPassword.mockResolvedValue({
      provider: "local",
      password: "hash",
      matchPassword: vi.fn(() => Promise.resolve(false)),
    });

    await expect(
      loginUser({
        email: "asha@example.com",
        password: "wrong",
        bruteForceKey: { keyPrefix: "auth", identifier: "asha@example.com" },
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  });
});
