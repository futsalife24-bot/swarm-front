// 自動生成: node scripts/build-voice-packs.mjs（手で編集しない）
// 管制AIボイスの任意ダウンロード用パック一覧。
export interface ControlVoicePackEntry {
  voice: "hiromi" | "hiyori" | "yoko";
  url: string;
  bytes: number;
  sha256: string;
  clips: number;
  sets: Record<string, number>;
}
export const CONTROL_VOICE_PACK_FORMAT = 1;
export const CONTROL_VOICE_PACKS: readonly ControlVoicePackEntry[] = [
  {
    voice: "hiromi",
    url: "assets/voice-packs/control-voice-hiromi-v3.bin",
    bytes: 6296247,
    sha256: "d15190360b1ecbcb180adcc12890732a96ebf1fcdb44fc0f8394e7f603592338",
    clips: 156,
    sets: { "voice-control-hiromi-v1": 122, "voice-tutorial-hiromi-v1": 34 },
  },
  {
    voice: "hiyori",
    url: "assets/voice-packs/control-voice-hiyori-v3.bin",
    bytes: 4487011,
    sha256: "423a79c769dab7d3842f7baed70d1de8d8401251a6c978382a62488eff798e99",
    clips: 122,
    sets: { "voice-control-hiyori-v1": 122 },
  },
  {
    voice: "yoko",
    url: "assets/voice-packs/control-voice-yoko-v3.bin",
    bytes: 4781429,
    sha256: "98d6cfad84bde48b07395dc2dd045b82c17d29187a4a40debbedcf185893b62f",
    clips: 122,
    sets: { "voice-control-yoko-v1": 122 },
  },
];
