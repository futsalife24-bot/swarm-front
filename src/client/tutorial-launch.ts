/**
 * 基礎訓練の入口（tutorial-proposal §8-3 W4）。
 * 設定の「ボタン配置」から開く訓練射撃場と同じ経路（?training=1 の iframe）で、手順つきの訓練を開く。
 * 訓練は報酬なし・保存なし。修了の記録（tutorial-flags の "training"）だけを残し、
 * ステージ解放や報酬には一切影響しない。
 */
import {
  OPERATION_KEYS,
  markOperationFlag,
  markSeen,
} from "./tutorial-flags";
import type { Layout } from "./layout";
import type { TutorialCourse } from "./tutorial-run";

export function recordTrainingAchievement(operation: unknown) {
  if (typeof operation !== "string") return false;
  const key = OPERATION_KEYS.find((candidate) => candidate === operation);
  if (!key) return false;
  return markOperationFlag(`op:${key}`);
}

export interface BasicTrainingOptions {
  layout: Layout;
  /** 初陣訓練（4操作）または完全版（12ステップ）。省略時は完全版。 */
  course?: TutorialCourse;
  /** 訓練射撃場へ渡す設定（音量・感度・持っていく2本）。 */
  config?: () => unknown;
  onExit: (completed: boolean) => void;
}

export function openBasicTraining(options: BasicTrainingOptions) {
  const course = options.course ?? "full";
  const frame = document.createElement("iframe");
  frame.className = "training-frame";
  frame.title = course === "first" ? "初陣訓練" : "基礎訓練";
  frame.allow = "autoplay; gyroscope; accelerometer";
  frame.src =
    import.meta.env.BASE_URL + `?training=1&tutorial=1&course=${course}`;
  const receive = (event: MessageEvent) => {
    if (
      event.origin !== location.origin ||
      event.source !== frame.contentWindow
    )
      return;
    if (event.data?.type === "training-ready") {
      const readyCourse =
        event.data.course === "first" || event.data.course === "full"
          ? event.data.course
          : course;
      frame.contentWindow!.postMessage(
        {
          type: "training-start",
          course: readyCourse,
          layout: options.layout,
          config: options.config?.(),
        },
        location.origin,
      );
    }
    if (event.data?.type === "training-achievement")
      recordTrainingAchievement(event.data.operation);
    if (event.data?.type === "training-exit") {
      window.removeEventListener("message", receive);
      frame.remove();
      const completed = event.data.completed === true;
      if (completed) markSeen("training");
      options.onExit(completed);
    }
  };
  window.addEventListener("message", receive);
  document.body.append(frame);
  return frame;
}
