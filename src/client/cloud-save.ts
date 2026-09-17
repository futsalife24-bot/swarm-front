import {
  loadProgress,
  persistProgress,
  validateProgress,
  newSaveKey,
  type ProgressSave,
} from "./progression-save";
import { assertSaveWriter } from "./save-writer";
import { clearBattleCheckpoint } from "./battle-checkpoint";

const KEY = "swarm-front-cloud-link-v1";
const BACKUP = "swarm-front-before-cloud-restore-v1";
interface Pending {
  mutation: string;
  version: number;
  save: ProgressSave;
}
interface Link {
  code: string;
  version: number;
  synced: string;
  blocked?: boolean;
  pending?: Pending;
}
export interface CloudSnapshot {
  version: number;
  updatedAt: number;
  serverNow: number;
  save: ProgressSave;
  day: string;
  week: string;
  daily: { day: string; run: string; startedAt: number } | null;
}
export type CloudState =
  "unlinked" | "saved" | "pending" | "saving" | "offline" | "conflict";
let status: CloudState = "unlinked",
  busy = false,
  installed = false;
let syncPromise: Promise<void> | undefined;
let updatedAt = 0;
export function cloudStatus() {
  return { status, updatedAt };
}
function announce(next: CloudState) {
  status = next;
  window.dispatchEvent(new Event("swarm-cloud-status"));
}
function parseCode(code: string) {
  const match = /^SF1-([a-f0-9]{32})-([a-f0-9]{64})$/.exec(code.trim());
  if (!match) throw Error("引き継ぎコードの形式を確認してください。");
  return { code: match[0], id: match[1], token: match[2] };
}
function readLink(): Link | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const link = JSON.parse(raw) as Link;
  parseCode(link.code);
  if (
    !Number.isSafeInteger(link.version) ||
    link.version < 1 ||
    typeof link.synced !== "string"
  )
    throw Error("クラウド接続情報を読めません。");
  return link;
}
function writeLink(link: Link) {
  localStorage.setItem(KEY, JSON.stringify(link));
}
async function call(
  code: string,
  action: "save" | "daily" | "weekly" | "delete",
  body?: unknown,
) {
  const { id, token } = parseCode(code);
  const response = await fetch(`/api/cloud/${id}/${action}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: "Bearer " + token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409) announce("conflict");
    throw Object.assign(Error(data.error ?? "クラウドに接続できません。"), {
      status: response.status,
    });
  }
  return data;
}
export async function inspectCloud(code: string): Promise<CloudSnapshot> {
  const data = (await call(code, "save")) as CloudSnapshot;
  validateProgress(data.save);
  if (
    data.save.mode !== "normal" ||
    !Number.isSafeInteger(data.version) ||
    data.version < 1
  )
    throw Error("クラウド保存の形式が不正です。");
  return data;
}
export function transferCode() {
  return readLink()?.code ?? null;
}
export async function createCloudSave() {
  assertSaveWriter(localStorage);
  if (readLink()) throw Error("既にクラウド保存を利用しています。");
  const save = loadProgress("normal");
  if (!save) throw Error("先に通常プレイを開始してください。");
  const response = await fetch("/api/cloud/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({ save }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? "クラウド保存を作成できません。");
  parseCode(data.code);
  writeLink({
    code: data.code,
    version: data.version,
    synced: JSON.stringify(save),
  });
  updatedAt = data.updatedAt;
  announce("saved");
  return data.code as string;
}
export function syncCloud(): Promise<void> {
  return (syncPromise ??= performCloudSync().finally(() => {
    syncPromise = undefined;
  }));
}
async function performCloudSync() {
  busy = true;
  try {
    assertSaveWriter(localStorage);
    const link = readLink();
    if (!link) {
      announce("unlinked");
      return;
    }
    if (link.blocked) {
      announce("conflict");
      return;
    }
    const save = loadProgress("normal");
    if (!save) return;
    const snapshot = JSON.stringify(save);
    if (!link.pending && snapshot === link.synced) {
      announce("saved");
      return;
    }
    link.pending ??= {
      mutation: crypto.randomUUID(),
      version: link.version,
      save,
    };
    writeLink(link); // Retry the exact mutation after an ambiguous network failure.
    announce("saving");
    let data: CloudSnapshot;
    try {
      data = await call(link.code, "save", link.pending);
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        link.blocked = true;
        writeLink(link);
      }
      throw error;
    }
    const acknowledged = new Set(link.pending.save.weeklyPending ?? []);
    const latest = loadProgress("normal");
    const unchanged =
      latest && JSON.stringify(latest) === JSON.stringify(link.pending.save);
    if (
      latest &&
      (acknowledged.size ||
        JSON.stringify(latest.weekly) !== JSON.stringify(data.save.weekly))
    ) {
      latest.weekly = data.save.weekly;
      latest.weeklyPending = (latest.weeklyPending ?? []).filter(
        (run) => !acknowledged.has(run),
      );
      persistProgress(latest);
      window.dispatchEvent(new Event("swarm-cloud-progress"));
    }
    // Preserve newer local edits for the next sync rather than marking them uploaded.
    link.synced = JSON.stringify(unchanged ? latest : link.pending.save);
    link.version = data.version;
    link.pending = undefined;
    writeLink(link);
    updatedAt = data.updatedAt;
    announce(
      JSON.stringify(loadProgress("normal")) === link.synced
        ? "saved"
        : "pending",
    );
  } catch {
    if (status !== "conflict") announce("offline");
  } finally {
    busy = false;
  }
}

/** UI must preview both saves and explicitly confirm which to keep before calling. */
export function restoreCloud(
  code: string,
  remote: CloudSnapshot,
  expectedLocal: string | null,
) {
  assertSaveWriter(localStorage);
  if (busy) throw Error("同期が終わってから再試行してください。");
  if (localStorage.getItem(newSaveKey("normal")) !== expectedLocal)
    throw Error("端末の進行が更新されました。確認し直してください。");
  validateProgress(remote.save);
  parseCode(code);
  if (remote.save.mode !== "normal") throw Error("通常保存ではありません。");
  if (expectedLocal) localStorage.setItem(BACKUP, expectedLocal);
  const next = structuredClone(remote.save);
  next.revision = expectedLocal ? (JSON.parse(expectedLocal).revision ?? 0) : 0;
  const link = {
    code: code.trim(),
    version: remote.version,
    synced: "",
    blocked: true,
  };
  writeLink(link); // If local restore fails, do not upload another account's data.
  persistProgress(next);
  clearBattleCheckpoint();
  link.synced = JSON.stringify(next);
  link.blocked = false;
  writeLink(link);
  updatedAt = remote.updatedAt;
  announce("saved");
}
export async function keepLocalAfterConflict(expectedVersion: number) {
  assertSaveWriter(localStorage);
  if (busy) throw Error("同期が終わってから再試行してください。");
  const link = readLink();
  if (!link) throw Error("クラウド保存がありません。");
  // A further remote change still produces a conflict; never fetch-and-overwrite blindly.
  link.version = expectedVersion;
  link.blocked = false;
  link.pending = undefined;
  link.synced = "";
  writeLink(link);
  await syncCloud();
}
export async function deleteCloudSave() {
  if (busy) throw Error("同期が終わってから再試行してください。");
  assertSaveWriter(localStorage);
  const link = readLink();
  if (!link) return;
  link.blocked = true;
  writeLink(link);
  await call(link.code, "delete", {});
  localStorage.removeItem(KEY);
  announce("unlinked");
}
export function installCloudSync() {
  if (installed) return;
  installed = true;
  try {
    const link = readLink();
    announce(
      !link
        ? "unlinked"
        : link.blocked
          ? "conflict"
          : JSON.stringify(loadProgress("normal")) === link.synced
            ? "saved"
            : "pending",
    );
  } catch {
    announce("offline");
  }
  window.addEventListener("online", () => void syncCloud());
  let timer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener("swarm-progress-saved", () => {
    try {
      const link = readLink();
      if (!link || link.blocked) return;
      announce("pending");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncCloud(), 1500);
    } catch {
      announce("offline");
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void syncCloud();
  });
  setInterval(() => {
    if (!document.hidden) void syncCloud();
  }, 15000);
}

/** Call only after assets finish loading and the player taps to enter the battle. */
export async function admitDailyDefense(run: string, day: string) {
  await syncCloud();
  if (status === "pending") await syncCloud();
  if (busy || status !== "saved")
    throw Error("先にクラウドの同期を完了してください。");
  const link = readLink();
  if (!link) throw Error("防衛作戦にはクラウド保存が必要です。");
  const expected = localStorage.getItem(newSaveKey("normal"));
  if (!expected || JSON.stringify(loadProgress("normal")) !== link.synced)
    throw Error("未同期の進行があります。もう一度お試しください。");
  const snapshot = (await call(link.code, "daily", {
    run,
    day,
    version: link.version,
  })) as CloudSnapshot;
  restoreCloud(link.code, snapshot, expected);
  return snapshot;
}

export async function claimCloudWeekly(id: string) {
  await syncCloud();
  if (status === "pending") await syncCloud();
  if (busy || status !== "saved")
    throw Error("先にクラウド同期を完了してください。");
  const link = readLink();
  if (!link) throw Error("クラウド保存を有効にしてください。");
  const expected = localStorage.getItem(newSaveKey("normal"));
  if (!expected || JSON.stringify(loadProgress("normal")) !== link.synced)
    throw Error("未同期の進行があります。もう一度お試しください。");
  const snapshot = (await call(link.code, "weekly", {
    id,
    version: link.version,
  })) as CloudSnapshot;
  restoreCloud(link.code, snapshot, expected);
  return snapshot;
}
