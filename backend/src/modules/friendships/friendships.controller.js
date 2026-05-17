import { logger } from "../../core/observability/logger.js";
import { sendError } from "../../core/http/api-response.js";
import {
  acceptFriendRequest,
  listFriends,
  listReceivedRequests,
  listSentRequests,
  rejectFriendRequest,
  removeFriendship,
  sendFriendRequest,
} from "./friendships.service.js";

const sendControllerError = (res, error) =>
  sendError(
    res,
    error.statusCode || 500,
    error.message || "Internal Server Error.",
    {
      code: error.code || "INTERNAL_SERVER_ERROR",
      ...error.details,
    },
  );

export async function getMyFriends(req, res) {
  try {
    const { responseBody } = await listFriends({
      userId: req.user.id,
      query: req.query,
    });

    return res.status(200).json(responseBody);
  } catch (error) {
    logger.error("Error in getMyFriends controller", error);
    return sendControllerError(res, error);
  }
}

export async function followRequestController(req, res) {
  try {
    const friendRequest = await sendFriendRequest({
      sender: req.user,
      recipientId: req.params.id,
    });

    return res.status(201).json(friendRequest);
  } catch (error) {
    logger.error("Error in sendFriendRequest controller", error);
    return sendControllerError(res, error);
  }
}

export async function unfollowRequestController(req, res) {
  try {
    const result = await removeFriendship({
      userId: req.user.id,
      recipientId: req.params.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in unfollowRequestController", error);
    return sendControllerError(res, error);
  }
}

export async function acceptRequestController(req, res) {
  try {
    const result = await acceptFriendRequest({
      user: req.user,
      requestId: req.params.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in acceptFriendRequest controller", error);
    return sendControllerError(res, error);
  }
}

export async function rejectRequestController(req, res) {
  try {
    const result = await rejectFriendRequest({
      userId: req.user.id,
      requestId: req.params.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in rejectFriendRequest controller", error);
    return sendControllerError(res, error);
  }
}

export async function receivedFollowReqsController(req, res) {
  try {
    const result = await listReceivedRequests({
      userId: req.user.id,
      query: req.query,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getFriendRequests controller", error);
    return sendControllerError(res, error);
  }
}

export async function sentFollowReqsController(req, res) {
  try {
    const result = await listSentRequests({
      userId: req.user.id,
      query: req.query,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getOutgoingFriendReqs controller", error);
    return sendControllerError(res, error);
  }
}
