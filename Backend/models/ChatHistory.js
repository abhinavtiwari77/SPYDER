const mongoose = require("mongoose");

const chatHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    response: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16000,
    },
    model: {
      type: String,
      default: "groq",
      trim: true,
    },
    tokenUsage: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
    metadata: {
      route: { type: String, default: "nextai" },
      source: { type: String, default: "web" },
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

chatHistorySchema.index({ user: 1, conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
