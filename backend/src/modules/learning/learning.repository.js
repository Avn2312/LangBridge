import LearningActivity from "../../shared/models/LearningActivity.js";
import Message from "../../shared/models/Message.js";

export function findMessageById(messageId) {
  return Message.findById(messageId).lean();
}

export function findRecentConversationMessages({ userId, partnerId, limit }) {
  return Message.find({
    $or: [
      { sender: userId, receiver: partnerId },
      { sender: partnerId, receiver: userId },
    ],
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .select("text sender receiver createdAt")
    .lean();
}

export function createLearningActivity(activity) {
  return LearningActivity.create(activity);
}

export function findPartnerCorrectionActivities({ userId, partnerId }) {
  const filter = {
    type: "partner_correction",
    $or: partnerId
      ? [
          { user: userId, partner: partnerId },
          { user: partnerId, partner: userId },
        ]
      : [{ user: userId }, { partner: userId }],
  };

  return LearningActivity.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .lean();
}

export function findRecentActivitiesForUser({ userId, limit }) {
  return LearningActivity.find({ user: userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
}

export function aggregateWeeklyActivityCounts({ userId, since }) {
  return LearningActivity.aggregate([
    { $match: { user: userId, createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
      },
    },
  ]);
}

export function countSavedPhrases(userId) {
  return LearningActivity.countDocuments({
    user: userId,
    type: "saved_phrase",
  });
}
