require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
const app = express();
const connectDB = require("./config/db");
require("./config/passport");
const { uploadAndScanFile } = require("./fileScan");
const groqResp = require("./groqResp");
const groqResp2 = require("./groqResp2");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const nsfwRoutes = require("./routes/nsfwRoutes");
const {
  scanDomain,
  scanIp,
  scanFileHash,
  scanUrl,
  uploadFileAndScan,
  postCommunityComment,
  autoShareIfNeeded,
} = require("./threatIntel");

const SUPPORTED_INTEL_TYPES = new Set(["domain", "ip", "url", "fileHash"]);
const SUPPORTED_COMMUNITY_TYPES = new Set(["file", "url", "domain", "ip_address"]);

function normalizeType(type) {
  return String(type || "").trim();
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return fallback;
}

async function scanIntelByType(type, value) {
  if (type === "domain") return scanDomain(value);
  if (type === "ip") return scanIp(value);
  if (type === "url") return scanUrl(value);
  if (type === "fileHash") return scanFileHash(value);
  throw new Error("Unsupported type");
}

function removeUploadedFile(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.warn(`Failed to delete uploaded file ${filePath}:`, err.message);
    }
  });
}

// uploadAndScanFile("./prompt.txt");

// Basic security middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

const allowedOrigins = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(",").map((item) => item.trim())
  : true;

// Configure CORS - more permissive for development
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // save files to 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, "fileToScan" + path.extname(file.originalname)); // unique filename
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 32 * 1024 * 1024 },
});

// Handle preflight requests
app.options('*', cors());

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

// Session support is required for Passport OAuth handshakes.
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/nsfw", nsfwRoutes);

async function handleChatRequest(req, res) {
  try {
    const { q } = req.body;
    if (!q) {
      return res.status(400).json({ error: "Missing query parameter" });
    }

    const response = await groqResp(q);
    console.log("Groq Response:", response);

    const safeResponse =
      response && response.answer
        ? response
        : {
            answer: {
              ai_output:
                "Groq is temporarily unavailable. Fallback mode is active. Please retry shortly.",
              server_cmd: "none",
            },
          };

    return res.json(safeResponse);
  } catch (error) {
    console.error("Error in /groqChat:", error);
    return res.status(200).json({
      answer: {
        ai_output:
          "Groq request failed due to temporary API limits. Please wait a moment and try again.",
        server_cmd: "none",
      },
    });
  }
}

app.post("/groqChat", handleChatRequest);
app.post("/geminiChat", handleChatRequest);

app.post("/scanFile", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("Uploaded file:", req.file);

    const scanResult = await uploadAndScanFile(req.file.path);
    console.log("Scan result:", scanResult);

    if (!scanResult?.success) {
      const failedAnalysis = await groqResp2(scanResult);
      return res.status(200).json({
        answer: {
          ai_output: failedAnalysis.ai_output,
          server_cmd: "none",
        },
        vt: {
          success: false,
          error: scanResult.error || "VirusTotal scan failed",
          details: scanResult.details || null,
          analysisId: scanResult.analysisId || null,
        },
      });
    }

    const response = await groqResp2(scanResult.data);
    console.log("Groq Response:", response);

    // Ensure the response has the expected structure
    if (!response || !response.ai_output) {
      throw new Error("Invalid response structure from Groq analysis");
    }

    return res.json({
      answer: {
        ai_output: response.ai_output,
        server_cmd: response.server_cmd || "none"
      },
      vt: {
        success: true,
        ...scanResult.data,
      },
    });
  } catch (error) {
    console.error("Error in /scanFile:", error);

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: "Maximum file size is 32MB for VirusTotal free tier",
      });
    }

    return res.status(500).json({ 
      error: "Failed to process file",
      message: error.message 
    });
  } finally {
    removeUploadedFile(req.file?.path);
  }
});

