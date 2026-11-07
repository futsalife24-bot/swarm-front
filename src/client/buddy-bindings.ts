import { applyBuddyAction, type BuddyAction } from "./buddy-controller";
import { getBuddySkillView, getBuddyUiState } from "./buddy-presentation";
import { mountBuddyMenu, createBuddySkillButton } from "./buddy-ui";
import type { BuddyId } from "../shared/buddy-progression";
import { BUDDY_RECRUIT_RULES } from "../shared/buddy-progression";
import type { ProgressSave } from "./progression-save";
import type { Controls } from "./input";
import type { Sound } from "./audio";
import type { World } from "../shared/game";
import "./buddy-bindings.css";

/** Claudeの表示契約を既存保存へ接続。保存成功後だけ呼出元の状態を差し替える。 */
export function mountGameBuddyMenu(
  host: HTMLElement,
  getSave: () => ProgressSave,
  saved: (save: ProgressSave) => void,
  inBattle: () => boolean,
  sound: Sound,
) {
  const act = (action: BuddyAction) => {
    const result = applyBuddyAction(getSave(), action, {
      inBattle: inBattle(),
    });
    saved(result.save);
    return result;
  };
  return mountBuddyMenu(host, getBuddyUiState(getSave()), {
    requestId: () => crypto.randomUUID(),
    chooseStarter: (id) =>
      getBuddyUiState(act({ kind: "starter", buddyId: id as BuddyId }).save),
    equip: (id) =>
      getBuddyUiState(
        act({ kind: "equip", buddyId: id as BuddyId | null }).save,
      ),
    breakthrough: (id) =>
      getBuddyUiState(
        act({ kind: "breakthrough", buddyId: id as BuddyId }).save,
      ),
    draw: (requestId) => {
      const result = act({ kind: "draw", requestId });
      return {
        state: getBuddyUiState(result.save),
        outcome: {
          ...result.receipt!,
          fragmentsGained: result.receipt!.duplicate
            ? BUDDY_RECRUIT_RULES.duplicateFragments
            : 0,
        },
      };
    },
    sound: (cue) => sound.play(cue),
  });
}

export function attachBuddySkill(
  controls: Controls,
  sound: Sound,
  place: () => void,
) {
  const skill = createBuddySkillButton({
    keyHint: "G",
    onActivate: () => controls.activateBuddySkill(),
    onHoldStart: () => controls.beginBuddySkill(),
    onHoldEnd: (activate) => controls.endBuddySkill(activate),
    sound: (cue) => sound.play(cue),
  });
  skill.element.id = "buddy";
  skill.element.hidden = true;
  skill.element.title = "固有スキル（G）：短押しで発動・長押しで強化";
  skill.element.dataset.buddyActive = "false";
  const placeholder = document.getElementById("buddy");
  if (placeholder) placeholder.replaceWith(skill.element);
  else document.getElementById("controls")!.append(skill.element);
  return {
    update(world: World | null, ownerId: string, active: boolean) {
      const state = getBuddySkillView(world, ownerId, active);
      const changed =
        (skill.element.dataset.buddyActive === "true") !== !!state;
      skill.element.dataset.buddyActive = String(!!state);
      skill.update(state);
      if (changed) place();
    },
  };
}
