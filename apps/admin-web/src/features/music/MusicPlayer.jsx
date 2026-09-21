import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  ChevronDown,
  FolderOpen,
  ListMusic,
  Music2,
  Pause,
  Play,
  Plus,
  ScanSearch,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  X
} from "lucide-react";
import { cx } from "@/lib/format";

const MusicContext = createContext(null);
const VOLUME_STORAGE_KEY = "ananta_admin_music_volume";
const AUDIO_EXTENSIONS = new Set([
  "aac",
  "aif",
  "aiff",
  "flac",
  "m4a",
  "mka",
  "mp3",
  "mp4",
  "oga",
  "ogg",
  "opus",
  "wav",
  "webm"
]);

function safeInitialVolume() {
  try {
    const value = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.65;
  } catch {
    return 0.65;
  }
}

function fileExtension(name = "") {
  const dot = name.lastIndexOf(".");
  if (dot < 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

// A name-only check, used while walking a directory tree before the File object exists.
function hasAudioExtension(name) {
  return AUDIO_EXTENSIONS.has(fileExtension(name));
}

function isAudioFile(file) {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("audio/")) return true;
  // Some browsers report video/* or an empty type for container formats that hold audio.
  if (hasAudioExtension(file.name)) return true;
  return false;
}

function fileKey(file) {
  const path = file.relativePath || file.webkitRelativePath || file.name;
  return [path, file.size, file.lastModified].join(":");
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

const SKIPPED_DIRECTORIES = new Set([
  "$recycle.bin",
  "system volume information",
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
  "node_modules",
  "appdata",
  "$windows.~ws",
  "$windows.~bt",
  "recovery"
]);

const MAX_SCAN_DEPTH = 12;
const MAX_SCAN_FILES = 5000;

function shouldSkipDirectory(name = "") {
  const lower = name.toLowerCase();
  if (SKIPPED_DIRECTORIES.has(lower)) return true;
  // Hidden/system folders never contain a user music library worth scanning.
  return lower.startsWith(".") || lower.startsWith("$");
}

/**
 * Walks a File System Access directory handle and collects every playable file.
 * The walk never throws: an unreadable sub-folder is skipped so one bad folder
 * cannot make an entire drive look empty.
 */
async function collectAudioFiles(directoryHandle, files, prefix = "", depth = 0, stats = { seen: 0 }) {
  if (depth > MAX_SCAN_DEPTH || files.length >= MAX_SCAN_FILES) return stats;

  // `values()` is the modern API; `entries()` covers older Chromium builds.
  let iterator = null;
  if (typeof directoryHandle.values === "function") {
    iterator = directoryHandle.values();
  } else if (typeof directoryHandle.entries === "function") {
    iterator = directoryHandle.entries();
  } else {
    return stats;
  }

  try {
    for await (const item of iterator) {
      // entries() yields [name, handle] pairs, values() yields handles.
      const entry = Array.isArray(item) ? item[1] : item;
      if (!entry) continue;
      const name = entry.name ?? "";
      const path = prefix ? `${prefix}/${name}` : name;

      if (entry.kind === "directory") {
        if (shouldSkipDirectory(name)) continue;
        try {
          await collectAudioFiles(entry, files, path, depth + 1, stats);
        } catch {
          // Permission denied or removable media unplugged - keep scanning.
        }
        if (files.length >= MAX_SCAN_FILES) break;
        continue;
      }

      if (entry.kind !== "file") continue;
      stats.seen += 1;
      // Decide from the real File when the extension is missing/unknown, so files
      // like "track" with an audio MIME type are still added.
      const extension = fileExtension(name);
      if (extension && !AUDIO_EXTENSIONS.has(extension)) continue;

      try {
        const file = await entry.getFile();
        if (!isAudioFile(file)) continue;
        // Directory handles give no webkitRelativePath, so carry the path ourselves.
        try {
          Object.defineProperty(file, "relativePath", { value: path, configurable: true });
        } catch {
          // Non-configurable File implementations: the name alone is enough.
        }
        files.push(file);
        if (files.length >= MAX_SCAN_FILES) break;
      } catch {
        // Locked or in-use file - skip it.
      }
    }
  } catch {
    // Iteration itself failed (revoked permission): return what we already found.
  }

  return stats;
}

/**
 * Drag-and-drop folders surface as FileSystemEntry objects rather than Files.
 * `readEntries` returns them in ~100-item batches, so keep calling until it
 * returns an empty batch or the directory has been fully read.
 */
function readAllEntryBatches(entry) {
  return new Promise((resolve) => {
    const reader = entry.createReader();
    const all = [];
    const readNextBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!Array.isArray(batch) || batch.length === 0) {
            resolve(all);
            return;
          }
          all.push(...batch);
          readNextBatch();
        },
        () => resolve(all) // Unreadable folder: keep whatever was listed.
      );
    };
    readNextBatch();
  });
}

