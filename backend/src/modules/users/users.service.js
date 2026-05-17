import { createAppError } from "../../core/http/api-response.js";
import { getBlockState } from "../moderation/blocking.service.js";
import { serializePublicUserProfile } from "./users.dto.js";
import { findPublicUserProfileById } from "./users.repository.js";

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
