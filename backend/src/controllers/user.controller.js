import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import Report from "../models/Report.js";
import { getIO, getOnlineUserIds, refreshPresenceForUsers } from "../lib/socket.js";
import { logger } from "../lib/logger.js";
import { sendError } from "../lib/apiResponse.js";
import { getBlockState } from "../lib/blocking.js";
import { eventTopics } from "../lib/events.js";
import { publishEvent } from "../lib/kafka.js";
import {
  cacheKeys,
  invalidateUserListCaches,
  readJsonCache,
  writeJsonCache,
} from "../lib/cache.js";
import {
  buildPaginationMeta,
  countMatchingDocuments,
  getPagination,
} from "../lib/pagination.js";
import { scorePartnerMatch } from "../lib/languageAssist.js";

const normalizeFilterValue = (value = "") => String(value).trim().toLowerCase();

const isTruthyQueryValue = (value) =>
  ["1", "true", "yes", "on"].includes(normalizeFilterValue(value));

export async function getRecommendations(req, res) {
  try {
    const currentUserId = req.user.id;
    const currentUser = req.user;
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    const wantsPaginatedResponse =
      req.query.page != null || req.query.limit != null;
    const discoveryFilters = {
      targetLanguage: normalizeFilterValue(req.query.targetLanguage),
      nativeLanguage: normalizeFilterValue(req.query.nativeLanguage),
      proficiency: normalizeFilterValue(req.query.proficiency),
      onlineNow: isTruthyQueryValue(req.query.onlineNow),
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
      return res
        .status(200)
        .json(wantsPaginatedResponse ? cached : cached.users);
    }

    const usersWhoBlockedMe = await User.find({
      blockedUsers: currentUserId,
    }).select("_id");
    const blockedByIds = usersWhoBlockedMe.map((user) => user._id);
    const excludedIds = [
      currentUserId,
      ...(currentUser.friends || []),
      ...(currentUser.blockedUsers || []),
      ...blockedByIds,
    ];
    const onlineUserIds = await getOnlineUserIds();
    const onlineUserIdSet = new Set(onlineUserIds.map(String));

    const filterConditions = [
      { _id: { $nin: excludedIds } }, // exclude self, friends, and blocked users
      { isOnboarded: true }, // only onboarded users
    ];

    if (discoveryFilters.targetLanguage) {
      filterConditions.push({ nativeLanguage: discoveryFilters.targetLanguage });
    }

    if (discoveryFilters.nativeLanguage) {
      filterConditions.push({ learningLanguage: discoveryFilters.nativeLanguage });
    }

    if (discoveryFilters.proficiency) {
      filterConditions.push({ proficiencyLevel: discoveryFilters.proficiency });
    }

    if (discoveryFilters.onlineNow) {
      filterConditions.push({ _id: { $in: onlineUserIds } });
    }

    const filter = {
      $and: filterConditions,
    };

    const [recommendedUsers, total] = await Promise.all([
      User.find(filter)
        .select(
          "fullName profilePic nativeLanguage learningLanguage bio location timezone proficiencyLevel interests updatedAt",
        )
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      countMatchingDocuments(User, filter),
    ]);
    const scoredUsers = recommendedUsers
      .map((user) => {
        const match = scorePartnerMatch(currentUser, user);
        return {
          ...user,
          isOnline: onlineUserIdSet.has(user._id.toString()),
          matchScore: match.score,
          matchReasons: match.reasons,
          isBestExchangeMatch: match.isBestExchangeMatch,
        };
      })
      .sort(
        (left, right) =>
          right.matchScore - left.matchScore ||
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );

    const payload = {
      success: true,
      users: scoredUsers,
      pagination: buildPaginationMeta({ page, limit, total }),
    };

    await writeJsonCache(cacheKey, payload, discoveryFilters.onlineNow ? 15 : 60);
    return res
      .status(200)
      .json(wantsPaginatedResponse ? payload : scoredUsers);
  } catch (error) {
    logger.error("Error in getRecommendations controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getMyFriends(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const wantsPaginatedResponse =
      req.query.page != null || req.query.limit != null;
    const cacheKey = cacheKeys.friends({ userId: req.user.id, page, limit });
    const cached = await readJsonCache(cacheKey);
    if (cached) {
      return res
        .status(200)
        .json(wantsPaginatedResponse ? cached : cached.friends);
    }

    const user = await User.findById(req.user.id).select("friends").lean();
    const friendIds = user?.friends || [];
    const pagedFriendIds = friendIds.slice(skip, skip + limit);

    const friends = await User.find({ _id: { $in: pagedFriendIds } })
      .select("fullName profilePic nativeLanguage learningLanguage")
      .lean();
    const friendPosition = new Map(
      pagedFriendIds.map((id, index) => [id.toString(), index]),
    );
    friends.sort(
      (a, b) =>
        friendPosition.get(a._id.toString()) -
        friendPosition.get(b._id.toString()),
    );

    const payload = {
      success: true,
      friends,
      pagination: buildPaginationMeta({
        page,
        limit,
        total: friendIds.length,
      }),
    };

    await writeJsonCache(cacheKey, payload, 60);
    return res.status(200).json(wantsPaginatedResponse ? payload : friends);
  } catch (error) {
    logger.error("Error in getMyFriends controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getUserByIdController(req, res) {
  try {
    const { id: targetUserId } = req.params;

    const targetUser = await User.findById(targetUserId).select(
      "fullName profilePic nativeLanguage learningLanguage bio location timezone proficiencyLevel interests isOnboarded verified blockedUsers",
    );

    if (!targetUser) {
      return sendError(res, 404, "User not found.", {
        code: "USER_NOT_FOUND",
      });
    }

    const blockState = await getBlockState(req.user.id, targetUserId);

    return res.status(200).json({
      _id: targetUser._id,
      fullName: targetUser.fullName,
      profilePic: targetUser.profilePic,
      nativeLanguage: targetUser.nativeLanguage,
      learningLanguage: targetUser.learningLanguage,
      timezone: targetUser.timezone,
      proficiencyLevel: targetUser.proficiencyLevel,
      interests: targetUser.interests || [],
      bio: targetUser.bio,
      location: targetUser.location,
      isOnboarded: targetUser.isOnboarded,
      verified: targetUser.verified,
      isBlockedByMe: blockState.isBlockedByViewer,
      hasBlockedMe: blockState.hasBlockedViewer,
    });
  } catch (error) {
    logger.error("Error in getUserById controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function followRequestController(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    // Prevent sending request to yourself
    if (myId === recipientId) {
      return sendError(res, 400, "Can't send friend request to self.", {
        code: "FRIEND_REQUEST_SELF",
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return sendError(res, 404, "Recipient not found.", {
        code: "RECIPIENT_NOT_FOUND",
      });
    }

    const blockState = await getBlockState(myId, recipientId);
    if (blockState.isBlockedEitherWay) {
      return sendError(
        res,
        403,
        "Cannot send request because one user has blocked the other.",
        {
          code: "FRIEND_REQUEST_BLOCKED",
        },
      );
    }

    // Check if already friends
    if (recipient.friends.some((friendId) => friendId.toString() === myId)) {
      return sendError(res, 400, "Already friends.", {
        code: "ALREADY_FRIENDS",
      });
    }

    // Check if request already exists (either direction)
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });

    if (existingRequest) {
      return sendError(res, 400, "Friend request already sent.", {
        code: "FRIEND_REQUEST_EXISTS",
      });
    }

    const friendRequest = await FriendRequest.create({
      sender: myId,
      recipient: recipientId,
    });
    await invalidateUserListCaches([myId, recipientId]);

    publishEvent({
      topic: eventTopics.friendRequestCreated,
      key: friendRequest._id.toString(),
      payload: {
        requestId: friendRequest._id.toString(),
        senderId: myId,
        recipientId,
      },
    });
    publishEvent({
      topic: eventTopics.notificationSend,
      key: recipientId,
      payload: {
        userId: recipientId,
        type: "friend_request.created",
        actorId: myId,
        requestId: friendRequest._id.toString(),
        channel: "in_app",
      },
    });

    // ── Real-time notification ──────────────────────────────────────────────
    // Emit to the recipient's personal room so their UI updates instantly
    // without needing a page refresh.
    // WHY try/catch? Socket.IO failure should never break the HTTP response.
    try {
      getIO()
        .to(recipientId)
        .emit("friendRequest", {
          type: "received",
          request: {
            _id: friendRequest._id,
            sender: {
              _id: req.user._id,
              fullName: req.user.fullName,
              profilePic: req.user.profilePic,
            },
            status: "pending",
            createdAt: friendRequest.createdAt,
          },
        });
    } catch (socketErr) {
      logger.error("Socket emit failed (friendRequest)", socketErr);
    }

    res.status(201).json(friendRequest);
  } catch (error) {
    logger.error("Error in sendFriendRequest controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function unfollowRequestController(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return sendError(res, 404, "Recipient not found.", {
        code: "RECIPIENT_NOT_FOUND",
      });
    }

    // Check if they are friends
    if (!recipient.friends.some((friendId) => friendId.toString() === myId)) {
      return sendError(res, 400, "Not friends.", { code: "NOT_FRIENDS" });
    }

    // Remove from each other's friends array
    await User.findByIdAndUpdate(myId, { $pull: { friends: recipientId } });
    await User.findByIdAndUpdate(recipientId, { $pull: { friends: myId } });

    // Also remove any existing friend requests between them
    await FriendRequest.deleteMany({
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });
    await invalidateUserListCaches([myId, recipientId]);
    await refreshPresenceForUsers([myId, recipientId]);

    res.status(200).json({ message: "Unfollowed successfully." });
  } catch (error) {
    logger.error("Error in unfollowRequestController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function acceptRequestController(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return sendError(res, 404, "Friend request not found.", {
        code: "FRIEND_REQUEST_NOT_FOUND",
      });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return sendError(
        res,
        403,
        "You are not authorized to accept this request.",
        {
          code: "FRIEND_REQUEST_FORBIDDEN",
        },
      );
    }

    if (friendRequest.status !== "pending") {
      return sendError(
        res,
        400,
        `Cannot accept a ${friendRequest.status} request.`,
        {
          code: "FRIEND_REQUEST_NOT_PENDING",
        },
      );
    }

    const blockState = await getBlockState(
      friendRequest.recipient.toString(),
      friendRequest.sender.toString(),
    );
    if (blockState.isBlockedEitherWay) {
      return sendError(
        res,
        403,
        "Cannot accept request because one user has blocked the other.",
        {
          code: "FRIEND_REQUEST_BLOCKED",
        },
      );
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // Add each user to the other's friends array
    // $addToSet ensures no duplicates (idempotent operation)
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });
    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });
    await invalidateUserListCaches([
      friendRequest.sender,
      friendRequest.recipient,
    ]);
    await refreshPresenceForUsers([
      friendRequest.sender,
      friendRequest.recipient,
    ]);

    publishEvent({
      topic: eventTopics.notificationSend,
      key: friendRequest.sender.toString(),
      payload: {
        userId: friendRequest.sender.toString(),
        type: "friend_request.accepted",
        actorId: friendRequest.recipient.toString(),
        requestId: friendRequest._id.toString(),
        channel: "in_app",
      },
    });

    // ── Real-time: notify the sender their request was accepted ───────────
    try {
      getIO()
        .to(friendRequest.sender.toString())
        .emit("friendRequest", {
          type: "accepted",
          acceptedBy: {
            _id: req.user._id,
            fullName: req.user.fullName,
            profilePic: req.user.profilePic,
          },
        });
    } catch (socketErr) {
      logger.error("Socket emit failed (acceptFriend)", socketErr);
    }

    res.status(200).json({ message: "Friend Request Accepted." });
  } catch (error) {
    logger.error("Error in acceptFriendRequest controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function rejectRequestController(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return sendError(res, 404, "Friend request not found.", {
        code: "FRIEND_REQUEST_NOT_FOUND",
      });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return sendError(
        res,
        403,
        "You are not authorized to reject this request.",
        {
          code: "FRIEND_REQUEST_FORBIDDEN",
        },
      );
    }
    if (friendRequest.status !== "pending") {
      return sendError(res, 400, "Friend request is already processed.", {
        code: "FRIEND_REQUEST_ALREADY_PROCESSED",
      });
    }

    friendRequest.status = "rejected";
    await friendRequest.save();

    res.status(200).json({ message: "Friend Request Rejected." });
  } catch (error) {
    logger.error("Error in rejectFriendRequest controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function receivedFollowReqsController(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const wantsPaginatedResponse =
      req.query.page != null || req.query.limit != null;
    const incomingFilter = {
      recipient: req.user.id,
      status: "pending",
    };
    const acceptedFilter = {
      sender: req.user.id,
      status: "accepted",
    };

    const [incomingReqs, acceptedReqs, incomingTotal, acceptedTotal] =
      await Promise.all([
        FriendRequest.find(incomingFilter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate(
            "sender",
            "fullName profilePic nativeLanguage learningLanguage",
          )
          .lean(),
        FriendRequest.find(acceptedFilter)
          .sort({ updatedAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .populate("recipient", "fullName profilePic")
          .lean(),
        countMatchingDocuments(FriendRequest, incomingFilter),
        countMatchingDocuments(FriendRequest, acceptedFilter),
      ]);

    res.status(200).json({
      incomingReqs,
      acceptedReqs,
      pagination: {
        incoming: buildPaginationMeta({ page, limit, total: incomingTotal }),
        accepted: buildPaginationMeta({ page, limit, total: acceptedTotal }),
      },
    });
  } catch (error) {
    logger.error("Error in getFriendRequests controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function sentFollowReqsController(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const wantsPaginatedResponse =
      req.query.page != null || req.query.limit != null;
    const filter = {
      sender: req.user.id,
      status: "pending",
    };

    const [outgoingRequests, total] = await Promise.all([
      FriendRequest.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate(
          "recipient",
          "fullName profilePic nativeLanguage learningLanguage",
        )
        .lean(),
      countMatchingDocuments(FriendRequest, filter),
    ]);

    const payload = {
      success: true,
      requests: outgoingRequests,
      pagination: buildPaginationMeta({ page, limit, total }),
    };

    res
      .status(200)
      .json(wantsPaginatedResponse ? payload : outgoingRequests);
  } catch (error) {
    logger.error("Error in getOutgoingFriendReqs controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function blockUserController(req, res) {
  try {
    const myId = req.user.id;
    const { id: targetUserId } = req.params;

    if (myId === targetUserId) {
      return sendError(res, 400, "You cannot block yourself.", {
        code: "BLOCK_SELF_NOT_ALLOWED",
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return sendError(res, 404, "User not found.", {
        code: "USER_NOT_FOUND",
      });
    }

    await Promise.all([
      User.findByIdAndUpdate(myId, {
        $addToSet: { blockedUsers: targetUserId },
        $pull: { friends: targetUserId },
      }),
      User.findByIdAndUpdate(targetUserId, {
        $pull: { friends: myId },
      }),
      FriendRequest.deleteMany({
        $or: [
          { sender: myId, recipient: targetUserId },
          { sender: targetUserId, recipient: myId },
        ],
      }),
    ]);
    await invalidateUserListCaches([myId, targetUserId]);
    await refreshPresenceForUsers([myId, targetUserId]);

    return res.status(200).json({
      success: true,
      message: "User blocked successfully.",
    });
  } catch (error) {
    logger.error("Error in blockUser controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function unblockUserController(req, res) {
  try {
    const myId = req.user.id;
    const { id: targetUserId } = req.params;

    await User.findByIdAndUpdate(myId, {
      $pull: { blockedUsers: targetUserId },
    });
    await invalidateUserListCaches([myId, targetUserId]);
    await refreshPresenceForUsers([myId, targetUserId]);

    return res.status(200).json({
      success: true,
      message: "User unblocked successfully.",
    });
  } catch (error) {
    logger.error("Error in unblockUser controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function reportUserController(req, res) {
  try {
    const reporterId = req.user.id;
    const { id: reportedId } = req.params;
    const reason = String(req.body?.reason || "").trim();
    const requestedCategory = String(req.body?.category || "other").trim();
    const category = [
      "harassment",
      "spam",
      "unsafe_content",
      "impersonation",
      "other",
    ].includes(requestedCategory)
      ? requestedCategory
      : "other";

    if (reporterId === reportedId) {
      return sendError(res, 400, "You cannot report yourself.", {
        code: "REPORT_SELF_NOT_ALLOWED",
      });
    }

    const reportedUser = await User.findById(reportedId);
    if (!reportedUser) {
      return sendError(res, 404, "User not found.", {
        code: "USER_NOT_FOUND",
      });
    }

    const report = await Report.create({
      reporter: reporterId,
      reported: reportedId,
      reason,
      message: req.body?.messageId || null,
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

    return res.status(201).json({
      success: true,
      reportId: report._id,
      message: "Report submitted successfully.",
    });
  } catch (error) {
    logger.error("Error in reportUser controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
