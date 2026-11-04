// 生成済みPNGの図柄を変えず、既存Chromeで配信用の解像度とWebPへ変換する。
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, "../../public/rebuild/card-art");
const browser = await chromium.launch({ channel: "chrome" });
const report = [];
try {
  await fs.mkdir(output, { recursive: true });
  const page = await browser.newPage();
  for (const filename of (await fs.readdir(path.join(here, "source"))).sort()) {
    if (!filename.endsWith(".png")) continue;
    const source = await fs.readFile(path.join(here, "source", filename));
    const frame = filename.startsWith("frame-");
    for (const size of frame ? [512] : [640, 128]) {
      const result = await page.evaluate(
        async ({ data, size, frame }) => {
          const bitmap = await createImageBitmap(
            await (await fetch(data)).blob(),
          );
          const canvas = new OffscreenCanvas(size, size);
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, 0, 0, size, size);
          const alpha = ctx.getImageData(size / 2, size / 2, 1, 1).data[3];
          if (frame && alpha !== 0)
            throw new Error("枠の中央が透明ではありません");
          const blob = await canvas.convertToBlob({
            type: "image/webp",
            quality: frame ? 0.9 : 0.86,
          });
          if (blob.type !== "image/webp")
            throw new Error("WebP変換に失敗しました");
          return {
            bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
            width: bitmap.width,
            height: bitmap.height,
            alpha,
          };
        },
        {
          data: `data:image/png;base64,${source.toString("base64")}`,
          size,
          frame,
        },
      );
      const name = filename.replace(
        ".png",
        size === 128 ? "-thumb.webp" : ".webp",
      );
      await fs.writeFile(path.join(output, name), Buffer.from(result.bytes));
      report.push({
        file: name,
        size,
        bytes: result.bytes.length,
        source: [result.width, result.height],
        centerAlpha: result.alpha,
      });
    }
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  path.join(here, "encoding.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    files: report.length,
    bytes: report.reduce((sum, r) => sum + r.bytes, 0),
  }),
);
