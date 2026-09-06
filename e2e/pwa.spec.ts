import { expect, test } from "@playwright/test";

test("PWA manifest installs an app shell that reopens solo offline", async ({
  page,
}) => {
  await page.goto("/");
  const manifest = await page.evaluate(async () => {
    const response = await fetch("manifest.webmanifest");
    return response.json();
  });
  expect(manifest).toMatchObject({
    name: "SWARM FRONT",
    display: "standalone",
    orientation: "landscape",
    start_url: "./",
    scope: "./",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "icon.svg", purpose: "any maskable" }),
    ]),
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page.context().setOffline(true);
  try {
    await page.reload();
    await expect(
      page.getByRole("button", { name: "ソロで出撃準備" }),
    ).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});

test("Pages subpath serves a scoped PWA manifest and worker", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4186/swarm-front/");
  const result = await page.evaluate(async () => {
    const manifest = await (await fetch("manifest.webmanifest")).json();
    const registration = await navigator.serviceWorker.ready;
    return { manifest, scope: registration.scope };
  });
  expect(result.manifest.start_url).toBe("./");
  expect(result.manifest.scope).toBe("./");
  expect(result.scope).toBe("http://127.0.0.1:4186/swarm-front/");
});
