import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Loader2,
  Pause,
  Play,
  Search,
  SkipForward,
  Square,
  Youtube,
  X
} from "lucide-react";
import YouTube from "react-youtube";
import YouTubePlayerFactory from "youtube-player";
import { api } from "@/lib/apiClient";
import { cx } from "@/lib/format";

const VideoContext = createContext(null);

const RECENT_STORAGE_KEY = "ananta_admin_video_recent";
const MAX_RECENT = 6;

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const YT_REFERRER_POLICY = "strict-origin-when-cross-origin";
const IFRAME_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/**
 * Playback tiers, tried in order.
 * The first two are iframes we build ourselves so referrerpolicy is set
 * before navigation (YouTube error 153). The npm players are the fallback
 * the user asked to keep working — they create the iframe themselves, so a
 * src-setter patch forces the same referrer policy onto them.
 */
const TIER_DIRECT = "direct-nocookie";
const TIER_RAW = "direct-youtube";
const TIER_REACT = "react-youtube";
const TIER_LIB = "youtube-player";
const TIER_ORDER = [TIER_DIRECT, TIER_RAW, TIER_REACT, TIER_LIB];
const TIER_LABEL = {
  [TIER_DIRECT]: "direct player",
  [TIER_RAW]: "youtube.com embed",
  [TIER_REACT]: "react-youtube",
  [TIER_LIB]: "youtube-player"
};
/** How long a tier gets to insert an iframe before the next one takes over. */
const TIER_TIMEOUT_MS = 8000;

const YT_STATE_NAMES = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "cued"
};

/** Human-readable reasons for the YouTube IFrame API error codes. */
const YT_ERROR_MESSAGES = {
  2: "This video link is invalid.",
  5: "The HTML5 player could not load this video.",
  100: "This video was removed or set to private.",
  101: "The uploader disabled embedding for this video.",
  150: "The uploader disabled embedding for this video.",
  153: "YouTube rejected the embed (error 153 — missing referrer or player too small)."
};
/** Config errors can recover on another player. Embedding blocks cannot. */
const CONFIG_ERROR_CODES = new Set([2, 5, 153]);
const EMBED_BLOCKED_CODES = new Set([100, 101, 150]);

function logVideo(level, event, details = {}) {
  const payload = {
    event,
    at: new Date().toISOString(),
    origin: typeof window !== "undefined" ? window.location.origin : undefined,
    ...details
  };
  const writer = console[level] || console.log;
  writer(`[video] ${event}`, payload);
}

function isYouTubeUrl(value) {
  const text = String(value ?? "");
  if (!text) return false;
  try {
    const url = new URL(text, typeof window !== "undefined" ? window.location.href : "https://localhost");
    return /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  } catch {
    return /youtube\.com|youtube-nocookie\.com|youtu\.be/i.test(text);
  }
}

/**
 * react-youtube and youtube-player assign iframe.src themselves and never set
 * referrerpolicy. YouTube then returns error 153. Patch the setter so the
 * policy is applied before the browser navigates.
 */
function installYouTubeIframePatch() {
  if (typeof window === "undefined" || window.__anantaYtIframePatched) return;
  window.__anantaYtIframePatched = true;

  const stamp = (iframe, src) => {
    if (!iframe || iframe.tagName !== "IFRAME" || !isYouTubeUrl(src)) return;
    if (iframe.getAttribute("referrerpolicy") !== YT_REFERRER_POLICY) {
      iframe.setAttribute("referrerpolicy", YT_REFERRER_POLICY);
    }
    if (!iframe.getAttribute("allow")) iframe.setAttribute("allow", IFRAME_ALLOW);
    logVideo("log", "iframe referrer patch", {
      src: String(src),
      referrerPolicy: iframe.referrerPolicy || iframe.getAttribute("referrerpolicy")
    });
  };

  const srcDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
  if (srcDesc?.set && srcDesc.get) {
    Object.defineProperty(HTMLIFrameElement.prototype, "src", {
      configurable: true,
      enumerable: srcDesc.enumerable,
      get: srcDesc.get,
      set(value) {
        stamp(this, value);
        return srcDesc.set.call(this, value);
      }
    });
  }

  const nativeSetAttribute = Element.prototype.setAttribute;
  HTMLIFrameElement.prototype.setAttribute = function setYouTubeIframeAttribute(name, value) {
    if (String(name).toLowerCase() === "src") stamp(this, value);
    return nativeSetAttribute.call(this, name, value);
  };

  logVideo("log", "installed YouTube iframe referrer patch");
}

