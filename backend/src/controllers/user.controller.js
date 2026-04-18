import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import { getIO } from "../lib/socket.js";

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
    console.log("Error in getRecommendations controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
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
    console.error("Error in getMyFriends controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}

export async function followRequestController(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    // Prevent sending request to yourself
    if (myId === recipientId) {
      return res
        .status(400)
        .json({ message: "Can't send friend request to self." });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found." });
    }

    // Check if already friends
    if (recipient.friends.some((friendId) => friendId.toString() === myId)) {
      return res.status(400).json({ message: "Already friends." });
    }

    // Check if request already exists (either direction)
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });

    if (existingRequest) {
      return res.status(400).json({ message: "Friend request already sent." });
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
      getIO().to(recipientId).emit("friendRequest", {
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
      console.error("Socket emit failed (friendRequest):", socketErr.message);
    }

    res.status(201).json(friendRequest);
  } catch (error) {
    console.log("Error in sendFriendRequest controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}

export async function unfollowRequestController(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found." });
    }

    // Check if they are friends
    if (!recipient.friends.some((friendId) => friendId.toString() === myId)) {
      return res.status(400).json({ message: "Not friends." });
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
    console.log("Error in unfollowRequestController:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}

export async function acceptRequestController(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found." });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to accept this request." });
    }

    if (friendRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Cannot accept a ${friendRequest.status} request.` });
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
      getIO().to(friendRequest.sender.toString()).emit("friendRequest", {
        type: "accepted",
        acceptedBy: {
          _id: req.user._id,
          fullName: req.user.fullName,
          profilePic: req.user.profilePic,
        },
      });
    } catch (socketErr) {
      console.error("Socket emit failed (acceptFriend):", socketErr.message);
    }

    res.status(200).json({ message: "Friend Request Accepted." });
  } catch (error) {
    console.log("Error in acceptFriendRequest controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}

export async function rejectRequestController(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found." });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not authorized to reject this request." });
    }
    if (friendRequest.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Friend request is already processed." });
    }

    friendRequest.status = "rejected";
    await friendRequest.save();

    res.status(200).json({ message: "Friend Request Rejected." });
  } catch (error) {
    console.log("Error in rejectFriendRequest controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
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
    console.log("Error in getFriendRequests controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
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
    console.log("Error in getOutgoingFriendReqs controller:", error.message);
    res.status(500).json({ message: "Internal Server Error." });
  }
}
