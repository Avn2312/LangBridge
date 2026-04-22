import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import { getIO } from "../lib/socket.js";
import { logger } from "../lib/logger.js";
import { sendError } from "../lib/apiResponse.js";

export async function getRecommendations(req, res) {
  try {
    const currentUserId = req.user.id;
    const currentUser = req.user;

    const recommendedUsers = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // exclude ourselves
        { _id: { $nin: currentUser.friends } }, // exclude existing friends
        { isOnboarded: true }, // only onboarded users
      ],
    });

    res.status(200).json(recommendedUsers);
  } catch (error) {
    logger.error("Error in getRecommendations controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getMyFriends(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("friends")
      .populate(
        "friends",
        "fullName profilePic nativeLanguage learningLanguage",
      );

    res.status(200).json(user.friends);
  } catch (error) {
    logger.error("Error in getMyFriends controller", error);
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
    const incomingReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate(
      "sender",
      "fullName profilePic nativeLanguage learningLanguage",
    );

    const acceptedReqs = await FriendRequest.find({
      sender: req.user.id,
      status: "accepted",
    }).populate("recipient", "fullName profilePic");

    res.status(200).json({ incomingReqs, acceptedReqs });
  } catch (error) {
    logger.error("Error in getFriendRequests controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function sentFollowReqsController(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate(
      "recipient",
      "fullName profilePic nativeLanguage learningLanguage",
    );

    res.status(200).json(outgoingRequests);
  } catch (error) {
    logger.error("Error in getOutgoingFriendReqs controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
