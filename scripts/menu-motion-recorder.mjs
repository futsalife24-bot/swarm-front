// Record actual Chrome frames at their elapsed time without seeking animations.
import { spawn } from "node:child_process";
import fs from "node:fs";
export async function recordMenuMotion(page, path, width, height) {
  const encoder = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      "20",
      "-i",
      "pipe:0",
      "-an",
      "-vf",
      "pad=ceil(iw/2)*2:ceil(ih/2)*2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      path,
    ],
    { windowsHide: true },
  );
  let error = "",
    previous,
    written = 0;
  const timestamps = [];
  encoder.stderr.on("data", (b) => {
    error += b;
  });
  const complete = new Promise((resolve, reject) => {
    encoder.on("error", reject);
    encoder.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error(error)),
    );
  });
  complete.catch(() => {});
  const cdp = await page.context().newCDPSession(page);
  let stopped = false;
  const onFrame = async (event) => {
    if (stopped) return;
    timestamps.push(event.metadata.timestamp);
    if (previous) {
      const count = Math.max(
        0,
        Math.round((event.metadata.timestamp - timestamps[0]) * 20) - written,
      );
      for (let i = 0; i < count; i++) encoder.stdin.write(previous);
      written += count;
    }
    previous = Buffer.from(event.data, "base64");
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId });
    } catch (e) {
      if (!stopped) error += String(e);
    }
  };
  cdp.on("Page.screencastFrame", onFrame);
  await page.bringToFront();
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 85,
    maxWidth: width,
    maxHeight: height,
    everyNthFrame: 1,
  });
  return async () => {
    if (stopped) return;
    stopped = true;
    cdp.off("Page.screencastFrame", onFrame);
    if (!page.isClosed()) await cdp.send("Page.stopScreencast");
    if (previous) {
      encoder.stdin.write(previous);
      written++;
    }
    encoder.stdin.end();
    await complete;
    if (error) throw Error(error);
    fs.writeFileSync(
      path + ".json",
      JSON.stringify({ timestamps, written, fps: 20 }, null, 2),
    );
  };
}
