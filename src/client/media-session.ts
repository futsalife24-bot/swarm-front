/** Notification identity only: playback actions remain owned by the browser. */
export function setGameMediaMetadata(base = import.meta.env.BASE_URL) {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator) ||
    typeof MediaMetadata === "undefined"
  )
    return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "SWARM FRONT.",
      artwork: [
        {
          src: `${base}icon-swarm-v2-512.png`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });
  } catch {
    // Unsupported/restricted metadata must not interfere with game audio.
  }
}
