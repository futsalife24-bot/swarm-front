import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const dir = "dist-validation/evidence";
mkdirSync(dir, { recursive: true });
test.use({
  viewport: { width: 844, height: 320 },
  isMobile: true,
  hasTouch: true,
});

test("P1 custom move over look receives hit-tested simultaneous touch input after save reload and rotation", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.locator("#solo").click();
  await page.locator("#layout-settings").click();
  await page.locator("#layout-selected").selectOption("move");
  await page.locator("#layout-size").fill("0.7");
  const move = page.locator('[data-layout-button="move"]');
  const box = (await move.boundingBox())!;
  const target = await page.evaluate(async () => {
    const { arena, readInsets } = await import(
      "/src/client/layout.ts" as string
    );
    const a = arena(innerWidth, innerHeight, readInsets());
    return { x: a.left + a.width * 0.55, y: a.top + a.height * 0.55 };
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...target, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator("#layout-save")).toBeEnabled();
  await page.locator("#layout-save").click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("swarm-front-controls-v1"),
  );
  const placement = JSON.parse(saved!).buttons.move;
  expect(placement.x).toBeCloseTo(0.55, 3);
  expect(placement.y).toBeCloseTo(0.55, 3);
  expect(placement.size).toBe(0.7);
  await page.reload();
  await page.locator("#solo").click();
  await page.locator("#launch").click();
  await expect(page.locator("#hud")).toBeVisible();
  const observations = [];
  for (const ending of ["touchEnd", "touchCancel"] as const) {
    if (ending === "touchCancel") {
      await page.setViewportSize({ width: 320, height: 844 });
      await expect(page.locator("#portrait")).toBeVisible();
      expect(
        await page.evaluate(() => document.elementFromPoint(160, 422)?.id),
      ).toBe("portrait");
      await page.setViewportSize({ width: 844, height: 320 });
      await expect(page.locator("#portrait")).toBeHidden();
      // The viewport update precedes its resize handler; wait for placement,
      // not just the orientation media query, before sending real touch events.
      await expect
        .poll(async () => {
          const b = (await page.locator("#move").boundingBox())!;
          return b.y + b.height / 2;
        })
        .toBeCloseTo(target.y, 1);
    }
    const geometry = await page.evaluate(() => {
      const center = (id: string) => {
        const b = document.getElementById(id)!.getBoundingClientRect();
        const x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        return {
          x,
          y,
          target: document.elementFromPoint(x, y)?.closest("[id]")?.id,
        };
      };
      return {
        controls: Object.fromEntries(
          ["move", "fire", "dodge", "reload", "swap", "revive"].map((id) => [
            id,
            center(id),
          ]),
        ),
        look: {
          x: 590,
          y: 210,
          target: document.elementFromPoint(590, 210)?.id,
        },
        z: Object.fromEntries(
          ["move", "look", "fire", "portrait"].map((id) => [
            id,
            getComputedStyle(document.getElementById(id)!).zIndex,
          ]),
        ),
        pause: center("pause"),
      };
    });
    const initial = await page.evaluate(() => (window as any).__swarm.input);
    const points = [
      { ...geometry.controls.move, id: 1 },
      { ...geometry.look, id: 2 },
      { ...geometry.controls.fire, id: 3 },
    ].map(({ x, y, id }) => ({ x, y, id }));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points,
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { ...points[0], y: points[0].y - 25 },
        { ...points[1], x: points[1].x + 20 },
        points[2],
      ],
    });
    await page.waitForTimeout(150);
    const active = await page.evaluate(() => (window as any).__swarm.input);
    await cdp.send("Input.dispatchTouchEvent", {
      type: ending,
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    const released = await page.evaluate(() => (window as any).__swarm.input);
    observations.push({ ending, geometry, initial, active, released });
    for (const [id, b] of Object.entries(geometry.controls))
      expect.soft(b.target).toBe(id);
    expect.soft(geometry.look.target).toBe("look");
    expect.soft(geometry.pause.target).toBe("pause");
    expect.soft(active.mz).toBeGreaterThan(0.4);
    expect.soft(active.yaw).not.toBe(initial.yaw);
    expect.soft(active.fire).toBe(true);
    expect.soft(released.mx).toBe(0);
    expect.soft(released.mz).toBe(0);
    expect.soft(released.fire).toBe(false);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("swarm-front-controls-v1"),
      ),
    ).toBe(saved);
  }
  writeFileSync(
    dir + "/custom-move-hit-test.json",
    JSON.stringify({ placement, observations }, null, 2),
  );
  await page.screenshot({ path: dir + "/custom-move.png" });
});

