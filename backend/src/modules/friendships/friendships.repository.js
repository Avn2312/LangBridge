import FriendRequest from "../../shared/models/FriendRequest.js";
import User from "../../shared/models/User.js";
import { countMatchingDocuments } from "../../core/http/pagination.js";

const friendFields =
  "fullName profilePic nativeLanguage learningLanguage";

export async function findUserFriends(userId) {
  return User.findById(userId).select("friends").lean();
}

export async function findFriendsByIds(friendIds = []) {
  return User.find({ _id: { $in: friendIds } }).select(friendFields).lean();
}

export async function findUserById(userId) {
  return User.findById(userId);
}

export function addFriend(userId, friendId) {
  return User.findByIdAndUpdate(userId, { $addToSet: { friends: friendId } });
}

export function removeFriend(userId, friendId) {
  return User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
}

export function findFriendRequestBetween(userId, otherUserId) {
  return FriendRequest.findOne({
    $or: [
      { sender: userId, recipient: otherUserId },
      { sender: otherUserId, recipient: userId },
    ],
  });
}

export function deleteFriendRequestsBetween(userId, otherUserId) {
  return FriendRequest.deleteMany({
    $or: [
      { sender: userId, recipient: otherUserId },
      { sender: otherUserId, recipient: userId },
    ],
  });
}

export function createFriendRequest({ senderId, recipientId }) {
  return FriendRequest.create({
    sender: senderId,
    recipient: recipientId,
  });
}

export function findFriendRequestById(requestId) {
  return FriendRequest.findById(requestId);
}

export async function listReceivedAndAcceptedRequests({ userId, skip, limit }) {
  const incomingFilter = {
    recipient: userId,
    status: "pending",
  };
  const acceptedFilter = {
    sender: userId,
    status: "accepted",
  };

  const [incomingReqs, acceptedReqs, incomingTotal, acceptedTotal] =
    await Promise.all([
      FriendRequest.find(incomingFilter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", friendFields)
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

  return { incomingReqs, acceptedReqs, incomingTotal, acceptedTotal };
}

export async function listSentPendingRequests({ userId, skip, limit }) {
  const filter = {
    sender: userId,
    status: "pending",
  };

  const [requests, total] = await Promise.all([
    FriendRequest.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("recipient", friendFields)
      .lean(),
    countMatchingDocuments(FriendRequest, filter),
  ]);

  return { requests, total };
}