installYouTubeIframePatch();

function pageOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function buildYouTubeEmbedSrc(videoId, host, { withOrigin = true } = {}) {
  const origin = pageOrigin();
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1"
  });
  if (withOrigin && origin) {
    params.set("origin", origin);
    // Identifies the embedding page. Origin-only so route changes don't rebuild the player.
    params.set("widget_referrer", origin);
  }
  return `${host}/embed/${videoId}?${params.toString()}`;
}

function playerOptions() {
  const origin = pageOrigin();
  return {
    width: "100%",
    height: "100%",
    // Privacy host still sends a Referer and avoids a class of error-153 failures.
    host: "https://www.youtube-nocookie.com",
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      enablejsapi: 1,
      ...(origin ? { origin, widget_referrer: origin } : {})
    }
  };
}

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.__anantaYtApiPromise) return window.__anantaYtApiPromise;

  window.__anantaYtApiPromise = new Promise((resolve, reject) => {
    const fail = (error) => {
      window.__anantaYtApiPromise = null;
      logVideo("error", "YouTube IFrame API unavailable", { message: error?.message });
      reject(error);
    };
    const previous = window.onYouTubeIframeAPIReady;
    const finish = () => {
      try {
        previous?.();
      } catch (error) {
        logVideo("warn", "previous onYouTubeIframeAPIReady threw", { message: error?.message });
      }
      if (window.YT?.Player) {
        logVideo("log", "YouTube IFrame API ready");
        resolve(window.YT);
      } else {
        fail(new Error("YT.Player missing after iframe_api callback"));
      }
    };
    window.onYouTubeIframeAPIReady = finish;

    if (window.YT?.Player) {
      finish();
      return;
    }

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => fail(new Error("YouTube IFrame API script failed to load"));
      document.head.appendChild(script);
      logVideo("log", "loading YouTube IFrame API script", { src: script.src });
    } else {
      logVideo("log", "YouTube IFrame API script already in document");
    }
  });

  return window.__anantaYtApiPromise;
}

function parseYouTubeMessage(data) {
  if (data && typeof data === "object") return data;
  if (typeof data !== "string") return null;
  try {
    return JSON.parse(data);
  } catch {
    return { raw: data };
  }
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be disabled; the player still works for this session.
  }
}

