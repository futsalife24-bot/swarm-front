import { describe, expect, it } from "vitest";
import { STAGES } from "../src/shared/stages";
import { freshProgress } from "../src/client/progression-save";
import { freshBuddyProgress } from "../src/shared/buddy-progression";
import { nextFtueStep, type FtueNextStep } from "../src/client/ftue";
import {
  homeChallengesMarkup,
  homeMarkup,
  homeNextEntrance,
} from "../src/client/home-screen";
import { unlockState, type UnlockEntry } from "../src/client/unlock-stage";

function clearedSave() {
  const save = freshProgress("normal");
  save.missions["1:normal"] = [true, false, false];
  return save;
}

function buddyChosenSave() {
  const save = clearedSave();
  save.buddies = freshBuddyProgress();
  save.buddies.starterChosen = true;
  return save;
}

function saveAtStage(stage: number) {
  const save = freshProgress("normal");
  for (let index = 1; index <= stage; index += 1)
    save.missions[`${index}:normal`] = [true, false, false];
  return save;
}

const noFlags = { seen: [] as string[] };

const markupFor = (
  save: ReturnType<typeof freshProgress> | null,
  supplyBoxClaimable = false,
) =>
  homeMarkup({
    stage: STAGES[0],
    inventoryCount: 0,
    nextStep: nextFtueStep(save, { supplyBoxClaimable }),
  });

