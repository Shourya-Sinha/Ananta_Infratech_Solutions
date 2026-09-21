import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Maximize2,
  Minimize2,
  Move,
  Pause,
  Play,
  Search,
  SkipForward,
  Youtube,
  X
} from "lucide-react";
import YouTube from "react-youtube";
import { api } from "@/lib/apiClient";
import { cx } from "@/lib/format";

const VideoContext = createContext(null);

const POSITION_STORAGE_KEY = "ananta_admin_video_position";
const SIZE_STORAGE_KEY = "ananta_admin_video_size";
const RECENT_STORAGE_KEY = "ananta_admin_video_recent";
const MAX_RECENT = 6;

const SIZES = {
  compact: { width: 320, height: 180 },
  regular: { width: 420, height: 236 },
  large: { width: 560, height: 315 }
};

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

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

function clampPosition(position, size) {
  if (typeof window === "undefined") return position;
  const maxX = Math.max(8, window.innerWidth - size.width - 8);
  const maxY = Math.max(8, window.innerHeight - size.height - 96);
  return {
    x: Math.min(Math.max(position.x, 8), maxX),
    y: Math.min(Math.max(position.y, 8), maxY)
  };
}

function defaultPosition(size) {
  if (typeof window === "undefined") return { x: 24, y: 96 };
  return { x: Math.max(16, window.innerWidth - size.width - 24), y: 96 };
}

/**
 * Holds the YouTube mini-player state. It lives above the router in AppShell,
 * so the iframe is never unmounted and playback continues while the admin
 * navigates between pages.
 */
export function VideoProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [sizeKey, setSizeKey] = useState(() => {
    const stored = readJson(SIZE_STORAGE_KEY, "regular");
    return SIZES[stored] ? stored : "regular";
  });
  const [recent, setRecent] = useState(() => {
    const stored = readJson(RECENT_STORAGE_KEY, []);
    return Array.isArray(stored) ? stored.slice(0, MAX_RECENT) : [];
  });
  const size = SIZES[sizeKey];
  const [position, setPosition] = useState(() => {
    const stored = readJson(POSITION_STORAGE_KEY, null);
    const base = SIZES[readJson(SIZE_STORAGE_KEY, "regular")] ?? SIZES.regular;
    return stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)
      ? clampPosition(stored, base)
      : defaultPosition(base);
  });

  const requestIdRef = useRef(0);

  useEffect(() => writeJson(SIZE_STORAGE_KEY, sizeKey), [sizeKey]);
  useEffect(() => writeJson(RECENT_STORAGE_KEY, recent), [recent]);
  useEffect(() => writeJson(POSITION_STORAGE_KEY, position), [position]);

  // Keep the floating window on screen when the viewport or size changes.
  useEffect(() => {
    setPosition((value) => clampPosition(value, size));
    const onResize = () => setPosition((value) => clampPosition(value, size));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [size]);

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
    recent,
    sizeKey,
    setSizeKey,
    size,
    position,
    setPosition
  }), [closeVideo, current, error, isOpen, isSearching, playVideo, position, query, recent, results, search, size, sizeKey]);

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (!context) throw new Error("useVideo must be used inside VideoProvider");
  return context;
}

/** Search toggle + results panel, rendered in the header next to the music player. */
export function VideoSearchToggle() {
  const video = useVideo();
  const inputRef = useRef(null);

  useEffect(() => {
    if (video.isOpen) inputRef.current?.focus();
  }, [video.isOpen]);

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
              onClick={() => video.setIsOpen(false)}
              aria-label="Close video search"
              title="Close video search">
              <X size={17} />
            </button>
          </div>

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
            The player keeps playing while you move between pages. Drag its header to reposition it.
          </p>
        </section>
      )}
    </>
  );
}

/** Human-readable reasons for the YouTube IFrame API error codes. */
const YT_ERROR_MESSAGES = {
  2: "This video link is invalid.",
  5: "The HTML5 player could not load this video.",
  100: "This video was removed or set to private.",
  101: "The uploader disabled embedding for this video.",
  150: "The uploader disabled embedding for this video."
};

/**
 * The floating, draggable YouTube window. Rendered once at the AppShell level
 * and never remounted on navigation, so playback continues across routes.
 *
 * Playback runs through the YouTube IFrame Player API (react-youtube) inside
 * this window — never a redirect to youtube.com. If a video refuses to embed
 * (errors 101/150 are common) the player automatically advances to the next
 * search result, and if the IFrame API script itself is blocked the window
 * falls back to a plain embed iframe. Every layer stays inside this window.
 */
