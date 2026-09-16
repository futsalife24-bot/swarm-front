import { expect, type Page } from "@playwright/test";

/** Exercise the share button clipboard fallback without changing the user's system clipboard. */
export async function copyInvite(page: Page) {
  await page.evaluate(() => {
    (window as any).__copiedInvite = "";
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async (text: string) => {
        (window as any).__copiedInvite = text;
      },
    });
  });
  try {
    await page
      .getByRole("button", { name: "招待リンクを共有", exact: true })
      .click();
    await expect(page.locator("#invite-feedback")).toHaveText("コピーしました");
    const invite = await page.evaluate(
      () => (window as any).__copiedInvite as string,
    );
    expect(new URL(invite).origin).toBe(new URL(page.url()).origin);
    expect(new URL(invite).hash).toMatch(/^#[a-f0-9]{32}$/);
    return invite;
  } finally {
    await page.evaluate(() => {
      delete (navigator as any).share;
      delete (navigator.clipboard as any).writeText;
      delete (window as any).__copiedInvite;
    });
  }
}
