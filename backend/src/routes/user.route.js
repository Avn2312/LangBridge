import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import {
  getRecommendations,
  getMyFriends,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRequests,
  getOutgoingFriendReqs
} from "../controllers/user.controller.js";

const router = express.Router();

//  below line applies auth middlewares to all the routes
router.use(protectRoute);   // protectRoute middleware return us req.user = user that is all the details of the valid user

router.get("/", getRecommendations);
router.get("/friends", getMyFriends);

router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);

// u can add this feature make on your own
// router.put("/friend-request/:id/remove", removeFriendRequest);

router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendReqs);

export default router;
