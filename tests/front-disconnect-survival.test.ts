import { describe, expect, it } from "vitest";
import {
  chooseFrontUpgrade,
  createFrontRun,
  stepFrontRun,
  type FrontMode,
} from "../src/shared/front-run";

function startedRun(mode: FrontMode, fusion: boolean) {
  const run = createFrontRun({
    runId: `disconnect-${mode}-${fusion}`,
    seed: 814,
    mode,
    fusion,
    players: [{ id: "host" }, { id: "guest" }],
  });
  for (const player of run.world.players) {
    const offer = run.upgrades[player.id].offer!;
    expect(
      chooseFrontUpgrade(
        run,
        player.id,
        {
          runId: run.world.run,
          offerId: offer.id,
          revision: offer.revision,
          requestId: `choose-${player.id}`,
          cardId: offer.defaultCardId,
        },
        0,
      ),
    ).toBe(true);
  }
  expect(run.phase).toBe("combat");
  return run;
}

describe("front run defeat during a disconnect", () => {
  it("keeps fusion survival active while the only surviving player can reconnect", () => {
    const run = startedRun("survival", true);
    const [host, guest] = run.world.players;
    host.hp = 0;
    guest.connected = false;

    stepFrontRun(run, {}, 0.05, 1);
    expect(run.world.phase).toBe("battle");
    expect(run.phase).toBe("combat");
    expect(guest.hp).toBeGreaterThan(0);

    guest.connected = true;
    stepFrontRun(run, {}, 0.05, 2);
    expect(run.world.phase).toBe("battle");
    expect(run.phase).toBe("combat");

    // 復帰猶予超過時にサーバーがHPを0にする状態を模擬する。
    guest.connected = false;
    guest.hp = 0;
    stepFrontRun(run, {}, 0.05, 3);
    expect(run.world.phase).toBe("defeat");
    expect(run.phase).toBe("defeat");
  });

  it.each([
    ["survival", false],
    ["defense", true],
  ] as const)(
    "retains the connected-survivor rule for %s fusion=%s",
    (mode, fusion) => {
      const run = startedRun(mode, fusion);
      const [host, guest] = run.world.players;
      host.hp = 0;
      guest.connected = false;
      expect(guest.hp).toBeGreaterThan(0);

      stepFrontRun(run, {}, 0.05, 1);
      expect(run.world.phase).toBe("defeat");
      expect(run.phase).toBe("defeat");
    },
  );
});
