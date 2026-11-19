import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTROL_VOICE_LINES,
  controlVoiceLine,
  playableLine,
} from "../src/client/control-voice-lines";
import {
  CONTROL_VOICE_PACKS,
} from "../src/client/control-voice-pack-catalog";
import {
  CONTROL_VOICE_SET_VOICES,
  controlVoicePath,
} from "../src/client/control-voice";
import {
  parseVoicePack,
} from "../src/client/control-voice-packs";
import { ENEMY_REPORT_ENTRIES } from "../src/client/enemy-report-entries";
import {
  ENEMY_MOTION_FILES,
  FOUNDRY_WORM_FILE,
} from "../src/client/enemy-motion-assets";
import { STRUCTURE_ASSETS } from "../src/client/structure-motion";
import { BASTION_ASSET } from "../src/client/bastion-view";
import { ENCOUNTER_FILM_FILES } from "../src/client/encounter-film-files";
import {
  ANOMALY_VOICES,
  ANOMALY_VOICE_PROFILES,
} from "../src/client/anomaly-voice";
import {
  ENEMY_REPORT_NAMES,
  ENEMY_REPORT_READINGS,
  enemyIdentificationLine,
  type EnemyReportId,
} from "../src/shared/enemy-identity";
import { ENEMY_REPORT_ORDER } from "../src/shared/enemy-report-order";
import {
  WORM_BODY_COUNT,
  WORM_UNIT_COUNT,
} from "../src/shared/worm";
import { foundryOptic } from "../src/shared/foundry-defs";
import { HOUND_VOLLEY_SPREADS } from "../src/shared/hound-volley";

const REPORT_SLUGS: Record<EnemyReportId, string> = {
  harrow: "harrow",
  calyx: "calyx",
  bastion: "bastion",
  ant: "volley",
  spider: "leaper",
  crawler: "pleat",
  spitter: "prism",
  hornet: "ray",
  boss: "foundry",
  worm: "catena",
};
const REPORT_KEYS = [...ENEMY_REPORT_ORDER];
const REPORT_KEY_SET = new Set<EnemyReportId>(REPORT_KEYS);
const anomalyClipIds = REPORT_KEYS.map((key) => `anomaly-${REPORT_SLUGS[key]}`);
const packFile = (url: string) => path.resolve("public", url.split("?")[0]);
const packBytes = (url: string) => fs.readFileSync(packFile(url));

