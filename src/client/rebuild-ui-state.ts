/** Presentation-only pause gate. It never advances or mutates a combat world. */
export const REBUILD_RESUME_SECONDS = 1;
export interface RebuildUiGate {
  paused: boolean;
  pauseReason: string;
  resumeRemaining: number;
}
export const createRebuildUiGate = (): RebuildUiGate => ({
  paused: false,
  pauseReason: "",
  resumeRemaining: 0,
});
export function pauseRebuildUi(gate: RebuildUiGate, reason: string) {
  gate.paused = true;
  gate.pauseReason = reason;
  gate.resumeRemaining = 0;
}
export function resumeRebuildUi(gate: RebuildUiGate, combat: boolean) {
  gate.paused = false;
  gate.pauseReason = "";
  gate.resumeRemaining = combat ? REBUILD_RESUME_SECONDS : 0;
}
/** Returns true only on the countdown's completion frame. */
export function tickRebuildUi(gate: RebuildUiGate, dt: number) {
  if (
    gate.paused ||
    gate.resumeRemaining <= 0 ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return false;
  gate.resumeRemaining = Math.max(0, gate.resumeRemaining - dt);
  return gate.resumeRemaining === 0;
}
export function rebuildUiActive(
  gate: RebuildUiGate,
  phase: string,
  hidden = false,
) {
  return (
    !hidden &&
    !gate.paused &&
    gate.resumeRemaining === 0 &&
    (phase === "combat" || phase === "boss")
  );
}
export function formatRebuildTime(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
/** Diagnostics are detached and recursively frozen; no live run references escape. */
export function readonlyRebuildSnapshot<T>(value: T): Readonly<T> {
  const result = structuredClone(value);
  const freeze = (entry: unknown) => {
    if (!entry || typeof entry !== "object" || Object.isFrozen(entry)) return;
    for (const child of Object.values(entry)) freeze(child);
    Object.freeze(entry);
  };
  freeze(result);
  return result;
}

const REBUILD_CONTROL_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyR",
  "KeyQ",
  "Space",
  "KeyF",
  "KeyZ",
  "KeyE",
]);
/** Reset keys stay released until a fresh physical keydown, even if the OS repeats. */
export function acceptRebuildKeydown(
  code: string,
  repeat: boolean,
  recordedKeys: ReadonlySet<string>,
) {
  return !REBUILD_CONTROL_KEYS.has(code) || !repeat || recordedKeys.has(code);
}
