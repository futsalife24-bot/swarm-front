/** 本人指定の採用版。属性・能力・入手条件はこの外観表から導出しない。 */
export const BUDDY_ASSETS = {
  tatara: {
    name: "タタラ",
    file: "tatara-v3.glb",
    portrait: "tatara.webp",
    display: "Palm",
    radius: 0.93,
    locomotion: "walk",
  },
  yosuga: {
    name: "ヨスガ",
    file: "yosuga-v5.glb",
    portrait: "yosuga.webp",
    display: "Display",
    radius: 0.52,
    locomotion: "walk",
  },
  tobari: {
    name: "トバリ",
    file: "tobari-v7.glb",
    portrait: "tobari.webp",
    display: "Display",
    radius: 0.43,
    locomotion: "float",
  },
  oriha: {
    name: "オリハ",
    file: "oriha-v3.glb",
    portrait: "oriha.webp",
    display: "Display",
    radius: 0.88,
    locomotion: "float",
  },
} as const;
export type BuddyKind = keyof typeof BUDDY_ASSETS;
export type BuddyMotion = "Idle" | "Follow" | "Display" | "Coil";
export interface BuddyAppearance {
  /** 外観インスタンスと所有者を別に扱う。製品は所有者1人につき1体。 */
  key: string;
  owner: string;
  kind: BuddyKind;
}
