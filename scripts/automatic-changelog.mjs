import { execFileSync } from "node:child_process";

// Releases through this main commit are described in the curated history.
export const HISTORY_BASE = "766b99836c147301a1f320035150715b5318159e";

export function summarizeFiles(files) {
  const labels = new Set();
  for (const file of files) {
    if (file === "src/client/changelog.ts") continue;
    if (
      /^server\//.test(file) ||
      (/(?:coop|room|invite|network|social|wire)/.test(file) &&
        /^src\//.test(file))
    )
      labels.add("協力プレイ・通信を更新しました。");
    else if (
      /^public\/assets\/(?:characters|trooper)/.test(file) ||
      /^src\/client\/.*trooper/.test(file)
    )
      labels.add("兵士の見た目・動作を更新しました。");
    else if (/^src\/.*(?:stage|map|terrain|scenery|cave)/.test(file))
      labels.add("ステージ・マップを更新しました。");
    else if (/^src\/.*(?:weapon|armory|gear|save|progression)/.test(file))
      labels.add("装備・進行まわりを更新しました。");
    else if (
      /^src\/.*(?:audio|sound)/.test(file) ||
      /^public\/.*\.(?:wav|mp3|ogg)$/.test(file)
    )
      labels.add("サウンドを更新しました。");
    else if (/^src\/client\//.test(file) || /^src\/.*\.css$/.test(file))
      labels.add("画面表示・操作を更新しました。");
    else if (
      /^src\//.test(file) ||
      /^public\//.test(file) ||
      /^(?:index\.html|package(?:-lock)?\.json|vite\.config\.ts|wrangler(?:\.[\w-]+)?\.jsonc)$/.test(
        file,
      )
    )
      labels.add("ゲームの動作・配信を更新しました。");
  }
  return [...labels];
}

export function generateChangelog(cwd, base = HISTORY_BASE) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  // Missing history must fail the build, rather than silently ship stale notes.
  git("merge-base", "--is-ancestor", base, "HEAD");
  // One Git process for the whole history: per-commit calls made this grow by
  // three process launches per release and approach the test timeout on Windows.
  // Each record is "<RS>time NUL message NUL" followed by the files changed
  // against the first parent (the same set as `git diff --name-only sha^1 sha`).
  const records = git(
    "log",
    "--first-parent",
    "--diff-merges=first-parent",
    "--name-only",
    "--format=%x1e%ct%x00%B%x00",
    `${base}..HEAD`,
  )
    .split("\x1e")
    .filter(Boolean);
  const days = new Map();
  for (const record of records) {
    const [time, message, changed] = record.split("\0");
    const files = changed.trim().split("\n");
    const fallback = summarizeFiles(files);
    if (!fallback.length) continue;
    // Optional player-facing details; never expose raw developer commit messages.
    const notes = message
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("Player-Note: "))
      .map((line) => line.slice(13).trim())
      .filter(Boolean);
    const timestamp = Number(time);
    const date = new Date((timestamp + 9 * 3600) * 1000)
      .toISOString()
      .slice(0, 10);
    if (!days.has(date)) days.set(date, new Set());
    for (const item of notes.length ? notes : fallback)
      days.get(date).add(item);
  }
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items: [...items] }));
}
