import {
  getPagination,
} from "../../core/http/pagination.js";
import {
  cacheKeys,
  readJsonCache,
  writeJsonCache,
} from "../../infrastructure/redis/cache.store.js";
import { getOnlineUserIds } from "../../infrastructure/realtime/socket.js";
import { scorePartnerMatch } from "../translation/translation.service.js";
import {
  findRecommendedUsers,
  findUsersWhoBlocked,
} from "./matching.repository.js";
import {
  serializeRecommendedUser,
  serializeRecommendations,
} from "./matching.dto.js";

const normalizeFilterValue = (value = "") => String(value).trim().toLowerCase();

const isTruthyQueryValue = (value) =>
  ["1", "true", "yes", "on"].includes(normalizeFilterValue(value));

export async function listRecommendations({ currentUser, query }) {
  const currentUserId = currentUser.id;
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 20,
    maxLimit: 50,
  });
  const wantsPaginatedResponse = query.page != null || query.limit != null;
  const discoveryFilters = {
    targetLanguage: normalizeFilterValue(query.targetLanguage),
    nativeLanguage: normalizeFilterValue(query.nativeLanguage),
    proficiency: normalizeFilterValue(query.proficiency),
    onlineNow: isTruthyQueryValue(query.onlineNow),
  };
  const serializedFilters = JSON.stringify(discoveryFilters);
  const cacheKey = cacheKeys.recommendations({
    userId: currentUserId,
    page,
    limit,
    filters: serializedFilters,
  });
  const cached = await readJsonCache(cacheKey);
  if (cached) {
    return wantsPaginatedResponse ? cached : cached.users;
  }

  const [usersWhoBlockedMe, onlineUserIds] = await Promise.all([
    findUsersWhoBlocked(currentUserId),
    getOnlineUserIds(),
  ]);
  const blockedByIds = usersWhoBlockedMe.map((user) => user._id);
  const excludedIds = [
    currentUserId,
    ...(currentUser.friends || []),
    ...(currentUser.blockedUsers || []),
    ...blockedByIds,
  ];
  const onlineUserIdSet = new Set(onlineUserIds.map(String));

  const filterConditions = [
    { _id: { $nin: excludedIds } },
    { isOnboarded: true },
  ];

  if (discoveryFilters.targetLanguage) {
    filterConditions.push({
      nativeLanguage: discoveryFilters.targetLanguage,
    });
  }

  if (discoveryFilters.nativeLanguage) {
    filterConditions.push({
      learningLanguage: discoveryFilters.nativeLanguage,
    });
  }

  if (discoveryFilters.proficiency) {
    filterConditions.push({ proficiencyLevel: discoveryFilters.proficiency });
  }

  if (discoveryFilters.onlineNow) {
    filterConditions.push({ _id: { $in: onlineUserIds } });
  }

  const { users, total } = await findRecommendedUsers({
    filter: { $and: filterConditions },
    skip,
    limit,
  });
  const scoredUsers = users
    .map((user) => {
      const match = scorePartnerMatch(currentUser, user);
      return serializeRecommendedUser({
        user,
        match,
        isOnline: onlineUserIdSet.has(user._id.toString()),
      });
    })
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore ||
        new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
    );

  const payload = serializeRecommendations({
    users: scoredUsers,
    page,
    limit,
    total,
  });

  await writeJsonCache(
    cacheKey,
    payload,
    discoveryFilters.onlineNow ? 15 : 60,
  );

  return wantsPaginatedResponse ? payload : scoredUsers;
}
