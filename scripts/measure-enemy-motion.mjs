/**
 * Render-only motion comparison. A server sends exact positions at 10 or 6.67 Hz;
 * the renderer runs at 60 Hz. This has no browser, GPU, or network dependency.
 * Run: node scripts/measure-enemy-motion.mjs
 */
const frameMs = 1000 / 60;
const speed = 4; // m/s, representative moving PLEAT
const durationMs = 3500;

const straight = (at) => (at / 1000) * speed;
const stop = (at) => (Math.min(at, 2000) / 1000) * speed;
const reverse = (at) => ((at <= 2000 ? at : 4000 - at) / 1000) * speed;

function samples(intervalMs, pause = false, trajectory = straight) {
  const result = [];
  for (let at = 0; at <= durationMs; at += intervalMs) {
    if (pause && at > 900 && at < 1300) continue;
    result.push({ at, x: trajectory(at) });
  }
  return result;
}

function run(states, mode, horizonMs = 0) {
  const positions = [];
  let received = 0;
  let latest = states[0];
  let previous = latest;
  let drawn = latest.x;
  for (let frame = 0; frame <= Math.round(durationMs / frameMs); frame++) {
    const now = frame * frameMs;
    while (
      received + 1 < states.length &&
      states[received + 1].at <= now + 1e-7
    ) {
      previous = latest;
      latest = states[++received];
    }
    const interval = latest.at - previous.at;
    const velocity = interval > 0 ? (latest.x - previous.x) / interval : 0;
    let target = latest.x;
    if (mode === "extrapolate") {
      target += velocity * Math.min(now - latest.at, horizonMs);
    } else if (mode === "interpolate") {
      const viewAt = now - horizonMs;
      const older = [...states].reverse().find((state) => state.at <= viewAt);
      const newer = states.find(
        (state) => state.at > viewAt && state.at <= latest.at,
      );
      if (older && newer) {
        const fraction = (viewAt - older.at) / (newer.at - older.at);
        target = older.x + (newer.x - older.x) * fraction;
      } else if (older) target = older.x;
      else target = states[0].x;
    }
    if (mode === "interpolate") drawn = target;
    else drawn += (target - drawn) * (1 - Math.exp((-24 * frameMs) / 1000));
    positions.push({ at: now, x: drawn });
  }
  return positions;
}

function metrics(positions, from, to, trajectory = straight) {
  const window = positions.filter(
    (point) => point.at >= from && point.at <= to,
  );
  const steps = window
    .slice(1)
    .map((point, index) => point.x - window[index].x);
  const magnitudes = steps.map(Math.abs);
  const meanStep = magnitudes.reduce((a, b) => a + b, 0) / steps.length;
  const variation =
    Math.sqrt(
      magnitudes.reduce((a, b) => a + (b - meanStep) ** 2, 0) / steps.length,
    ) / meanStep;
  const signedErrors = window.map((point) => point.x - trajectory(point.at));
  const errors = signedErrors.map(Math.abs);
  return {
    speedVariation: +variation.toFixed(3),
    meanLagMs: +(
      (errors.reduce((a, b) => a + b, 0) / errors.length / speed) *
      1000
    ).toFixed(1),
    maxErrorM: +Math.max(...errors).toFixed(3),
    maxAheadM: +Math.max(0, ...signedErrors).toFixed(3),
    maxStepM: +Math.max(...magnitudes).toFixed(3),
  };
}

for (const [scenario, states, steadyStart, steadyEnd, trajectory] of [
  ["100ms", samples(100), 500, 3000, straight],
  ["150ms", samples(150), 600, 3000, straight],
  ["100ms + 300ms downlink pause", samples(100, true), 500, 3000, straight],
  ["100ms + sudden stop", samples(100, false, stop), 1800, 2450, stop],
  ["100ms + reversal", samples(100, false, reverse), 1800, 2450, reverse],
]) {
  const alternatives = {
    current: run(states, "current"),
    extrapolate50: run(states, "extrapolate", 50),
    extrapolate100: run(states, "extrapolate", 100),
    extrapolate150: run(states, "extrapolate", 150),
    interpolate100: run(states, "interpolate", 100),
    interpolate150: run(states, "interpolate", 150),
  };
  console.log(
    JSON.stringify({
      scenario,
      steady: Object.fromEntries(
        Object.entries(alternatives).map(([name, path]) => [
          name,
          metrics(path, steadyStart, steadyEnd, trajectory),
        ]),
      ),
      pause: scenario.includes("pause")
        ? Object.fromEntries(
            Object.entries(alternatives).map(([name, path]) => [
              name,
              metrics(path, 900, 1550, trajectory),
            ]),
          )
        : undefined,
    }),
  );
}
