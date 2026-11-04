import { fresh, parseSave, SAVE_KEY, type Save } from "./save";

export const ENVIRONMENT_PREFERENCES_KEY =
  "swarm-front-environment-preferences-v1";
export const FRONT_SETTINGS_KEY = "swarm-front-rebuild-settings-v1";
export const PLAYTEST_PREFERENCES_KEY = "swarm-front-playtest-preferences-v1";

export interface EnvironmentPreferences {
  sensitivity: number;
  fireSensitivity: number;
  gyroEnabled: boolean;
  gyroSensitivity: number;
  volume: number;
  bgmVolume: number;
  seVolume: number;
  quality: 0.65 | 1;
  frameRate: 30 | 60;
  mapRotates: boolean;
  damageNumbers: "self" | "all" | "off";
}

export const defaultEnvironmentPreferences = (): EnvironmentPreferences => ({
  sensitivity: 1,
  fireSensitivity: 1,
  gyroEnabled: false,
  gyroSensitivity: 1,
  volume: 0.35,
  bgmVolume: 1,
  seVolume: 1,
  quality: 1,
  frameRate: 60,
  mapRotates: false,
  damageNumbers: "self",
});

export function parseEnvironmentPreferences(
  raw: string,
): EnvironmentPreferences {
  const p = JSON.parse(raw);
  for (const key of ["sensitivity", "fireSensitivity", "gyroSensitivity"])
    if (!Number.isFinite(p?.[key]) || p[key] < 0.1 || p[key] > 6)
      throw new Error("操作設定が破損しています。");
  for (const key of ["volume", "bgmVolume", "seVolume"])
    if (!Number.isFinite(p?.[key]) || p[key] < 0 || p[key] > 1)
      throw new Error("音量設定が破損しています。");
  if (
    typeof p.gyroEnabled !== "boolean" ||
    ![0.65, 1].includes(p.quality) ||
    ![30, 60].includes(p.frameRate) ||
    ![undefined, true, false].includes(p.mapRotates) ||
    ![undefined, "self", "all", "off"].includes(p.damageNumbers)
  )
    throw new Error("描画・ジャイロ設定が破損しています。");
  return Object.fromEntries(
    Object.entries(defaultEnvironmentPreferences()).map(([key, fallback]) => [
      key,
      p[key] ?? fallback,
    ]),
  ) as unknown as EnvironmentPreferences;
}

type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export const environmentPreferencesFromSave = (save: Save) =>
  parseEnvironmentPreferences(
    JSON.stringify({
      ...defaultEnvironmentPreferences(),
      ...save,
      fireSensitivity: save.fireSensitivity ?? save.sensitivity,
    }),
  );

/** No timestamps exist on legacy keys. Front wins a conflict, then base, then old Save. */
export function loadEnvironmentPreferences(
  storage: StorageAccess = localStorage,
  fallback = defaultEnvironmentPreferences(),
): {
  value: EnvironmentPreferences;
  warning: string;
} {
  const common = storage.getItem(ENVIRONMENT_PREFERENCES_KEY);
  if (common !== null)
    return { value: parseEnvironmentPreferences(common), warning: "" };
  let warning = "";
  for (const key of [FRONT_SETTINGS_KEY, PLAYTEST_PREFERENCES_KEY, SAVE_KEY]) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    try {
      const value =
        key === SAVE_KEY
          ? environmentPreferencesFromSave(parseSave(raw))
          : key === PLAYTEST_PREFERENCES_KEY
            ? environmentPreferencesFromSave(
                parseSave(JSON.stringify({ ...fresh(), ...JSON.parse(raw) })),
              )
            : parseEnvironmentPreferences(raw);
      // These two controls only exist in the base/solo menu. Preserve them
      // while Front takes priority for settings exposed in both menus.
      if (key === FRONT_SETTINGS_KEY) {
        const baseRaw = storage.getItem(PLAYTEST_PREFERENCES_KEY);
        const saveRaw = baseRaw === null ? storage.getItem(SAVE_KEY) : null;
        if (baseRaw !== null || saveRaw !== null) {
          try {
            const base = environmentPreferencesFromSave(
              baseRaw !== null
                ? parseSave(
                    JSON.stringify({ ...fresh(), ...JSON.parse(baseRaw) }),
                  )
                : parseSave(saveRaw),
            );
            value.mapRotates = base.mapRotates;
            value.damageNumbers = base.damageNumbers;
          } catch {
            warning =
              "以前の基地設定の一部を読み込めませんでした。元データは残しています。";
          }
        }
      }
      try {
        storage.setItem(ENVIRONMENT_PREFERENCES_KEY, JSON.stringify(value));
      } catch {
        warning = "共通の設定を保存できませんでした。元データは残しています。";
      }
      return { value, warning };
    } catch {
      warning = "以前の設定を読み込めませんでした。元データは残しています。";
    }
  }
  return { value: fallback, warning };
}

export function saveEnvironmentPreferences(
  value: EnvironmentPreferences,
  storage: StorageAccess = localStorage,
) {
  const parsed = parseEnvironmentPreferences(JSON.stringify(value));
  storage.setItem(ENVIRONMENT_PREFERENCES_KEY, JSON.stringify(parsed));
  return parsed;
}
