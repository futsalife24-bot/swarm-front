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
    url: "assets/voice-packs/control-voice-hiromi-v5.bin",
    bytes: 6795573,
    sha256: "0602e69c9690660720d23024773e6ead082db13247955f2a86b9be84c8a686df",
    clips: 167,
    sets: { "voice-control-hiromi-v1": 123, "voice-tutorial-hiromi-v1": 44 },
  },
  {
    voice: "hiyori",
    url: "assets/voice-packs/control-voice-hiyori-v5.bin",
    bytes: 4972335,
    sha256: "7f65564034329f7e81c5545c92d458a8019e6fe971f865fbbf460620fcd74e02",
    clips: 133,
    sets: { "voice-control-hiyori-v1": 123, "voice-tutorial-hiyori-v1": 10 },
  },
  {
    voice: "yoko",
    url: "assets/voice-packs/control-voice-yoko-v5.bin",
    bytes: 5303926,
    sha256: "f97d22da9ea8f844819ade75fdd47efb2c1183ee34c7429b8193a1c06549e45e",
    clips: 133,
    sets: { "voice-control-yoko-v1": 123, "voice-tutorial-yoko-v1": 10 },
  },
];
