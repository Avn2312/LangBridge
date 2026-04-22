import Message from "../models/Message.js";
import User from "../models/User.js";
import { logger } from "../lib/logger.js";
import { sendError } from "../lib/apiResponse.js";

// ─── GET /api/messages/:userId ─────────────────────────────────────────────────
// Returns paginated message history between the logged-in user and :userId
// Query params: ?page=1&limit=50
export async function getMessages(req, res) {
  try {
    const myId = req.user._id;
    const { userId: otherId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    // Find messages in either direction between the two users
    // INTERVIEW: "Why $or here instead of two separate queries?"
    //   → One round-trip to MongoDB. $or with the compound index is efficient.
    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherId },
        { sender: otherId, receiver: myId },
      ],
    })
      .sort({ createdAt: -1 }) // newest first (frontend reverses for display)
      .skip(skip)
      .limit(limit)
      .lean(); // .lean() returns plain JS objects — 3x faster than Mongoose docs

    // Mark unread messages as read (messages sent TO me by the other person)
    // Fire-and-forget — don't await so response is fast
    Message.updateMany(
      { sender: otherId, receiver: myId, read: false },
      { $set: { read: true } },
    ).exec();

    return res.status(200).json({
      success: true,
      messages: messages.reverse(), // chronological order for the frontend
      page,
      limit,
    });
  } catch (error) {
    logger.error("Error in getMessages", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

// ─── GET /api/messages/conversations ──────────────────────────────────────────
// Returns all conversations for the logged-in user,
// each with the other user's profile and the last message.
// INTERVIEW: "Walk me through this aggregation."
//   → "Group messages where I'm sender or receiver, find the latest message per
//      conversation partner, then join user profiles and sort by recency."
export async function getConversations(req, res) {
  try {
    const myId = req.user._id;

    const conversations = await Message.aggregate([
      // Step 1: Only messages involving me
      {
        $match: {
          $or: [{ sender: myId }, { receiver: myId }],
        },
      },

      // Step 2: Derive the "other" person in this conversation
      // If I'm the sender → otherUser = receiver; otherwise → otherUser = sender
      {
        $addFields: {
          otherUser: {
            $cond: {
              if: { $eq: ["$sender", myId] },
              then: "$receiver",
              else: "$sender",
            },
          },
        },
      },

      // Step 3: Group by the other user, keep only the latest message per conversation
      {
        $group: {
          _id: "$otherUser",
          lastMessage: { $last: "$$ROOT" }, // $$ROOT = full document
          unreadCount: {
            // Count messages sent TO me that I haven't read
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", myId] },
                    { $eq: ["$read", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      // Step 4: Sort by the timestamp of the last message (most recent first)
      { $sort: { "lastMessage.createdAt": -1 } },

      // Step 5: Join user profile data for the other person
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },

      // Step 6: Flatten the userDetails array into a single object
      { $unwind: "$userDetails" },

      // Step 7: Shape the output — only pick fields the frontend needs
      {
        $project: {
          _id: 0,
          userId: "$_id",
          fullName: "$userDetails.fullName",
          profilePic: "$userDetails.profilePic",
          nativeLanguage: "$userDetails.nativeLanguage",
          learningLanguage: "$userDetails.learningLanguage",
          lastMessage: {
            text: "$lastMessage.text",
            createdAt: "$lastMessage.createdAt",
            isFromMe: { $eq: ["$lastMessage.sender", myId] },
          },
          unreadCount: 1,
        },
      },
    ]);

    return res.status(200).json({ success: true, conversations });
  } catch (error) {
    logger.error("Error in getConversations", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