export function FloatingVideo() {
  const video = useVideo();
  const dragRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const failedIdsRef = useRef(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1);
  const [playbackError, setPlaybackError] = useState(null);
  const [directEmbed, setDirectEmbed] = useState(false);

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

  // Reset player state for every new video and arm a watchdog: if the IFrame
  // API script never initialises (blocked by an extension or the network),
  // fall back to a plain embed iframe instead of showing a dead window.
  useEffect(() => {
    if (!currentId) return undefined;
    readyRef.current = false;
    setPlayerReady(false);
    setPlayerState(-1);
    setPlaybackError(null);
    const timer = setTimeout(() => {
      if (!readyRef.current) setDirectEmbed(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [currentId]);

  // A fresh search clears the failed-video memory so old errors never block new results.
  useEffect(() => {
    failedIdsRef.current.clear();
  }, [video.results]);

  const onPlayerReady = useCallback((event) => {
    readyRef.current = true;
    playerRef.current = event.target;
    setPlayerReady(true);
  }, []);

  const onPlayerStateChange = useCallback(
    (event) => {
      const state = Number(event.data);
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
      } else {
        setPlaybackError({ message: `${reason} Try another video from the list.`, exhausted: true });
      }
    },
    [goNext]
  );

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player?.getPlayerState) return;
    if (player.getPlayerState() === 1 || player.getPlayerState() === 3) player.pauseVideo();
    else player.playVideo();
  }, []);

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragRef.current = {
      offsetX: event.clientX - video.position.x,
      offsetY: event.clientY - video.position.y
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [video.position.x, video.position.y]);

  const onPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    video.setPosition(clampPosition(
      { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY },
      video.size
    ));
  }, [video]);

  const endDrag = useCallback((event) => {
    dragRef.current = null;
    setIsDragging(false);
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
  }, []);

  if (!video.current || !currentId) return null;

  const { width, height } = video.size;
  // Last-resort embed when the IFrame API never came up. Still inside this window.
  const embedSrc = `https://www.youtube-nocookie.com/embed/${currentId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  const hasDirectControls = playerReady && !directEmbed && !playbackError;
  const showLoadingOverlay = !playerReady && !directEmbed && !playbackError;
  const showTapToPlay = hasDirectControls && (playerState === -1 || playerState === 5);

  return (
    <div
      className={cx("floating-video", isDragging && "floating-video-dragging")}
      style={{ left: video.position.x, top: video.position.y, width }}
      role="region"
      aria-label="YouTube mini player">
      <div
        className="floating-video-bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}>
        <Move size={13} className="shrink-0 text-white/55" />
        <p className="floating-video-title">{video.current.title}</p>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {hasDirectControls && (
            <button
              type="button"
              className="floating-video-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={togglePlayback}
              aria-label={isPlaying ? "Pause video" : "Play video"}
              title={isPlaying ? "Pause video" : "Play video"}>
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
          )}
          <button
            type="button"
            className="floating-video-button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => video.setSizeKey(video.sizeKey === "large" ? "compact" : video.sizeKey === "compact" ? "regular" : "large")}
            aria-label={video.sizeKey === "large" ? "Shrink player" : "Enlarge player"}
            title={video.sizeKey === "large" ? "Shrink player" : "Enlarge player"}>
            {video.sizeKey === "large" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            type="button"
            className="floating-video-button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={video.closeVideo}
            aria-label="Close video"
            title="Close video">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="floating-video-frame" style={{ height }}>
        {!directEmbed && (
          <YouTube
            videoId={currentId}
            opts={YOUTUBE_OPTS}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            onError={onPlayerError}
            className="floating-video-player"
            iframeClassName="floating-video-iframe" />
        )}

        {directEmbed && (
          <iframe
            key={currentId}
            title={video.current.title || "YouTube video"}
            src={embedSrc}
            style={{ height, pointerEvents: isDragging ? "none" : "auto" }}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen />
        )}

        {showLoadingOverlay && (
          <div className="floating-video-overlay" aria-live="polite">
            <Loader2 size={22} className="animate-spin" />
            <p className="floating-video-overlay-text">Loading player…</p>
          </div>
        )}

        {showTapToPlay && (
          <div className="floating-video-overlay">
            <button
              type="button"
              className="floating-video-play-big"
              onClick={() => playerRef.current?.playVideo?.()}
              aria-label="Play video"
              title="Play video">
              <Play size={22} fill="currentColor" />
            </button>
            <p className="floating-video-overlay-text">Tap to start playback</p>
          </div>
        )}

        {playbackError && (
          <div className="floating-video-overlay" role="alert">
            <AlertTriangle size={20} className="text-amber-300" />
            <p className="floating-video-overlay-text">{playbackError.message}</p>
            {!playbackError.exhausted && (
              <button type="button" className="floating-video-retry" onClick={() => goNext(true)}>
                <SkipForward size={13} /> Play next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Kept in a module-level constant: react-youtube recreates the player whenever
// the `opts` identity changes, and none of these values are dynamic. `origin`
// is required for the IFrame API postMessage bridge when the app is served
// from a proxied host, so it is pinned to the live window origin once.
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
