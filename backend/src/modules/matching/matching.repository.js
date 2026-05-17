import User from "../../shared/models/User.js";
import { countMatchingDocuments } from "../../core/http/pagination.js";

const recommendationFields =
  "fullName profilePic nativeLanguage learningLanguage bio location timezone proficiencyLevel interests updatedAt";

export function findUsersWhoBlocked(userId) {
  return User.find({ blockedUsers: userId }).select("_id");
}

export async function findRecommendedUsers({ filter, skip, limit }) {
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(recommendationFields)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    countMatchingDocuments(User, filter),
  ]);

  return { users, total };
}
