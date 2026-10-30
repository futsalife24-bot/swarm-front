import fs from "node:fs";
import path from "node:path";

// Read-only aggregation of isolated browser evidence; never connects to a game.
const base = process.argv[2] ?? "dist-validation/coop-comfort-20261030";
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(base, name), "utf8"));
const stats = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.floor(sorted.length * fraction)] ?? null;
  return {
    count: sorted.length,
    p50: at(0.5),
    p95: at(0.95),
    max: sorted.at(-1) ?? null,
  };
};
const active = (s) => s.phase === "combat" && s.serverNow > s.resumeUntil + 1;
const names = [
  "live-flow-input-trace",
  "live-input-window-16",
  "live-input-window-slow-up",
  "live-input-window-4-slow-up",
  "live-input-adaptive-slow-up",
  "live-input-adaptive-long",
  "live-bastion-warm-adaptive",
  "live-input-receipt-long",
  "live-input-receipt-slow-up",
  "live-input-receipt-profile",
];
const trials = names.map((name) => {
  const r = read(name + "/results.json");
  return {
    name,
    functionalPass: r.passed,
    sourcesStable: r.sourcesStable,
    sourceHashes: r.sourceBefore,
    secondsRequested: r.secondsRequested,
    profileEnabled: r.profileEnabled,
    renderClients: r.renderClients,
    linkConfig: r.linkConfig,
    releaseAfterSeconds: r.releaseAfterSeconds,
    inputWindowOverride: r.inputWindowOverride ?? 0,
    preparations: r.preparations.map((p) => ({
      ms: p.ms,
      actors: p.actors,
      preparationRestored: p.preparationRestored,
      programCount: p.programCount,
      preparationSkippedForNetworkIsolation:
        p.preparationSkippedForNetworkIsolation,
    })),
    errors: r.errors,
    clients: r.clients.map((c) => {
      const raw = read(name + `/client-${c.client}-samples.json`);
      const gaps = raw.inputEvents.slice(1).flatMap((s, index) => {
        const prior = raw.inputEvents[index];
        return active(s) && active(prior) && s.resumeUntil === prior.resumeUntil
          ? [s.ms - prior.ms]
          : [];
      });
      const releaseMs = r.releaseAfterSeconds * 1000;
      const release =
        releaseMs > 0
          ? raw.inputEvents.find(
              (s) => s.ms >= releaseMs && !s.fire && !s.moving,
            )
          : undefined;
      const receipt =
        release && raw.receiptAckEvents.find((s) => s.seq >= release.seq);
      return {
        client: c.client,
        gameSeconds: c.gameSeconds,
        frames: c.frames,
        renderCpu: c.renderCpu,
        ackObservedRtt: c.ackObservedRtt,
        receiptAckRtt: c.receiptAckRtt,
        activeSamples: raw.samples.filter(active).length,
        zeroAckOutsideResume: raw.samples.filter(
          (s) => active(s) && s.ack === 0,
        ).length,
        activeInputGapsMs: stats(gaps),
        activeInputGapsOver250Ms: gaps.filter((gap) => gap > 250).length,
        releaseReceiptSinceIntentMs: receipt ? receipt.ms - releaseMs : null,
        longFrames: raw.longFrames,
        errors: c.errors,
        glErrors: c.glErrors,
        programTransitions: c.diagnostic?.programTransitions?.map((p) => ({
          ms: p.ms,
          gameTime: p.gameTime,
          enemyKinds: p.enemyKinds,
          durationMs: p.durationMs,
          beforeCount: p.beforeCount,
          afterCount: p.afterCount,
          added: p.added.map((a) => ({ id: a.id, name: a.name })),
        })),
        slowGlCalls: c.diagnostic?.slowGlCalls,
        lastCombat: {
          time: c.last.time,
          phase: c.last.phase,
          hp: c.last.hp,
          enemies: c.last.enemies,
        },
      };
    }),
  };
});
const result = {
  method:
    "4 local Chrome processes with blank profiles, legal pilot controls and real Worker; 1 renderer, 3 network-only clients. Link limits apply to uncompressed payload. Different seeds, not matched performance trials. functionalPass is not a smoothness guarantee.",
  activeDefinition:
    "combat, more than one second after resumeUntil; gaps require both endpoints within the same resume interval. Includes dead players; no claim of end-to-end physical action latency.",
  trials,
};
fs.writeFileSync(
  path.join(base, "input-continuity-results.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    trials.map((t) => ({
      name: t.name,
      passed: t.functionalPass,
      stable: t.sourcesStable,
      clients: t.clients.map((c) => ({
        client: c.client,
        zero: c.zeroAckOutsideResume,
        gapMax: c.activeInputGapsMs.max,
        gapOver250: c.activeInputGapsOver250Ms,
        frameMax: c.frames.max,
        releaseReceiptMs: c.releaseReceiptSinceIntentMs,
      })),
    })),
    null,
    2,
  ),
);
