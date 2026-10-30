import fs from "node:fs";
import path from "node:path";
const root = "dist-validation/coop-comfort-20261030";
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const compact = (name, mode) => {
  const r = read(name + "/results.json");
  return {
    source: name,
    baseline: r.baseline,
    overallPassed: r.passed,
    buildRevision: r.buildRevision,
    method: r.method,
    sourceBefore: r.sourceBefore,
    sourcesStable: r.sourcesStable,
    nativeFocusVerified: r.nativeFocusVerified,
    errors: r.errors,
    runs: r.runs
      .filter((v) => !mode || v.mode === mode)
      .map(({ samples, ...rest }) => rest),
  };
};
const units = read("input-loop-unit.json");
const result = {
  meaning:
    "Release delay is local key/mouse release to outbound WebSocket input, not server acceptance or displayed movement. RAF-only delay does not simulate a JavaScript main-thread block. Prior front baseline overall failed later on a separate legacy room quota; its completed front measurement is retained explicitly.",
  baseline: [
    compact("input-ui-baseline-ready", "front"),
    compact("input-ui-baseline-legacy-profile", "legacy"),
  ],
  modified: compact("input-ui-separated-complete"),
  units: {
    success: units.success,
    passed: units.numPassedTests,
    failed: units.numFailedTests,
    files: units.testResults.map((v) => ({
      name: path.basename(v.name),
      status: v.status,
      assertions: v.assertionResults.map((a) => ({
        title: a.title,
        status: a.status,
      })),
    })),
  },
};
for (const [key, name] of [
  ["live", "live-input-loop"],
  ["singleRenderer", "live-input-loop-single-render"],
]) {
  const liveFile = path.join(root, name, "results.json");
  if (!fs.existsSync(liveFile)) continue;
  const live = read(name + "/results.json");
  result[key] = {
    passed: live.passed,
    method: live.method,
    secondsRequested: live.secondsRequested,
    renderClients: live.renderClients,
    linkConfig: live.linkConfig,
    sourceBefore: live.sourceBefore,
    sourcesStable: live.sourcesStable,
    errors: live.errors,
    wire: live.wire,
    clients: live.clients.map((client) => {
      const raw = read(`${name}/client-${client.client}-samples.json`);
      const active = (s) =>
        s.phase === "combat" && s.serverNow > s.resumeUntil + 1;
      const gaps = raw.inputEvents.slice(1).flatMap((s, index) => {
        const previous = raw.inputEvents[index];
        return active(s) &&
          active(previous) &&
          s.resumeUntil === previous.resumeUntil
          ? [s.ms - previous.ms]
          : [];
      });
      return {
        ...client,
        zeroAckOutsideResume: raw.samples.filter(
          (s) => active(s) && s.ack === 0,
        ).length,
        inputGapMaxMs: Math.max(...gaps),
        inputGapsOver250Ms: gaps.filter((gap) => gap > 250).length,
      };
    }),
  };
}
fs.writeFileSync(
  "docs/evidence/coop-comfort-20261030/network-input-results.json",
  JSON.stringify(result, null, 2) + "\n",
);
