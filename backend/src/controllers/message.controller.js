import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { logger } from "../lib/logger.js";
import { sendError } from "../lib/apiResponse.js";
import { getBlockState } from "../lib/blocking.js";
import {
  cacheKeys,
  readJsonCache,
  writeJsonCache,
} from "../lib/cache.js";
import {
  buildPaginationMeta,
  countMatchingDocuments,
  getPagination,
} from "../lib/pagination.js";

const getAttachmentType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
};

const getCloudinaryResourceType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return "video";
  }
  return "raw";
};

const uploadBufferToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

// ─── POST /api/messages/attachments ──────────────────────────────────────────
// Uploads chat media to Cloudinary and returns the metadata that Socket.IO stores.
export async function uploadMessageAttachment(req, res) {
  try {
    const file = req.file;

    if (!file) {
      return sendError(res, 400, "No file provided.", {
        code: "NO_ATTACHMENT_FILE",
      });
    }

    const attachmentType = getAttachmentType(file.mimetype);
    const resourceType = getCloudinaryResourceType(file.mimetype);

    const result = await uploadBufferToCloudinary(file.buffer, {
      resource_type: resourceType,
      folder:
        attachmentType === "audio"
          ? "langbridge/voice-notes"
          : "langbridge/chat-attachments",
    });

    return res.status(201).json({
      success: true,
      attachment: {
        url: result.secure_url,
        type: attachmentType,
        filename: file.originalname || "",
        size: file.size || result.bytes || 0,
      },
    });
  } catch (error) {
    logger.error("Error uploading message attachment", error);
    return sendError(res, 500, "Failed to upload attachment.", {
      code: "ATTACHMENT_UPLOAD_FAILED",
    });
  }
}

// ─── GET /api/messages/:userId ─────────────────────────────────────────────────
// Returns paginated message history between the logged-in user and :userId
// Query params: ?page=1&limit=50
export async function getMessages(req, res) {
  try {
    const myId = req.user._id;
    const { userId: otherId } = req.params;
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });

    const blockState = await getBlockState(myId, otherId);
    if (blockState.isBlockedEitherWay) {
      return sendError(
        res,
        403,
        "Cannot access messages because one user has blocked the other.",
        {
          code: "MESSAGES_BLOCKED",
          isBlockedByMe: blockState.isBlockedByViewer,
          hasBlockedMe: blockState.hasBlockedViewer,
        },
      );
    }

    // Find messages in either direction between the two users
    // INTERVIEW: "Why $or here instead of two separate queries?"
    //   → One round-trip to MongoDB. $or with the compound index is efficient.
    const filter = {
      $or: [
        { sender: myId, receiver: otherId },
        { sender: otherId, receiver: myId },
      ],
    };

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1, _id: -1 }) // newest first (frontend reverses for display)
        .skip(skip)
        .limit(limit)
        .lean(), // .lean() returns plain JS objects — 3x faster than Mongoose docs
      countMatchingDocuments(Message, filter),
    ]);

    // Mark unread messages as read (messages sent TO me by the other person)
    // Fire-and-forget — don't await so response is fast
    Message.updateMany(
      { sender: otherId, receiver: myId, read: false },
      { $set: { read: true, readAt: new Date() } },
    ).exec();

    return res.status(200).json({
      success: true,
      messages: messages.reverse(), // chronological order for the frontend
      pagination: buildPaginationMeta({ page, limit, total }),
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
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const cacheKey = cacheKeys.conversations({
      userId: myId.toString(),
      page,
      limit,
    });
    const cached = await readJsonCache(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const conversations = await Message.aggregate([
      // Step 1: Only messages involving me
      {
        $match: {
          $or: [{ sender: myId }, { receiver: myId }],
        },
      },

      // Step 2: Make "latest message" deterministic before grouping.
      { $sort: { createdAt: -1, _id: -1 } },

      // Step 3: Derive the "other" person in this conversation
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

      // Step 4: Group by the other user, keep only the latest message per conversation
      {
        $group: {
          _id: "$otherUser",
          lastMessage: { $first: "$$ROOT" }, // $$ROOT = full document
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

      // Step 5: Sort by the timestamp of the last message (most recent first)
      { $sort: { "lastMessage.createdAt": -1, "lastMessage._id": -1 } },
      {
        $facet: {
          conversations: [
            { $skip: skip },
            { $limit: limit },
            // Step 6: Join user profile data for the other person
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "userDetails",
              },
            },

            // Step 7: Flatten the userDetails array into a single object
            { $unwind: "$userDetails" },

            // Step 8: Shape the output — only pick fields the frontend needs
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
          ],
          metadata: [{ $count: "total" }],
        },
      },
      {
        $project: {
          conversations: 1,
          total: {
            $ifNull: [{ $arrayElemAt: ["$metadata.total", 0] }, 0],
          },
        },
      },
    ]);
    const result = Array.isArray(conversations[0]?.conversations)
      ? conversations[0]
      : { conversations, total: conversations.length };
    const payload = {
      success: true,
      conversations: result.conversations,
      pagination: buildPaginationMeta({
        page,
        limit,
        total: result.total,
      }),
    };

    await writeJsonCache(cacheKey, payload, 30);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Error in getConversations", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
