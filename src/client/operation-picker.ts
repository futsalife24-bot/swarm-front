import { menuDialog } from "./menu-ui";
import "./operation-picker.css";

export type OperationAudience = "solo" | "coop";

/** The common title's second step; callers keep ownership of routing and saves. */
export function openOperationPicker(
  audience: OperationAudience,
  actions: { advance: () => void; survival: () => void },
) {
  const dialog = menuDialog(
    audience === "solo" ? "ソロの作戦を選ぶ" : "協力の作戦を選ぶ",
    `<p class="operation-picker-intro">進撃と生存から作戦を選択してください。</p><div class="operation-picker-options"><button type="button" data-operation="advance"><small>CAMPAIGN</small><strong>進撃</strong><span>ステージを進め、武器と装備を育てる</span><i aria-hidden="true">↗</i></button><button type="button" data-operation="survival"><small>SURVIVAL</small><strong>生存</strong><span>強化を融合し、生存時間に挑む</span><i aria-hidden="true">↗</i></button></div>`,
    "SWARM FRONT / OPERATION",
  );
  dialog.classList.add("operation-picker-dialog");
  let chosen = false;
  dialog
    .querySelectorAll<HTMLButtonElement>("[data-operation]")
    .forEach((button) => {
      button.onclick = () => {
        if (chosen || !dialog.isConnected) return;
        chosen = true;
        const action =
          button.dataset.operation === "advance"
            ? actions.advance
            : actions.survival;
        dialog.close();
        action();
      };
    });
  return dialog;
}