test("P2 four-player HUD contains HP DOWN and disconnected spans at short landscape widths", async ({
  page,
}) => {
  await page.goto("/");
  // Presentation fixture only: render the production HUD with four real Player-shaped
  // records. No battle mutation, network claim, or mission performance measurement.
  await page.evaluate(async () => {
    const { createWorld, addPlayer } = await import(
      "/src/shared/game.ts" as string
    );
    const { hudMarkup } = await import("/src/client/hud.ts" as string);
    const w = createWorld("hud-layout-fixture");
    addPlayer(w, "self");
    addPlayer(w, "healthy").hp = 160;
    addPlayer(w, "down").hp = 0;
    addPlayer(w, "away").connected = false;
    w.wave = 1;
    document.getElementById("ui")!.hidden = true;
    const hud = document.getElementById("hud")!;
    hud.hidden = false;
    hud.innerHTML = hudMarkup(w, "self", "CO-OP");
  });
  const measurements = [];
  for (const [width, height] of [
    [640, 280],
    [844, 320],
    [568, 320],
  ]) {
    await page.setViewportSize({ width, height });
    const m = await page.evaluate(() => {
      const rect = (el: Element) => {
        const b = el.getBoundingClientRect();
        const node = el as HTMLElement;
        const s = getComputedStyle(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        return {
          left: b.left,
          right: b.right,
          top: b.top,
          bottom: b.bottom,
          width: b.width,
          height: b.height,
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          textRight: range.getBoundingClientRect().right,
          text: node.textContent,
          overflow: s.overflowX,
          ellipsis: s.textOverflow,
          fontSize: s.fontSize,
        };
      };
      return {
        width: innerWidth,
        height: innerHeight,
        vitals: rect(document.querySelector(".vitals")!),
        mission: rect(document.querySelector(".mission-hud")!),
        strip: rect(document.querySelector(".squad-strip")!),
        spans: [...document.querySelectorAll(".squad-strip span")].map(rect),
      };
    });
    measurements.push(m);
    expect
      .soft(m.spans.map((s) => s.text))
      .toEqual(["味方1 160", "味方2 DOWN", "味方3 切断"]);
    expect.soft(m.vitals.height).toBe(72);
    expect.soft(m.vitals.bottom).toBeLessThanOrEqual(80);
    expect.soft(m.strip.scrollWidth).toBeLessThanOrEqual(m.strip.clientWidth);
    for (const s of [m.strip, ...m.spans]) {
      expect.soft(s.left).toBeGreaterThanOrEqual(m.vitals.left + 4);
      expect.soft(s.right).toBeLessThanOrEqual(m.vitals.right - 4);
      expect.soft(s.bottom).toBeLessThanOrEqual(m.vitals.bottom - 4);
    }
    for (const s of m.spans) {
      expect.soft(s.right).toBeLessThanOrEqual(m.mission.left - 12);
      if (width >= 640) {
        expect.soft(s.scrollWidth).toBeLessThanOrEqual(s.clientWidth);
        expect.soft(s.textRight).toBeLessThanOrEqual(s.right);
      }
      if (s.scrollWidth > s.clientWidth) {
        expect.soft(s.overflow).toBe("hidden");
        expect.soft(s.ellipsis).toBe("ellipsis");
      }
    }
    await page.screenshot({ path: dir + `/squad-${width}.png` });
  }
  writeFileSync(
    dir + "/squad-layout.json",
    JSON.stringify(
      { fixture: "four-player presentation only", measurements },
      null,
      2,
    ),
  );
});
