require("dotenv").config();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const COOLDOWN_MS = Number(process.env.GROQ_COOLDOWN_MS || 60000);

let cooldownUntil = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY || "";
}

function getGroqModels() {
  return (process.env.GROQ_MODELS || "openai/gpt-oss-120b,llama-3.3-70b-versatile,llama-3.1-8b-instant")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getReasoningEffort() {
  const value = String(process.env.GROQ_REASONING_EFFORT || "medium").trim().toLowerCase();
  if (["none", "low", "medium", "high"].includes(value)) return value;
  return "medium";
}

function parseErrorBody(bodyText) {
  try {
    const parsed = JSON.parse(bodyText || "{}");
    return parsed?.error?.message || bodyText;
  } catch {
    return bodyText;
  }
}

async function callSingleModel({ apiKey, model, messages, maxRetries, maxTokens = 700, temperature = 0.7 }) {
  const body = {
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    top_p: Number(process.env.GROQ_TOP_P || 1),
    reasoning_effort: getReasoningEffort(),
    stream: false,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      const message = parseErrorBody(text);
      const retryable = RETRYABLE_STATUSES.has(response.status);

      if (response.status === 429) {
        cooldownUntil = Math.max(cooldownUntil, Date.now() + COOLDOWN_MS);
      }

      if (retryable && attempt < maxRetries) {
        await sleep(700 * (attempt + 1));
        continue;
      }

      throw new Error(`Groq ${model} failed (${response.status}): ${message}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      if (attempt < maxRetries) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      throw new Error(`Groq ${model} returned empty content`);
    }

    return String(content).trim();
  }

  throw new Error("Groq retries exhausted");
}

async function callGroqWithFallback({ messages, maxTokens = 700, temperature = 0.7 }) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY in environment variables");
  }

  const models = getGroqModels();
  const maxRetries = Number(process.env.GROQ_MAX_RETRIES || 2);
  const errors = [];

  if (Date.now() < cooldownUntil) {
    throw new Error("Groq is temporarily rate-limited. Cooldown active.");
  }

  for (const model of models) {
    try {
      const output = await callSingleModel({
        apiKey,
        model,
        messages,
        maxRetries,
        maxTokens,
        temperature,
      });

      return { output, model };
    } catch (error) {
      errors.push(error.message);
    }
  }

  const joined = errors.join(" | ");
  if (/\(401\)|invalid api key/i.test(joined)) {
    throw new Error(`Groq authentication failed. Check GROQ_API_KEY. Details: ${joined}`);
  }
  throw new Error(joined);
}

module.exports = {
  callGroqWithFallback,
};
