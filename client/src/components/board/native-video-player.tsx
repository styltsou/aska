import {
  LoaderCircleIcon,
  Maximize2Icon,
  Minimize2Icon,
  PlayIcon,
  RotateCcwIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { MorphStateIcon } from "@/components/ui/morph-state-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FLOATING_MENU_SURFACE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { VideoAsset } from "@/types/asset";

const CONTROL_HIDE_DELAY_MS = 1_800;
const BUFFERING_SPINNER_DELAY_MS = 180;
const SEEK_STEP_SECONDS = 10;
const VIDEO_PLAYER_RAIL_CLASS = "bg-white/20";
const VIDEO_PLAYER_PREFERENCES_KEY = "aska.video-player-preferences:v2";
const LEGACY_VIDEO_PLAYER_PREFERENCES_KEY = "aska.video-player-preferences:v1";

type VideoPlayerPreferences = {
  volume: number;
  muted: boolean;
  showRemainingTime: boolean;
};

const DEFAULT_VIDEO_PLAYER_PREFERENCES: VideoPlayerPreferences = {
  volume: 1,
  muted: false,
  showRemainingTime: false,
};

function readVideoPlayerPreferences(): VideoPlayerPreferences {
  try {
    const raw =
      window.localStorage.getItem(VIDEO_PLAYER_PREFERENCES_KEY) ??
      window.localStorage.getItem(LEGACY_VIDEO_PLAYER_PREFERENCES_KEY);
    if (!raw) return DEFAULT_VIDEO_PLAYER_PREFERENCES;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("volume" in parsed) ||
      !("muted" in parsed) ||
      typeof parsed.volume !== "number" ||
      !Number.isFinite(parsed.volume) ||
      parsed.volume < 0 ||
      parsed.volume > 1 ||
      typeof parsed.muted !== "boolean"
    ) {
      return DEFAULT_VIDEO_PLAYER_PREFERENCES;
    }

    return {
      volume: parsed.volume,
      muted: parsed.muted,
      showRemainingTime:
        "showRemainingTime" in parsed &&
        typeof parsed.showRemainingTime === "boolean"
          ? parsed.showRemainingTime
          : false,
    };
  } catch {
    return DEFAULT_VIDEO_PLAYER_PREFERENCES;
  }
}

