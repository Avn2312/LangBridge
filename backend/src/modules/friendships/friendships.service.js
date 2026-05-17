import { createAppError } from "../../core/http/api-response.js";
import {
  getPagination,
} from "../../core/http/pagination.js";
import {
  cacheKeys,
  invalidateUserListCaches,
  readJsonCache,
  writeJsonCache,
} from "../../infrastructure/redis/cache.store.js";
import { refreshPresenceForUsers } from "../../infrastructure/realtime/socket.js";
import { eventTopics } from "../../infrastructure/messaging/event-topics.js";
import { publishEvent } from "../../infrastructure/messaging/event-bus.js";
import { getBlockState } from "../moderation/blocking.service.js";
import {
  emitFriendRequestAccepted,
  emitFriendRequestReceived,
} from "./friendships.emitters.js";
import {
  addFriend,
  createFriendRequest,
  deleteFriendRequestsBetween,
  findFriendRequestBetween,
  findFriendRequestById,
  findFriendsByIds,
  findUserById,
  findUserFriends,
  listReceivedAndAcceptedRequests,
  listSentPendingRequests,
  removeFriend,
} from "./friendships.repository.js";
import {
  serializeFriendsList,
  serializeFriendshipMessage,
  serializeReceivedRequests,
  serializeSentRequests,
} from "./friendships.dto.js";

const appError = (statusCode, message, code, details = {}) =>
  createAppError(message, statusCode, { code, details });

const includesId = (ids = [], id) =>
  ids.some((entry) => entry.toString() === id.toString());

export async function listFriends({ userId, query }) {
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 20,
    maxLimit: 100,
  });
  const wantsPaginatedResponse = query.page != null || query.limit != null;
  const cacheKey = cacheKeys.friends({ userId, page, limit });
  const cached = await readJsonCache(cacheKey);
  if (cached) {
    return {
      payload: cached,
      responseBody: wantsPaginatedResponse ? cached : cached.friends,
    };
  }

  const user = await findUserFriends(userId);
  const friendIds = user?.friends || [];
  const pagedFriendIds = friendIds.slice(skip, skip + limit);
  const friends = await findFriendsByIds(pagedFriendIds);
  const friendPosition = new Map(
    pagedFriendIds.map((id, index) => [id.toString(), index]),
  );

  friends.sort(
    (a, b) =>
      friendPosition.get(a._id.toString()) -
      friendPosition.get(b._id.toString()),
  );

  const payload = serializeFriendsList({
    friends,
    page,
    limit,
    total: friendIds.length,
  });

  await writeJsonCache(cacheKey, payload, 60);
  return { payload, responseBody: wantsPaginatedResponse ? payload : friends };
}

export async function sendFriendRequest({ sender, recipientId }) {
  const senderId = sender.id;

  if (senderId === recipientId) {
    throw appError(
      400,
      "Can't send friend request to self.",
      "FRIEND_REQUEST_SELF",
    );
  }

  const recipient = await findUserById(recipientId);
  if (!recipient) {
    throw appError(404, "Recipient not found.", "RECIPIENT_NOT_FOUND");
  }

  const blockState = await getBlockState(senderId, recipientId);
  if (blockState.isBlockedEitherWay) {
    throw appError(
      403,
      "Cannot send request because one user has blocked the other.",
      "FRIEND_REQUEST_BLOCKED",
    );
  }

  if (includesId(recipient.friends, senderId)) {
    throw appError(400, "Already friends.", "ALREADY_FRIENDS");
  }

  const existingRequest = await findFriendRequestBetween(senderId, recipientId);
  if (existingRequest) {
    throw appError(
      400,
      "Friend request already sent.",
      "FRIEND_REQUEST_EXISTS",
    );
  }

  const friendRequest = await createFriendRequest({ senderId, recipientId });
  await invalidateUserListCaches([senderId, recipientId]);

  publishEvent({
    topic: eventTopics.friendRequestCreated,
    key: friendRequest._id.toString(),
    payload: {
      requestId: friendRequest._id.toString(),
      senderId,
      recipientId,
    },
  });
  publishEvent({
    topic: eventTopics.notificationSend,
    key: recipientId,
    payload: {
      userId: recipientId,
      type: "friend_request.created",
      actorId: senderId,
      requestId: friendRequest._id.toString(),
      channel: "in_app",
    },
  });

  emitFriendRequestReceived({
    recipientId,
    request: friendRequest,
    sender,
  });

  return friendRequest;
}

