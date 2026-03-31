require("dotenv").config();
const { callGroqWithFallback } = require("./groqClient");

const systemPrompt =
  "You analyze file security scan data. Reply naturally in strict JSON only: {\"ai_output\":\"...\",\"server_cmd\":\"none\"}. Keep guidance concise and actionable.";

function cleanJsonFence(text = "") {
  const trimmed = String(text).trim();
  if (trimmed.startsWith("```json")) return trimmed.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  if (trimmed.startsWith("```")) return trimmed.replace(/^```\s*/, "").replace(/\s*```$/, "");
  return trimmed;
}

async function groqResp2(scanPayload) {
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Analyze this file scan payload and summarize risk: ${JSON.stringify(scanPayload)}`,
      },
    ];

    const { output } = await callGroqWithFallback({
      messages,
      maxTokens: Number(process.env.GROQ_FILE_MAX_TOKENS || 600),
      temperature: Number(process.env.GROQ_FILE_TEMPERATURE || 0.4),
    });

    const cleaned = cleanJsonFence(output);
    try {
      const parsed = JSON.parse(cleaned);
      return {
        ai_output: parsed.ai_output || cleaned,
        server_cmd: "none",
      };
    } catch {
      return {
        ai_output: cleaned,
        server_cmd: "none",
      };
    }
  } catch (error) {
    console.error("Groq file analysis failed:", error.message);
    return {
      ai_output: "Groq file analysis is temporarily unavailable. Please retry in a moment.",
      server_cmd: "none",
    };
  }
}

module.exports = groqResp2;
