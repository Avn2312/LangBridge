import User from "../../shared/models/User.js";

const publicProfileFields =
  "fullName profilePic nativeLanguage learningLanguage bio location timezone proficiencyLevel interests isOnboarded verified blockedUsers";

export function findPublicUserProfileById(userId) {
  return User.findById(userId).select(publicProfileFields);
}

export function updateUserProfileById(userId, profile) {
  return User.findByIdAndUpdate(
    userId,
    {
      $set: profile,
    },
    {
      new: true,
      runValidators: true,
    },
  ).select(publicProfileFields);
}
