import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const out = "docs/evidence/supply-last-skip-20261111/jack";
fs.mkdirSync(out, { recursive: true });
const lines = {
  "b-tatara": ["準備できた。", "そっちへ行く。"],
  "b-yosuga": ["……見つけた。", "待ってて。"],
  "b-tobari": ["聞こえたよ。", "すぐそばに。"],
  "b-oriha": ["つながった。", "会いに行くね。"],
};
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/supply-reveal/gacha.css"><body style="margin:0"><script type="module">
import { createSupplyReveal } from '/supply-reveal/runtime.js';
import { setBuddyArt } from '/supply-reveal/kakutei-fx.js';
window.reveal = createSupplyReveal(document.body, { sound: false, warm: false });
window.setBuddyArt = setBuddyArt;
await reveal.ready; window.ready = true;
</script>`;
const publicRoot = path.resolve("public");
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/probe") {
    res.setHeader("content-type", "text/html");
    res.end(html);
    return;
  }
  const file = path.resolve(publicRoot, "." + url.pathname);
  if (
    !file.startsWith(publicRoot + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    "content-type",
    file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "application/octet-stream",
  );
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chrome" });
const rows = [];
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.drawnSilhouettes = [];
    window.drawnLines = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (args[0] instanceof Image && args[0].src.startsWith("data:image/png"))
        window.drawnSilhouettes.push(args[0].src);
      return draw.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      window.drawnLines.push(args[0]);
      return fillText.apply(this, args);
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/probe`);
  await page.waitForFunction(() => window.ready);
  for (const art of [
    "b-tatara",
    "b-yosuga",
    "b-tobari",
    "b-oriha",
    "b-tatara",
  ]) {
    const result = await page.evaluate(async (art) => {
      await reveal.play([{ type: "buddy", name: art, art }], {
        effects: 10,
        silent: true,
        manual: true,
      });
      const root = reveal.root;
      const modelArt = reveal.model().pods.find((pod) => pod.tier === 5)?.r.art;
      const jack = reveal.timeline().find((part) => part.fx === "jack");
      window.drawnSilhouettes.length = 0;
      window.drawnLines.length = 0;
      reveal.seek(jack.refStart + jack.refDuration * 0.6, 0, false, {
        id: "jack",
        p: { g: 0, w: 1, a: 2 },
      });
      const image = new Image();
      image.src = `/supply-reveal/assets/${art}.webp`;
      await new Promise((resolve) => {
        image.onload = image.onerror = resolve;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const g = canvas.getContext("2d");
      g.drawImage(image, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#062822";
      g.fillRect(0, 0, canvas.width, canvas.height);
      return {
        effect: reveal.state().effect,
        resultArt: art,
        modelArt,
        datasetArt: root.dataset.jackArt,
        line: root.dataset.jackLine,
        reply: root.dataset.jackReply,
        drawnLines: window.drawnLines,
        jack: !!jack,
        drawn: window.drawnSilhouettes.length,
        matches: window.drawnSilhouettes.includes(canvas.toDataURL()),
      };
    }, art);
    assert.equal(result.effect, 10);
    assert.equal(result.modelArt, art);
    assert.equal(result.datasetArt, art);
    assert.deepEqual([result.line, result.reply], lines[art]);
    assert(result.drawnLines.includes(lines[art][0]));
    assert(result.drawnLines.includes(lines[art][1]));
    assert.equal(result.jack, true);
    assert(result.drawn > 0);
    assert.equal(result.matches, true);
    await page.screenshot({ path: `${out}/${art}-${rows.length}.png` });
    rows.push(result);
  }
  const multiple = await page.evaluate(async () => {
    const arts = ["b-oriha", "b-yosuga"];
    const results = [
      ...arts.map((art) => ({ type: "buddy", name: art, art })),
      ...Array.from({ length: 8 }, (_, index) => ({
        type: "weapon",
        rarity: "N",
        name: `N${index}`,
        art: "w-rifle",
      })),
    ];
    await reveal.play(results, { effects: 10, silent: true, manual: true });
    const targetArt = reveal.model().pods.find((pod) => pod.tier === 5)?.r.art;
    const jack = reveal.timeline().find((part) => part.fx === "jack");
    window.drawnSilhouettes.length = 0;
    window.drawnLines.length = 0;
    reveal.seek(jack.refStart + jack.refDuration * 0.6, 0, false, {
      id: "jack",
      p: { g: 0, w: 1, a: 2 },
    });
    const image = new Image();
    image.src = `/supply-reveal/assets/${targetArt}.webp`;
    await new Promise((resolve) => {
      image.onload = image.onerror = resolve;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const g = canvas.getContext("2d");
    g.drawImage(image, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#062822";
    g.fillRect(0, 0, canvas.width, canvas.height);
    return {
      arts,
      targetArt,
      datasetArt: reveal.root.dataset.jackArt,
      line: reveal.root.dataset.jackLine,
      reply: reveal.root.dataset.jackReply,
      drawnLines: window.drawnLines,
      matches: window.drawnSilhouettes.includes(canvas.toDataURL()),
    };
  });
  assert.equal(multiple.targetArt, multiple.arts[0]);
  assert.equal(multiple.datasetArt, multiple.targetArt);
  assert.deepEqual([multiple.line, multiple.reply], lines[multiple.targetArt]);
  assert(multiple.drawnLines.includes(lines[multiple.targetArt][0]));
  assert(multiple.drawnLines.includes(lines[multiple.targetArt][1]));
  assert.equal(multiple.matches, true);
  await page.screenshot({ path: `${out}/multiple.png` });
  const unknown = await page.evaluate(() => {
    setBuddyArt("b-unknown");
    window.drawnSilhouettes.length = 0;
    window.drawnLines.length = 0;
    reveal.seek(0, 0, false, { id: "jack", p: { g: 0, w: 1, a: 2 } });
    return {
      datasetArt: reveal.root.dataset.jackArt,
      line: reveal.root.dataset.jackLine,
      reply: reveal.root.dataset.jackReply,
      drawn: window.drawnSilhouettes.length,
      drawnLines: window.drawnLines,
    };
  });
  assert.equal(unknown.datasetArt, "");
  assert.deepEqual(
    [unknown.line, unknown.reply],
    ["……きこえる？", "そっちへ行く。"],
  );
  assert.equal(unknown.drawn, 0);
  assert(unknown.drawnLines.includes(unknown.line));
  assert(unknown.drawnLines.includes(unknown.reply));
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${out}/unknown.png` });
  fs.writeFileSync(
    `${out}/jack-check.json`,
    JSON.stringify({ passed: true, rows, multiple, unknown, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ passed: true, rows, multiple, unknown, errors }),
  );
  await page.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
