const tf = require("@tensorflow/tfjs");
const nsfwjs = require("nsfwjs");
const JimpLib = require("jimp");

const Jimp = JimpLib.Jimp || JimpLib;
const MODEL_SIZE = Number(process.env.NSFW_MODEL_SIZE || 224);
const HIGH_RISK_THRESHOLD = Number(process.env.NSFW_HIGH_THRESHOLD || 0.72);
const MEDIUM_RISK_THRESHOLD = Number(process.env.NSFW_MEDIUM_THRESHOLD || 0.45);

let modelPromise = null;

function safeProbability(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function buildScoreMap(predictions = []) {
  const map = {
    Drawing: 0,
    Hentai: 0,
    Neutral: 0,
    Porn: 0,
    Sexy: 0,
  };

  predictions.forEach((item) => {
    const key = String(item.className || "");
    if (!(key in map)) return;
    map[key] = safeProbability(item.probability);
  });

  return map;
}

function computeRisk(scores) {
  // Weighted aggregate to reduce noisy single-class spikes.
  const weighted = scores.Porn * 1.0 + scores.Hentai * 0.9 + scores.Sexy * 0.55;
  const clamped = Math.max(0, Math.min(1, weighted));

  let verdict = "clean";
  if (clamped >= HIGH_RISK_THRESHOLD) {
    verdict = "high-risk";
  } else if (clamped >= MEDIUM_RISK_THRESHOLD) {
    verdict = "review";
  }

  return {
    riskScore: Number(clamped.toFixed(4)),
    verdict,
  };
}

async function ensureModel() {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    await tf.setBackend("cpu");
    await tf.ready();

    const modelPath = process.env.NSFW_MODEL_URL || undefined;
    const loaded = await nsfwjs.load(modelPath, { size: MODEL_SIZE });
    return loaded;
  })().catch((error) => {
    modelPromise = null;
    throw error;
  });

  return modelPromise;
}

async function imageBufferToTensor(buffer) {
  const image = await Jimp.read(buffer);
  image.cover({ w: MODEL_SIZE, h: MODEL_SIZE });

  const { data, width, height } = image.bitmap;
  const values = new Float32Array(width * height * 3);

  for (let src = 0, dst = 0; src < data.length; src += 4) {
    values[dst++] = data[src] / 255;
    values[dst++] = data[src + 1] / 255;
    values[dst++] = data[src + 2] / 255;
  }

  return tf.tensor3d(values, [height, width, 3], "float32");
}

async function analyzeImageBuffer(buffer, meta = {}) {
  if (!buffer || !buffer.length) {
    throw new Error("Empty image payload");
  }

  const model = await ensureModel();
  const tensor = await imageBufferToTensor(buffer);

  try {
    const predictions = await model.classify(tensor);
    const scores = buildScoreMap(predictions);
    const risk = computeRisk(scores);

    return {
      ...risk,
      scores,
      topClass: predictions?.[0]?.className || "unknown",
      raw: predictions,
      model: {
        provider: "nsfwjs",
        size: MODEL_SIZE,
      },
      meta,
      ts: Date.now(),
    };
  } finally {
    tensor.dispose();
  }
}

module.exports = {
  analyzeImageBuffer,
  ensureModel,
};
