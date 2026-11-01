import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const out = "docs/evidence/pleat-wall-fix-20261101";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--use-angle=d3d11"],
});
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 850 } });
  const png = (n) =>
    `data:image/png;base64,${readFileSync(`${out}/${n}.png`).toString("base64")}`;
  await page.setContent(
    `<html lang="ja"><meta charset="utf-8"><style>body{margin:0;background:#091419;color:#e4f4ef;font:19px system-ui}p{margin:10px 16px}img{display:block;width:844px;height:390px}</style><p>大型3 ／ 修正前の侵入 → 修正後は板の外で回転</p><img src="${png("previous-ground")}"><img src="${png("fixed-turn")}"></html>`,
  );
  await page.screenshot({ path: `${out}/phone-comparison.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  page.setDefaultNavigationTimeout(120000);
  for (const version of ["previous", "fixed"]) {
    await page.goto(
      `http://127.0.0.1:5188/scripts/pleat-wall-fix-review.html?scale=3&version=${version}`,
    );
    await page.waitForFunction(() => window.review, undefined, {
      timeout: 120000,
    });
    const bytes = await page.evaluate(async () => {
      const source = document.querySelector("canvas"),
        canvas = document.createElement("canvas");
      canvas.width = 844;
      canvas.height = 390;
      const ctx = canvas.getContext("2d"),
        stream = canvas.captureStream(20),
        chunks = [];
      const rec = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 1800000,
      });
      rec.ondataavailable = (e) => chunks.push(e.data);
      const stopped = new Promise((resolve) => (rec.onstop = resolve));
      rec.start();
      for (let i = 0; i < window.review.length; i++) {
        window.review.draw(i);
        ctx.drawImage(source, 0, 0);
        ctx.fillStyle = "#091419e8";
        ctx.fillRect(8, 8, 500, 36);
        ctx.fillRect(8, 325, 825, 57);
        ctx.fillStyle = "#ecf5f0";
        ctx.font = "19px sans-serif";
        ctx.fillText(document.querySelector("#title").textContent, 18, 34);
        ctx.font = "16px sans-serif";
        document
          .querySelector("#stats")
          .textContent.split("\n")
          .forEach((line, j) => ctx.fillText(line, 18, 347 + j * 23));
        await new Promise((r) => setTimeout(r, 50));
      }
      rec.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    });
    writeFileSync(`${out}/${version}.webm`, Buffer.from(bytes));
    console.log(version, bytes.length);
  }
} finally {
  await browser.close();
}