/** Same contract as collectAudioFiles, but for a dropped FileSystemEntry tree. */
async function collectAudioFromEntry(entry, files, prefix = "", depth = 0, stats = { seen: 0 }) {
  if (!entry || depth > MAX_SCAN_DEPTH || files.length >= MAX_SCAN_FILES) return stats;

  if (entry.isFile) {
    stats.seen += 1;
    const extension = fileExtension(entry.name ?? "");
    if (extension && !AUDIO_EXTENSIONS.has(extension)) return stats;
    try {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      if (!isAudioFile(file)) return stats;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      try {
        Object.defineProperty(file, "relativePath", { value: path, configurable: true });
      } catch {
        // Non-configurable File implementations: the name alone is enough.
      }
      files.push(file);
    } catch {
      // Locked or unreadable file - skip it.
    }
    return stats;
  }

  if (entry.isDirectory) {
    if (shouldSkipDirectory(entry.name ?? "")) return stats;
    const children = await readAllEntryBatches(entry);
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    for (const child of children) {
      await collectAudioFromEntry(child, files, nextPrefix, depth + 1, stats);
      if (files.length >= MAX_SCAN_FILES) break;
    }
  }

  return stats;
}

export function MusicProvider({ children }) {
  const audioRef = useRef(null);
  const tracksRef = useRef([]);
  const isPlayingRef = useRef(false);
  const [tracks, setTracks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(safeInitialVolume);
  const [libraryName, setLibraryName] = useState("Local library");
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanStatus, setScanStatus] = useState("");

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      const nextLength = tracksRef.current.length;
      if (nextLength === 0) return;
      setCurrentIndex((index) => (index + 1) % nextLength);
      setIsPlaying(true);
    };
    const onError = () => setScanError("This file could not be played by the browser.");

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Keep the current audio element in sync when the selected track changes.
  useEffect(() => {
    const audio = audioRef.current;
    const track = tracks[currentIndex];
    if (!audio) return;
    setCurrentTime(0);
    setDuration(0);
    if (!track) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }
    audio.src = track.url;
    audio.load();
    if (isPlayingRef.current) {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentIndex, tracks]);

  useEffect(() => {
    if (tracks.length > 0 && currentIndex >= tracks.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, tracks.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => () => {
    tracksRef.current.forEach((track) => URL.revokeObjectURL(track.url));
  }, []);

  const addFiles = useCallback((fileList, source = "Local library", options = {}) => {
    const { silentWhenEmpty = false } = options;
    const incoming = Array.from(fileList ?? []).filter(isAudioFile);
    if (incoming.length === 0) {
      if (!silentWhenEmpty) {
        setScanError("No supported audio files were found. Try MP3, WAV, M4A, OGG or FLAC.");
      }
      return 0;
    }

    setScanError("");
    setLibraryName(source);
    setTracks((existing) => {
      const existingKeys = new Set(existing.map((track) => track.key));
      const additions = [];
      incoming.forEach((file) => {
        const key = fileKey(file);
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        additions.push({
          key,
          name: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          path: file.relativePath || file.webkitRelativePath || file.name,
          url: URL.createObjectURL(file)
        });
      });
      return additions.length > 0 ? [...existing, ...additions] : existing;
    });
    return incoming.length;
  }, []);

  const openFolderInput = useCallback(() => {
    const input = document.getElementById("ananta-music-folder-input");
    if (input) {
      input.click();
      return true;
    }
    return false;
  }, []);

  // The classic <input webkitdirectory> picker is supported by every modern
  // browser (Chrome, Edge, Firefox, Safari) and also works inside embedded
  // frames, where showDirectoryPicker is blocked with a SecurityError. It
  // returns the whole folder tree (all sub-folders) in one change event.
  const supportsFolderInput = useCallback(() => {
    try {
      return typeof document !== "undefined" && "webkitdirectory" in document.createElement("input");
    } catch {
      return false;
    }
  }, []);

  /** Shared reporting for every folder source (picker, drop, fallback walk). */
  const reportFolderResult = useCallback((added, total, folderName) => {
    if (added > 0) {
      setScanError("");
      let status = `Added ${added} song${added === 1 ? "" : "s"} from “${folderName}”.`;
      if (total >= MAX_SCAN_FILES) status += ` First ${MAX_SCAN_FILES} songs loaded — scan smaller sub-folders for the rest.`;
      setScanStatus(status);
    } else {
      setScanStatus("");
      setScanError(
        total > 0
          ? `Scanned ${total} file${total === 1 ? "" : "s"} in “${folderName}” but found no MP3/WAV/M4A/OGG/FLAC audio. Pick the folder that directly contains your music, or use “Add songs”.`
          : `“${folderName}” looks empty or could not be read. Pick the music folder itself, or use “Add songs”.`
      );
    }
  }, []);

  /** Called by the hidden webkitdirectory input after a folder is picked. */
  const handleFolderFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) return; // Dialog was cancelled.
      const folderName = files[0].webkitRelativePath?.split("/")[0] || "Selected folder";
      setIsScanning(true);
      try {
        const added = addFiles(files, folderName, { silentWhenEmpty: true });
        reportFolderResult(added, files.length, folderName);
      } finally {
        setIsScanning(false);
      }
    },
    [addFiles, reportFolderResult]
  );

  /** Drag-and-drop of a folder: walk the dropped entry tree for audio. */
  const scanDroppedEntries = useCallback(
    async (entries) => {
      if (!entries || entries.length === 0) return;
      setIsScanning(true);
      setScanError("");
      setScanStatus("");
      try {
        const files = [];
        let stats = { seen: 0 };
        for (const entry of entries) {
          stats = await collectAudioFromEntry(entry, files, "", 0, stats);
        }
        const folderName = entries[0]?.name || "Dropped folder";
        const added = addFiles(files, folderName, { silentWhenEmpty: true });
        reportFolderResult(added, Math.max(stats.seen, files.length), folderName);
      } catch {
        setScanError("The dropped folder could not be read. Try “Scan folder / drive” instead.");
      } finally {
        setIsScanning(false);
      }
    },
    [addFiles, reportFolderResult]
  );

  const scanFolder = useCallback(async () => {
    setScanError("");
    setScanStatus("");

    // 1st choice: the webkitdirectory input — universal and iframe-safe.
    if (supportsFolderInput() && openFolderInput()) return;

    // Fallback: File System Access API walk (older Chromium without the input).
    const canUsePicker = typeof window !== "undefined"
      && typeof window.showDirectoryPicker === "function"
      && window.isSecureContext !== false;

    if (!canUsePicker) {
      if (!openFolderInput()) {
        setScanError("This browser cannot open folders. Use “Add songs” to pick files instead.");
      }
      return;
    }

    let directory = null;
    try {
      // `startIn: "music"` opens the OS music library (not the app/download
      // folder) as a starting point. The dialog is a normal system file dialog,
      // so any folder on any drive can still be navigated to and selected.
      directory = await window.showDirectoryPicker({ mode: "read", startIn: "music" });
    } catch (error) {
      if (error?.name === "AbortError") return;
      // Some builds reject unknown `startIn` values - retry without it.
      try {
        directory = await window.showDirectoryPicker({ mode: "read" });
      } catch (retryError) {
        if (retryError?.name === "AbortError") return;
        if (!openFolderInput()) {
          setScanError("The folder picker was blocked by the browser. Use “Add songs” instead.");
        }
        return;
      }
    }

    if (!directory) return;

    setIsScanning(true);
    try {
      // Explicitly request read permission; without it the walk yields nothing.
      if (typeof directory.queryPermission === "function") {
        let permission = await directory.queryPermission({ mode: "read" });
        if (permission === "prompt" && typeof directory.requestPermission === "function") {
          permission = await directory.requestPermission({ mode: "read" });
        }
        if (permission === "denied") {
          setScanError(`Read access to “${directory.name}” was denied. Allow access and scan again.`);
          return;
        }
      }

      const files = [];
      const stats = await collectAudioFiles(directory, files);
      const added = addFiles(files, directory.name, { silentWhenEmpty: true });
      reportFolderResult(added, stats.seen, directory.name);
    } catch (error) {
      if (error?.name !== "AbortError") {
        setScanError("The folder could not be scanned. Check the browser permission and try again.");
      }
    } finally {
      setIsScanning(false);
    }
  }, [addFiles, openFolderInput, reportFolderResult, supportsFolderInput]);

  const removeTrack = useCallback((key) => {
    const track = tracks.find((item) => item.key === key);
    if (!track) return;
    const removedIndex = tracks.indexOf(track);
    URL.revokeObjectURL(track.url);
    if (removedIndex === currentIndex) setIsPlaying(false);
    if (removedIndex < currentIndex) setCurrentIndex((index) => Math.max(0, index - 1));
    setTracks((items) => items.filter((item) => item.key !== key));
  }, [currentIndex, tracks]);

  const clearLibrary = useCallback(() => {
    tracks.forEach((track) => URL.revokeObjectURL(track.url));
    audioRef.current?.pause();
    setTracks([]);
    setCurrentIndex(0);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setLibraryName("Local library");
  }, [tracks]);

  const playTrack = useCallback((index) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    if (tracks.length === 0) {
      setIsOpen(true);
      return;
    }
    if (duration > 0 && currentTime >= duration - 0.25) {
      const audio = audioRef.current;
      if (audio) audio.currentTime = 0;
    }
    setIsPlaying((playing) => !playing);
  }, [currentTime, duration, tracks.length]);

  const nextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentIndex((index) => (index + 1) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length]);

  const previousTrack = useCallback(() => {
    if (tracks.length === 0) return;
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    setCurrentIndex((index) => (index - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  }, [currentTime, tracks.length]);

  const seek = useCallback((value) => {
    const nextTime = Number(value);
    if (audioRef.current && Number.isFinite(nextTime)) {
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  }, []);

  const setVolume = useCallback((value) => {
    const nextVolume = Math.min(1, Math.max(0, Number(value)));
    setVolumeState(nextVolume);
    if (audioRef.current) audioRef.current.volume = nextVolume;
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(nextVolume));
    } catch {
      // Local storage can be disabled; playback itself still works.
    }
  }, []);

  const value = useMemo(() => ({
    tracks,
    currentTrack: tracks[currentIndex] ?? null,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    libraryName,
    isOpen,
    isScanning,
    scanError,
    scanStatus,
    setIsOpen,
    addFiles,
    handleFolderFiles,
    scanDroppedEntries,
    scanFolder,
    removeTrack,
    clearLibrary,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    formatTime
  }), [
    addFiles,
    clearLibrary,
    currentIndex,
    currentTime,
    duration,
    handleFolderFiles,
    isOpen,
    isPlaying,
    isScanning,
    libraryName,
    nextTrack,
    playTrack,
    previousTrack,
    removeTrack,
    scanDroppedEntries,
    scanError,
    scanFolder,
    scanStatus,
    seek,
    setVolume,
    togglePlay,
    tracks,
    volume
  ]);

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used inside MusicProvider");
  return context;
}

