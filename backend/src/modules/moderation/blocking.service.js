import User from "../../shared/models/User.js";

export const getBlockState = async (viewerId, otherUserId) => {
  const [viewer, otherUser] = await Promise.all([
    User.findById(viewerId).select("blockedUsers"),
    User.findById(otherUserId).select("blockedUsers"),
  ]);

  if (!viewer || !otherUser) {
    return {
      isBlockedByViewer: false,
      hasBlockedViewer: false,
      isBlockedEitherWay: false,
    };
  }

  const isBlockedByViewer = (viewer.blockedUsers || []).some(
    (id) => id.toString() === otherUserId.toString(),
  );
  const hasBlockedViewer = (otherUser.blockedUsers || []).some(
    (id) => id.toString() === viewerId.toString(),
  );

  return {
    isBlockedByViewer,
    hasBlockedViewer,
    isBlockedEitherWay: isBlockedByViewer || hasBlockedViewer,
  };
};