app.post("/intel/scan", async (req, res) => {
  try {
    const { type, value } = req.body;
    const normalizedType = normalizeType(type);
    const normalizedValue = String(value || "").trim();
    const autoShare = parseBoolean(req.body?.autoShare, true);

    if (!normalizedType || !normalizedValue) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Provide both type and value",
      });
    }

    if (!SUPPORTED_INTEL_TYPES.has(normalizedType)) {
      return res.status(400).json({
        error: "Unsupported type",
        message: "Supported types are: domain, ip, url, fileHash",
      });
    }

    const intel = await scanIntelByType(normalizedType, normalizedValue);

    let shareStatus = { attempted: false, reason: "disabled_by_request" };
    if (autoShare) {
      shareStatus = await autoShareIfNeeded(intel);
    }

    return res.json({
      ...intel,
      shareStatus,
    });
  } catch (error) {
    console.error("Error in /intel/scan:", error);
    return res.status(error.status || 500).json({
      error: "Threat intel scan failed",
      message: error.message,
    });
  }
});

app.post("/intel/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const intel = await uploadFileAndScan(req.file.path);
    const autoShare = parseBoolean(req.body?.autoShare, true);
    let shareStatus = { attempted: false, reason: "disabled_by_request" };
    if (autoShare) {
      shareStatus = await autoShareIfNeeded(intel);
    }

    return res.json({
      ...intel,
      shareStatus,
    });
  } catch (error) {
    console.error("Error in /intel/file:", error);
    return res.status(error.status || 500).json({
      error: "File threat intel scan failed",
      message: error.message,
    });
  } finally {
    removeUploadedFile(req.file?.path);
  }
});

app.post("/intel/bulk", async (req, res) => {
  try {
    const { items } = req.body;
    const autoShare = parseBoolean(req.body?.autoShare, true);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Invalid payload",
        message: "items must be a non-empty array",
      });
    }

    if (items.length > 25) {
      return res.status(400).json({
        error: "Too many items",
        message: "Maximum of 25 items allowed per bulk request",
      });
    }

    const results = [];
    for (const item of items) {
      const normalizedType = normalizeType(item?.type);
      const normalizedValue = String(item?.value || "").trim();
      if (!normalizedType || !normalizedValue) {
        results.push({
          success: false,
          type: normalizedType,
          value: normalizedValue,
          error: "Missing type or value",
        });
        continue;
      }

      if (!SUPPORTED_INTEL_TYPES.has(normalizedType)) {
        results.push({
          success: false,
          type: normalizedType,
          value: normalizedValue,
          error: "Unsupported type",
        });
        continue;
      }

      try {
        const intel = await scanIntelByType(normalizedType, normalizedValue);

        let shareStatus = { attempted: false, reason: "disabled_by_request" };
        if (autoShare) {
          shareStatus = await autoShareIfNeeded(intel);
        }

        results.push({ ...intel, shareStatus });
      } catch (itemError) {
        results.push({
          success: false,
          type: normalizedType,
          value: normalizedValue,
          error: itemError.message,
        });
      }
    }

    return res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in /intel/bulk:", error);
    return res.status(500).json({
      error: "Bulk threat intel scan failed",
      message: error.message,
    });
  }
});

app.post("/intel/share", async (req, res) => {
  try {
    const itemType = normalizeType(req.body?.itemType);
    const itemId = String(req.body?.itemId || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!itemType || !itemId || !text) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Provide itemType, itemId and text",
      });
    }

    if (!SUPPORTED_COMMUNITY_TYPES.has(itemType)) {
      return res.status(400).json({
        error: "Unsupported itemType",
        message: "Supported itemType values are: file, url, domain, ip_address",
      });
    }

    const response = await postCommunityComment({ itemType, itemId, text });
    return res.json(response);
  } catch (error) {
    console.error("Error in /intel/share:", error);
    return res.status(error.status || 500).json({
      error: "Sharing to community failed",
      message: error.message,
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Not found handler
app.use((req, res, next) => {
  res.status(404).json({ 
    error: "Not Found",
    message: `Cannot ${req.method} ${req.url}` 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  
  // Handle specific types of errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: "File Upload Error",
      message: err.message
    });
  }
  
  if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: "Invalid JSON",
      message: "The request body contains invalid JSON"
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({
    error: err.status === 400 ? "Bad Request" : "Internal Server Error",
    message: err.message || "Something went wrong"
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing process or change PORT in Backend/.env.`);
      } else {
        console.error("Server failed to start:", error.message);
      }

      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