function IconButton({ label, children, onClick, disabled = false, className = "" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx("music-icon-button", className)}>
      {children}
    </button>
  );
}

export function MusicPlayer() {
  const music = useMusic();
  const folderInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const current = music.currentTrack;
  const progressMax = music.duration > 0 ? music.duration : 1;

  // React strips unknown casings, so the directory attributes are set imperatively.
  // They must stay paired with no `accept` filter: Chrome drops whole directory
  // listings when `accept` and `webkitdirectory` are combined.
  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.setAttribute("mozdirectory", "");
  }, []);

  return (
    <>
      <input
        id="ananta-music-folder-input"
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          // Reset first so picking the same folder again still fires `change`.
          event.target.value = "";
          music.handleFolderFiles(files);
        }} />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.aif,.aiff,.flac,.m4a,.mka,.mp3,.mp4,.ogg,.opus,.wav,.webm"
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) music.addFiles(event.target.files, "Selected songs");
          event.target.value = "";
        }} />

      <div className="music-control-group">
        <button
          type="button"
          className={cx("music-toggle", music.isPlaying && "music-toggle-active")}
          onClick={music.togglePlay}
          aria-label={music.isPlaying ? "Pause music" : "Play music"}
          title={music.isPlaying ? "Pause music" : "Play music"}>
          <span className="music-toggle-icon">
            {music.isPlaying ? <AudioLines size={16} /> : <Music2 size={16} />}
          </span>
          <span className="hidden sm:inline">{music.isPlaying ? "Playing" : "Music"}</span>
          {music.tracks.length > 0 && <span className="music-count">{music.tracks.length}</span>}
        </button>
        <button
          type="button"
          className="music-toggle-panel"
          onClick={() => music.setIsOpen((open) => !open)}
          aria-expanded={music.isOpen}
          aria-label="Open music queue"
          title="Open music queue">
          <ChevronDown size={14} className={cx("transition-transform", music.isOpen && "rotate-180")} />
        </button>
      </div>

      {music.isOpen && (
        <section
          className="music-panel"
          aria-label="Local music player"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            // Dropped folders arrive as entries, plain files as a FileList.
            const entries = Array.from(event.dataTransfer.items ?? [])
              .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null))
              .filter(Boolean);
            if (entries.some((entry) => entry.isDirectory)) {
              music.scanDroppedEntries(entries);
              return;
            }
            music.addFiles(event.dataTransfer.files, "Dropped songs");
          }}>
          <div className="music-panel-header">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="music-panel-mark"><Music2 size={17} /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-graphite-900">Work mode playlist</p>
                <p className="truncate text-[11px] text-graphite-500">{music.libraryName} · {music.tracks.length} song{music.tracks.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <IconButton label="Close music player" onClick={() => music.setIsOpen(false)}><X size={17} /></IconButton>
          </div>

          {current ? (
            <div className="music-now-playing">
              <div className="music-cover"><Music2 size={25} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-graphite-900">{current.name}</p>
                <p className="truncate text-[11px] text-graphite-500">{current.path}</p>
              </div>
              <span className="music-playing-dot" aria-label={music.isPlaying ? "Playing" : "Paused"} />
            </div>
          ) : (
            <div className="music-empty">
              <ListMusic size={26} />
              <p className="mt-2 text-sm font-semibold text-graphite-900">Bring your soundtrack</p>
              <p className="mt-1 max-w-[280px] text-center text-xs leading-5 text-graphite-500">
                Choose a folder or drop songs here. Your browser will ask permission before reading local files.
              </p>
            </div>
          )}

          {current && (
            <>
              <div className="music-progress">
                <input
                  aria-label="Song progress"
                  type="range"
                  min="0"
                  max={progressMax}
                  step="0.1"
                  value={Math.min(music.currentTime, progressMax)}
                  onChange={(event) => music.seek(event.target.value)} />
                <div className="flex justify-between text-[10px] font-medium tabular-nums text-graphite-500">
                  <span>{music.formatTime(music.currentTime)}</span>
                  <span>{music.formatTime(music.duration)}</span>
                </div>
              </div>
              <div className="music-controls">
                <IconButton label="Previous song" onClick={music.previousTrack}><SkipBack size={18} /></IconButton>
                <button type="button" className="music-play-button" onClick={music.togglePlay} aria-label={music.isPlaying ? "Pause song" : "Play song"}>
                  {music.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <IconButton label="Next song" onClick={music.nextTrack}><SkipForward size={18} /></IconButton>
                <div className="music-volume ml-auto">
                  <Volume2 size={14} />
                  <input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={music.volume} onChange={(event) => music.setVolume(event.target.value)} />
                </div>
              </div>
            </>
          )}

          {music.scanError && <p className="music-error">{music.scanError}</p>}
          {!music.scanError && music.scanStatus && <p className="music-status">{music.scanStatus}</p>}

          <div className="music-actions">
            <button type="button" className="music-action-button" onClick={music.scanFolder} disabled={music.isScanning}>
              <ScanSearch size={15} /> {music.isScanning ? "Scanning…" : "Scan folder / drive"}
            </button>
            <button type="button" className="music-action-button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} /> Add songs
            </button>
          </div>
          <p className="music-help">Pick any folder on any drive (C:, D:, external disks) — every song inside it and its sub-folders is added at once. You can also drag a whole folder here.</p>

          {music.tracks.length > 0 && (
            <div className="music-library-list">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-graphite-500">Queue</p>
                <button type="button" className="music-clear-button" onClick={music.clearLibrary}><Trash2 size={12} /> Clear</button>
              </div>
              {music.tracks.map((track, index) => (
                <div key={track.key} className={cx("music-track-row", index === music.currentIndex && "music-track-active")}>
                  <button type="button" className="music-track-select" onClick={() => music.playTrack(index)}>
                    <span className="music-track-index">{index === music.currentIndex && music.isPlaying ? <AudioLines size={13} /> : index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">{track.name}</span>
                  </button>
                  <IconButton label={`Remove ${track.name}`} onClick={() => music.removeTrack(track.key)} className="!h-6 !w-6"><X size={13} /></IconButton>
                </div>
              ))}
            </div>
          )}

          {!current && (
            <div className="mt-3 flex gap-2">
              <button type="button" className="music-primary-action" onClick={music.scanFolder} disabled={music.isScanning}><FolderOpen size={15} /> Choose folder</button>
              <button type="button" className="music-secondary-action" onClick={() => fileInputRef.current?.click()}><Plus size={15} /> Files</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
