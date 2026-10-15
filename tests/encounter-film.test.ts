import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { showEncounterFilm } from "../src/client/encounter-film";
import { waitForFullscreenTransition } from "../src/client/landscape";
import { closeMenuDialog, menuDialog } from "../src/client/menu-ui";

vi.mock("../src/client/landscape", () => ({
  waitForFullscreenTransition: vi.fn(),
}));
vi.mock("../src/client/menu-ui", () => ({
  menuDialog: vi.fn(),
  closeMenuDialog: vi.fn((dialog: Dialog) => {
    if (!dialog.isConnected) return;
    dialog.close();
  }),
}));

class Video extends EventTarget {
  dataset: Record<string, string> = {};
  src = "";
  error = null;
  pause = vi.fn();
  load = vi.fn();
  play = vi.fn().mockResolvedValue(undefined);
  removeAttribute = vi.fn(() => {
    this.src = "";
  });
}

class Dialog extends EventTarget {
  open = false;
  isConnected = true;
  classList = { add: vi.fn() };
  video = new Video();
  status = { textContent: "" };
  retry = { hidden: true, onclick: null as null | (() => void) };
  heading = { id: "" };
  setAttribute = vi.fn();
  querySelector(selector: string) {
    return selector === "video"
      ? this.video
      : selector === ".film-status"
        ? this.status
        : selector === ".film-retry"
          ? this.retry
          : selector === "h2"
            ? this.heading
            : null;
  }
  close() {
    this.open = false;
    this.isConnected = false;
    this.dispatchEvent(new Event("close"));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const tick = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

let dialog: Dialog;
let owner: EventTarget;
beforeEach(() => {
  dialog = new Dialog();
  owner = new EventTarget();
  vi.mocked(menuDialog).mockReturnValue(dialog as unknown as HTMLDialogElement);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("waits for fullscreen and an open dialog before fetching the film", async () => {
  const transition = deferred<void>();
  vi.mocked(waitForFullscreenTransition).mockReturnValue(transition.promise);
  const fetcher = vi.fn().mockResolvedValue(new Response(new Blob(["film"])));
  vi.stubGlobal("fetch", fetcher);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:film");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

  showEncounterFilm("crawler", owner as HTMLDialogElement);
  await tick();
  expect(fetcher).not.toHaveBeenCalled();
  dialog.open = true;
  transition.resolve();
  await tick();

  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(dialog.video.src).toBe("blob:film"));
  expect(dialog.video.play).toHaveBeenCalledTimes(1);
  dialog.close();
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:film");
});

it("closes an unopened film with its report and never starts a late fetch", async () => {
  const transition = deferred<void>();
  vi.mocked(waitForFullscreenTransition).mockReturnValue(transition.promise);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);

  showEncounterFilm("crawler", owner as HTMLDialogElement);
  owner.dispatchEvent(new Event("close"));
  expect(closeMenuDialog).toHaveBeenCalledWith(dialog);
  expect(dialog.isConnected).toBe(false);
  transition.resolve();
  await tick();
  expect(fetcher).not.toHaveBeenCalled();
});

it("aborts an unfinished download when the report closes", async () => {
  vi.mocked(waitForFullscreenTransition).mockResolvedValue();
  const download = deferred<Response>();
  const fetcher = vi.fn().mockReturnValue(download.promise);
  vi.stubGlobal("fetch", fetcher);
  const createUrl = vi.spyOn(URL, "createObjectURL");
  dialog.open = true;

  showEncounterFilm("crawler", owner as HTMLDialogElement);
  await tick();
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
  owner.dispatchEvent(new Event("close"));
  expect(signal.aborted).toBe(true);
  download.resolve(new Response(new Blob(["late film"])));
  await tick();
  expect(createUrl).not.toHaveBeenCalled();
  expect(dialog.video.play).not.toHaveBeenCalled();
});
