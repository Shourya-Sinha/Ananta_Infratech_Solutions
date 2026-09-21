"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;

const { AppError, ERROR_CODES } = require("../../errors/AppError");

const SEARCH_TTL_MS = 5 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 8000;
const MAX_CACHE_ENTRIES = 200;

// Small in-process cache: the same query typed by several admins in a row
// should not hit YouTube repeatedly.
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Without a desktop UA YouTube serves a consent/stripped page with no results.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new Error(`Upstream responded ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Pulls the ytInitialData JSON blob out of a YouTube results page. */
function extractInitialData(html) {
  const patterns = [
    /ytInitialData"?\s*\]?\s*=\s*(\{.+?\})\s*;\s*<\/script>/s,
    /var\s+ytInitialData\s*=\s*(\{.+?\})\s*;/s,
    /window\["ytInitialData"\]\s*=\s*(\{.+?\})\s*;/s
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    try {
      return JSON.parse(match[1]);
    } catch {
      // Try the next pattern; a greedy match may have swallowed trailing script.
    }
  }
  return null;
}

/** Depth-first walk collecting every videoRenderer, in page order. */
function collectVideoRenderers(node, out = [], depth = 0) {
  if (!node || depth > 30 || out.length >= 60) return out;
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out, depth + 1);
    return out;
  }
  if (typeof node !== "object") return out;
  if (node.videoRenderer?.videoId) out.push(node.videoRenderer);
  for (const key of Object.keys(node)) {
    if (key === "videoRenderer") continue;
    collectVideoRenderers(node[key], out, depth + 1);
  }
  return out;
}

function readText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.simpleText === "string") return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map((run) => run.text ?? "").join("");
  return "";
}

function normaliseScraped(renderer) {
  const thumbs = renderer.thumbnail?.thumbnails ?? [];
  return {
    videoId: renderer.videoId,
    title: readText(renderer.title) || "Untitled video",
    channel: readText(renderer.ownerText) || readText(renderer.longBylineText) || "",
    duration:
      readText(renderer.lengthText) ||
      (renderer.badges?.some((badge) => readText(badge?.metadataBadgeRenderer?.label) === "LIVE") ? "LIVE" : ""),
    views: readText(renderer.shortViewCountText),
    published: readText(renderer.publishedTimeText),
    thumbnail: thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${renderer.videoId}/mqdefault.jpg`
  };
}

async function searchViaScrape(query, limit) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D&hl=en`;
  const html = await fetchText(url);
  const data = extractInitialData(html);
  if (!data) throw new Error("Could not parse YouTube response");

  const seen = new Set();
  const items = [];
  for (const renderer of collectVideoRenderers(data)) {
    if (seen.has(renderer.videoId)) continue;
    seen.add(renderer.videoId);
    items.push(normaliseScraped(renderer));
    if (items.length >= limit) break;
  }
  return items;
}

async function searchViaDataApi(query, limit, apiKey) {
  const url =
    "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true" +
    `&maxResults=${limit}&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`YouTube Data API responded ${response.status}`);
  const payload = await response.json();
  return (payload.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet?.title ?? "Untitled video",
      channel: item.snippet?.channelTitle ?? "",
      duration: "",
      views: "",
      published: item.snippet?.publishedAt ?? "",
      thumbnail:
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`
    }));
}

// Exported for unit tests: the scrape parser is the fragile part of this module.
exports.__testing = { extractInitialData, collectVideoRenderers, normaliseScraped, readText };

exports.MediaService = {
  /**
   * Searches YouTube for embeddable videos. Uses the official Data API when a
   * key is configured and falls back to parsing the public results page, so the
   * feature works out of the box without extra credentials.
   */
  async searchYouTube(query, limit = 12) {
    const trimmed = String(query ?? "").trim();
    if (trimmed.length < 2) throw AppError.validation("Search query must be at least 2 characters.");

    const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 25);
    const cacheKey = `${trimmed.toLowerCase()}::${safeLimit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return { items: cached, cached: true };

    // Read lazily from process.env: the key is optional, so this module stays
    // usable (and unit-testable) without booting the full env config.
    const apiKey = process.env.YOUTUBE_API_KEY;
    const attempts = [];
    if (apiKey) attempts.push(() => searchViaDataApi(trimmed, safeLimit, apiKey));
    attempts.push(() => searchViaScrape(trimmed, safeLimit));

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const items = await attempt();
        if (items.length > 0) {
          cacheSet(cacheKey, items);
          return { items, cached: false };
        }
        lastError = null;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        "YouTube search is unavailable right now. Try again in a moment.",
        502
      );
    }
    return { items: [], cached: false };
  }
};