/** Accepts a raw id, a watch/share/shorts/embed URL, or a plain search phrase. */
export function parseYouTubeId(input) {
  const value = String(input ?? "").trim();
  if (!value) return null;
  if (YOUTUBE_ID_PATTERN.test(value)) return value;
  if (!/youtu/i.test(value)) return null;

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
    if (!host.endsWith("youtube.com") && !host.endsWith("youtube-nocookie.com")) return null;

    const paramId = url.searchParams.get("v");
    if (paramId && YOUTUBE_ID_PATTERN.test(paramId)) return paramId;

    const segments = url.pathname.split("/").filter(Boolean);
    const marker = segments.findIndex((segment) => ["embed", "shorts", "live", "v"].includes(segment));
    const candidate = marker >= 0 ? segments[marker + 1] : null;
    return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function nextTier(tier) {
  const index = TIER_ORDER.indexOf(tier);
  if (index < 0 || index >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[index + 1];
}

/**
 * Holds the YouTube player state. It lives above the router in AppShell, so
 * the header (and the player inside its toggle panel) is never unmounted and
 * playback continues while the admin navigates between pages.
 */
export function VideoProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [recent, setRecent] = useState(() => {
    const stored = readJson(RECENT_STORAGE_KEY, []);
    return Array.isArray(stored) ? stored.slice(0, MAX_RECENT) : [];
  });

  const requestIdRef = useRef(0);

  useEffect(() => writeJson(RECENT_STORAGE_KEY, recent), [recent]);

  const playVideo = useCallback((video) => {
    if (!video?.videoId) return;
    logVideo("log", "play requested", {
      videoId: video.videoId,
      title: video.title,
      channel: video.channel
    });
    setCurrent(video);
    setError("");
    setRecent((items) => {
      const next = [video, ...items.filter((item) => item.videoId !== video.videoId)];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const search = useCallback(async (rawQuery) => {
    const term = String(rawQuery ?? "").trim();
    if (term.length < 2) {
      setError("Type at least 2 characters to search.");
      return;
    }

    // A pasted link should play immediately rather than run a text search.
    const directId = parseYouTubeId(term);
    if (directId) {
      logVideo("log", "parsed direct video link", { input: term, videoId: directId });
      playVideo({
        videoId: directId,
        title: "YouTube video",
        channel: "",
        thumbnail: `https://i.ytimg.com/vi/${directId}/mqdefault.jpg`
      });
      setResults([]);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    setError("");
    try {
      logVideo("log", "search request", { q: term });
      const response = await api.get("/media/youtube/search", { params: { q: term, limit: 12 } });
      if (requestId !== requestIdRef.current) return; // A newer search already won.
      const items = response.data?.data?.items ?? [];
      logVideo("log", "search response", {
        q: term,
        count: items.length,
        source: response.data?.data?.source,
        cached: response.data?.data?.cached
      });
      setResults(items);
      if (items.length === 0) setError(`No videos found for “${term}”.`);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      const message =
        requestError?.response?.data?.error?.message ||
        "Could not reach YouTube search. Check your connection and try again.";
      logVideo("error", "search failed", {
        q: term,
        message,
        status: requestError?.response?.status,
        code: requestError?.code,
        // A status-less failure from the browser is usually CORS or a dropped connection.
        corsHint: requestError?.response
          ? undefined
          : "No HTTP status — the browser blocked the call (CORS) or the API is down."
      });
      setResults([]);
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false);
    }
  }, [playVideo]);

  const closeVideo = useCallback(() => {
    logVideo("log", "playback stopped");
    setCurrent(null);
  }, []);

  const value = useMemo(() => ({
    isOpen,
    setIsOpen,
    query,
    setQuery,
    results,
    isSearching,
    error,
    setError,
    current,
    playVideo,
    closeVideo,
    search,
    recent
  }), [closeVideo, current, error, isOpen, isSearching, playVideo, query, recent, results, search]);

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (!context) throw new Error("useVideo must be used inside VideoProvider");
  return context;
}

/**
 * Iframe we own, so referrerpolicy is on the element before src is set.
 * `attachApi` wires the official IFrame API for play/pause and error codes.
 * The raw tier skips that — the API rewrite is itself a cause of error 153.
 */
function DirectEmbedPlayer({ videoId, host, withOrigin, attachApi, onReady, onStateChange, onError, onIframeLoad }) {
  const hostRef = useRef(null);
  const handlersRef = useRef({});
  handlersRef.current = { onReady, onStateChange, onError, onIframeLoad };

  useEffect(() => {
    const mount = hostRef.current;
    if (!mount) return undefined;
    let cancelled = false;
    let player = null;
    let iframe = null;

    // setTimeout survives React 18 StrictMode's mount/unmount/mount pass:
    // the cleanup cancels the first timer before it creates a player.
    const timer = setTimeout(() => {
      if (cancelled || !hostRef.current) return;
      const src = buildYouTubeEmbedSrc(videoId, host, { withOrigin });
      iframe = document.createElement("iframe");
      iframe.className = "video-embed-iframe";
      iframe.title = "YouTube video";
      iframe.allow = IFRAME_ALLOW;
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = YT_REFERRER_POLICY;
      iframe.src = src;
      iframe.addEventListener("load", () => {
        const width = iframe.clientWidth;
        const height = iframe.clientHeight;
        logVideo("log", "iframe loaded", {
          videoId,
          host,
          src: iframe.src,
          referrerPolicy: iframe.referrerPolicy,
          width,
          height,
          belowYouTubeMinimum: width < 200 || height < 200
        });
        if (width < 200 || height < 200) {
          logVideo("warn", "iframe is below YouTube's 200x200 minimum — playback will fail", { width, height });
        }
        handlersRef.current.onIframeLoad?.(iframe);
      });
      hostRef.current.replaceChildren(iframe);
      logVideo("log", "direct iframe inserted", {
        videoId,
        host,
        withOrigin,
        attachApi,
        src,
        referrerPolicy: iframe.referrerPolicy
      });

      if (!attachApi) {
        handlersRef.current.onReady?.({ target: null, apiUnavailable: true });
        return;
      }

      loadYouTubeIframeApi()
        .then((YT) => {
          if (cancelled || !iframe.isConnected) return;
          logVideo("log", "attaching YT.Player to direct iframe", { videoId, host });
          player = new YT.Player(iframe, {
            events: {
              onReady: (event) => {
                if (cancelled) return;
                logVideo("log", "direct player ready", { videoId, host });
                handlersRef.current.onReady?.(event);
              },
              onStateChange: (event) => {
                if (cancelled) return;
                logVideo("log", "direct state change", {
                  videoId,
                  host,
                  state: event?.data,
                  stateName: YT_STATE_NAMES[event?.data] || "unknown"
                });
                handlersRef.current.onStateChange?.(event);
              },
              onError: (event) => {
                if (cancelled) return;
                logVideo("error", "direct player error", {
                  videoId,
                  host,
                  code: event?.data,
                  message: YT_ERROR_MESSAGES[Number(event?.data)] || "unknown YouTube error"
                });
                handlersRef.current.onError?.(event);
              }
            }
          });
        })
        .catch((error) => {
          logVideo("error", "IFrame API failed for direct embed — native controls still available", {
            videoId,
            message: error?.message
          });
          handlersRef.current.onReady?.({ target: null, apiUnavailable: true });
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      try {
        player?.destroy?.();
      } catch (error) {
        logVideo("warn", "direct player destroy failed", { message: error?.message });
      }
      iframe?.remove?.();
    };
  }, [attachApi, host, videoId, withOrigin]);

  return <div ref={hostRef} className="video-embed-secondary-host" />;
}

/**
 * youtube-player npm package, created after a tick so a StrictMode remount
 * cannot destroy it mid-handshake. react-youtube uses this same package.
 */
function LibraryApiPlayer({ videoId, onReady, onStateChange, onError }) {
  const hostRef = useRef(null);
  const handlersRef = useRef({});
  handlersRef.current = { onReady, onStateChange, onError };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let core = null;
    const timer = setTimeout(() => {
      if (cancelled || !hostRef.current) return;
      const options = { ...playerOptions(), videoId };
      logVideo("log", "youtube-player factory create", { videoId, host: options.host, playerVars: options.playerVars });
      try {
        core = YouTubePlayerFactory(host, options);
      } catch (error) {
        logVideo("error", "youtube-player factory threw", { videoId, message: error?.message });
        handlersRef.current.onError?.({ data: 5 });
        return;
      }
      core.on("ready", (event) => {
        if (cancelled) return;
        logVideo("log", "youtube-player ready", { videoId });
        handlersRef.current.onReady?.(event);
      });
      core.on("stateChange", (event) => {
        if (cancelled) return;
        logVideo("log", "youtube-player state", {
          videoId,
          state: event?.data,
          stateName: YT_STATE_NAMES[event?.data] || "unknown"
        });
        handlersRef.current.onStateChange?.(event);
      });
      core.on("error", (event) => {
        if (cancelled) return;
        logVideo("error", "youtube-player error", {
          videoId,
          code: event?.data,
          message: YT_ERROR_MESSAGES[Number(event?.data)] || "unknown YouTube error"
        });
        handlersRef.current.onError?.(event);
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (core?.destroy) {
        Promise.resolve(core.destroy()).catch((error) => {
          logVideo("warn", "youtube-player destroy failed", { message: error?.message });
        });
      }
    };
  }, [videoId]);

  return <div ref={hostRef} className="video-embed-secondary-host" />;
}

/**
 * The player rendered INSIDE the "Videos" toggle panel — never a floating
 * window over the page. The panel is portaled to document.body so it is not
 * a child of the header's backdrop-filter (Chrome will not play a YouTube
 * iframe under backdrop-filter, filter, or a lingering transform).
 */
export function EmbeddedVideo() {
  const video = useVideo();
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const failedIdsRef = useRef(new Set());
  const frameRef = useRef(null);
  const lastErrorKeyRef = useRef("");
  const [tier, setTier] = useState(TIER_DIRECT);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [playbackError, setPlaybackError] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const currentId = video.current?.videoId ?? null;
  const isPlaying = playerState === 1 || playerState === 3;
  const libraryOpts = useMemo(() => playerOptions(), []);
  // Reset during render so a new video never mounts on the tier that just failed.
  const [tierVideoId, setTierVideoId] = useState(currentId);
  if (currentId !== tierVideoId) {
    setTierVideoId(currentId);
    setTier(TIER_DIRECT);
  }

  const goNext = useCallback(
    (markCurrent) => {
      const failedId = video.current?.videoId;
      if (!failedId) return false;
      if (markCurrent) failedIdsRef.current.add(failedId);

      const pool = video.results.length > 0 ? video.results : video.recent;
      const position = pool.findIndex((item) => item.videoId === failedId);
      const ordered = position >= 0 ? [...pool.slice(position + 1), ...pool.slice(0, position)] : pool;
      const next = ordered.find((item) => item.videoId !== failedId && !failedIdsRef.current.has(item.videoId));
      if (!next) return false;
      logVideo("log", "advancing to next video", { from: failedId, to: next.videoId, markCurrent });
      video.playVideo(next);
      return true;
    },
    [video]
  );

  const escalateTier = useCallback(
    (fromTier, reason) => {
      const next = nextTier(fromTier);
      if (!next) {
        logVideo("error", "every player tier failed", { from: fromTier, reason, videoId: currentId });
        return false;
      }
      logVideo("warn", "escalating player tier", { from: fromTier, to: next, reason, videoId: currentId });
      setTier(next);
      return true;
    },
    [currentId]
  );

  useEffect(() => {
    failedIdsRef.current.clear();
  }, [video.results]);

  useEffect(() => {
    if (!currentId) return;
    logVideo("log", "player environment", {
      videoId: currentId,
      href: window.location.href,
      referrer: document.referrer,
      referrerMeta: document.querySelector('meta[name="referrer"]')?.content,
      inIframe: window.self !== window.top,
      ancestorOrigins: window.location.ancestorOrigins ? [...window.location.ancestorOrigins] : [],
      tier: TIER_DIRECT
    });
  }, [currentId]);

  useEffect(() => {
    if (!currentId) return undefined;
    readyRef.current = false;
    playerRef.current = null;
    lastErrorKeyRef.current = "";
    setPlayerReady(false);
    setPlayerState(-1);
    setPlaybackError(null);
    setIframeLoaded(false);
    logVideo("log", "tier armed", { videoId: currentId, tier, timeoutMs: TIER_TIMEOUT_MS });

    const timer = setTimeout(() => {
      if (readyRef.current) return;
      const iframe = frameRef.current?.querySelector("iframe");
      logVideo("warn", "player not ready before timeout", {
        videoId: currentId,
        tier,
        iframePresent: Boolean(iframe),
        iframeSrc: iframe?.src,
        referrerPolicy: iframe?.referrerPolicy,
        width: iframe?.clientWidth,
        height: iframe?.clientHeight
      });
      // An iframe that loaded can still be played with YouTube's own controls.
      // Destroying it to "fall back" is what made a working embed look broken.
      if (iframe?.src) {
        logVideo("log", "keeping loaded iframe despite missing API ready", { videoId: currentId, tier });
        setIframeLoaded(true);
        setPlayerReady(true);
        return;
      }
      if (!escalateTier(tier, "init timeout, no iframe")) {
        setPlaybackError({
          message: "The player never started. Open the console and filter for [video].",
          exhausted: true
        });
      }
    }, TIER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [currentId, escalateTier, tier]);

  const onPlayerReady = useCallback((event) => {
    readyRef.current = true;
    if (event?.target?.playVideo) playerRef.current = event.target;
    setPlayerReady(true);
    logVideo("log", "onReady", {
      videoId: currentId,
      tier,
      apiUnavailable: Boolean(event?.apiUnavailable),
      hasPlayVideo: Boolean(event?.target?.playVideo)
    });
    if (event?.target?.playVideo) {
      Promise.resolve(event.target.playVideo()).then(
        () => logVideo("log", "playVideo() resolved", { videoId: currentId, tier }),
        (error) => logVideo("warn", "playVideo() rejected (autoplay blocked is normal — use the YouTube play button)", {
          videoId: currentId,
          tier,
          message: error?.message,
          name: error?.name
        })
      );
    }
  }, [currentId, tier]);

  const onPlayerStateChange = useCallback(
    (event) => {
      const state = Number(event?.data);
      if (Number.isNaN(state)) return;
      setPlayerState(state);
      logVideo("log", "state change", {
        videoId: currentId,
        tier,
        state,
        stateName: YT_STATE_NAMES[state] || "unknown"
      });
      if (state === 0 && currentId) goNext(false);
    },
    [currentId, goNext, tier]
  );

  const onPlayerError = useCallback(
    (event) => {
      const code = Number(event?.data);
      const reason = YT_ERROR_MESSAGES[code] || `YouTube could not play this video (error ${code}).`;
      const dedupeKey = `${currentId}:${tier}:${code}`;
      if (lastErrorKeyRef.current === dedupeKey) {
        logVideo("log", "duplicate player error ignored", { videoId: currentId, tier, code });
        return;
      }
      lastErrorKeyRef.current = dedupeKey;
      logVideo("error", "playback error", {
        videoId: currentId,
        tier,
        code,
        reason,
        source: event?.source || "player-callback",
        href: window.location.href,
        referrer: document.referrer,
        referrerMeta: document.querySelector('meta[name="referrer"]')?.content
      });

      // Player-configuration failures: try the next embed before skipping the video.
      if (CONFIG_ERROR_CODES.has(code) && escalateTier(tier, `error ${code}`)) {
        setPlaybackError({ message: `${reason} Trying another player…`, code });
        return;
      }
      if (EMBED_BLOCKED_CODES.has(code) && goNext(true)) {
        setPlaybackError({ message: `${reason} Trying the next video…`, code });
        return;
      }
      if (CONFIG_ERROR_CODES.has(code) && goNext(true)) {
        setPlaybackError({ message: `${reason} Trying the next video…`, code });
        return;
      }
      setPlaybackError({
        message: `${reason} Details are in the console under [video].`,
        exhausted: true,
        code
      });
    },
    [currentId, escalateTier, goNext, tier]
  );

  const onIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  const tierStartedAtRef = useRef(0);
  useEffect(() => {
    tierStartedAtRef.current = Date.now();
  }, [currentId, tier]);

  // Catches error 153 even when the npm player swallows the callback, and
  // when the raw iframe has enablejsapi=1 but we did not construct YT.Player.
  // Ignore messages in the first moment after a tier switch — the dying
  // iframe keeps posting its error and would skip the player we just started.
  useEffect(() => {
    if (!currentId) return undefined;
    const onMessage = (event) => {
      if (!isYouTubeUrl(event.origin)) return;
      const parsed = parseYouTubeMessage(event.data);
      const name = parsed?.event || parsed?.raw;
      if (name !== "onError" && name !== "onReady") return;
      logVideo(name === "onError" ? "error" : "log", "youtube postMessage", {
        videoId: currentId,
        tier,
        origin: event.origin,
        data: event.data
      });
      if (name !== "onError") return;
      if (Date.now() - tierStartedAtRef.current < 500) {
        logVideo("log", "ignoring postMessage error during tier switch", { videoId: currentId, tier });
        return;
      }
      const code = Number(parsed?.info ?? parsed?.data);
      if (!Number.isNaN(code)) onPlayerError({ data: code, source: "postMessage" });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [currentId, onPlayerError, tier]);

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player?.getPlayerState) {
      logVideo("warn", "play/pause ignored — IFrame API not attached", { videoId: currentId, tier });
      return;
    }
    Promise.resolve(player.getPlayerState())
      .then((state) => {
        logVideo("log", "play/pause command", {
          videoId: currentId,
          tier,
          state,
          stateName: YT_STATE_NAMES[state] || "unknown",
          action: state === 1 || state === 3 ? "pause" : "play"
        });
        return state === 1 || state === 3 ? player.pauseVideo() : player.playVideo();
      })
      .catch((error) => {
        logVideo("error", "play/pause command failed", {
          videoId: currentId,
          tier,
          message: error?.message,
          name: error?.name
        });
      });
  }, [currentId, tier]);

  const stopVideo = useCallback(() => {
    const player = playerRef.current;
    if (player?.stopVideo) {
      Promise.resolve(player.stopVideo()).catch((error) => {
        logVideo("warn", "stopVideo failed", { message: error?.message });
      });
    }
    video.closeVideo();
  }, [video]);

  if (!video.current || !currentId) return null;

  const showLoadingBadge = !iframeLoaded && !playerReady && !playbackError;

  return (
    <div className="video-embed">
      <div className="video-embed-frame" ref={frameRef}>
        {tier === TIER_DIRECT && (
          <DirectEmbedPlayer
            videoId={currentId}
            host="https://www.youtube-nocookie.com"
            withOrigin
            attachApi
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError}
            onIframeLoad={onIframeLoad} />
        )}

        {tier === TIER_RAW && (
          <DirectEmbedPlayer
            videoId={currentId}
            host="https://www.youtube.com"
            withOrigin
            attachApi={false}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError}
            onIframeLoad={onIframeLoad} />
        )}

        {tier === TIER_REACT && (
          <YouTube
            videoId={currentId}
            opts={libraryOpts}
            loading="eager"
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError}
            className="video-embed-player"
            iframeClassName="video-embed-iframe" />
        )}

        {tier === TIER_LIB && (
          <LibraryApiPlayer
            videoId={currentId}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError} />
        )}

        {showLoadingBadge && (
          <div className="video-embed-status" aria-live="polite">
            <Loader2 size={12} className="animate-spin" />
            <span>Loading {TIER_LABEL[tier] || "player"}…</span>
          </div>
        )}

        {playbackError && (
          <div className="video-embed-overlay" role="alert">
            <AlertTriangle size={16} className="text-amber-300" />
            <p className="video-embed-overlay-text">
              {playbackError.code ? `Error ${playbackError.code}: ` : ""}
              {playbackError.message}
            </p>
            {!playbackError.exhausted && (
              <button type="button" className="video-embed-retry" onClick={() => goNext(true)}>
                <SkipForward size={12} /> Play next
              </button>
            )}
          </div>
        )}
      </div>

      <div className="video-embed-controls">
        <button
          type="button"
          className="video-embed-control"
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pause video" : "Play video"}
          title={isPlaying ? "Pause video" : "Play video"}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          className="video-embed-control"
          onClick={() => goNext(true)}
          aria-label="Play next result"
          title="Play next result">
          <SkipForward size={14} />
        </button>
        <button
          type="button"
          className="video-embed-control"
          onClick={stopVideo}
          aria-label="Stop video"
          title="Stop video">
          <Square size={12} />
        </button>
        <span className="video-embed-tier">{TIER_LABEL[tier] || tier}</span>
      </div>
    </div>
  );
}

/** Search toggle + results + embedded player panel, rendered in the header. */
export function VideoSearchToggle() {
  const video = useVideo();
  const inputRef = useRef(null);

  useEffect(() => {
    if (video.isOpen) inputRef.current?.focus();
  }, [video.isOpen]);

  useEffect(() => {
    if (!video.isOpen) return undefined;
    let cancelled = false;
    logVideo("log", "panel opened", { origin: window.location.origin });
    api.get("/media/youtube/config")
      .then((response) => {
        if (cancelled) return;
        logVideo("log", "media config", response.data?.data ?? response.data);
        if (response.data?.data && response.data.data.keyConfigured === false) {
          logVideo("warn", "YOUTUBE_API_KEY is not visible to the API process. Search falls back to scraping. Playback does not use the key.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        logVideo("error", "media config failed", {
          message: error?.message,
          status: error?.response?.status,
          data: error?.response?.data,
          corsHint: error?.response
            ? undefined
            : "No HTTP status — add this page's origin to CORS_ORIGIN and restart the API."
        });
      });
    return () => {
      cancelled = true;
    };
  }, [video.isOpen]);

  const closePanel = useCallback(() => {
    video.closeVideo();
    video.setIsOpen(false);
  }, [video]);

  const panel = video.isOpen ? (
    <section className="music-panel video-panel" aria-label="YouTube video search">
      <div className="music-panel-header">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="music-panel-mark video-panel-mark"><Youtube size={17} /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-graphite-900">Watch while you work</p>
            <p className="truncate text-[11px] text-graphite-500">Search YouTube or paste a link</p>
          </div>
        </div>
        <button
          type="button"
          className="music-icon-button"
          onClick={closePanel}
          aria-label="Close video panel and stop playback"
          title="Close and stop">
          <X size={17} />
        </button>
      </div>

      {video.current && <EmbeddedVideo />}

      <form
        className="video-search-row"
        onSubmit={(event) => {
          event.preventDefault();
          video.search(video.query);
        }}>
        <Search size={15} className="text-graphite-400" />
        <input
          ref={inputRef}
          type="search"
          value={video.query}
          placeholder="Search songs, tutorials, news…"
          aria-label="YouTube search"
          onChange={(event) => video.setQuery(event.target.value)} />
        <button type="submit" className="video-search-button" disabled={video.isSearching}>
          {video.isSearching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
        </button>
      </form>

      {video.error && <p className="music-error">{video.error}</p>}

      {video.results.length > 0 && (
        <div className="video-result-list">
          {video.results.map((item) => (
            <button
              key={item.videoId}
              type="button"
              className={cx("video-result", video.current?.videoId === item.videoId && "video-result-active")}
              onClick={() => video.playVideo(item)}>
              <span className="video-result-thumb">
                <img src={item.thumbnail} alt="" loading="lazy" />
                {item.duration && <span className="video-result-duration">{item.duration}</span>}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="video-result-title">{item.title}</span>
                <span className="video-result-meta">
                  {[item.channel, item.views].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {video.results.length === 0 && video.recent.length > 0 && (
        <div className="video-result-list">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-graphite-500">Recently played</p>
          {video.recent.map((item) => (
            <button
              key={item.videoId}
              type="button"
              className={cx("video-result", video.current?.videoId === item.videoId && "video-result-active")}
              onClick={() => video.playVideo(item)}>
              <span className="video-result-thumb">
                <img src={item.thumbnail} alt="" loading="lazy" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="video-result-title">{item.title}</span>
                <span className="video-result-meta">{item.channel}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="music-help">
        Videos play in this panel and keep going while you move between pages. If one does not start, open the browser console and filter for [video] — that log has the exact YouTube error code.
      </p>
    </section>
  ) : null;

  return (
    <>
      <div className="music-control-group">
        <button
          type="button"
          className={cx("music-toggle video-toggle", video.current && "video-toggle-active")}
          onClick={() => video.setIsOpen((open) => !open)}
          aria-expanded={video.isOpen}
          aria-label="Search YouTube videos"
          title="Search YouTube videos">
          <span className="music-toggle-icon video-toggle-icon"><Youtube size={16} /></span>
          <span className="hidden sm:inline">Videos</span>
        </button>
      </div>

      {panel && typeof document !== "undefined" ? createPortal(panel, document.body) : panel}
    </>
  );
}
