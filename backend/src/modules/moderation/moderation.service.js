import { createAppError } from "../../core/http/api-response.js";
import {
  getPagination,
} from "../../core/http/pagination.js";
import { invalidateUserListCaches } from "../../infrastructure/redis/cache.store.js";
import { refreshPresenceForUsers } from "../../infrastructure/realtime/socket.js";
import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { publishEvent } from "../../infrastructure/messaging/event-bus.js";
import {
  blockUser as blockUserRecord,
  createReport,
  deleteFriendRequestsBetween,
  findUserById,
  listReports,
  removeFriendshipFromTarget,
  unblockUser as unblockUserRecord,
  updateReportStatus,
} from "./moderation.repository.js";
import {
  serializeModerationActionMessage,
  serializeModerationQueue,
  serializeReportStatusUpdate,
  serializeReportSubmitted,
} from "./moderation.dto.js";

const REPORT_STATUSES = new Set(["open", "reviewing", "actioned", "closed"]);
const REPORT_CATEGORIES = new Set([
  "harassment",
  "spam",
  "unsafe_content",
  "impersonation",
  "other",
]);

const appError = (statusCode, message, code) =>
  createAppError(message, statusCode, { code });

export async function blockUser({ userId, targetUserId }) {
  if (userId === targetUserId) {
    throw appError(400, "You cannot block yourself.", "BLOCK_SELF_NOT_ALLOWED");
  }

  const targetUser = await findUserById(targetUserId);
  if (!targetUser) {
    throw appError(404, "User not found.", "USER_NOT_FOUND");
  }

  await Promise.all([
    blockUserRecord({ userId, targetUserId }),
    removeFriendshipFromTarget({ userId, targetUserId }),
    deleteFriendRequestsBetween(userId, targetUserId),
  ]);
  await invalidateUserListCaches([userId, targetUserId]);
  await refreshPresenceForUsers([userId, targetUserId]);

  return serializeModerationActionMessage("User blocked successfully.");
}

export async function unblockUser({ userId, targetUserId }) {
  await unblockUserRecord({ userId, targetUserId });
  await invalidateUserListCaches([userId, targetUserId]);
  await refreshPresenceForUsers([userId, targetUserId]);

  return serializeModerationActionMessage("User unblocked successfully.");
}

export async function reportUser({ reporterId, reportedId, body }) {
  const reason = String(body?.reason || "").trim();
  const requestedCategory = String(body?.category || "other").trim();
  const category = REPORT_CATEGORIES.has(requestedCategory)
    ? requestedCategory
    : "other";

  if (reporterId === reportedId) {
    throw appError(
      400,
      "You cannot report yourself.",
      "REPORT_SELF_NOT_ALLOWED",
    );
  }

  const reportedUser = await findUserById(reportedId);
  if (!reportedUser) {
    throw appError(404, "User not found.", "USER_NOT_FOUND");
  }

  const report = await createReport({
    reporterId,
    reportedId,
    reason,
    messageId: body?.messageId,
    category,
  });

  publishEvent({
    topic: eventTopics.userReported,
    key: report._id.toString(),
    payload: {
      reportId: report._id.toString(),
      reporterId,
      reportedId,
      hasReason: Boolean(reason),
    },
  });

  return serializeReportSubmitted(report);
}

export async function getModerationQueue({ query }) {
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 20,
    maxLimit: 100,
  });
  const status = String(query.status || "open");
  const filter =
    status === "all"
      ? {}
      : { status: REPORT_STATUSES.has(status) ? status : "open" };
  const { reports, total } = await listReports({ filter, skip, limit });

  return serializeModerationQueue({ reports, page, limit, total });
}

export async function changeReportStatus({ reportId, body }) {
  const status = String(body?.status || "").trim();
  if (!REPORT_STATUSES.has(status)) {
    throw appError(400, "Invalid moderation status.", "INVALID_REPORT_STATUS");
  }

  const report = await updateReportStatus({
    reportId,
    status,
    moderatorNote: String(body?.moderatorNote || "").trim(),
  });

  if (!report) {
    throw appError(404, "Report not found.", "REPORT_NOT_FOUND");
  }

  return serializeReportStatusUpdate(report);
}
