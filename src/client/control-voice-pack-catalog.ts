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
    url: "assets/voice-packs/control-voice-hiromi-v2.bin",
    bytes: 6131283,
    sha256: "3727d557d269fa29106f158015eee03188ac652b74c77962d2f37958cba37253",
    clips: 147,
    sets: { "voice-control-hiromi-v1": 113, "voice-tutorial-hiromi-v1": 34 },
  },
  {
    voice: "hiyori",
    url: "assets/voice-packs/control-voice-hiyori-v2.bin",
    bytes: 4325809,
    sha256: "3be7fbc76cfb2d393dc86f4e4ecb75fec201bf182e0706840f372d12e7108dd3",
    clips: 113,
    sets: { "voice-control-hiyori-v1": 113 },
  },
  {
    voice: "yoko",
    url: "assets/voice-packs/control-voice-yoko-v2.bin",
    bytes: 4613975,
    sha256: "2dc48061ad3e6ee40b04222abcfe00adc3d0aed8ad62edd0401faabeadae454d",
    clips: 113,
    sets: { "voice-control-yoko-v1": 113 },
  },
];
