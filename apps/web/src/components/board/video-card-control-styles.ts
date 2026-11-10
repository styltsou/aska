export const VIDEO_CARD_TIME_BADGE_CLASS =
  "rounded-sm bg-black/75 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white backdrop-blur-sm tabular-nums";

export function formatVideoDuration(seconds: number) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = String(whole % 60).padStart(2, "0");
  return whole >= 3600
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}
