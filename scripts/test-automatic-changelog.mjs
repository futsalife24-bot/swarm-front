import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { generateChangelog } from "./automatic-changelog.mjs";

test("Git history: documentation exclusion, merged changes, Japanese fallback, deduplication and missing base", () => {
  const cwd = mkdtempSync(join(tmpdir(), "swarm-history-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: "2026-09-16T23:00:00Z",
        GIT_COMMITTER_DATE: "2026-09-16T23:00:00Z",
      },
    }).trim();
  const commit = (path, message, content = message) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
    git("add", path);
    git("commit", "-m", message);
  };
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    commit("docs/start.md", "base");
    const base = git("rev-parse", "HEAD");
    commit("docs/state.md", "docs only");
    assert.deepEqual(generateChangelog(cwd, base), []);
    git("switch", "-c", "feature");
    commit("src/client/room.ts", "internal implementation");
    commit("src/client/room.ts", "internal followup");
    git("switch", "main");
    git("merge", "--no-ff", "feature", "-m", "Merge feature");
    commit("src/client/room.ts", "another internal followup");
    assert.deepEqual(generateChangelog(cwd, base), [
      { date: "2026-09-17", items: ["協力プレイ・通信を更新しました。"] },
    ]);
    commit("src/main.ts", "details\n\nPlayer-Note: 更新履歴を自動化しました。");
    assert.deepEqual(generateChangelog(cwd, base)[0].items, [
      "更新履歴を自動化しました。",
      "協力プレイ・通信を更新しました。",
    ]);
    assert.throws(() =>
      generateChangelog(cwd, "0000000000000000000000000000000000000000"),
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
