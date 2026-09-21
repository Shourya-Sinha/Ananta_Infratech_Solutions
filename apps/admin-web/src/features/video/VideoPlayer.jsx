import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

/** Playback tiers, tried in order. The first two use the IFrame Player API. */
const TIER_REACT = "react-youtube"; // primary: react-youtube (npm)
const TIER_LIB = "youtube-player"; // secondary fallback: youtube-player (npm)
const TIER_IFRAME = "iframe"; // last resort: plain embed, no API
const NEXT_TIER = { [TIER_REACT]: TIER_LIB, [TIER_LIB]: TIER_IFRAME, [TIER_IFRAME]: TIER_IFRAME };
/** How long a tier gets to initialise before the next one takes over (ms). */
const TIER_TIMEOUT_MS = 8000;

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
      const response = await api.get("/media/youtube/search", { params: { q: term, limit: 12 } });
      if (requestId !== requestIdRef.current) return; // A newer search already won.
      const items = response.data?.data?.items ?? [];
      setResults(items);
      if (items.length === 0) setError(`No videos found for “${term}”.`);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
      setError(
        requestError?.response?.data?.error?.message ||
          "Could not reach YouTube search. Check your connection and try again."
      );
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false);
    }
  }, [playVideo]);

  const closeVideo = useCallback(() => {
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

/** Human-readable reasons for the YouTube IFrame API error codes. */
const YT_ERROR_MESSAGES = {
  2: "This video link is invalid.",
  5: "The HTML5 player could not load this video.",
  100: "This video was removed or set to private.",
  101: "The uploader disabled embedding for this video.",
  150: "The uploader disabled embedding for this video."
};

// Module-level constants: recreating these objects would make react-youtube
// rebuild the player on every render. `origin` is required for the IFrame API
// postMessage bridge when the app is served from a proxied host.
const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : undefined;
const YOUTUBE_OPTS = {
  width: "100%",
  height: "100%",
  playerVars: {
    autoplay: 1,
    rel: 0,
    modestbranding: 1,
    playsinline: 1,
    ...(APP_ORIGIN ? { origin: APP_ORIGIN } : {})
  }
};
const SECONDARY_PLAYER_VARS = {
  autoplay: 1,
  rel: 0,
  modestbranding: 1,
  playsinline: 1,
  ...(APP_ORIGIN ? { origin: APP_ORIGIN } : {})
};

/**
 * Secondary fallback player built on the `youtube-player` npm package. It
 * drives the YouTube IFrame API directly (no React lifecycle), so it recovers
 * from cases where the primary react-youtube component cannot initialise —
 * blocked React portals, unmount races, or a wedged API handshake.
 */
function SecondaryApiPlayer({ videoId, onReady, onStateChange, onError }) {
  const hostRef = useRef(null);
  // Handlers live in a ref so the player is created once per videoId and the
  // callbacks it fires are always the latest render's closures.
  const handlersRef = useRef({});
  handlersRef.current = { onReady, onStateChange, onError };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let core = null;
    try {
      core = YouTubePlayerFactory(host, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: SECONDARY_PLAYER_VARS
      });
    } catch {
      // Factory threw (element gone, API blocked): report a player error so
      // the parent escalates to the plain-embed tier.
      handlersRef.current.onError?.({ data: 5 });
      return undefined;
    }
    core.on("ready", (event) => {
      if (!cancelled) handlersRef.current.onReady?.(event);
    });
    core.on("stateChange", (event) => {
      if (!cancelled) handlersRef.current.onStateChange?.(event);
    });
    core.on("error", (event) => {
      if (!cancelled) handlersRef.current.onError?.(event);
    });
    return () => {
      cancelled = true;
      if (core?.destroy) {
        Promise.resolve(core.destroy()).catch(() => {
          // The player may already be gone; teardown is best-effort.
        });
      }
    };
  }, [videoId]);

  return <div ref={hostRef} className="video-embed-secondary-host" />;
}

/**
 * The player rendered INSIDE the "Videos" toggle panel — never a floating
 * window over the page. The header stays mounted across route changes, so
 * playback continues while navigating as long as the panel is open.
 *
 * Fallback chain, all inside this panel:
 *   1. react-youtube (IFrame Player API via React)
 *   2. youtube-player (IFrame Player API, direct — secondary npm fallback)
 *   3. plain embed iframe (no API script at all)
 *
 * A tier that never becomes ready is skipped for every later video, videos
 * that refuse embedding (101/150) auto-advance to the next search result, and
 * a finished video continues with the next one like a queue.
 */
