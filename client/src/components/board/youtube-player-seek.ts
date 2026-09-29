export type YouTubeSeekPlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

export function createYouTubePlayerSeekController() {
  let player: YouTubeSeekPlayer | null = null;
  let status: "loading" | "ready" | "unavailable" = "loading";
  let pendingSeconds: number | null = null;

  return {
    beginLoading() {
      player = null;
      pendingSeconds = null;
      status = "loading";
    },
    setReady(readyPlayer: YouTubeSeekPlayer) {
      player = readyPlayer;
      status = "ready";
      if (pendingSeconds !== null) {
        player.seekTo(pendingSeconds, true);
        pendingSeconds = null;
      }
    },
    setUnavailable() {
      player = null;
      pendingSeconds = null;
      status = "unavailable";
    },
    seek(seconds: number) {
      if (status === "ready" && player) {
        player.seekTo(seconds, true);
        return true;
      }
      if (status === "loading") {
        pendingSeconds = seconds;
        return true;
      }
      return false;
    },
  };
}