describe("ANOMALY report consistency", () => {
  it("keeps all ten report ledgers over the same enemy set", () => {
    expect(REPORT_KEYS).toHaveLength(10);
    expect(new Set(Object.keys(ENEMY_REPORT_NAMES))).toEqual(REPORT_KEY_SET);
    expect(new Set(Object.keys(ENEMY_REPORT_ENTRIES))).toEqual(REPORT_KEY_SET);
    expect(new Set(Object.keys(ENCOUNTER_FILM_FILES))).toEqual(REPORT_KEY_SET);
    expect(new Set(Object.keys(ENEMY_REPORT_READINGS))).toEqual(REPORT_KEY_SET);
    expect(
      new Set(
        CONTROL_VOICE_LINES.map((line) => line.id).filter((id) =>
          id.startsWith("anomaly-"),
        ),
      ),
    ).toEqual(new Set(["anomaly-new", ...anomalyClipIds]));
    for (const key of REPORT_KEYS)
      if (key === "worm")
        expect(
          ANOMALY_VOICE_PROFILES["boss-linked"].name.startsWith(
            ENEMY_REPORT_NAMES.worm,
          ),
        ).toBe(true);
      else expect(ANOMALY_VOICES[key].name).toBe(ENEMY_REPORT_NAMES[key]);
  });

  it("uses the report names and readings for identification lines", () => {
    for (const key of REPORT_KEYS) {
      expect(
        key === "worm"
          ? [
              ANOMALY_VOICE_PROFILES["boss-linked"].name,
              ANOMALY_VOICE_PROFILES["boss-separated"].name,
            ]
          : [ANOMALY_VOICES[key].name],
      ).toEqual(
        key === "worm"
          ? [
              `${ENEMY_REPORT_NAMES.worm}・連結中`,
              `${ENEMY_REPORT_NAMES.worm}・分離後`,
            ]
          : [ENEMY_REPORT_NAMES[key]],
      );
      expect(enemyIdentificationLine(key)).toBe(
        `識別名、${ENEMY_REPORT_READINGS[key]}。`,
      );
    }
  });

  it("copies the report attack and movement prose into report voice lines", () => {
    for (const key of REPORT_KEYS) {
      const [, attack, movement] = ENEMY_REPORT_ENTRIES[key];
      expect(controlVoiceLine(`report-${REPORT_SLUGS[key]}-attack`)?.text).toBe(
        attack,
      );
      expect(controlVoiceLine(`report-${REPORT_SLUGS[key]}-form`)?.text).toBe(
        movement,
      );
    }
  });

  it("ships every adopted identification clip in all three voice packs", () => {
    expect(CONTROL_VOICE_PACKS.map((pack) => pack.voice)).toEqual([
      "hiromi",
      "hiyori",
      "yoko",
    ]);
    const indexes = new Map(
      CONTROL_VOICE_PACKS.map((pack) => [
        pack.voice,
        parseVoicePack(
          packBytes(pack.url).buffer.slice(
            packBytes(pack.url).byteOffset,
            packBytes(pack.url).byteOffset + packBytes(pack.url).byteLength,
          ),
          pack.voice,
        ),
      ]),
    );
    for (const id of anomalyClipIds) {
      const line = controlVoiceLine(id)!;
      expect(line.text).toMatch(/^識別名、.+。$/u);
      expect(playableLine(line)).toBe(true);
      for (const voice of CONTROL_VOICE_SET_VOICES[line.set]) {
        const key = controlVoicePath(line, voice);
        expect(indexes.get(voice)!.has(key), key).toBe(true);
      }
    }
  });

  it("resolves existing shared models for every report species", () => {
    expect(new Set(Object.keys(STRUCTURE_ASSETS))).toEqual(
      new Set(REPORT_KEYS.filter((key) => key !== "bastion" && key !== "worm")),
    );
    for (const key of REPORT_KEYS.filter(
      (key) => key !== "bastion" && key !== "worm",
    )) {
      const file = ENEMY_MOTION_FILES[STRUCTURE_ASSETS[key]];
      expect(fs.existsSync(packFile(file)), `${key}: ${file}`).toBe(true);
    }
    expect(fs.existsSync(packFile(BASTION_ASSET))).toBe(true);
    expect(fs.existsSync(packFile(FOUNDRY_WORM_FILE))).toBe(true);
    expect(new Set(Object.keys(ENEMY_MOTION_FILES))).toEqual(
      new Set(Object.values(STRUCTURE_ASSETS)),
    );
  });

  it("keeps the old F-16 wording out of the source tree", () => {
    const forbidden = [
      "ケイリクス",
      "BASTION（仮称）",
      "HOUNDと散射派生",
      "残存節と同じ数の個体",
      "地面に沿って前方へ衝撃波が走",
    ];
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, {
        withFileTypes: true,
      })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
      }
    };
    walk("src");
    for (const file of files)
      for (const phrase of forbidden)
        expect(fs.readFileSync(file, "utf8"), `${file}: ${phrase}`).not.toContain(
          phrase,
        );
  });

  it("binds CATENA and VOLLEY report values to their combat contracts", () => {
    expect(WORM_BODY_COUNT).toBe(14);
    expect(WORM_UNIT_COUNT).toBe(1 + WORM_BODY_COUNT);
    const combatMouths = Array.from({ length: WORM_UNIT_COUNT }, (_, part) =>
      part,
    ).filter((part) => foundryOptic(part, WORM_BODY_COUNT) !== undefined);
    expect(combatMouths).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(Math.ceil(WORM_BODY_COUNT / 2)).toBe(7);
    expect(ENEMY_REPORT_ENTRIES.worm[1]).toContain("2節につき1体");
    expect(ENEMY_REPORT_ENTRIES.worm[1]).toContain("最大7体");
    expect(HOUND_VOLLEY_SPREADS).toEqual([-0.16, 0, 0.16]);
  });
});

