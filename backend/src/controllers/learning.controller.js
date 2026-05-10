import mongoose from "mongoose";
import LearningActivity from "../models/LearningActivity.js";
import Message from "../models/Message.js";
import { sendError } from "../lib/apiResponse.js";
import { logger } from "../lib/logger.js";
import {
  createContextAwareTranslation,
  createCorrection,
} from "../lib/languageAssist.js";
import { getBlockState } from "../lib/blocking.js";
import { getIO } from "../lib/socket.js";

const normalizeText = (value, maxLength = 2000) =>
  String(value || "").trim().slice(0, maxLength);

const normalizeObjectId = (value) => {
  if (!value) return null;
  const id = String(value);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
};

const serializeCorrectionActivity = (activity) => ({
  _id: activity._id,
  user: activity.user,
  partner: activity.partner,
  message: activity.message,
  type: activity.type,
  originalText: activity.sourceText,
  correctedText: activity.resultText,
  note: activity.metadata?.note || "",
  status: activity.metadata?.status || "active",
  author: activity.metadata?.author || activity.partner,
  receiver: activity.metadata?.receiver || activity.user,
  createdAt: activity.createdAt,
  updatedAt: activity.updatedAt,
});

// Learning routes create annotations owned by the learner. They may reference a
// Message, but they never rewrite Message.text or change chat delivery state.
export async function correctMessageController(req, res) {
  try {
    const text = normalizeText(req.body?.text);
    const tone = String(req.body?.tone || "friendly").trim();
    const messageId = req.body?.messageId;
    let partnerId = normalizeObjectId(req.body?.partnerId);
    let sourceText = text;
    let message = null;

    if (messageId) {
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return sendError(res, 400, "messageId is invalid.", {
          code: "INVALID_MESSAGE_ID",
        });
      }

      message = await Message.findById(messageId).lean();
      if (!message) {
        return sendError(res, 404, "Message not found.", {
          code: "MESSAGE_NOT_FOUND",
        });
      }

      const myId = req.user._id.toString();
      const senderId = message.sender.toString();
      const receiverId = message.receiver.toString();
      if (senderId !== myId && receiverId !== myId) {
        return sendError(res, 403, "You cannot correct this message.", {
          code: "CORRECTION_FORBIDDEN",
        });
      }

      partnerId = senderId === myId ? receiverId : senderId;
      sourceText = message.text;
    }

    if (!sourceText) {
      return sendError(res, 400, "Text is required.", {
        code: "CORRECTION_TEXT_REQUIRED",
      });
    }

    if (req.body?.partnerId && !partnerId) {
      return sendError(res, 400, "partnerId is invalid.", {
        code: "INVALID_PARTNER_ID",
      });
    }

    if (partnerId) {
      const blockState = await getBlockState(req.user._id, partnerId);
      if (blockState.isBlockedEitherWay) {
        return sendError(res, 403, "Cannot correct a blocked conversation.", {
          code: "CORRECTION_BLOCKED",
        });
      }
    }

    const correction = createCorrection({ text: sourceText, tone });
    const activity = await LearningActivity.create({
      user: req.user._id,
      partner: partnerId,
      message: message?._id || null,
      type: "correction",
      sourceText: correction.original,
      resultText: correction.corrected,
      targetLanguage: req.user.learningLanguage || "",
      metadata: {
        tone: correction.tone,
        explanation: correction.explanation,
        changes: correction.changes,
      },
    });

    return res.status(200).json({
      success: true,
      correction,
      activityId: activity._id,
    });
  } catch (error) {
    logger.error("Error in correctMessageController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function createPartnerCorrectionController(req, res) {
  try {
    const messageId = req.body?.messageId;
    const correctedText = normalizeText(req.body?.correctedText);
    const note = normalizeText(req.body?.note, 500);

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return sendError(res, 400, "messageId is invalid.", {
        code: "INVALID_MESSAGE_ID",
      });
    }

    if (!correctedText) {
      return sendError(res, 400, "Corrected text is required.", {
        code: "CORRECTED_TEXT_REQUIRED",
      });
    }

    const message = await Message.findById(messageId).lean();
    if (!message) {
      return sendError(res, 404, "Message not found.", {
        code: "MESSAGE_NOT_FOUND",
      });
    }

    const myId = req.user._id.toString();
    const senderId = message.sender.toString();
    const receiverId = message.receiver.toString();

    if (senderId === myId) {
      return sendError(res, 403, "You cannot partner-correct your own message.", {
        code: "CANNOT_CORRECT_OWN_MESSAGE",
      });
    }

    if (receiverId !== myId) {
      return sendError(res, 403, "You cannot correct this message.", {
        code: "PARTNER_CORRECTION_FORBIDDEN",
      });
    }

    const originalText = normalizeText(message.text);
    if (!originalText) {
      return sendError(res, 400, "Only text messages can be corrected.", {
        code: "MESSAGE_TEXT_REQUIRED",
      });
    }

    const blockState = await getBlockState(req.user._id, senderId);
    if (blockState.isBlockedEitherWay) {
      return sendError(res, 403, "Cannot correct a blocked conversation.", {
        code: "CORRECTION_BLOCKED",
      });
    }

    const activity = await LearningActivity.create({
      user: senderId,
      partner: req.user._id,
      message: message._id,
      type: "partner_correction",
      sourceText: originalText,
      resultText: correctedText,
      targetLanguage: req.user.nativeLanguage || req.user.learningLanguage || "",
      metadata: {
        author: req.user._id,
        receiver: senderId,
        note,
        status: "active",
      },
    });
    const correction = serializeCorrectionActivity(activity.toObject());

    try {
      getIO().to(senderId).emit("newCorrection", correction);
      getIO().to(myId).emit("newCorrection", correction);
    } catch (socketError) {
      logger.error("Socket emit failed (newCorrection)", socketError);
    }

    return res.status(201).json({
      success: true,
      correction,
      activityId: activity._id,
    });
  } catch (error) {
    logger.error("Error in createPartnerCorrectionController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getPartnerCorrectionsController(req, res) {
  try {
    const partnerId = normalizeObjectId(req.query?.partnerId);

    if (req.query?.partnerId && !partnerId) {
      return sendError(res, 400, "partnerId is invalid.", {
        code: "INVALID_PARTNER_ID",
      });
    }

    const filter = {
      type: "partner_correction",
      $or: partnerId
        ? [
            { user: req.user._id, partner: partnerId },
            { user: partnerId, partner: req.user._id },
          ]
        : [{ user: req.user._id }, { partner: req.user._id }],
    };

    const activities = await LearningActivity.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      corrections: activities.map(serializeCorrectionActivity),
    });
  } catch (error) {
    logger.error("Error in getPartnerCorrectionsController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function translateMessageController(req, res) {
  try {
    const targetLanguage = normalizeText(
      req.body?.targetLanguage || req.user.nativeLanguage || "english",
      80,
    );
    const messageId = req.body?.messageId;
    let text = normalizeText(req.body?.text);
    let partnerId = normalizeObjectId(req.body?.partnerId);
    let message = null;

    if (req.body?.partnerId && !partnerId) {
      return sendError(res, 400, "partnerId is invalid.", {
        code: "INVALID_PARTNER_ID",
      });
    }

    if (messageId) {
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return sendError(res, 400, "messageId is invalid.", {
          code: "INVALID_MESSAGE_ID",
        });
      }

      message = await Message.findById(messageId).lean();
      if (!message) {
        return sendError(res, 404, "Message not found.", {
          code: "MESSAGE_NOT_FOUND",
        });
      }

      const myId = req.user._id.toString();
      const senderId = message.sender.toString();
      const receiverId = message.receiver.toString();
      if (senderId !== myId && receiverId !== myId) {
        return sendError(res, 403, "You cannot translate this message.", {
          code: "TRANSLATION_FORBIDDEN",
        });
      }

      partnerId = senderId === myId ? receiverId : senderId;
      text = message.text;
    }

    if (!text) {
      return sendError(res, 400, "Text is required.", {
        code: "TRANSLATION_TEXT_REQUIRED",
      });
    }

    if (partnerId) {
      const blockState = await getBlockState(req.user._id, partnerId);
      if (blockState.isBlockedEitherWay) {
        return sendError(res, 403, "Cannot translate a blocked conversation.", {
          code: "TRANSLATION_BLOCKED",
        });
      }
    }

    const contextMessages = partnerId
      ? await Message.find({
          $or: [
            { sender: req.user._id, receiver: partnerId },
            { sender: partnerId, receiver: req.user._id },
          ],
        })
          .sort({ createdAt: -1, _id: -1 })
          .limit(8)
          .select("text sender receiver createdAt")
          .lean()
      : [];

    const translation = createContextAwareTranslation({
      text,
      targetLanguage,
      contextMessages: contextMessages.reverse(),
    });
    const activity = await LearningActivity.create({
      user: req.user._id,
      partner: partnerId,
      message: message?._id || null,
      type: "translation",
      sourceText: translation.original,
      resultText: translation.translated,
      targetLanguage: translation.targetLanguage,
      metadata: {
        confidence: translation.confidence,
        contextHint: translation.contextHint,
      },
    });

    return res.status(200).json({
      success: true,
      translation,
      activityId: activity._id,
    });
  } catch (error) {
    logger.error("Error in translateMessageController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function savePhraseController(req, res) {
  try {
    const phrase = normalizeText(req.body?.phrase, 500);
    const partnerId = normalizeObjectId(req.body?.partnerId);
    const messageId = normalizeObjectId(req.body?.messageId);

    if (!phrase) {
      return sendError(res, 400, "Phrase is required.", {
        code: "PHRASE_REQUIRED",
      });
    }

    if (req.body?.partnerId && !partnerId) {
      return sendError(res, 400, "partnerId is invalid.", {
        code: "INVALID_PARTNER_ID",
      });
    }

    if (req.body?.messageId && !messageId) {
      return sendError(res, 400, "messageId is invalid.", {
        code: "INVALID_MESSAGE_ID",
      });
    }

    const activity = await LearningActivity.create({
      user: req.user._id,
      partner: partnerId,
      message: messageId,
      type: "saved_phrase",
      sourceText: phrase,
      resultText: phrase,
      targetLanguage: req.body?.language || req.user.learningLanguage || "",
    });

    return res.status(201).json({ success: true, phrase: activity });
  } catch (error) {
    logger.error("Error in savePhraseController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function getLearningDashboardController(req, res) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [recentActivities, weeklyCounts, totalSavedPhrases] =
      await Promise.all([
        LearningActivity.find({ user: req.user._id })
          .sort({ createdAt: -1, _id: -1 })
          .limit(20)
          .lean(),
        LearningActivity.aggregate([
          { $match: { user: req.user._id, createdAt: { $gte: since } } },
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
            },
          },
        ]),
        LearningActivity.countDocuments({
          user: req.user._id,
          type: "saved_phrase",
        }),
      ]);

    const weekly = weeklyCounts.reduce(
      (acc, item) => ({ ...acc, [item._id]: item.count }),
      {},
    );
    const activeDays = new Set(
      recentActivities
        .filter((activity) => new Date(activity.createdAt) >= since)
        .map((activity) => new Date(activity.createdAt).toISOString().slice(0, 10)),
    );

    return res.status(200).json({
      success: true,
      summary: {
        corrections: (weekly.correction || 0) + (weekly.partner_correction || 0),
        translations: weekly.translation || 0,
        savedPhrases: totalSavedPhrases,
        activeDays: activeDays.size,
        weeklyProgress:
          (weekly.correction || 0) +
          (weekly.partner_correction || 0) +
          (weekly.translation || 0) +
          (weekly.saved_phrase || 0),
      },
      recentActivities,
    });
  } catch (error) {
    logger.error("Error in getLearningDashboardController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}