export async function removeFriendship({ userId, recipientId }) {
  const recipient = await findUserById(recipientId);
  if (!recipient) {
    throw appError(404, "Recipient not found.", "RECIPIENT_NOT_FOUND");
  }

  if (!includesId(recipient.friends, userId)) {
    throw appError(400, "Not friends.", "NOT_FRIENDS");
  }

  await Promise.all([
    removeFriend(userId, recipientId),
    removeFriend(recipientId, userId),
    deleteFriendRequestsBetween(userId, recipientId),
  ]);
  await invalidateUserListCaches([userId, recipientId]);
  await refreshPresenceForUsers([userId, recipientId]);

  return serializeFriendshipMessage("Unfollowed successfully.");
}

export async function acceptFriendRequest({ user, requestId }) {
  const friendRequest = await findFriendRequestById(requestId);
  if (!friendRequest) {
    throw appError(404, "Friend request not found.", "FRIEND_REQUEST_NOT_FOUND");
  }

  if (friendRequest.recipient.toString() !== user.id) {
    throw appError(
      403,
      "You are not authorized to accept this request.",
      "FRIEND_REQUEST_FORBIDDEN",
    );
  }

  if (friendRequest.status !== "pending") {
    throw appError(
      400,
      `Cannot accept a ${friendRequest.status} request.`,
      "FRIEND_REQUEST_NOT_PENDING",
    );
  }

  const senderId = friendRequest.sender.toString();
  const recipientId = friendRequest.recipient.toString();
  const blockState = await getBlockState(recipientId, senderId);
  if (blockState.isBlockedEitherWay) {
    throw appError(
      403,
      "Cannot accept request because one user has blocked the other.",
      "FRIEND_REQUEST_BLOCKED",
    );
  }

  friendRequest.status = "accepted";
  await friendRequest.save();

  await Promise.all([
    addFriend(senderId, recipientId),
    addFriend(recipientId, senderId),
  ]);
  await invalidateUserListCaches([senderId, recipientId]);
  await refreshPresenceForUsers([senderId, recipientId]);

  publishEvent({
    topic: eventTopics.notificationSend,
    key: senderId,
    payload: {
      userId: senderId,
      type: "friend_request.accepted",
      actorId: recipientId,
      requestId: friendRequest._id.toString(),
      channel: "in_app",
    },
  });

  emitFriendRequestAccepted({
    senderId,
    acceptedBy: user,
  });

  return serializeFriendshipMessage("Friend Request Accepted.");
}

export async function rejectFriendRequest({ userId, requestId }) {
  const friendRequest = await findFriendRequestById(requestId);
  if (!friendRequest) {
    throw appError(404, "Friend request not found.", "FRIEND_REQUEST_NOT_FOUND");
  }

  if (friendRequest.recipient.toString() !== userId) {
    throw appError(
      403,
      "You are not authorized to reject this request.",
      "FRIEND_REQUEST_FORBIDDEN",
    );
  }

  if (friendRequest.status !== "pending") {
    throw appError(
      400,
      "Friend request is already processed.",
      "FRIEND_REQUEST_ALREADY_PROCESSED",
    );
  }

  friendRequest.status = "rejected";
  await friendRequest.save();

  return serializeFriendshipMessage("Friend Request Rejected.");
}

export async function listReceivedRequests({ userId, query }) {
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 20,
    maxLimit: 100,
  });
  const result = await listReceivedAndAcceptedRequests({ userId, skip, limit });

  return serializeReceivedRequests({
    incomingReqs: result.incomingReqs,
    acceptedReqs: result.acceptedReqs,
    page,
    limit,
    incomingTotal: result.incomingTotal,
    acceptedTotal: result.acceptedTotal,
  });
}

export async function listSentRequests({ userId, query }) {
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 20,
    maxLimit: 100,
  });
  const wantsPaginatedResponse = query.page != null || query.limit != null;
  const { requests, total } = await listSentPendingRequests({
    userId,
    skip,
    limit,
  });
  const payload = serializeSentRequests({ requests, page, limit, total });

  return wantsPaginatedResponse ? payload : requests;
}
