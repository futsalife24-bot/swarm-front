import { describe, expect, it } from "vitest";
import { STAGES } from "../src/shared/stages";
import { freshProgress } from "../src/client/progression-save";
import { freshBuddyProgress } from "../src/shared/buddy-progression";
import { nextFtueStep } from "../src/client/ftue";
import { homeMarkup, homeNextEntrance } from "../src/client/home-screen";

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
});
