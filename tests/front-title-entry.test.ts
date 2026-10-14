import { describe, expect, it } from "vitest";
import { STAGES } from "../src/shared/stages";
import { homeMarkup } from "../src/client/home-screen";

describe("shared title entry", () => {
  it("offers solo and co-op with both operations without hiding existing menus", () => {
    const html = homeMarkup({ stage: STAGES[0], inventoryCount: 0 });
    expect(html).toContain('id="solo" aria-label="ソロ：進撃 または 生存"');
    expect(html).toContain('id="coop" aria-label="協力：進撃 または 生存"');
    expect(html).toContain('id="open-armory"');
    expect(html).toContain('id="open-bestiary"');
    expect(html).toContain('class="home-challenges"');
  });
});