function saveVideoPlayerPreferences(preferences: VideoPlayerPreferences) {
  try {
    window.localStorage.setItem(
      VIDEO_PLAYER_PREFERENCES_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // Video playback should still work when browser storage is unavailable.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3_600);
  const minutes = Math.floor((whole % 3_600) / 60);
  const remainder = String(whole % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

export function NativeVideoPlayer({
  src,
  poster,
  title,
  storyboard,
  initialTime,
  continuePlaying = false,
  fit = "contain",
}: {
  src: string;
  poster?: string;
  title: string;
  storyboard?: VideoAsset["storyboard"];
  initialTime?: number;
  continuePlaying?: boolean;
  fit?: "contain" | "cover";
}) {
  const [initialPlayerPreferences] = useState(readVideoPlayerPreferences);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const waitingTimerRef = useRef<number | undefined>(undefined);
  const handoffAppliedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [ended, setEnded] = useState(false);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [muted, setMuted] = useState(
    continuePlaying || initialPlayerPreferences.muted,
  );
  const [volume, setVolume] = useState(initialPlayerPreferences.volume);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const [storyboardReady, setStoryboardReady] = useState(false);
  const [volumeSliderExpanded, setVolumeSliderExpanded] = useState(false);
  const [showRemainingTime, setShowRemainingTime] = useState(
    initialPlayerPreferences.showRemainingTime,
  );
  const [hover, setHover] = useState<{ seconds: number; percent: number }>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [muted, volume]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== undefined) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearHideTimer();
    const controlsHaveFocus = controlsRef.current?.contains(
      document.activeElement,
    );
    if (!videoRef.current?.paused && !controlsHaveFocus) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
        hideTimerRef.current = undefined;
      }, CONTROL_HIDE_DELAY_MS);
    }
  }, [clearHideTimer]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  const clearWaiting = useCallback(() => {
    if (waitingTimerRef.current !== undefined) {
      window.clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = undefined;
    }
    setWaiting(false);
  }, []);

  const delayWaitingIndicator = useCallback(() => {
    if (waitingTimerRef.current !== undefined) {
      window.clearTimeout(waitingTimerRef.current);
    }
    waitingTimerRef.current = window.setTimeout(() => {
      waitingTimerRef.current = undefined;
      setWaiting(true);
    }, BUFFERING_SPINNER_DELAY_MS);
  }, []);

  useEffect(
    () => () => {
      if (waitingTimerRef.current !== undefined) {
        window.clearTimeout(waitingTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const updateFullscreenState = () => {
      setPlayerFullscreen(document.fullscreenElement === playerRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (ended || video.ended) {
      video.currentTime = 0;
      setCurrentTime(0);
      setEnded(false);
    }
    try {
      await video.play();
    } catch {
      setPlaying(false);
      setControlsVisible(true);
    }
  }, [ended]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void play();
    else video.pause();
  }, [play]);

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const next = clamp(seconds, 0, video.duration);
    video.currentTime = next;
    setCurrentTime(next);
    setEnded(next >= video.duration);
  }, []);

  const handleProgressChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      seekTo(Number(event.currentTarget.value));
    },
    [seekTo],
  );

  const handleVolumeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const next = clamp(Number(event.currentTarget.value), 0, 1);
      video.volume = next;
      video.muted = next === 0;
      setVolume(next);
      setMuted(next === 0);
      saveVideoPlayerPreferences({
        volume: next,
        muted: next === 0,
        showRemainingTime,
      });
    },
    [showRemainingTime],
  );

  const toggleMuted = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    if (!next && video.volume === 0) {
      video.volume = 0.75;
      setVolume(0.75);
    }
    setMuted(next);
    saveVideoPlayerPreferences({
      volume: video.volume,
      muted: next,
      showRemainingTime,
    });
  }, [showRemainingTime]);

  const togglePlayerFullscreen = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (document.fullscreenElement === player) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void player.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(nextDuration);

    if (handoffAppliedRef.current || initialTime === undefined) return;
    handoffAppliedRef.current = true;
    const target = clamp(initialTime, 0, Math.max(0, nextDuration - 0.1));
    video.currentTime = target;
    setCurrentTime(target);

    if (continuePlaying) {
      // The hover preview is muted, so keep the handoff muted. This also makes
      // the async autoplay reliable under browser media policies.
      video.muted = true;
      setMuted(true);
      void play();
    }
  }, [continuePlaying, initialTime, play]);

  const updateBufferedTime = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) {
      setBufferedTime(0);
      return;
    }
    setBufferedTime(video.buffered.end(video.buffered.length - 1));
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLButtonElement
      ) {
        return;
      }

      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - SEEK_STEP_SECONDS);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + SEEK_STEP_SECONDS);
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMuted();
      }
    },
    [currentTime, seekTo, toggleMuted, togglePlayback],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buffered = duration > 0 ? (bufferedTime / duration) * 100 : 0;
  const storyboardIndex =
    hover && storyboard
      ? clamp(
          Math.floor(hover.seconds / storyboard.intervalSeconds),
          0,
          storyboard.frameCount - 1,
        )
      : 0;
  const storyboardRows = storyboard
    ? Math.ceil(storyboard.frameCount / storyboard.columns)
    : 0;
  const volumePercent = muted ? 0 : volume * 100;
  const controlButtonClass =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-white/85 shadow-none outline-none transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 active:bg-white/15";

  return (
    <div
      ref={playerRef}
      className="group/player absolute inset-0 overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerMove={revealControls}
      onPointerLeave={() => {
        const controlsHaveFocus = controlsRef.current?.contains(
          document.activeElement,
        );
        if (playing && !controlsHaveFocus) {
          clearHideTimer();
          setControlsVisible(false);
        }
      }}
      onFocusCapture={() => {
        clearHideTimer();
        setControlsVisible(true);
      }}
      onBlurCapture={scheduleControlsHide}
      aria-label={`${title} video player`}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={muted}
        playsInline
        preload="metadata"
        className={cn(
          "absolute inset-0 size-full",
          fit === "cover" && !playerFullscreen
            ? "object-cover"
            : "object-contain",
        )}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration)
              ? event.currentTarget.duration
              : 0,
          )
        }
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onProgress={updateBufferedTime}
        onPlay={() => {
          setPlaying(true);
          clearWaiting();
          setEnded(false);
          scheduleControlsHide();
        }}
        onPlaying={clearWaiting}
        onPause={() => {
          clearHideTimer();
          clearWaiting();
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={delayWaitingIndicator}
        onCanPlay={clearWaiting}
        onEnded={(event) => {
          setPlaying(false);
          setCurrentTime(event.currentTarget.duration);
          setEnded(true);
          setControlsVisible(true);
        }}
        onError={() => {
          setFailed(true);
          clearWaiting();
        }}
      />
      {storyboard?.url ? (
        <img
          src={storyboard.url}
          alt=""
          aria-hidden="true"
          className="hidden"
          onLoad={() => setStoryboardReady(true)}
          onError={() => setStoryboardReady(false)}
        />
      ) : null}

      {!failed ? (
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset"
          aria-label={
            ended ? "Replay video" : playing ? "Pause video" : "Play video"
          }
          onClick={togglePlayback}
        >
          {!playing ? (
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-[background-color,transform,ring-color] duration-150 ease-out hover:scale-[1.04] hover:bg-black/60 hover:ring-white/25 motion-reduce:transition-none",
                "absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2",
              )}
            >
              {ended ? (
                <RotateCcwIcon className="size-5" />
              ) : (
                <PlayIcon className="ml-0.5 size-5 fill-current" />
              )}
            </span>
          ) : null}
        </button>
      ) : null}

      {waiting && playing && !failed ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <LoaderCircleIcon className="size-10 animate-spin stroke-[1.5] text-white" />
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm text-white/75">
          This video could not be played.
        </div>
      ) : null}

      {!failed ? (
        <div
          ref={controlsRef}
          className={cn(
            "absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1 bg-linear-to-t from-black/80 via-black/35 to-transparent px-3 pt-8 pb-2 transition-opacity duration-150 motion-reduce:transition-none sm:pb-3",
            controlsVisible || !playing
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
          onPointerDown={(event: PointerEvent<HTMLDivElement>) =>
            event.stopPropagation()
          }
          onPointerLeave={() => setVolumeSliderExpanded(false)}
        >
          <div className="group/progress relative flex h-4 min-w-0 items-center">
            {hover ? (
              <div
                className={cn(
                  "pointer-events-none absolute bottom-full z-40 mb-2 -translate-x-1/2 rounded-lg p-1 text-center",
                  FLOATING_MENU_SURFACE_CLASS,
                  "bg-popover/50",
                )}
                style={{ left: `${clamp(hover.percent, 0, 100)}%` }}
                aria-hidden="true"
              >
                {storyboard && storyboardReady ? (
                  <div
                    className="rounded-sm bg-black"
                    style={{
                      width: storyboard.tileWidth,
                      height: storyboard.tileHeight,
                      backgroundImage: `url(${storyboard.url})`,
                      backgroundSize: `${storyboard.columns * storyboard.tileWidth}px ${storyboardRows * storyboard.tileHeight}px`,
                      backgroundPosition: `-${(storyboardIndex % storyboard.columns) * storyboard.tileWidth}px -${Math.floor(storyboardIndex / storyboard.columns) * storyboard.tileHeight}px`,
                    }}
                  />
                ) : null}
                <span className="block px-1 pt-0.5 text-xs font-medium tabular-nums">
                  {formatTime(hover.seconds)}
                </span>
              </div>
            ) : null}
            <div
              className={cn(
                "pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full transition-[height] duration-150 group-focus-within/progress:h-2.5 group-hover/progress:h-2.5 motion-reduce:transition-none",
                VIDEO_PLAYER_RAIL_CLASS,
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-white/35"
                style={{ width: `${clamp(buffered, 0, 100)}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 bg-white"
                style={{ width: `${clamp(progress, 0, 100)}%` }}
              />
            </div>
            <span
              className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity duration-150 group-focus-within/progress:opacity-100 group-hover/progress:opacity-100"
              style={{ left: `${clamp(progress, 0, 100)}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step="any"
              value={Math.min(currentTime, duration || 0.01)}
              disabled={duration <= 0}
              onChange={handleProgressChange}
              onPointerDown={() => {
                clearHideTimer();
                setControlsVisible(true);
              }}
              onPointerMove={(event) => {
                if (duration <= 0) return;
                if (event.pointerType === "touch" && event.buttons === 0)
                  return;
                const bounds = event.currentTarget.getBoundingClientRect();
                const percent = clamp(
                  ((event.clientX - bounds.left) / bounds.width) * 100,
                  0,
                  100,
                );
                setHover({ seconds: (percent / 100) * duration, percent });
              }}
              onPointerLeave={() => setHover(undefined)}
              onPointerUp={(event) => {
                if (event.pointerType === "touch") setHover(undefined);
                scheduleControlsHide();
              }}
              onFocus={() => {
                if (duration > 0)
                  setHover({
                    seconds: currentTime,
                    percent: (currentTime / duration) * 100,
                  });
              }}
              onBlur={() => setHover(undefined)}
              onKeyUp={() => {
                if (duration > 0)
                  setHover({
                    seconds: videoRef.current?.currentTime ?? currentTime,
                    percent:
                      ((videoRef.current?.currentTime ?? currentTime) /
                        duration) *
                      100,
                  });
              }}
              className="absolute inset-0 m-0 size-full cursor-pointer opacity-0"
              aria-label="Video progress"
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            />
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-0.5">
              <div className="flex shrink-0 items-center gap-0.5">
                <PlayerControlButton
                  label={`Back ${SEEK_STEP_SECONDS} seconds`}
                  onClick={() => seekTo(currentTime - SEEK_STEP_SECONDS)}
                  className={controlButtonClass}
                >
                  <SkipBackIcon className="size-4 fill-current" />
                </PlayerControlButton>
                <PlayerControlButton
                  label={
                    ended
                      ? "Replay video"
                      : playing
                        ? "Pause video"
                        : "Play video"
                  }
                  onClick={togglePlayback}
                  className={controlButtonClass}
                >
                  <MorphStateIcon
                    icon={ended ? RotateCcw : playing ? Pause : Play}
                    className={cn("size-4", !ended && "fill-current")}
                    strokeWidth={ended ? 2.25 : 0}
                  />
                </PlayerControlButton>
                <PlayerControlButton
                  label={`Forward ${SEEK_STEP_SECONDS} seconds`}
                  onClick={() => seekTo(currentTime + SEEK_STEP_SECONDS)}
                  className={controlButtonClass}
                >
                  <SkipForwardIcon className="size-4 fill-current" />
                </PlayerControlButton>
              </div>

              <div
                className="group/volume flex items-center rounded-md transition-colors duration-150 focus-within:bg-white/10 hover:bg-white/10"
                onPointerEnter={() => setVolumeSliderExpanded(true)}
                onFocusCapture={() => setVolumeSliderExpanded(true)}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-transparent p-0 text-white/85 shadow-none transition-colors duration-150 outline-none hover:bg-transparent hover:text-white focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-white/60 active:bg-transparent"
                        aria-label={
                          muted || volume === 0 ? "Unmute video" : "Mute video"
                        }
                        onClick={(event) => {
                          toggleMuted();
                          event.currentTarget.blur();
                          scheduleControlsHide();
                        }}
                      />
                    }
                  >
                    <MorphStateIcon
                      icon={muted || volume === 0 ? VolumeX : Volume2}
                      className="size-4"
                      strokeWidth={2.25}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {muted || volume === 0 ? "Unmute video" : "Mute video"}
                  </TooltipContent>
                </Tooltip>
                <div
                  className={cn(
                    "relative h-8 overflow-hidden transition-[width,opacity] duration-200 ease-out group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 motion-reduce:transition-none",
                    volumeSliderExpanded ? "w-20 opacity-100" : "w-0 opacity-0",
                  )}
                >
                  <div className="relative flex size-full items-center px-1">
                    <div
                      className={cn(
                        "pointer-events-none absolute right-1 left-1 h-1.5 overflow-hidden rounded-full transition-[height] duration-150 group-focus-within/volume:h-2 group-hover/volume:h-2 motion-reduce:transition-none",
                        VIDEO_PLAYER_RAIL_CLASS,
                      )}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-white"
                        style={{ width: `${volumePercent}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={handleVolumeChange}
                      onPointerDown={clearHideTimer}
                      onPointerUp={(event) => {
                        event.currentTarget.blur();
                        scheduleControlsHide();
                      }}
                      onPointerCancel={(event) => {
                        event.currentTarget.blur();
                        scheduleControlsHide();
                      }}
                      className="absolute inset-0 m-0 size-full cursor-pointer opacity-0"
                      aria-label="Video volume"
                      aria-valuetext={`${Math.round(volumePercent)}%`}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="relative top-px inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md px-1 text-xs font-medium text-white/80 tabular-nums transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none active:bg-white/15 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-white/80"
                aria-label="Toggle between elapsed and remaining video time"
                title="Toggle elapsed/remaining time"
                disabled={duration <= 0}
                onClick={() => {
                  const next = !showRemainingTime;
                  setShowRemainingTime(next);
                  saveVideoPlayerPreferences({
                    volume,
                    muted,
                    showRemainingTime: next,
                  });
                  scheduleControlsHide();
                }}
              >
                {showRemainingTime
                  ? `-${formatTime(Math.max(0, duration - currentTime))}`
                  : formatTime(currentTime)}
                {` / ${formatTime(duration)}`}
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <PlayerControlButton
                label={
                  playerFullscreen
                    ? "Exit player full screen"
                    : "Full screen player"
                }
                onClick={togglePlayerFullscreen}
                className={controlButtonClass}
              >
                {playerFullscreen ? (
                  <Minimize2Icon className="size-4" />
                ) : (
                  <Maximize2Icon className="size-4" />
                )}
              </PlayerControlButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerControlButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={className}
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
