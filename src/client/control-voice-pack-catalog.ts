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
    url: "assets/voice-packs/control-voice-hiromi-v1.bin",
    bytes: 6197594,
    sha256: "d7ae0d7993ff231d5ae1365517f6408840168d8799ae63838f38c14f2fb399e3",
    clips: 145,
    sets: { "voice-control-hiromi-v1": 111, "voice-tutorial-hiromi-v1": 34 },
  },
  {
    voice: "hiyori",
    url: "assets/voice-packs/control-voice-hiyori-v1.bin",
    bytes: 4382297,
    sha256: "f68e009063de6a0779b299e479a7a006419341d847b0efab072166e68d617d6e",
    clips: 111,
    sets: { "voice-control-hiyori-v1": 111 },
  },
  {
    voice: "yoko",
    url: "assets/voice-packs/control-voice-yoko-v1.bin",
    bytes: 4682173,
    sha256: "06cf5e4dd40f05e0cdee4f08907d4e303d9501f7ac09dd63d98df845b3cebc7e",
    clips: 111,
    sets: { "voice-control-yoko-v1": 111 },
  },
];
