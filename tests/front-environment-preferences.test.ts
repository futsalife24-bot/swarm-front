import { describe, expect, it } from "vitest";
import { fresh, SAVE_KEY } from "../src/client/save";
import {
  ENVIRONMENT_PREFERENCES_KEY,
  FRONT_SETTINGS_KEY,
  PLAYTEST_PREFERENCES_KEY,
  defaultEnvironmentPreferences,
  loadEnvironmentPreferences,
  parseEnvironmentPreferences,
  saveEnvironmentPreferences,
} from "../src/client/environment-preferences";

function memory(initial: Record<string, string> = {}, failWrite = false) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrite) throw new Error("保存不可");
      data.set(key, value);
    },
  };
}

describe("共通環境設定", () => {
  it("矛盾する旧キーはFrontを優先し、両旧キーと進行保存は残す", () => {
    const front = JSON.stringify({
      ...defaultEnvironmentPreferences(),
      quality: 0.65,
      frameRate: 30,
    });
    const base = JSON.stringify({
      ...defaultEnvironmentPreferences(),
      quality: 1,
      frameRate: 60,
      mapRotates: true,
      damageNumbers: "all",
    });
    const progress = JSON.stringify(fresh());
    const storage = memory({
      [FRONT_SETTINGS_KEY]: front,
      [PLAYTEST_PREFERENCES_KEY]: base,
      [SAVE_KEY]: progress,
    });
    expect(loadEnvironmentPreferences(storage).value).toMatchObject({
      quality: 0.65,
      frameRate: 30,
      mapRotates: true,
      damageNumbers: "all",
    });
    expect(storage.getItem(FRONT_SETTINGS_KEY)).toBe(front);
    expect(storage.getItem(PLAYTEST_PREFERENCES_KEY)).toBe(base);
    expect(storage.getItem(SAVE_KEY)).toBe(progress);
  });

  it("共通キーを往復し、旧キーより優先する", () => {
    const storage = memory({
      [FRONT_SETTINGS_KEY]: JSON.stringify(defaultEnvironmentPreferences()),
    });
    saveEnvironmentPreferences(
      { ...defaultEnvironmentPreferences(), quality: 0.65, frameRate: 30 },
      storage,
    );
    expect(loadEnvironmentPreferences(storage).value).toMatchObject({
      quality: 0.65,
      frameRate: 30,
    });
  });

  it("旧基地だけなら移行し、保存失敗でも読んだ値と旧キーを維持する", () => {
    const base = JSON.stringify({ quality: 0.65, frameRate: 30 });
    const storage = memory({ [PLAYTEST_PREFERENCES_KEY]: base }, true);
    const loaded = loadEnvironmentPreferences(storage);
    expect(loaded.value).toMatchObject({ quality: 0.65, frameRate: 30 });
    expect(loaded.warning).toContain("保存できませんでした");
    expect(storage.getItem(PLAYTEST_PREFERENCES_KEY)).toBe(base);
    expect(storage.getItem(ENVIRONMENT_PREFERENCES_KEY)).toBeNull();
    expect(() => saveEnvironmentPreferences(loaded.value, storage)).toThrow();
  });

  it("破損値を拒否し、未知の保存項目は共通キーへ入れない", () => {
    for (const value of [
      { quality: 2 },
      { ...defaultEnvironmentPreferences(), frameRate: 144 },
      { ...defaultEnvironmentPreferences(), volume: -1 },
    ])
      expect(() =>
        parseEnvironmentPreferences(JSON.stringify(value)),
      ).toThrow();
    const storage = memory();
    saveEnvironmentPreferences(
      { ...defaultEnvironmentPreferences(), inventory: ["混入"] } as never,
      storage,
    );
    expect(
      JSON.parse(storage.getItem(ENVIRONMENT_PREFERENCES_KEY)!),
    ).not.toHaveProperty("inventory");
  });
});
