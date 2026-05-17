import express from "express";
import {
  protectRoute,
  requireVerifiedUser,
} from "../../core/middleware/auth.middleware.js";
import {
  getUserByIdController,
} from "./user.controller.js";
import { getRecommendations } from "../matching/matching.controller.js";
import { recommendationsQueryValidation } from "../matching/matching.validators.js";
import {
  getMyFriends,
  followRequestController,
  unfollowRequestController,
  acceptRequestController,
  rejectRequestController,
  receivedFollowReqsController,
  sentFollowReqsController,
} from "../friendships/friendships.controller.js";
import { friendshipListQueryValidation } from "../friendships/friendships.validators.js";
import {
  blockUserController,
  unblockUserController,
  reportUserController,
} from "../moderation/moderation.user-actions.controller.js";
import { reportUserValidation } from "../moderation/moderation.validators.js";
import { userIdParamValidation } from "./user.validators.js";

const router = express.Router();

// Apply auth middleware to ALL routes in this file
// WHY: Every user-related action requires authentication.
//      Instead of adding protectRoute to each route individually,
//      router.use() applies it to all routes below.
router.use(protectRoute);

router.get("/", recommendationsQueryValidation, getRecommendations);
router.get("/friends", friendshipListQueryValidation, getMyFriends);

router.post(
  "/follow/:id",
  requireVerifiedUser,
  userIdParamValidation,
  followRequestController,
);
router.delete(
  "/unfollow/:id",
  requireVerifiedUser,
  userIdParamValidation,
  unfollowRequestController,
);
router.patch(
  "/follow/accept/:id",
  requireVerifiedUser,
  userIdParamValidation,
  acceptRequestController,
);
router.patch(
  "/follow/reject/:id",
  requireVerifiedUser,
  userIdParamValidation,
  rejectRequestController,
);
router.get(
  "/received/requests",
  requireVerifiedUser,
  friendshipListQueryValidation,
  receivedFollowReqsController,
);
router.get(
  "/sent/requests",
  requireVerifiedUser,
  friendshipListQueryValidation,
  sentFollowReqsController,
);
router.get(
  "/:id",
  requireVerifiedUser,
  userIdParamValidation,
  getUserByIdController,
);

router.post(
  "/block/:id",
  requireVerifiedUser,
  userIdParamValidation,
  blockUserController,
);
router.delete(
  "/block/:id",
  requireVerifiedUser,
  userIdParamValidation,
  unblockUserController,
);
router.post(
  "/report/:id",
  requireVerifiedUser,
  userIdParamValidation,
  reportUserValidation,
  reportUserController,
);

export default router;
