import fs from "node:fs";
import path from "node:path";

const unique = (items) => [...new Set(items)].sort();
const matches = (text, pattern) =>
  [...text.matchAll(pattern)].map((match) => match[1]);
function section(text, start, end) {
  const first = text.indexOf(start),
    last = text.indexOf(end, first + start.length);
  if (first < 0 || last < 0)
    throw new Error(`Runtime asset catalog source changed: ${start}`);
  return text.slice(first, last);
}
function one(text, pattern, label) {
  const values = matches(text, pattern);
  if (values.length !== 1)
    throw new Error(`Runtime asset catalog source changed: ${label}`);
  return values[0];
}
/** Only current loader references; never enumerate all of public/. */
export function collectCurrentAssetPacks(root) {
  const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const motion = source("src/client/enemy-motion-assets.ts");
  const trooper = source("src/client/standard-trooper.ts");
  const weapon = source("src/client/progression-weapons.ts");
  if (!weapon.includes("assets/weapons/realism-v2/${id}.glb"))
    throw new Error("Weapon loader layout changed");
  const actors = [
    `assets/characters/${one(trooper, /(swarm-soldier\.glb\?v=[a-f0-9]+)/g, "soldier")}`,
    ...matches(motion, /"(assets\/enemies\/[^"\n]+\.glb(?:\?[^"\n]+)?)"/g),
    one(
      source("src/client/bastion-view.ts"),
      /"(assets\/enemies\/bastion[^"\n]+\.glb\?rev=[a-f0-9]+)"/g,
      "bastion",
    ),
  ];
  if (actors.length !== 11)
    throw new Error("Enemy motion catalog changed; review current actors");
  const weapons = ["rifle", "shotgun", "rocket"].flatMap((kind) =>
    Array.from(
      { length: 5 },
      (_, rarity) => `assets/weapons/realism-v2/${kind}_${rarity}.glb`,
    ),
  );
  const audio = source("src/client/audio.ts");
  const levels = section(audio, "const LEVELS", "const BASE");
  const keys = matches(levels, /^  (\w+): /gm);
  if (keys.length < 25) throw new Error("Combat sound catalog changed");
  const soundBase = (name) =>
    one(
      audio,
      new RegExp("const " + name + " = `[^`]*?(assets/audio/[^`]+)`;", "g"),
      name,
    );
  const se = keys.map(
    (key) =>
      (key !== "impact" &&
      ["impactShell", "impactHard", "impactSoft"].includes(key)
        ? soundBase("AR_HIT")
        : key === "rocketBurst"
          ? soundBase("ROCKET_FINAL")
          : ["rifle", "shotgun"].includes(key)
            ? soundBase("SELECTED")
            : soundBase("BASE")) +
      key +
      ".wav",
  );
  const soldier = source("src/client/soldier-voice.ts");
  const voices = matches(
    section(soldier, "export const SOLDIER_VOICES", "export type SoldierClip"),
    /id: "([^"]+)"/g,
  ).map(
    (id) =>
      one(soldier, /SOLDIER_PATH = "([^"]+)"/g, "soldier voice path") +
      id +
      ".wav",
  );
  const anomaly = source("src/client/anomaly-voice.ts");
  const profiles = [
    ...matches(
      section(anomaly, "export const ANOMALY_VOICES", "} as const"),
      /^  (\w+): \{/gm,
    ),
    ...matches(
      section(anomaly, "export const ANOMALY_VOICE_PROFILES", "} as const"),
      /^  "([^"]+)": \{/gm,
    ),
  ];
  const anomalyBase = one(
    anomaly,
    /ANOMALY_VOICE_PATH = "([^"]+)"/g,
    "anomaly voice path",
  );
  const anomalyVoices = profiles.flatMap((id) =>
    [0, 1].map((variant) => `${anomalyBase}${id}-${variant}.wav`),
  );
  const upgrade = source("src/shared/front-upgrades.ts");
  const ids = matches(
    section(
      upgrade,
      "export const FRONT_UPGRADE_CATALOG",
      "export interface FrontUpgradeOffer",
    ),
    /id: "([a-z-]+)"/g,
  );
  const fusions = matches(
    section(upgrade, "export const FRONT_FUSION_IDS", "] as const"),
    /"([a-z-]+)"/g,
  );
  const upgradeUi = source("src/client/front-upgrade-ui.ts");
  const atlas = section(upgradeUi, "const atlasIds", "const icon");
  const atlasCount = Number(
    one(atlas, /FRONT_FUSION_IDS\.slice\(0, (\d+)\)/g, "fusion atlas count"),
  );
  const atlasIds = new Set([
    ...matches(atlas, /"([a-z-]+)"/g),
    ...fusions.slice(0, atlasCount),
  ]);
  if (!upgradeUi.includes("rebuild/upgrades/${id}.png"))
    throw new Error("Upgrade icon layout changed");
  if (
    !source("src/client/gear-weapon-list.ts").includes(
      'assets/ui/weapon-${locked ? "locked" : "unlocked"}.png',
    )
  )
    throw new Error("Gear icon layout changed");
  const icons = ids
    .filter((id) => !atlasIds.has(id))
    .map((id) => `rebuild/upgrades/${id}.png`);
  const ui = [
    one(
      source("src/client/home-screen.ts"),
      /(assets\/ui\/title-logo-v\d+\.png)/g,
      "title logo",
    ),
    one(
      source("src/client/home-screen.css"),
      /(assets\/ui\/title-atmosphere-v\d+\.png)/g,
      "title atmosphere",
    ),
    "assets/ui/weapon-locked.png",
    "assets/ui/weapon-unlocked.png",
    one(upgradeUi, /(rebuild\/upgrades\/fusion-atlas\.png)/g, "fusion atlas"),
    ...icons,
  ];
  const mapSource = source("src/shared/stages.ts");
  const names = matches(
    section(mapSource, "export const MAPS", "\n];"),
    /^    name: "([^"]+)"/gm,
  );
  if (names.length !== 6)
    throw new Error("Map loader catalog changed; review map packs");
  const mapLoader = source("src/client/map-assets.ts");
  const mapTemplate = one(
    mapLoader,
    /(assets\/maps\/map_\$\{assetIndex\}_v\d+\.glb)/g,
    "map template",
  );
  const distantTemplate = one(
    mapLoader,
    /(assets\/maps\/distant_\$\{assetIndex\}_v\d+\.glb)/g,
    "distant template",
  );
  const survivalTemplate = one(
    mapLoader,
    /(assets\/maps\/defense_\$\{variant\}_v\d+\.glb)/g,
    "survival template",
  );
  const maps = names.map((label, index) => ({
    id: `map-${index}`,
    label: `${label}（進撃）`,
    description:
      "通常・高台ルート共通。遠景を含みます。音楽は別の任意保存です。",
    urls: [
      mapTemplate.replace("${assetIndex}", String(index)),
      ...(index !== 5
        ? [distantTemplate.replace("${assetIndex}", String(index))]
        : []),
    ],
  }));
  const survival = [
    {
      id: "map-survival-0",
      label: `生存：${names[0]}`,
      description: "現行の新規生存で使う戦場素材です。",
      urls: [survivalTemplate.replace("${variant}", "0")],
    },
  ];
  const bgm = source("src/client/bgm.ts");
  const music = unique([
    ...matches(
      section(bgm, "export const MAP_MUSIC", "] as const"),
      /"([^"]+)"/g,
    ),
    ...matches(
      section(bgm, "export type MusicTrack", "type MusicWorld"),
      /"([^"]+)"/g,
    ),
  ]);
  const movies = matches(
    source("src/client/encounter-film-files.ts"),
    /"(assets\/encounters\/[^"\n]+\.mp4\?v=[a-f0-9]+)"/g,
  );
  const html = source("index.html");
  const webmanifest = one(
    html,
    /rel="manifest" href="%BASE_URL%([^"]+)"/g,
    "webmanifest",
  );
  const install = JSON.parse(source(`public/${webmanifest}`));
  const shell = unique([
    webmanifest,
    ...matches(html, /href="%BASE_URL%([^"\n]+\.png)"/g),
    ...install.icons.map((icon) => icon.src),
    ...matches(source("src/client/media-session.ts"), /\}([^`\s]+\.png)`/g),
    one(
      source("src/client/playtest.css"),
      /(assets\/fonts\/[^\s")]+\.ttf)/g,
      "font",
    ),
  ]);
  return [
    {
      id: "app",
      label: "ゲーム本体",
      description:
        "この版の画面・プログラム・表示設定。共通データと一緒に保存します。",
      urls: shell,
    },
    {
      id: "common",
      label: "共通データ",
      description: "現行の兵士・ANOMALY・武器・戦闘音・必要な画面素材。",
      urls: unique([
        ...actors,
        ...weapons,
        ...se,
        ...voices,
        ...anomalyVoices,
        ...ui,
      ]),
    },
    ...maps,
    ...survival,
    {
      id: "bgm",
      label: "音楽（任意）",
      description: "メニュー・全マップの現行BGM。戦闘データには含みません。",
      optional: true,
      urls: music.map((track) => `assets/audio/bgm-v1/${track}.mp3`),
    },
    {
      id: "movies",
      label: "会敵ムービー（任意）",
      description: "レポートから開く現行10本。戦闘には不要です。",
      optional: true,
      urls: movies,
    },
  ];
}
