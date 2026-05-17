import FriendRequest from "../../shared/models/FriendRequest.js";
import Report from "../../shared/models/Report.js";
import User from "../../shared/models/User.js";
import { countMatchingDocuments } from "../../core/http/pagination.js";

const moderationUserFields = "fullName email profilePic";

export function findUserById(userId) {
  return User.findById(userId);
}

export function blockUser({ userId, targetUserId }) {
  return User.findByIdAndUpdate(userId, {
    $addToSet: { blockedUsers: targetUserId },
    $pull: { friends: targetUserId },
  });
}

export function removeFriendshipFromTarget({ userId, targetUserId }) {
  return User.findByIdAndUpdate(targetUserId, {
    $pull: { friends: userId },
  });
}

export function unblockUser({ userId, targetUserId }) {
  return User.findByIdAndUpdate(userId, {
    $pull: { blockedUsers: targetUserId },
  });
}

export function deleteFriendRequestsBetween(userId, targetUserId) {
  return FriendRequest.deleteMany({
    $or: [
      { sender: userId, recipient: targetUserId },
      { sender: targetUserId, recipient: userId },
    ],
  });
}

export function createReport({
  reporterId,
  reportedId,
  reason,
  messageId,
  category,
}) {
  return Report.create({
    reporter: reporterId,
    reported: reportedId,
    reason,
    message: messageId || null,
    category,
  });
}

export async function listReports({ filter, skip, limit }) {
  const [reports, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reporter", moderationUserFields)
      .populate("reported", moderationUserFields)
      .populate("message", "text createdAt")
      .lean(),
    countMatchingDocuments(Report, filter),
  ]);

  return { reports, total };
}

export function updateReportStatus({ reportId, status, moderatorNote }) {
  return Report.findByIdAndUpdate(
    reportId,
    { status, moderatorNote },
    { new: true },
  )
    .populate("reporter", moderationUserFields)
    .populate("reported", moderationUserFields)
    .populate("message", "text createdAt");
}
