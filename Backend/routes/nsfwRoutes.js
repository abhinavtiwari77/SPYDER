const express = require("express");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const { analyzeImageBuffer, ensureModel } = require("../utils/nsfwService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.NSFW_MAX_IMAGE_SIZE || 5 * 1024 * 1024),
  },
});

router.use(requireAuth);

router.get("/health", async (req, res) => {
  try {
    await ensureModel();
    return res.json({
      success: true,
      status: "ready",
      message: "NSFW model is loaded",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: "error",
      message: error.message,
    });
  }
});

router.post("/analyze-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        error: "No image provided",
      });
    }

    const result = await analyzeImageBuffer(req.file.buffer, {
      source: "upload",
      filename: req.file.originalname || "image",
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Image analysis failed",
      message: error.message,
    });
  }
});

router.post("/analyze-frame", async (req, res) => {
  try {
    const imageBase64 = String(req.body?.imageBase64 || "").trim();
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: "Missing imageBase64",
      });
    }

    const base64Part = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const buffer = Buffer.from(base64Part, "base64");

    if (!buffer.length) {
      return res.status(400).json({
        success: false,
        error: "Invalid frame payload",
      });
    }

    const result = await analyzeImageBuffer(buffer, {
      source: "frame",
      size: buffer.length,
    });

    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Frame analysis failed",
      message: error.message,
    });
  }
});

router.use((error, req, res, next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "Image too large",
      message: "Maximum image size exceeded",
    });
  }

  return next(error);
});

module.exports = router;
