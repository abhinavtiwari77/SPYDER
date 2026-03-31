require("dotenv").config();

const fs = require("fs");
const FormData = require("form-data");

const VT_BASE_URL = "https://www.virustotal.com/api/v3";
const VT_GUI_BASE_URL = "https://www.virustotal.com/gui";
const DEFAULT_TIMEOUT_MS = Number(process.env.VT_REQUEST_TIMEOUT_MS || 30000);
const POLL_DELAY_MS = Number(process.env.VT_POLL_DELAY_MS || 4000);
const MAX_POLL_RETRIES = Number(process.env.VT_MAX_POLL_RETRIES || 45);
const AUTO_SHARE_ENABLED = String(process.env.VT_AUTO_SHARE || "false").toLowerCase() === "true";
const AUTO_SHARE_MIN_SCORE = Number(process.env.VT_AUTO_SHARE_MIN_MALICIOUS || 2);
const AUTO_SHARE_MESSAGE = process.env.VT_AUTO_SHARE_MESSAGE || "Automated alert from Spyder: detected as suspicious/malicious by multiple engines. Please investigate.";

function getApiKey() {
  const apiKey = process.env.VT_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VT_API_KEY in environment variables");
  }
  return apiKey;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function vtRequest(path, options = {}) {
  const apiKey = getApiKey();
  const url = `${VT_BASE_URL}${path}`;
  const headers = {
    "x-apikey": apiKey,
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    const message = `VirusTotal request failed (${response.status} ${response.statusText}): ${body}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function normalizeVerdict(stats = {}) {
  const malicious = Number(stats.malicious || 0);
  const suspicious = Number(stats.suspicious || 0);
  const undetected = Number(stats.undetected || 0);
  const harmless = Number(stats.harmless || 0);

  let verdict = "clean";
  if (malicious > 0) {
    verdict = "malicious";
  } else if (suspicious > 0) {
    verdict = "suspicious";
  }

  return {
    verdict,
    score: malicious,
    stats: {
      malicious,
      suspicious,
      harmless,
      undetected,
      timeout: Number(stats.timeout || 0),
      failure: Number(stats.failure || 0),
      confirmed_timeout: Number(stats["confirmed-timeout"] || 0),
      type_unsupported: Number(stats["type-unsupported"] || 0),
    },
  };
}

function extractTopDetections(results = {}, limit = 10) {
  return Object.entries(results)
    .filter(([, item]) => item && (item.category === "malicious" || item.category === "suspicious"))
    .slice(0, limit)
    .map(([engine, item]) => ({
      engine,
      category: item.category,
      result: item.result || "n/a",
      method: item.method || "n/a",
      version: item.engine_version || item.version || "n/a",
    }));
}

function getGuiLink(type, id) {
  if (!type || !id) return null;
  if (type === "ip") return `${VT_GUI_BASE_URL}/ip-address/${id}`;
  if (type === "domain") return `${VT_GUI_BASE_URL}/domain/${id}`;
  if (type === "url") return `${VT_GUI_BASE_URL}/url/${id}`;
  if (type === "file" || type === "fileHash") return `${VT_GUI_BASE_URL}/file/${id}`;
  return null;
}

function mapIntelTypeToVtType(type) {
  if (type === "ip") return "ip_address";
  if (type === "domain") return "domain";
  if (type === "url") return "url";
  if (type === "file" || type === "fileHash") return "file";
  return null;
}

function encodeUrlId(url) {
  return Buffer.from(url)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function pollAnalysis(analysisId) {
  for (let i = 0; i < MAX_POLL_RETRIES; i += 1) {
    const analysis = await vtRequest(`/analyses/${analysisId}`);
    const status = analysis?.data?.attributes?.status;

    if (status === "completed") {
      return analysis;
    }

    await delay(POLL_DELAY_MS);
  }

  throw new Error(`VirusTotal analysis timeout for id ${analysisId}`);
}

function buildIntelResponse({ type, value, vtObject, source }) {
  const attrs = vtObject?.data?.attributes || {};
  const links = vtObject?.data?.links || {};
  const normalized = normalizeVerdict(attrs.last_analysis_stats || attrs.stats || {});
  const id = vtObject?.data?.id;
  const communityItemType = mapIntelTypeToVtType(type);

  return {
    success: true,
    type,
    value,
    source,
    id,
    communityItemType,
    verdict: normalized.verdict,
    maliciousScore: normalized.score,
    stats: normalized.stats,
    reputation: attrs.reputation,
    tags: attrs.tags || [],
    lastAnalysisDate: attrs.last_analysis_date || attrs.date || null,
    topDetections: extractTopDetections(attrs.last_analysis_results || attrs.results || {}),
    vtLink: links.self || null,
    vtGuiLink: getGuiLink(type, id),
    raw: vtObject,
  };
}

async function scanDomain(domain) {
  const vtObject = await vtRequest(`/domains/${encodeURIComponent(domain)}`);
  return buildIntelResponse({ type: "domain", value: domain, vtObject, source: "lookup" });
}

async function scanIp(ip) {
  const vtObject = await vtRequest(`/ip_addresses/${encodeURIComponent(ip)}`);
  return buildIntelResponse({ type: "ip", value: ip, vtObject, source: "lookup" });
}

async function scanFileHash(fileHash) {
  const vtObject = await vtRequest(`/files/${encodeURIComponent(fileHash)}`);
  return buildIntelResponse({ type: "fileHash", value: fileHash, vtObject, source: "lookup" });
}

async function scanUrl(url) {
  const body = new URLSearchParams({ url }).toString();

  const submit = await vtRequest("/urls", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const analysisId = submit?.data?.id;
  if (!analysisId) {
    throw new Error("VirusTotal did not return an analysis id for URL");
  }

  const analysis = await pollAnalysis(analysisId);
  const urlId = analysis?.meta?.url_info?.id || encodeUrlId(url);
  const vtObject = await vtRequest(`/urls/${urlId}`);

  return buildIntelResponse({ type: "url", value: url, vtObject, source: "submit+lookup" });
}

async function uploadFileAndScan(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const submit = await vtRequest("/files", {
    method: "POST",
    headers: form.getHeaders(),
    body: form,
  });

  const analysisId = submit?.data?.id;
  if (!analysisId) {
    throw new Error("VirusTotal did not return an analysis id for file upload");
  }

  const analysis = await pollAnalysis(analysisId);
  const fileSha256 = analysis?.meta?.file_info?.sha256;

  if (!fileSha256) {
    const attrs = analysis?.data?.attributes || {};
    const normalized = normalizeVerdict(attrs.stats || {});
    return {
      success: true,
      type: "file",
      value: filePath,
      source: "upload+analysis",
      id: analysisId,
      communityItemType: "file",
      verdict: normalized.verdict,
      maliciousScore: normalized.score,
      stats: normalized.stats,
      reputation: null,
      tags: [],
      lastAnalysisDate: attrs.date || null,
      topDetections: extractTopDetections(attrs.results || {}),
      vtGuiLink: `${VT_GUI_BASE_URL}/file-analysis/${analysisId}`,
      raw: analysis,
    };
  }

  const vtObject = await vtRequest(`/files/${fileSha256}`);
  return buildIntelResponse({ type: "file", value: fileSha256, vtObject, source: "upload+lookup" });
}

async function postCommunityComment({ itemType, itemId, text }) {
  const payload = {
    data: {
      type: "comment",
      attributes: { text },
      relationships: {
        item: {
          data: {
            type: itemType,
            id: itemId,
          },
        },
      },
    },
  };

  const result = await vtRequest("/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return {
    success: true,
    commentId: result?.data?.id,
    itemType,
    itemId,
  };
}

function shouldAutoShare(intel) {
  if (!AUTO_SHARE_ENABLED) {
    return false;
  }

  return Number(intel?.maliciousScore || 0) >= AUTO_SHARE_MIN_SCORE;
}

async function autoShareIfNeeded(intel) {
  if (!shouldAutoShare(intel)) {
    return { attempted: false, reason: "threshold_or_setting_not_met" };
  }

  const vtType = intel.communityItemType || mapIntelTypeToVtType(intel.type);
  if (!vtType || !intel.id) {
    return { attempted: false, reason: "missing_item_type_or_id" };
  }

  const tagsLine = Array.isArray(intel.tags) && intel.tags.length > 0
    ? ` Tags: ${intel.tags.slice(0, 5).join(", ")}.`
    : "";
  const shareText = `${AUTO_SHARE_MESSAGE} IOC type=${intel.type} id=${intel.id} malicious=${intel.maliciousScore}.${tagsLine}`;

  try {
    const share = await postCommunityComment({
      itemType: vtType,
      itemId: intel.id,
      text: shareText,
    });

    return { attempted: true, shared: true, result: share };
  } catch (error) {
    return { attempted: true, shared: false, error: error.message };
  }
}

module.exports = {
  scanDomain,
  scanIp,
  scanFileHash,
  scanUrl,
  uploadFileAndScan,
  postCommunityComment,
  autoShareIfNeeded,
};
