# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: front.spec.ts >> 横画面 640：初期候補・3択・再開・旧版保護
- Location: e2e\front.spec.ts:295:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic "三人称3D戦場" [ref=e2]
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - button "現在の強化 0/6枠" [active] [ref=e6] [cursor=pointer]
        - heading "強化を選べ" [level=1] [ref=e7]
      - generic [ref=e8]:
        - button "新規獲得・未取得 → 1段階：装甲補強：最大体力 +5%。生存中の取得時は増加分を回復。" [ref=e9] [cursor=pointer]:
          - generic [ref=e10]:
            - generic [aria-hidden] [ref=e11]: ＋
            - text: 新規獲得
          - generic [ref=e12]: 未取得 → 1段階 · 補強
          - strong [ref=e13]: 装甲補強
          - generic [ref=e14]: 最大体力 +5%。生存中の取得時は増加分を回復。
        - button "新規獲得・未取得 → 1段階：圧縮炸薬：同じ敵に3回命中で爆発。威力 42。" [ref=e15] [cursor=pointer]:
          - generic [ref=e16]:
            - generic [aria-hidden] [ref=e17]: ＋
            - text: 新規獲得
          - generic [ref=e18]: 未取得 → 1段階 · 爆発
          - strong [ref=e19]: 圧縮炸薬
          - generic [ref=e20]: 同じ敵に3回命中で爆発。威力 42。
        - button "新規獲得・未取得 → 1段階：磁力回収：経験値の回収半径 8m。" [ref=e21] [cursor=pointer]:
          - generic [ref=e22]:
            - generic [aria-hidden] [ref=e23]: ＋
            - text: 新規獲得
          - generic [ref=e24]: 未取得 → 1段階 · 補強
          - strong [ref=e25]: 磁力回収
          - generic [ref=e26]: 経験値の回収半径 8m。
