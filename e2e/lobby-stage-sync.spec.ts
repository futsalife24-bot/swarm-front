import { test, expect } from "@playwright/test";
import { localCreationKey } from "../tests/credentials";
import { copyInvite } from "./invite";

const endpoint = process.env.SWARM_TEST_ENDPOINT ?? "http://127.0.0.1:8789";

test("ST11 and ST20 remain synchronized after lobby replies and guest preparation", async ({
  browser,
}) => {
  const host = await browser.newContext({ serviceWorkers: "block" });
  const guest = await browser.newContext({ serviceWorkers: "block" });
  host.setDefaultTimeout(15000);
  guest.setDefaultTimeout(15000);
  try {
    const a = await host.newPage();
    const b = await guest.newPage();
    await a.goto("/");
    await a.getByRole("button", { name: "協力プレイ", exact: true }).click();
    await a.locator(".coop-advanced summary").click();
    await a.locator("#endpoint").fill(endpoint);
    await a.locator("#creation-key").evaluate((el: HTMLInputElement, key) => {
      el.value = key;
    }, localCreationKey());
    await a.getByRole("button", { name: "ルームを作る" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(1);
    await b.goto(await copyInvite(a));
    await b.locator(".coop-advanced summary").click();
    await b.locator("#endpoint").fill(endpoint);
    await b.getByRole("button", { name: "招待ルームに参加" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(2);

    for (const stage of ["11", "20"]) {
      await a.locator("#lobby-stage").selectOption(stage);
      // The guest can only get this value from the real Worker's lobby reply.
      await expect(b.locator("#lobby-stage")).toHaveValue(stage);
      await expect(b.locator("#lobby-stage")).toBeDisabled();
      await expect(a.locator("#lobby-stage")).toHaveValue(stage);
    }
    await b
      .getByRole("button", { name: "出撃準備・装備変更", exact: true })
      .click();
    await expect(b.locator("#stage-select")).toHaveValue("20");
    await expect(b.locator("#stage-select")).toBeDisabled();
    await expect(a.locator(".is-preparing")).toHaveCount(1);
    await expect(a.locator("#begin")).toBeDisabled();
    await expect(a.locator("#lobby-stage")).toHaveValue("20");
    await b.getByRole("button", { name: "準備完了してロビーへ" }).click();
    await expect(a.locator(".is-ready")).toHaveCount(2);
    for (const p of [a, b])
      await expect(p.locator("#lobby-stage")).toHaveValue("20");
    await expect(a.locator("#begin")).toBeEnabled();
  } finally {
    await host.close();
    await guest.close();
  }
});
