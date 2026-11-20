import { describe, expect, it } from "vitest";
import { freshProgress, type ProgressSave } from "../src/client/progression-save";
import { freshBuddyProgress } from "../src/shared/buddy-progression";
import { nextFtueStep, type FtueNextStep } from "../src/client/ftue";
import {
  unlockState,
  type UnlockEntry,
} from "../src/client/unlock-stage";

type Fixture = {
  name: string;
  save: ProgressSave | null;
  claimable?: boolean;
  expected: FtueNextStep;
  entrance: UnlockEntry;
};

function saveAtStage(stage: number, mode: "normal" | "test" = "normal") {
  const save = freshProgress(mode);
  for (let index = 1; index <= stage; index += 1)
    save.missions[`${index}:normal`] = [true, false, false];
  return save;
}

function stage1Buddy() {
  const save = saveAtStage(1);
  save.buddies = freshBuddyProgress();
  save.buddies.starterChosen = true;
  return save;
}

function supplyDone() {
  const save = stage1Buddy();
  save.receipts.push("supply:first10");
  return save;
}

const fixtures: readonly Fixture[] = [
  {
    name: "no save",
    save: null,
    expected: {
      kind: "solo",
      label: "solo advance （進撃）",
      destination: "solo",
    },
    entrance: "solo",
  },
  {
    name: "not started",
    save: saveAtStage(0),
    expected: {
      kind: "solo",
      label: "solo advance （進撃）",
      destination: "solo",
    },
    entrance: "solo",
  },
  {
    name: "ST1 not cleared",
    save: saveAtStage(0),
    expected: {
      kind: "solo",
      label: "solo advance （進撃）",
      destination: "solo",
    },
    entrance: "solo",
  },
  {
    name: "first buddy not chosen",
    save: saveAtStage(1),
    expected: {
      kind: "buddy",
      label: "最初のバディを選ぶ",
      destination: "base → buddy card",
    },
    entrance: "buddy",
  },
  {
    name: "first 10-pull not done",
    save: stage1Buddy(),
    expected: {
      kind: "supply",
      label: "初回補給10連",
      destination: "base → supply pod",
    },
    entrance: "supply",
  },
  {
    name: "claimable supply box after 10-pull",
    save: supplyDone(),
    claimable: true,
    expected: {
      kind: "supplyBox",
      label: "支給ボックス",
      destination: "supplyBox",
    },
    entrance: "supplyBox",
  },
  {
    name: "everything done",
    save: supplyDone(),
    expected: { kind: "none", label: null, destination: null },
    entrance: "title",
  },
  {
    name: "existing player with cleared save and no buddy record",
    save: (() => {
      const save = saveAtStage(1);
      delete save.buddies;
      return save;
    })(),
    expected: {
      kind: "buddy",
      label: "最初のバディを選ぶ",
      destination: "base → buddy card",
    },
    entrance: "buddy",
  },
  {
    name: "test save before ST1",
    save: saveAtStage(0, "test"),
    expected: {
      kind: "solo",
      label: "solo advance （進撃）",
      destination: "solo",
    },
    entrance: "solo",
  },
];

describe("nextFtueStep (C-6 F5)", () => {
  it("matches every §4-4 state table row", () => {
    for (const fixture of fixtures) {
      const actual = nextFtueStep(fixture.save, {
        supplyBoxClaimable: fixture.claimable,
      });
      expect(actual, fixture.name).toEqual(fixture.expected);
    }
  });

  it("judges the first 10-pull only from supply receipts", () => {
    const save = stage1Buddy();
    save.receipts.push("login:day1");
    expect(nextFtueStep(save).kind).toBe("supply");
    save.receipts.push("supply:first10");
    expect(nextFtueStep(save).kind).toBe("none");
  });

  it("does not mutate its inputs", () => {
    const save = supplyDone();
    const before = JSON.stringify(save);
    nextFtueStep(save, { supplyBoxClaimable: true });
    expect(JSON.stringify(save)).toBe(before);
  });

  it("keeps every next-step entrance open under U0", () => {
    for (const fixture of fixtures) {
      const state = unlockState(fixture.save, { seen: [] });
      expect(
        state.entries[fixture.entrance].open,
        `${fixture.name}: ${fixture.entrance}`,
      ).toBe(true);
    }
  });
});
