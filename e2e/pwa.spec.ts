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
    display: "fullscreen",
    orientation: "landscape",
    start_url: "./",
    scope: "./",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        src: "icon-swarm-v4-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      }),
      expect.objectContaining({
        src: "icon-swarm-v4-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      }),
      expect.objectContaining({
        src: "icon-swarm-v4-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      }),
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
      page.getByRole("button", { name: "ソロ：進撃 または 生存", exact: true }),
    ).toBeVisible();
  } finally {
    await page.context().setOffline(false);
  }
});

test("Pages subpath serves a scoped PWA manifest and worker", async ({
  page,
}) => {
  const pagesUrl =
    process.env.PWA_PAGES_URL || "http://127.0.0.1:4186/swarm-front/";
  await page.goto(pagesUrl);
  const result = await page.evaluate(async () => {
    const manifest = await (await fetch("manifest.webmanifest")).json();
    const registration = await navigator.serviceWorker.ready;
    return { manifest, scope: registration.scope };
  });
  expect(result.manifest.start_url).toBe("./");
  expect(result.manifest.scope).toBe("./");
  expect(result.scope).toBe(pagesUrl);
});
