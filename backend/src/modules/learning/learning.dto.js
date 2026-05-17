export const serializeCorrectionActivity = (activity) => ({
  _id: activity._id,
  user: activity.user,
  partner: activity.partner,
  message: activity.message,
  type: activity.type,
  originalText: activity.sourceText,
  correctedText: activity.resultText,
  note: activity.metadata?.note || "",
  status: activity.metadata?.status || "active",
  author: activity.metadata?.author || activity.partner,
  receiver: activity.metadata?.receiver || activity.user,
  createdAt: activity.createdAt,
  updatedAt: activity.updatedAt,
});

export const serializeLearningDashboard = ({
  recentActivities,
  weeklyCounts,
  totalSavedPhrases,
  since,
}) => {
  const weekly = weeklyCounts.reduce(
    (acc, item) => ({ ...acc, [item._id]: item.count }),
    {},
  );
  const activeDays = new Set(
    recentActivities
      .filter((activity) => new Date(activity.createdAt) >= since)
      .map((activity) =>
        new Date(activity.createdAt).toISOString().slice(0, 10),
      ),
  );

  return {
    success: true,
    summary: {
      corrections: (weekly.correction || 0) + (weekly.partner_correction || 0),
      translations: weekly.translation || 0,
      savedPhrases: totalSavedPhrases,
      activeDays: activeDays.size,
      weeklyProgress:
        (weekly.correction || 0) +
        (weekly.partner_correction || 0) +
        (weekly.translation || 0) +
        (weekly.saved_phrase || 0),
    },
    recentActivities,
  };
};
