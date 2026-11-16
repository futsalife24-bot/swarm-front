import type { EnemyReportId } from "../shared/enemy-identity";
import type { Sound } from "./audio";

export type ReportVoice = Pick<Sound, "announce" | "controlVoice" | "unlock">;

/** 棚卸し済みの識別名だけ。残る9種は3声とも未収録（音声を生成しない）。 */
export const REPORT_IDENTIFICATION_CLIPS: Partial<
  Record<EnemyReportId, string>
> = {
  calyx: "anomaly-calyx",
};

/** 一覧の再描画や同じ項目の連打では繰り返さず、別項目への移動で次の表示とする。 */
export function reportIdentification(voice?: ReportVoice) {
  let selected: EnemyReportId | undefined;
  return {
    select(key: EnemyReportId, state?: "solo" | "coop") {
      if (key === selected) return;
      selected = key;
      // ？？？・未収録への移動でも、前の項目の発話と非同期準備を取り消す。
      voice?.controlVoice.stop();
      const clip = state === "solo" && REPORT_IDENTIFICATION_CLIPS[key];
      if (clip) {
        voice?.unlock();
        voice?.announce(clip);
      }
    },
    stop() {
      voice?.controlVoice.stop();
    },
  };
}
