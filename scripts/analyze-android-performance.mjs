import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
export function distribution(values) {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!a.length) return null;
  const q = p => a[Math.max(0, Math.ceil(a.length * p) - 1)];
  return { n: a.length, mean: a.reduce((s, x) => s + x, 0) / a.length,
    p50: q(.5), p95: q(.95), p99: q(.99), max: a.at(-1), over50: a.filter(x => x > 50).length,
    over100: a.filter(x => x > 100).length };
}
export function analyze(r) {
  if (r.schema !== 1 || !Array.isArray(r.frames) || !Array.isArray(r.samples)) throw Error('Invalid recording');
  // Only intervals bounded by two consecutive active frames count as battle FPS.
  const frames = r.frames.filter((f, i) => f.active && i > 0 && r.frames[i - 1].active && Number.isFinite(f.dt));
  const summarize = list => {
    const times = distribution(list.map(f => f.dt));
    return { frameMs: times, renderedFps: times ? 1000 / times.mean : null,
      renderCpuMs: distribution(list.map(f => f.renderCpuMs)) };
  };
  const secondWindows = {};
  for (const f of frames) (secondWindows[Math.floor(f.t / 1000)] ??= []).push(f);
  return { caseId: r.caseId, meta: r.meta, build: r.build,
    physicalAndroidVerified: r.physicalAndroidVerified === true,
    elapsedMs: r.elapsedMs, battle: summarize(frames),
    first30s: summarize(frames.filter(f => f.t < 30000)),
    last30s: summarize(frames.filter(f => f.t >= r.elapsedMs - 30000)),
    seconds: Object.entries(secondWindows).map(([second, frames]) => ({ second: Number(second), ...summarize(frames) })),
    enemyCount: distribution(r.samples.filter(s => s.active).map(s => s.enemyCount)),
    longFrames: frames.filter(f => f.dt > 50),
    inputToRenderProxyMs: distribution(r.inputToRender.filter(x => x.active).map(x => x.ms)),
    heapSamples: r.samples.map(s => ({ t: s.t, bytes: s.heap })),
    limitations: ['Not input-to-photon', 'Render CPU duration excludes other main-thread work and GPU execution',
      'Physical device identity needs human confirmation', 'No automatic quality PASS',
      'Development build and probe overhead not quantified', ...(r.truncated ? ['Recording truncated'] : []),
      ...(r.events.some(e => e.visibility === 'hidden') ? ['Background interval present; inspect raw data'] : [])] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw Error('Usage: node scripts/analyze-android-performance.mjs recording.json');
  const result = analyze(JSON.parse(fs.readFileSync(file, 'utf8')));
  const output = file.replace(/\.json$/i, '') + '.summary.json';
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(output);
}
