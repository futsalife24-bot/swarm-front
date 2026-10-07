// 実非表示の限定調査専用。普段のブラウザへの接続・保存・設定変更は行わない。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const analytics =
  "https://project-hub.melosalife-24.workers.dev/api/analytics/collect/swarm-front";
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";

export function visibilityPlan(origin, output) {
  assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(new URL(origin).origin, origin);
  const root = fs.realpathSync(process.cwd());
  const out = path.resolve(root, output);
  const relative = path.relative(root, out);
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
  );
  assert.ok(fs.existsSync(chrome), "インストール済みChromeが必要です");
  const core = "node_modules/playwright-core/lib/coreBundle.js";
  const implementation = fs.readFileSync(core, "utf8");
  // インストール済み実装を読取で照合。ライブラリへ変更は加えない。
  assert.ok(
    implementation.includes(
      "const skipDefaultOverrides = browserOptions.noDefaults && this._crPage._browserContext === this._crPage._browserContext._browser._defaultContext;",
    ),
    "noDefaults/default context条件が変わった場合は再調査すること",
  );
  assert.match(
    implementation,
    /if \(this\._isMainFrame\(\) && !skipDefaultOverrides\)\s+promises2\.push\(this\._client\.send\("Emulation\.setFocusEmulationEnabled", \{ enabled: true \}\)\);/,
  );
  return {
    origin,
    out,
    chrome,
    noDefaults: true,
    context: "専用Chromeの既存default contextだけを使用",
    playwright: JSON.parse(
      fs.readFileSync("node_modules/playwright-core/package.json", "utf8"),
    ).version,
    implementationSha256: createHash("sha256")
      .update(implementation)
      .digest("hex"),
    observationOrder:
      "初期capture → 製品document listener → 後から追加するdocument listener",
    analytics: "外部解析はabort。成功応答・hidden・イベントは合成しない",
  };
}

export function visibilityRequestKind(url, origin) {
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) return "internal";
  if (target.origin === origin) return "local";
  if (target.origin + target.pathname === analytics) return "analytics";
  return "unexpected-external";
}

export async function startVisibilityChrome(plan) {
  fs.mkdirSync(plan.out, { recursive: true });
  const outputRoot = fs.realpathSync(plan.out);
  const relative = path.relative(fs.realpathSync(process.cwd()), outputRoot);
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
  );
  const profile = fs.mkdtempSync(path.join(outputRoot, "profile-"));
  // この呼出しが作成したディレクトリだけを終了時の削除対象にする。
  const profileReal = fs.realpathSync(profile);
  const args = [
    `--user-data-dir=${profileReal}`,
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--disable-extensions",
    "--window-size=1024,650",
    "--use-angle=d3d11",
    "about:blank",
  ];
  const child = spawn(plan.chrome, args, {
    stdio: "ignore",
    windowsHide: true,
  });
  let spawnError;
  child.on("error", (error) => {
    spawnError = error;
  });
  let browser;
  const cleanup = async () => {
    const result = {
      browserCloseRequested: false,
      forcedOwnProcess: false,
      profileRemoved: false,
    };
    if (browser?.isConnected()) {
      try {
        const session = await browser.newBrowserCDPSession();
        result.browserCloseRequested = true;
        await session.send("Browser.close").catch(() => {});
      } catch (error) {
        result.closeRequestError = String(error);
      }
    }
    for (
      let n = 0;
      n < 30 &&
      child.exitCode === null &&
      child.signalCode === null &&
      !spawnError;
      n++
    )
      await delay(100);
    if (child.exitCode === null && child.signalCode === null && !spawnError) {
      // 自分が生成し、まだ終了していないProcessのツリーだけを対象とする。
      result.forcedOwnProcess = true;
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
      for (
        let n = 0;
        n < 30 && child.exitCode === null && child.signalCode === null;
        n++
      )
        await delay(100);
    }
    assert.ok(
      spawnError || child.exitCode !== null || child.signalCode !== null,
      "専用Chrome終了未確認",
    );
    assert.equal(path.dirname(profileReal), outputRoot);
    assert.ok(path.basename(profileReal).startsWith("profile-"));
    assert.equal(fs.realpathSync(profile), profileReal);
    assert.equal(fs.lstatSync(profile).isSymbolicLink(), false);
    fs.rmSync(profileReal, { recursive: true, maxRetries: 5, retryDelay: 200 });
    result.profileRemoved = true;
    return result;
  };
  try {
    const portFile = path.join(profileReal, "DevToolsActivePort");
    for (let n = 0; n < 100 && !fs.existsSync(portFile); n++) {
      if (spawnError) throw spawnError;
      assert.equal(child.exitCode, null, "専用Chromeが接続前に終了");
      await delay(100);
    }
    assert.ok(fs.existsSync(portFile), "専用ChromeのCDP起動待ち10秒を超過");
    const [portText, endpoint] = fs
      .readFileSync(portFile, "utf8")
      .trim()
      .split(/\r?\n/);
    assert.match(portText, /^\d+$/);
    const port = Number(portText);
    assert.ok(port > 0 && port <= 65535);
    assert.match(endpoint, /^\/devtools\/browser\/[a-zA-Z0-9-]+$/);
    // 起動引数だけでloopback限定と断定しない。専用の動的portの実リスナーを確認。
    const addresses = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop).LocalAddress | ConvertTo-Json -Compress`,
      ],
      { encoding: "utf8", windowsHide: true },
    ).trim();
    const parsed = JSON.parse(addresses);
    const listeners = Array.isArray(parsed) ? parsed : [parsed];
    assert.ok(
      listeners.length > 0 &&
        listeners.every((address) => ["127.0.0.1", "::1"].includes(address)),
      "CDPがloopback限定ではありません",
    );
    const { chromium } = await import("@playwright/test");
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
      noDefaults: true,
      timeout: 10000,
    });
    assert.equal(browser.contexts().length, 1);
    const context = browser.contexts()[0];
    assert.equal(context.pages().length, 1);
    assert.equal(context.pages()[0].url(), "about:blank");
    return {
      browser,
      context,
      cleanup,
      evidence: {
        pid: child.pid,
        listeners,
        noDefaults: true,
        defaultContextOnly: true,
        profile: path.basename(profileReal),
        startupBlankPage: true,
      },
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "専用Chrome準備と終了処理が失敗",
      );
    }
    throw error;
  }
}
