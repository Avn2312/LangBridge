import mongoose from "mongoose";

const learningActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    type: {
      type: String,
      enum: ["correction", "partner_correction", "translation", "saved_phrase"],
      required: true,
    },
    sourceText: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    resultText: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    sourceLanguage: {
      type: String,
      trim: true,
      default: "",
    },
    targetLanguage: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

learningActivitySchema.index({ user: 1, type: 1, createdAt: -1 });
learningActivitySchema.index({ user: 1, createdAt: -1 });
learningActivitySchema.index({ user: 1, message: 1, createdAt: -1 });
learningActivitySchema.index({ user: 1, partner: 1, createdAt: -1 });

const LearningActivity = mongoose.model(
  "LearningActivity",
  learningActivitySchema,
);

export default LearningActivity;