export function EmbeddedVideo() {
  const video = useVideo();
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const failedIdsRef = useRef(new Set());
  // Once a tier proves unusable on this device (init timeout), later videos
  // start directly on the next tier instead of waiting for another timeout.
  const worstTierRef = useRef(null);
  const [tier, setTier] = useState(TIER_REACT);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [playbackError, setPlaybackError] = useState(null);

  const currentId = video.current?.videoId ?? null;
  const isPlaying = playerState === 1 || playerState === 3;

  // Plays the next result that has not already errored. `markCurrent` flags the
  // failed video so auto-skip never loops, while a manual skip leaves it retryable.
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
      video.playVideo(next);
      return true;
    },
    [video]
  );

  // A fresh search clears the failed-video memory so old errors never block new results.
  useEffect(() => {
    failedIdsRef.current.clear();
  }, [video.results]);

  // Start each new video on the best tier that still works on this device.
  useEffect(() => {
    if (!currentId) return;
    setTier(worstTierRef.current ?? TIER_REACT);
  }, [currentId]);

  // Reset player state per video/tier and arm the watchdog that promotes the
  // next tier when the current one never becomes ready.
  useEffect(() => {
    if (!currentId) return undefined;
    readyRef.current = false;
    playerRef.current = null;
    setPlayerReady(false);
    setPlayerState(-1);
    setPlaybackError(null);
    if (tier === TIER_IFRAME) return undefined; // No API to wait for.
    const timer = setTimeout(() => {
      if (!readyRef.current) {
        const next = NEXT_TIER[tier] ?? TIER_IFRAME;
        worstTierRef.current = next;
        setTier(next);
      }
    }, TIER_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [currentId, tier]);

  const onPlayerReady = useCallback((event) => {
    readyRef.current = true;
    if (!playerRef.current && event?.target) playerRef.current = event.target;
    setPlayerReady(true);
  }, []);

  const onPlayerStateChange = useCallback(
    (event) => {
      const state = Number(event?.data);
      setPlayerState(state);
      // Video finished: behave like a queue and continue with the next result.
      if (state === 0 && currentId) goNext(false);
    },
    [currentId, goNext]
  );

  const onPlayerError = useCallback(
    (event) => {
      const code = Number(event?.data);
      const reason = YT_ERROR_MESSAGES[code] || "YouTube could not play this video.";
      if (goNext(true)) {
        setPlaybackError({ message: `${reason} Trying the next video…` });
        return;
      }
      // Nothing left in the list: codes 2/5 can be device-specific, so retry
      // this video through the fallback chain. Embedding restrictions (100/
      // 101/150) never recover in any tier — say so instead of spinning.
      if (code === 2 || code === 5) {
        const next = NEXT_TIER[tier] ?? TIER_IFRAME;
        worstTierRef.current = next;
        setTier(next);
        return;
      }
      setPlaybackError({ message: `${reason} Try another video from the list.`, exhausted: true });
    },
    [goNext, tier]
  );

  // Works for both API tiers: react-youtube exposes sync methods, youtube-player
  // promisified ones — Promise.resolve flattens either shape.
  const togglePlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player?.getPlayerState) return;
    Promise.resolve(player.getPlayerState())
      .then((state) => (state === 1 || state === 3 ? player.pauseVideo() : player.playVideo()))
      .catch(() => {
        // A rejected command (e.g. playback disposed) is harmless here.
      });
  }, []);

  const stopVideo = useCallback(() => {
    const player = playerRef.current;
    if (player?.stopVideo) Promise.resolve(player.stopVideo()).catch(() => {});
    video.closeVideo();
  }, [video]);

  if (!video.current || !currentId) return null;

  const showApiChrome = tier !== TIER_IFRAME;
  const showLoadingOverlay = showApiChrome && !playerReady && !playbackError;
  const showTapToPlay =
    showApiChrome && playerReady && !playbackError && (playerState === -1 || playerState === 5 || playerState === 0);

  return (
    <div className="video-embed">
      <div className="video-embed-frame">
        {tier === TIER_REACT && (
          <YouTube
            videoId={currentId}
            opts={YOUTUBE_OPTS}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError}
            className="video-embed-player"
            iframeClassName="video-embed-iframe" />
        )}

        {tier === TIER_LIB && (
          <SecondaryApiPlayer
            videoId={currentId}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError} />
        )}

        {tier === TIER_IFRAME && (
          <iframe
            key={currentId}
            title={video.current.title || "YouTube video"}
            src={`https://www.youtube-nocookie.com/embed/${currentId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen />
        )}

        {showLoadingOverlay && (
          <div className="video-embed-overlay" aria-live="polite">
            <Loader2 size={20} className="animate-spin" />
            <p className="video-embed-overlay-text">Loading player…</p>
          </div>
        )}

        {showTapToPlay && (
          <div className="video-embed-overlay">
            <button
              type="button"
              className="video-embed-play-big"
              onClick={() => {
                Promise.resolve(playerRef.current?.playVideo?.()).catch(() => {
                  // Playback can be rejected if the video was swapped; harmless.
                });
              }}
              aria-label={playerState === 0 ? "Replay video" : "Play video"}
              title={playerState === 0 ? "Replay video" : "Play video"}>
              <Play size={20} fill="currentColor" />
            </button>
            <p className="video-embed-overlay-text">
              {playerState === 0 ? "Video ended — tap to replay" : "Tap to start playback"}
            </p>
          </div>
        )}

        {playbackError && (
          <div className="video-embed-overlay" role="alert">
            <AlertTriangle size={18} className="text-amber-300" />
            <p className="video-embed-overlay-text">{playbackError.message}</p>
            {!playbackError.exhausted && (
              <button type="button" className="video-embed-retry" onClick={() => goNext(true)}>
                <SkipForward size={12} /> Play next
              </button>
            )}
          </div>
        )}
      </div>

      {showApiChrome && (
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
          <span className="video-embed-tier">
            {tier === TIER_LIB ? "fallback player" : "player"}
          </span>
        </div>
      )}
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

  const closePanel = useCallback(() => {
    // Collapsing the panel also stops playback — the player lives here now.
    video.closeVideo();
    video.setIsOpen(false);
  }, [video]);

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

      {video.isOpen && (
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
            Videos play right here in the panel and keep playing while you move between pages. Close the panel to stop.
          </p>
        </section>
      )}
    </>
  );
}
