import { createAppError } from "../../core/http/api-response.js";
import {
  deleteCachePatterns,
  invalidateUserListCaches,
} from "../../infrastructure/redis/cache.store.js";
import { getBlockState } from "../moderation/blocking.service.js";
import { serializePublicUserProfile } from "./users.dto.js";
import {
  findPublicUserProfileById,
  updateUserProfileById,
} from "./users.repository.js";

export async function getUserProfile({ viewerId, targetUserId }) {
  const targetUser = await findPublicUserProfileById(targetUserId);

  if (!targetUser) {
    throw createAppError("User not found.", 404, {
      code: "USER_NOT_FOUND",
    });
  }

  const blockState = await getBlockState(viewerId, targetUserId);

  return serializePublicUserProfile({ user: targetUser, blockState });
}

export async function updateMyProfile({ userId, body }) {
  const interests = Array.isArray(body.interests)
    ? body.interests
        .map((interest) => String(interest).trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const profile = {
    fullName: body.fullName,
    bio: body.bio,
    nativeLanguage: body.nativeLanguage,
    learningLanguage: body.learningLanguage,
    location: body.location,
    timezone: body.timezone || "",
    proficiencyLevel: body.proficiencyLevel || "",
    profilePic: body.profilePic || "",
    interests,
  };

  const updatedUser = await updateUserProfileById(userId, profile);

  if (!updatedUser) {
    throw createAppError("User not found.", 404, {
      code: "USER_NOT_FOUND",
    });
  }

  await Promise.all([
    invalidateUserListCaches([userId]),
    deleteCachePatterns(["langbridge:cache:recommendations:*"]),
  ]);

  return {
    success: true,
    user: serializePublicUserProfile({
      user: updatedUser,
      blockState: { isBlockedByMe: false, hasBlockedMe: false },
    }),
  };
}
