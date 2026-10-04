import {
  LoaderCircleIcon,
  PauseIcon,
  PlayIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { VIDEO_CARD_PLAY_BUTTON_CLASS } from "@/components/board/video-card-control-styles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VideoAsset } from "@/types/asset";

const CONTROL_HIDE_DELAY_MS = 1_800;
const SEEK_STEP_SECONDS = 5;

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
}: {
  src: string;
  poster?: string;
  title: string;
  storyboard?: VideoAsset["storyboard"];
  initialTime?: number;
  continuePlaying?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const handoffAppliedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [muted, setMuted] = useState(continuePlaying);
  const [volume, setVolume] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [storyboardReady, setStoryboardReady] = useState(false);
  const [hover, setHover] = useState<{ seconds: number; percent: number }>();

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

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
    } catch {
      setPlaying(false);
      setControlsVisible(true);
    }
  }, []);

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
    },
    [],
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
    "size-8 rounded-md border-transparent bg-transparent text-white shadow-none hover:bg-white/15 hover:text-white focus-visible:border-white/30 focus-visible:ring-white/35 dark:hover:bg-white/15";

  return (
    <div
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
        className="absolute inset-0 size-full object-contain"
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
          setWaiting(false);
          scheduleControlsHide();
        }}
        onPlaying={() => setWaiting(false)}
        onPause={() => {
          clearHideTimer();
          setPlaying(false);
          setControlsVisible(true);
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => setWaiting(false)}
        onEnded={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onError={() => {
          setFailed(true);
          setWaiting(false);
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
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={togglePlayback}
        >
          {!playing && !waiting ? (
            <span
              className={cn(
                VIDEO_CARD_PLAY_BUTTON_CLASS,
                "absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2",
              )}
            >
              <PlayIcon className="ml-0.5 size-5 fill-current" />
            </span>
          ) : null}
        </button>
      ) : null}

      {waiting && !failed ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md">
            <LoaderCircleIcon className="size-5 animate-spin" />
          </span>
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
            "absolute inset-x-0 bottom-0 z-30 bg-linear-to-t from-black/80 via-black/35 to-transparent px-2.5 pt-12 pb-2.5 transition-opacity duration-150 motion-reduce:transition-none sm:px-3 sm:pb-3",
            controlsVisible || !playing
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
          onPointerDown={(event: PointerEvent<HTMLDivElement>) =>
            event.stopPropagation()
          }
        >
          <div className="rounded-xl border border-white/15 bg-black/55 p-2 text-white shadow-lg backdrop-blur-md">
            <div className="group/progress relative flex h-5 items-center">
              {hover ? (
                <div
                  className="pointer-events-none absolute bottom-full z-40 mb-2 -translate-x-1/2 rounded-lg border border-white/15 bg-black/85 p-1 text-center text-white shadow-xl backdrop-blur-md"
                  style={{
                    left: `clamp(5.25rem, ${hover.percent}%, calc(100% - 5.25rem))`,
                  }}
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
              <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/20 transition-[height] duration-100 group-focus-within/progress:h-1.5 group-hover/progress:h-1.5 motion-reduce:transition-none">
                <span
                  className="absolute inset-y-0 left-0 bg-white/30"
                  style={{ width: `${clamp(buffered, 0, 100)}%` }}
                />
                <span
                  className="absolute inset-y-0 left-0 bg-white"
                  style={{ width: `${clamp(progress, 0, 100)}%` }}
                />
              </div>
              <span
                className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity duration-100 group-focus-within/progress:opacity-100 group-hover/progress:opacity-100"
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

            <div className="flex h-8 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={controlButtonClass}
                aria-label={playing ? "Pause video" : "Play video"}
                onClick={togglePlayback}
              >
                {playing ? (
                  <PauseIcon className="size-4 fill-current" />
                ) : (
                  <PlayIcon className="ml-0.5 size-4 fill-current" />
                )}
              </Button>

              <div className="group/volume flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={controlButtonClass}
                  aria-label={
                    muted || volume === 0 ? "Unmute video" : "Mute video"
                  }
                  onClick={toggleMuted}
                >
                  {muted || volume === 0 ? (
                    <VolumeXIcon className="size-4" />
                  ) : (
                    <Volume2Icon className="size-4" />
                  )}
                </Button>
                <div className="relative hidden w-0 overflow-hidden opacity-0 transition-[width,opacity] duration-150 group-focus-within/volume:w-20 group-focus-within/volume:opacity-100 group-hover/volume:w-20 group-hover/volume:opacity-100 motion-reduce:transition-none sm:block">
                  <div className="relative flex h-8 w-20 items-center px-1">
                    <div className="pointer-events-none absolute right-1 left-1 h-1 overflow-hidden rounded-full bg-white/20">
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
                      className="absolute inset-0 m-0 size-full cursor-pointer opacity-0"
                      aria-label="Video volume"
                      aria-valuetext={`${Math.round(volumePercent)}%`}
                    />
                  </div>
                </div>
              </div>

              <span className="ml-0.5 text-xs font-medium text-white/90 tabular-nums">
                {formatTime(currentTime)}
                <span className="px-1 text-white/45">/</span>
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
