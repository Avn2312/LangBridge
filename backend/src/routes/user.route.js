import express from "express";
import {
  protectRoute,
  requireVerifiedUser,
} from "../middlewares/auth.middleware.js";
import {
  getRecommendations,
  getMyFriends,
  followRequestController,
  unfollowRequestController,
  acceptRequestController,
  rejectRequestController,
  receivedFollowReqsController,
  sentFollowReqsController,
} from "../controllers/user.controller.js";
import { userIdParamValidation } from "../validation/user.validator.js";

const router = express.Router();

// Apply auth middleware to ALL routes in this file
// WHY: Every user-related action requires authentication.
//      Instead of adding protectRoute to each route individually,
//      router.use() applies it to all routes below.
router.use(protectRoute);

router.get("/", getRecommendations);
router.get("/friends", getMyFriends);

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
  receivedFollowReqsController,
);
router.get("/sent/requests", requireVerifiedUser, sentFollowReqsController);

export default router;
