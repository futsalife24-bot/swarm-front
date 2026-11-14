// 管制AIボイスの任意ダウンロード用パックを作る（2026-11-14）。
// 原本: assets-src/voice-<set>-<voice>-v<N>/*.wav（公開物には含めない）
// 出力: public/assets/voice-packs/control-voice-<voice>-v<PACK>.bin と
//       src/client/control-voice-pack-catalog.ts（容量・SHA-256・収録本数）
// 使い方: node scripts/build-voice-packs.mjs [ffmpegのパス]
//   ffmpeg は引数 → 環境変数 FFMPEG → PATH の順に探す。
// パック形式（SFVP v1）:
//   "SFVP" | u8 形式版(1) | 3バイト0 | u32LE 目次JSONの長さ | 目次JSON(UTF-8) | 音声データ
//   目次: { format: 1, voice, version, codec: "mp3", clips: [{ key, offset, length }] }
//   offset は音声データ先頭からのバイト位置。key は "voice-<set>-<voice>-v<N>/<台詞ID>"。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "assets-src");
const OUTPUT = path.join(root, "public", "assets", "voice-packs");
const CATALOG = path.join(
  root,
  "src",
  "client",
  "control-voice-pack-catalog.ts",
);
const VOICES = ["hiromi", "hiyori", "yoko"];
/** パックの版。中身を作り直したら上げる（URLが変わり、古い保存は「更新あり」になる）。 */
const PACK_VERSION = 1;
/** 声の台詞向け: モノラル 44.1kHz・MP3 64kbps（全ブラウザの decodeAudioData で展開できる形式）。 */
const ENCODE = [
  "-ac",
  "1",
  "-ar",
  "44100",
  "-c:a",
  "libmp3lame",
  "-b:a",
  "64k",
  "-map_metadata",
  "-1",
  "-id3v2_version",
  "0",
];

const ffmpeg = process.argv[2] || process.env.FFMPEG || "ffmpeg";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-voice-pack-"));

async function encode(file) {
  const out = path.join(
    temp,
    `${createHash("sha1").update(file).digest("hex")}.mp3`,
  );
  await run(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    file,
    ...ENCODE,
    out,
  ]);
  return fs.readFileSync(out);
}

async function pool(items, size, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

const catalog = [];
try {
  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const voice of VOICES) {
    const folders = fs
      .readdirSync(SOURCE, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          new RegExp(`^voice-(control|tutorial)-${voice}-v\\d+$`).test(d.name),
      )
      .map((d) => d.name)
      .sort();
    const sources = folders.flatMap((folder) =>
      fs
        .readdirSync(path.join(SOURCE, folder))
        .filter((name) => name.endsWith(".wav"))
        .sort()
        .map((name) => ({
          key: `${folder}/${name.slice(0, -4)}`,
          file: path.join(SOURCE, folder, name),
        })),
    );
    if (!sources.length) throw Error(`no source clips for ${voice}`);
    const encoded = await pool(sources, 8, (s) => encode(s.file));
    let offset = 0;
    const clips = sources.map((s, i) => {
      const clip = { key: s.key, offset, length: encoded[i].length };
      offset += encoded[i].length;
      return clip;
    });
    const index = Buffer.from(
      JSON.stringify({
        format: 1,
        voice,
        version: PACK_VERSION,
        codec: "mp3",
        clips,
      }),
      "utf8",
    );
    const header = Buffer.alloc(12);
    header.write("SFVP", 0, "ascii");
    header.writeUInt8(1, 4);
    header.writeUInt32LE(index.length, 8);
    const pack = Buffer.concat([header, index, ...encoded]);
    const file = `control-voice-${voice}-v${PACK_VERSION}.bin`;
    fs.writeFileSync(path.join(OUTPUT, file), pack);
    const wavBytes = sources.reduce((n, s) => n + fs.statSync(s.file).size, 0);
    const sets = Object.fromEntries(
      folders.map((folder) => [
        folder,
        sources.filter((s) => s.key.startsWith(`${folder}/`)).length,
      ]),
    );
    catalog.push({
      voice,
      url: `assets/voice-packs/${file}`,
      bytes: pack.length,
      sha256: createHash("sha256").update(pack).digest("hex"),
      clips: clips.length,
      sets,
    });
    console.log(
      `${file}: ${clips.length} clips, ${(pack.length / 1048576).toFixed(2)} MiB (WAV ${(wavBytes / 1048576).toFixed(1)} MiB)`,
    );
  }
  const body = catalog
    .map(
      (p) =>
        `  {\n    voice: "${p.voice}",\n    url: "${p.url}",\n    bytes: ${p.bytes},\n    sha256: "${p.sha256}",\n    clips: ${p.clips},\n    sets: ${JSON.stringify(p.sets)},\n  },`,
    )
    .join("\n");
  const prettier = await import("prettier");
  fs.writeFileSync(
    CATALOG,
    await prettier.format(
      `// 自動生成: node scripts/build-voice-packs.mjs（手で編集しない）\n// 管制AIボイスの任意ダウンロード用パック一覧。\nexport interface ControlVoicePackEntry {\n  voice: "hiromi" | "hiyori" | "yoko";\n  url: string;\n  bytes: number;\n  sha256: string;\n  clips: number;\n  sets: Record<string, number>;\n}\nexport const CONTROL_VOICE_PACK_FORMAT = 1;\nexport const CONTROL_VOICE_PACKS: readonly ControlVoicePackEntry[] = [\n${body}\n];\n`,
      { parser: "typescript" },
    ),
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