```

# Test source

```ts
  428 |         (id) => selectedPool.includes(id) && !excluded.includes(id!),
  429 |       ),
  430 |     ).toBe(true);
  431 |     const chosenId = originalChoices[0] as FrontUpgradeId;
  432 |     const chosenName = FRONT_UPGRADE_CATALOG[chosenId].name;
  433 |     await page
  434 |       .getByRole("button", { name: "現在の強化 0/6枠", exact: true })
  435 |       .click();
  436 |     const owned = page.getByRole("dialog", { name: "現在の強化", exact: true });
  437 |     await expect(owned).toBeVisible();
  438 |     await expect(owned).toContainText("まだ強化を取得していません");
  439 |     await page.screenshot({
  440 |       path: `${evidence}/owned-empty-${viewport.width}.png`,
  441 |     });
  442 |     const acquiredSample = getFrontRunView(
  443 |       createFrontRun(
  444 |         { runId: "owned-layout", seed: 1, players: [{ id: "p" }] },
  445 |         0,
  446 |       ),
  447 |       "p",
  448 |     );
  449 |     for (const id of [
  450 |       "blast-core",
  451 |       "fuse",
  452 |       "compressed-charge",
  453 |       "armor-piercer",
  454 |       "ricochet",
  455 |       "line-shot",
  456 |     ] as const)
  457 |       acquiredSample.levels[id] = 2;
  458 |     acquiredSample.picks = 12;
  459 |     // 実際の詳細ダイアログに最大取得状態の描画だけを入れて収まりを検証。
  460 |     await owned.locator(".front-upgrade-details").evaluate(
  461 |       (el, markup) => {
  462 |         el.outerHTML = markup;
  463 |       },
  464 |       frontUpgradeDetails(acquiredSample, "/"),
  465 |     );
  466 |     await expect(owned.locator("li")).toHaveCount(6);
  467 |     await owned.locator(".front-evolution-progress").scrollIntoViewIfNeeded();
  468 |     await expect(
  469 |       page.getByRole("button", { name: "3択へ戻る", exact: true }),
  470 |     ).toBeInViewport();
  471 |     expect(
  472 |       await owned.evaluate((el) => {
  473 |         const r = el.getBoundingClientRect();
  474 |         return (
  475 |           r.left >= 0 &&
  476 |           r.top >= 0 &&
  477 |           r.right <= innerWidth &&
  478 |           r.bottom <= innerHeight &&
  479 |           el.scrollWidth <= el.clientWidth
  480 |         );
  481 |       }),
  482 |     ).toBe(true);
  483 |     await page.screenshot({
  484 |       path: `${evidence}/owned-six-${viewport.width}.png`,
  485 |     });
  486 |     await page.getByRole("button", { name: "3択へ戻る", exact: true }).click();
  487 |     await expect(owned).not.toBeVisible();
  488 |     await page
  489 |       .getByRole("button", { name: "現在の強化 0/6枠", exact: true })
  490 |       .click();
  491 |     await page.keyboard.press("Escape");
  492 |     await expect(owned).not.toBeVisible();
  493 |     await expect(
  494 |       page.getByRole("heading", { name: "強化を選べ", exact: true }),
  495 |     ).toBeVisible();
  496 |     expect(
  497 |       await page
  498 |         .locator(".rebuild-card")
  499 |         .evaluateAll((es) => es.map((e) => e.getAttribute("data-card"))),
  500 |     ).toEqual(originalChoices);
  501 |     await expect(page.locator(".rebuild-card")).toHaveCount(3);
  502 |     expect(await page.locator(".rebuild-selection footer").count()).toBe(0);
  503 |     const cards = await page.locator(".rebuild-card").evaluateAll((nodes) =>
  504 |       nodes.map((el) => {
  505 |         const r = el.getBoundingClientRect(),
  506 |           image = el.querySelector("img")!,
  507 |           style = getComputedStyle(el);
  508 |         return {
  509 |           left: r.left,
  510 |           right: r.right,
  511 |           top: r.top,
  512 |           bottom: r.bottom,
  513 |           loaded: image.complete && image.naturalWidth === 256,
  514 |           animation: style.animationName,
  515 |           delay: style.animationDelay,
  516 |         };
  517 |       }),
  518 |     );
  519 |     expect(
  520 |       cards.every(
  521 |         (c) =>
  522 |           c.left >= 0 &&
  523 |           c.right <= viewport.width &&
  524 |           c.top >= 0 &&
  525 |           c.bottom <= viewport.height &&
  526 |           c.loaded,
  527 |       ),
> 528 |     ).toBe(true);
      |       ^ Error: expect(received).toBe(expected) // Object.is equality
  529 |     expect(cards.map((c) => c.animation)).toEqual(
  530 |       viewport.width === 640
  531 |         ? ["none", "none", "none"]
  532 |         : ["rebuild-card-enter", "rebuild-card-enter", "rebuild-card-enter"],
  533 |     );
  534 |     if (viewport.width === 844)
  535 |       expect(cards.map((c) => c.delay)).toEqual(["0s", "0.07s", "0.14s"]);
  536 |     const title = page.locator(".front-choice-title");
  537 |     expect(
  538 |       await title.evaluate((el) => getComputedStyle(el).animationName),
  539 |     ).toBe(viewport.width === 640 ? "none" : "front-title-enter");
  540 |     await page
  541 |       .locator(".rebuild-card")
  542 |       .last()
  543 |       .evaluate(async (el) => {
  544 |         await Promise.all(
  545 |           el.getAnimations().map((animation) => animation.finished),
  546 |         );
  547 |       });
  548 |     await page.screenshot({
  549 |       path: `${evidence}/selection-${viewport.width}x${viewport.height}.png`,
  550 |     });
  551 |     const panel = await page.locator(".rebuild-selection").evaluate((el) => {
  552 |       const r = el.getBoundingClientRect();
  553 |       return { x: r.x, y: r.y, width: r.width, height: r.height };
  554 |     });
  555 |     expect(panel.width).toBeLessThanOrEqual(viewport.width * 0.85);
  556 |     expect(panel.height).toBeLessThan(viewport.height * 0.65);
  557 |     expect(
  558 |       Math.abs(panel.x + panel.width / 2 - viewport.width / 2),
  559 |     ).toBeLessThan(2);
  560 |     expect(
  561 |       Math.abs(panel.y + panel.height / 2 - viewport.height / 2),
  562 |     ).toBeLessThan(2);
  563 |     expect(
  564 |       await page
  565 |         .locator("#ui")
  566 |         .evaluate((el) => getComputedStyle(el).backgroundColor),
  567 |     ).toBe("rgba(0, 0, 0, 0)");
  568 |     const transition = page.evaluate(
  569 |       () =>
  570 |         new Promise<{
  571 |           elapsed: number;
  572 |           picked: string;
  573 |           disabled: number;
  574 |           cue: boolean;
  575 |         }>((resolve) => {
  576 |           const ui = document.getElementById("ui")!;
  577 |           ui.addEventListener(
  578 |             "click",
  579 |             () => {
  580 |               const started = performance.now();
  581 |               let picked = "",
  582 |                 disabled = 0,
  583 |                 cue = false;
  584 |               const observe = () => {
  585 |                 cue ||= ui.textContent?.includes("まもなく再開") ?? false;
  586 |                 const card = ui.querySelector(".is-picked");
  587 |                 if (card) {
  588 |                   picked = getComputedStyle(card).animationName;
  589 |                   disabled = ui.querySelectorAll("[data-card]:disabled").length;
  590 |                 }
  591 |                 const elapsed = performance.now() - started;
  592 |                 if (
  593 |                   !document.getElementById("controls")!.hidden ||
  594 |                   elapsed > 2000
  595 |                 )
  596 |                   resolve({ elapsed, picked, disabled, cue });
  597 |                 else requestAnimationFrame(observe);
  598 |               };
  599 |               requestAnimationFrame(observe);
  600 |             },
  601 |             { once: true, capture: true },
  602 |           );
  603 |         }),
  604 |     );
  605 |     await page.locator(`[data-card="${chosenId}"]`).click();
  606 |     const selected = await transition;
  607 |     expect(selected.elapsed).toBeLessThan(700);
  608 |     expect(selected.picked).toBe(
  609 |       viewport.width === 640 ? "none" : "front-card-pick",
  610 |     );
  611 |     expect(selected.disabled).toBe(3);
  612 |     expect(selected.cue).toBe(false);
  613 |     writeFileSync(
  614 |       `${evidence}/choice-${viewport.width}.json`,
  615 |       JSON.stringify({ viewport, panel, transition: selected }, null, 2) + "\n",
  616 |     );
  617 |     await expect(page.getByText("強化 1/6枠", { exact: true })).toBeVisible();
  618 |     await expect(page.locator("#controls")).toBeVisible({ timeout: 10000 });
  619 |     await expect(
  620 |       page.getByRole("list", { name: "取得済み強化" }),
  621 |     ).toBeVisible();
  622 |     await expect(
  623 |       page.getByRole("listitem", { name: `${chosenName} 1段階`, exact: true }),
  624 |     ).toBeVisible();
  625 |     await page.screenshot({ path: `${evidence}/battle-${viewport.width}.png` });
  626 |     await page.keyboard.press("Escape");
  627 |     await expect(
  628 |       page.getByRole("heading", { name: "一時停止", exact: true }),
```