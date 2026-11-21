import { describe, expect, it } from "vitest";
import {
  HIYORI_RELEASE,
  emptySupplyBox,
  grantLoginBonus,
  grantOnce,
} from "../src/client/supply-box";
import { receivedHiyori } from "../src/client/supply-box-ui";

const NOON = Date.UTC(2026, 10, 14, 3);

describe("supply box: control-voice shortcut eligibility", () => {
  it("is offered only for a Hiyori receipt", () => {
    expect(receivedHiyori([])).toBe(false);
    expect(receivedHiyori(grantLoginBonus(emptySupplyBox(), NOON).items)).toBe(
      false,
    );
    expect(
      receivedHiyori(grantOnce(emptySupplyBox(), HIYORI_RELEASE, NOON).items),
    ).toBe(true);
  });
});
