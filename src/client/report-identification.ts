import type { EnemyReportId } from "../shared/enemy-identity";
import type { Sound } from "./audio";

export type ReportVoice = Pick<Sound, "announce" | "controlVoice" | "unlock">;

/** 全10種・3声の収録済み識別名。保存キーと音声IDの対応を固定する。 */
export const REPORT_IDENTIFICATION_CLIPS: Record<EnemyReportId, string> = {
  crawler: "anomaly-pleat",
  ant: "anomaly-volley",
  spider: "anomaly-leaper",
  spitter: "anomaly-prism",
  boss: "anomaly-foundry",
  hornet: "anomaly-ray",
  bastion: "anomaly-bastion",
  worm: "anomaly-catena",
  calyx: "anomaly-calyx",
  harrow: "anomaly-harrow",
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
