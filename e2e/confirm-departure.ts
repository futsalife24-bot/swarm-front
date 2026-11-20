import type { Dialog, Page } from "@playwright/test";

/** Every started promise is observed immediately; every received dialog is owned. */
export async function confirmDeparture(
  page: Pick<Page, "on" | "off">,
  action: () => Promise<unknown>,
  accept: boolean,
  dialogTimeout = 10000,
) {
  let received: Dialog | undefined;
  let handled = false;
  let resolveDialog!: (dialog: Dialog | undefined) => void;
  const observed = new Promise<Dialog | undefined>((resolve) => {
    resolveDialog = resolve;
  });
  const listener = (dialog: Dialog) => {
    received = dialog;
    resolveDialog(dialog);
  };
  page.on("dialog", listener);
  const timer = setTimeout(() => resolveDialog(undefined), dialogTimeout);
  const navigation = Promise.resolve()
    .then(action)
    .then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    );
  try {
    const dialog = await Promise.race([
      observed,
      navigation.then((result) => {
        if (!result.ok) throw result.error;
        return observed;
      }),
    ]);
    if (!dialog) throw new Error("終了確認ダイアログが到着しませんでした");
    if (dialog.type() !== "beforeunload")
      throw new Error(`想定外のダイアログ: ${dialog.type()}`);
    if (accept) await dialog.accept();
    else await dialog.dismiss();
    handled = true;
    const result = await navigation;
    if (!result.ok) {
      const message = result.error instanceof Error ? result.error.message : "";
      if (
        accept ||
        !/ERR_ABORTED|interrupted|NS_BINDING_ABORTED|Timeout .*exceeded/.test(
          message,
        )
      )
        throw result.error;
    }
  } finally {
    clearTimeout(timer);
    page.off("dialog", listener);
    resolveDialog(undefined);
    if (received && !handled) await received.dismiss().catch(() => {});
    // Actions use their own bounded timeout; never alter shared Page defaults.
    await navigation;
  }
}
