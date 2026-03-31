const express = require("express");
const ChatHistory = require("../models/ChatHistory");
const TrackingEvent = require("../models/TrackingEvent");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/history", async (req, res) => {
  try {
    const conversationId = String(req.body?.conversationId || "").trim();
    const prompt = String(req.body?.prompt || "").trim();
    const responseText = String(req.body?.response || "").trim();

    if (!conversationId || !prompt || !responseText) {
      return res.status(400).json({
        error: "Missing fields",
        message: "conversationId, prompt and response are required",
      });
    }

    const doc = await ChatHistory.create({
      user: req.user._id,
      conversationId,
      prompt,
      response: responseText,
      model: String(req.body?.model || "groq"),
      tokenUsage: {
        promptTokens: Number(req.body?.tokenUsage?.promptTokens || 0),
        completionTokens: Number(req.body?.tokenUsage?.completionTokens || 0),
        totalTokens: Number(req.body?.tokenUsage?.totalTokens || 0),
      },
      metadata: {
        route: String(req.body?.metadata?.route || "nextai"),
        source: String(req.body?.metadata?.source || "web"),
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
      },
    });

    return res.status(201).json({
      success: true,
      history: doc,
    });
  } catch (error) {
    console.error("Error saving chat history:", error);
    return res.status(500).json({
      error: "Failed to save chat history",
      message: error.message,
    });
  }
});

router.get("/history", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const conversationId = String(req.query.conversationId || "").trim();

    const filter = { user: req.user._id };
    if (conversationId) filter.conversationId = conversationId;

    const list = await ChatHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await ChatHistory.countDocuments(filter);

    return res.json({
      success: true,
      page,
      limit,
      total,
      history: list,
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    return res.status(500).json({
      error: "Failed to get chat history",
      message: error.message,
    });
  }
});

router.get("/conversations", async (req, res) => {
  try {
    const conversations = await ChatHistory.aggregate([
      { $match: { user: req.user._id } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          latestPrompt: { $first: "$prompt" },
          latestResponse: { $first: "$response" },
          latestAt: { $first: "$createdAt" },
          messageCount: { $sum: 1 },
        },
      },
      { $sort: { latestAt: -1 } },
      { $limit: 100 },
    ]);

    return res.json({ success: true, conversations });
  } catch (error) {
    console.error("Error getting conversations:", error);
    return res.status(500).json({
      error: "Failed to get conversations",
      message: error.message,
    });
  }
});

router.delete("/history/:id", async (req, res) => {
  try {
    const deleted = await ChatHistory.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({
        error: "Not found",
        message: "History item not found",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat history:", error);
    return res.status(500).json({
      error: "Failed to delete history",
      message: error.message,
    });
  }
});

router.post("/tracking", async (req, res) => {
  try {
    const eventType = String(req.body?.eventType || "").trim();

    if (!eventType) {
      return res.status(400).json({
        error: "Missing fields",
        message: "eventType is required",
      });
    }

    const event = await TrackingEvent.create({
      user: req.user._id,
      eventType,
      sessionId: req.body?.sessionId || null,
      metadata: req.body?.metadata || {},
    });

    return res.status(201).json({ success: true, event });
  } catch (error) {
    console.error("Error saving tracking event:", error);
    return res.status(500).json({
      error: "Failed to save tracking event",
      message: error.message,
    });
  }
});

module.exports = router;
