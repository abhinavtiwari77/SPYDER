require("dotenv").config();
const { callGroqWithFallback } = require("./groqClient");

const systemPrompt =
  "You are a cybersecurity assistant. Reply naturally in strict JSON only: {\"ai_output\":\"...\",\"server_cmd\":\"none|filescan|webscan|nsfwcheck\"}. Use filescan/webscan/nsfwcheck only if explicitly requested, otherwise none.";

function cleanJsonFence(text = "") {
  const trimmed = String(text).trim();
  if (trimmed.startsWith("```json")) return trimmed.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  if (trimmed.startsWith("```")) return trimmed.replace(/^```\s*/, "").replace(/\s*```$/, "");
  return trimmed;
}

function detectServerCommand(text) {
  const query = String(text || "").toLowerCase();
  if (/\b(nsfw|explicit image|adult image|inappropriate image)\b/.test(query)) return "nsfwcheck";
  if (/\b(scan file|upload file|analy[sz]e file|check file|malware file|virus file)\b/.test(query)) return "filescan";
  if (/\b(scan website|check website|url scan|is this website safe|web security|site security)\b/.test(query)) return "webscan";
  return "none";
}

function buildFallbackAnswer(userQuery) {
  const cmd = detectServerCommand(userQuery);
  if (cmd === "filescan") {
    return {
      ai_output: "I can help with file triage. Upload a file and I will trigger the scanning workflow.",
      server_cmd: cmd,
    };
  }
  if (cmd === "webscan") {
    return {
      ai_output: "I can help you assess website risk signals. Share the URL and I will guide the scan flow.",
      server_cmd: cmd,
    };
  }
  if (cmd === "nsfwcheck") {
    return {
      ai_output: "I can help with NSFW moderation checks. Provide content and I will trigger analysis.",
      server_cmd: cmd,
    };
  }
  return {
    ai_output:
      "Groq is temporarily unavailable or rate-limited, but fallback mode is active. You can continue with security triage questions.",
    server_cmd: "none",
  };
}

function buildErrorFallback(userQuery, errorMessage) {
  const authError = /authentication failed|invalid api key|\(401\)/i.test(String(errorMessage || ""));
  if (authError) {
    return {
      ai_output: "Groq API authentication failed. Update GROQ_API_KEY in Backend/.env and restart the backend server.",
      server_cmd: "none",
    };
  }
  return buildFallbackAnswer(userQuery);
}

async function groqResp(q) {
  try {
    if (!q || typeof q !== "string" || !q.trim()) {
      return {
        answer: {
          ai_output: "Please enter a valid message.",
          server_cmd: "none",
        },
      };
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: q.trim() },
    ];

    const { output } = await callGroqWithFallback({
      messages,
      maxTokens: Number(process.env.GROQ_CHAT_MAX_TOKENS || 700),
      temperature: Number(process.env.GROQ_CHAT_TEMPERATURE || 0.7),
    });

    const cleaned = cleanJsonFence(output);
    try {
      const parsed = JSON.parse(cleaned);
      return {
        answer: {
          ai_output: parsed.ai_output || parsed.text || cleaned,
          server_cmd: parsed.server_cmd || "none",
        },
      };
    } catch {
      return {
        answer: {
          ai_output: cleaned,
          server_cmd: "none",
        },
      };
    }
  } catch (error) {
    console.error("Groq chat failed:", error.message);
    return {
      answer: buildErrorFallback(q, error.message),
    };
  }
}

module.exports = groqResp;
