import { ARMORY_TOUR } from "./armory-tour-steps";
import type { GuideVoice } from "./first-guides";
import "./armory-tour.css";

export { ARMORY_TOUR };

export function startArmoryTour(
  voice: GuideVoice,
  routes: { list(): void; workshop(): void },
) {
  const panel = document.createElement("aside");
  panel.className = "armory-tour";
  panel.popover = "manual";
  panel.setAttribute("aria-label", "管制AIの武器強化案内");
  panel.innerHTML =
    '<b></b><p aria-live="polite"></p><button type="button" data-end>案内を終了</button><button type="button" data-next>次へ</button>';
  document.body.append(panel);
  let index = 0;
  let marked: HTMLElement | undefined;
  const end = () => {
    marked?.classList.remove("armory-tour-target");
    document.removeEventListener("click", handleDrawerChoice, true);
    panel.remove();
  };
  const draw = () => {
    marked?.classList.remove("armory-tour-target");
    const [id, text, target] = ARMORY_TOUR[index];
    marked = Array.from(document.querySelectorAll<HTMLElement>(target)).find(
      (el) => el.checkVisibility(),
    );
    marked?.scrollIntoView({ block: "nearest" });
    marked?.classList.add("armory-tour-target");
    const host =
      document.querySelector("dialog[open]:last-of-type") ?? document.body;
    if (index === 4 && host instanceof HTMLDialogElement) {
      host.addEventListener(
        "close",
        () => {
          if (index === 4) end();
        },
        { once: true },
      );
    }
    host.append(panel);
    panel.showPopover();
    panel.classList.toggle(
      "at-top",
      (marked?.getBoundingClientRect().top ?? 0) > window.innerHeight / 2,
    );
    panel.querySelector("b")!.textContent =
      `管制AI　${index + 1} / ${ARMORY_TOUR.length}`;
    panel.querySelector("p")!.textContent = text;
    panel.querySelector("[data-next]")!.textContent =
      index === ARMORY_TOUR.length - 1 ? "案内を完了" : "次へ";
    panel
      .querySelector<HTMLButtonElement>("[data-next]")!
      .focus({ preventScroll: true });
    void voice.say(id);
  };
  // The highlighted drawer entry can also be operated directly.
  function handleDrawerChoice(event: MouseEvent) {
    const button = (event.target as Element | null)?.closest(
      "[data-menu-destination]",
    );
    if (!button) return;
    if (index !== 4) return end();
    if (button.getAttribute("data-menu-destination") !== "workshop")
      return end();
    document.body.append(panel);
    index++;
    requestAnimationFrame(draw);
  }
  document.addEventListener("click", handleDrawerChoice, true);
  panel.querySelector<HTMLButtonElement>("[data-end]")!.onclick = end;
  panel.querySelector<HTMLButtonElement>("[data-next]")!.onclick = () => {
    if (++index === ARMORY_TOUR.length) return end();
    if (index === 2) routes.list();
    if (index === 4)
      document.querySelector<HTMLButtonElement>("[data-menu-toggle]")?.click();
    if (index === 5) {
      document.body.append(panel);
      document.querySelector<HTMLDialogElement>("dialog[open]")?.close();
      routes.workshop();
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