describe("shared title entry", () => {
  it("offers solo and co-op with both operations without hiding existing menus", () => {
    const html = homeMarkup({ stage: STAGES[0], inventoryCount: 0 });
    expect(html).toContain('id="solo" aria-label="ソロ：進撃 または 生存"');
    expect(html).toContain('id="coop" aria-label="協力：進撃 または 生存"');
    expect(html).toContain('id="open-armory"');
    expect(html).toContain('id="open-bestiary"');
    expect(html).toContain('class="home-challenges"');
  });

  it("keeps the stage name but removes the operation body from the title", () => {
    const html = homeMarkup({ stage: STAGES[0], inventoryCount: 0 });
    expect(html).toContain(STAGES[0].name);
    expect(html).not.toContain(STAGES[0].brief);
    expect(html).not.toContain("作戦詳細");
  });

  it("maps F5 steps to the existing home entrance markers", () => {
    const buddyMissing = clearedSave();
    const supplyMissing = buddyChosenSave();
    const supplyDone = buddyChosenSave();
    supplyDone.receipts.push("supply:first10");

    expect(homeNextEntrance(nextFtueStep(null))).toBe("solo");
    expect(homeNextEntrance(nextFtueStep(buddyMissing))).toBe("base");
    expect(homeNextEntrance(nextFtueStep(supplyMissing))).toBe("base");
    expect(
      homeNextEntrance(
        nextFtueStep(supplyDone, { supplyBoxClaimable: true }),
      ),
    ).toBe("supplyBox");
    expect(homeNextEntrance(nextFtueStep(supplyDone))).toBeNull();
  });

  it("shows one existing emphasis for the buddy or supply step", () => {
    for (const [save, description] of [
      [clearedSave(), "最初のバディを選べます"],
      [buddyChosenSave(), "初回補給10連ができます"],
    ] as const) {
      const html = markupFor(save);
      expect(html.match(/class="primary(?: home-launch)?"/g)).toHaveLength(1);
      expect(html).toContain('<button class="home-launch" id="solo"');
      expect(html).toContain('<button class="primary" id="open-armory"');
      expect(html).toContain(`<em>${description}</em>`);
    }
  });

  it("leaves the existing emphasis off when the supply-box badge is the marker", () => {
    const save = buddyChosenSave();
    save.receipts.push("supply:first10");
    const html = markupFor(save, true);
    expect(
      nextFtueStep(save, { supplyBoxClaimable: true }).kind,
    ).toBe("supplyBox");
    expect(html.match(/class="primary(?: home-launch)?"/g)).toBeNull();
    expect(html).toContain("<em>武器・育成・生存カード</em>");
  });

  it("keeps the current home display once every step is done", () => {
    const save = buddyChosenSave();
    save.receipts.push("supply:first10");
    expect(markupFor(save)).toBe(
      homeMarkup({ stage: STAGES[0], inventoryCount: 0 }),
    );
  });

  it("never marks a closed U0 entrance for any F5 step", () => {
    const steps = [
      { kind: "solo" },
      { kind: "buddy" },
      { kind: "supply" },
      { kind: "supplyBox" },
      { kind: "none" },
    ] as FtueNextStep[];
    const targets: Record<FtueNextStep["kind"], UnlockEntry | null> = {
      solo: "solo",
      buddy: "buddy",
      supply: "supply",
      supplyBox: "supplyBox",
      none: null,
    } as const;
    for (const stage of [0, 1, 2, 3]) {
      const unlock = unlockState(saveAtStage(stage), noFlags);
      for (const step of steps) {
        const entrance = homeNextEntrance(step, unlock);
        if (!entrance) continue;
        const target = targets[step.kind];
        expect(target).not.toBeNull();
        expect(
          unlock.entries[target as UnlockEntry].open,
          `${step.kind}@S${stage}`,
        ).toBe(true);
        const html = homeMarkup({
          stage: STAGES[0],
          inventoryCount: 0,
          nextStep: step,
          unlock,
        });
        if (entrance === "base")
          expect(html).toContain('<button class="primary" id="open-armory"');
        else expect(html).not.toContain('<button class="primary" id="open-armory"');
      }
    }
  });

  it("shows U0 reasons and disabled state on locked home buttons", () => {
    const locked = homeMarkup({
      stage: STAGES[0],
      inventoryCount: 0,
      unlock: unlockState(saveAtStage(0), noFlags),
    });
    expect(locked).toContain(
      '<button id="open-armory" aria-label="基地" aria-disabled="true" disabled>',
    );
    expect(locked).toContain(
      '<button id="open-bestiary" aria-label="エネミーレポート" aria-disabled="true" disabled>',
    );
    expect(locked).toContain(
      "<em>ST1 前哨掃討のクリアで開きます</em>",
    );
    expect(locked).toContain("<em>敵と遭遇すると記録が始まります</em>");

    const opened = homeMarkup({
      stage: STAGES[0],
      inventoryCount: 0,
      unlock: unlockState(saveAtStage(1), noFlags),
    });
    expect(opened).not.toContain('id="open-armory" aria-label="基地" aria-disabled');
    expect(opened).toContain("<em>敵の特徴と対処を確認</em>");
  });

  it("suppresses a closed next-step target while keeping the base locked", () => {
    const html = homeMarkup({
      stage: STAGES[0],
      inventoryCount: 0,
      nextStep: {
        kind: "buddy",
        label: "最初のバディを選ぶ",
        destination: "base → buddy card",
      },
      unlock: unlockState(saveAtStage(0), noFlags),
    });
    expect(html).toContain('<button class="primary home-launch" id="solo"');
    expect(html).not.toContain('<button class="primary" id="open-armory"');
    expect(html).toContain("<em>ST1 前哨掃討のクリアで開きます</em>");
  });

  it("emits challenge rows only for entrances U0 has opened", () => {
    const supplyBox =
      '<button id="pt-supply-box" class="weekly-title-button">支給ボックス<span class="weekly-notification" aria-hidden="true" hidden></span></button>';
    expect(
      homeChallengesMarkup({
        unlock: unlockState(saveAtStage(0), noFlags),
        mode: "normal",
      }),
    ).toBe(supplyBox);
    expect(
      homeChallengesMarkup({
        unlock: unlockState(saveAtStage(1), noFlags),
        mode: "normal",
      }),
    ).toBe(supplyBox);
    const s2 = homeChallengesMarkup({
      unlock: unlockState(saveAtStage(2), noFlags),
      mode: "normal",
    });
    expect(s2).toContain('id="pt-weekly-missions"');
    expect(s2).not.toContain('id="pt-daily-defense"');
    const s3 = homeChallengesMarkup({
      unlock: unlockState(saveAtStage(3), noFlags),
      mode: "normal",
    });
    expect(s3).toContain('id="pt-daily-defense"');
    expect(s3).toContain('id="pt-weekly-missions"');
    expect(s3).toContain('id="pt-supply-box"');
    expect(
      homeChallengesMarkup({
        unlock: unlockState(saveAtStage(3), noFlags),
        mode: "normal",
        developerMode: true,
      }),
    ).toBe("");
  });
});
