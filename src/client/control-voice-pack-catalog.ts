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
    url: "assets/voice-packs/control-voice-hiromi-v4.bin",
    bytes: 6367802,
    sha256: "a2db860c863a06627f7383d69fe3574adc739026df092b1f1444ccbfe1bc6dd8",
    clips: 157,
    sets: { "voice-control-hiromi-v1": 123, "voice-tutorial-hiromi-v1": 34 },
  },
  {
    voice: "hiyori",
    url: "assets/voice-packs/control-voice-hiyori-v4.bin",
    bytes: 4556685,
    sha256: "3a06dd92fefb6cccbac8453429b1bb2518302f2964f9ab79237efe6908d61460",
    clips: 123,
    sets: { "voice-control-hiyori-v1": 123 },
  },
  {
    voice: "yoko",
    url: "assets/voice-packs/control-voice-yoko-v4.bin",
    bytes: 4855697,
    sha256: "8107adfaf8b0323e9a68bff8ba4e2c190f4a343de18bb971cf6820408709ae64",
    clips: 123,
    sets: { "voice-control-yoko-v1": 123 },
  },
];
