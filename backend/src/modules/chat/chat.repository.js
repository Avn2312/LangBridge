import Message from "../../shared/models/Message.js";
import { countMatchingDocuments } from "../../core/http/pagination.js";

export async function findMessagesBetweenUsers({
  viewerId,
  otherUserId,
  skip,
  limit,
}) {
  const filter = {
    $or: [
      { sender: viewerId, receiver: otherUserId },
      { sender: otherUserId, receiver: viewerId },
    ],
  };

  const [messages, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    countMatchingDocuments(Message, filter),
  ]);

  return { messages, total };
}

export function markMessagesRead({ senderId, receiverId }) {
  return Message.updateMany(
    { sender: senderId, receiver: receiverId, read: false },
    { $set: { read: true, readAt: new Date() } },
  ).exec();
}

export function markMessagesReadAt({ senderId, receiverId, readAt }) {
  return Message.updateMany(
    { sender: senderId, receiver: receiverId, read: false },
    { $set: { read: true, readAt } },
  );
}

export function findMessageByClientMessageId({ senderId, clientMessageId }) {
  return Message.findOne({
    sender: senderId,
    clientMessageId,
  });
}

export function createMessage({
  senderId,
  receiverId,
  text,
  attachments,
  clientMessageId,
}) {
  return Message.create({
    sender: senderId,
    receiver: receiverId,
    text,
    attachments,
    clientMessageId: clientMessageId || undefined,
  });
}

export async function aggregateConversationsForUser({ userId, skip, limit }) {
  const conversations = await Message.aggregate([
    {
      $match: {
        $or: [{ sender: userId }, { receiver: userId }],
      },
    },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $addFields: {
        otherUser: {
          $cond: {
            if: { $eq: ["$sender", userId] },
            then: "$receiver",
            else: "$sender",
          },
        },
      },
    },
    {
      $group: {
        _id: "$otherUser",
        lastMessage: { $first: "$$ROOT" },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$receiver", userId] },
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
    { $sort: { "lastMessage.createdAt": -1, "lastMessage._id": -1 } },
    {
      $facet: {
        conversations: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "userDetails",
            },
          },
          { $unwind: "$userDetails" },
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
                isFromMe: { $eq: ["$lastMessage.sender", userId] },
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

  return conversations[0] || { conversations: [], total: 0 };
}