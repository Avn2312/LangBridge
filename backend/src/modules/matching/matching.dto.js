import { buildPaginationMeta } from "../../core/http/pagination.js";

export const serializeRecommendedUser = ({ user, match, isOnline }) => ({
  ...user,
  isOnline,
  matchScore: match.score,
  matchReasons: match.reasons,
  isBestExchangeMatch: match.isBestExchangeMatch,
});

export const serializeRecommendations = ({ users, page, limit, total }) => ({
  success: true,
  users,
  pagination: buildPaginationMeta({ page, limit, total }),
});
