// Explicit, local Vite-only diagnostic. Never imported by the shipped game.
export async function install(meta) {
  if (location.hostname !== 'localhost' || location.port !== '5193')
    throw Error('Use the dedicated localhost:5193 test origin');
  if (window.__androidPerf) throw Error('Probe already installed; reload first');
  if (!meta || !/^[a-f0-9]{40}$/.test(meta.sourceSha ?? ''))
    throw Error('Supply the measured source SHA');
  const { Renderer } = await import('/src/client/render.ts');
  const original = Renderer.prototype.render;
  const limit = 120000;
  let recording = false, report = null, timer, statusTimer, previous = null;
  let started = 0, lastSample = -Infinity, pendingInput = null, observers = [];
  const panel = document.createElement('div');
  panel.id = 'android-perf';
  panel.style.cssText = 'position:fixed;top:40px;left:30%;z-index:99999;background:#10202eee;color:white;font:12px sans-serif;padding:4px;max-width:65vw;pointer-events:auto';
  panel.innerHTML = '<select aria-label="測定ケース"><option>A</option><option>B</option><option>C</option><option>D</option></select> <button>記録開始</button> <button>停止</button> <button>JSON保存</button> <output>待機</output>';
  document.body.append(panel);
  for (const type of ['pointerdown', 'pointerup', 'pointermove', 'click'])
    panel.addEventListener(type, e => e.stopPropagation());
  const buttons = panel.querySelectorAll('button');
  const output = panel.querySelector('output');
  function push(key, value) {
    if (report[key].length < limit) report[key].push(value);
    else report.truncated = true;
  }
  function input(e) {
    if (!recording || panel.contains(e.target) || !e.isTrusted) return;
    // Coalesce to earliest pending input; never retain coordinates, key or target.
    pendingInput ??= { type: e.type, timestamp: e.timeStamp };
  }
  const inputTypes = ['pointerdown', 'pointermove', 'pointerup', 'keydown'];
  function visibility() {
    if (recording) push('events', { t: performance.now() - started, visibility: document.visibilityState });
  }
  function observe(type) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    const observer = new PerformanceObserver(list => {
      if (!recording) return;
      for (const e of list.getEntries()) {
        if (e.startTime < started) continue;
        push('longTasks', {
          type, t: e.startTime - started, duration: e.duration,
          blockingDuration: e.blockingDuration ?? null,
          scripts: e.scripts?.map(s => ({
            duration: s.duration, function: s.sourceFunctionName,
            // Only local source paths; no page URLs, query strings or user data.
            source: s.sourceURL?.startsWith(location.origin + '/')
              ? new URL(s.sourceURL).pathname : null,
          })) ?? null,
        });
      }
    });
    observer.observe({ type, buffered: false });
    observers.push(observer);
  }
  function wrapped(...args) {
    const begin = performance.now();
    const result = original.apply(this, args);
    const end = performance.now();
    if (!recording || result !== true) return result;
    const w = args[0], active = Boolean(args[6] && w?.phase === 'battle');
    push('frames', { t: end - started, dt: previous === null ? null : end - previous,
      renderCpuMs: end - begin, active });
    previous = end;
    if (pendingInput) {
      const delay = end - pendingInput.timestamp;
      push('inputToRender', { t: end - started, type: pendingInput.type,
        ms: delay >= 0 && delay < 60000 ? delay : null, active });
      pendingInput = null;
    }
    if (end - lastSample >= 1000) {
      lastSample = end;
      let objects = 0;
      this.scene.traverse(() => objects++);
      const p = w?.players.find(p => p.id === args[1]);
      const enemies = {};
      for (const e of w?.enemies ?? []) if (e.hp > 0) enemies[e.kind] = (enemies[e.kind] ?? 0) + 1;
      push('samples', {
        t: end - started, active, phase: w?.phase ?? null, gameTime: w?.time ?? null,
        stage: w?.solo?.stage ?? w?.stage ?? null, difficulty: w?.solo?.difficulty ?? null,
        wave: w?.wave ?? null, enemies, enemyCount: Object.values(enemies).reduce((sum, n) => sum + n, 0),
        enemyObjectCount: w?.enemies.length ?? 0,
        render: { ...this.renderer.info.render }, memoryObjects: { ...this.renderer.info.memory }, objects,
        heap: performance.memory?.usedJSHeapSize ?? null,
        quality: this.quality, adaptiveScale: this.adaptiveQuality.scale, targetFps: this.frameRate,
        viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
        buffer: [this.renderer.domElement.width, this.renderer.domElement.height],
        player: p ? { hp: p.hp, x: p.x, y: p.y ?? 0, z: p.z, slot: p.slot,
          weapons: p.weapons.map(({ id, ...weapon }) => weapon) } : null,
        harrow: w?.enemies.filter(e => e.kind === 'harrow').map(e => e.harrow?.kind ?? e.harrow?.phase ?? null) ?? [],
      });
      if (!report.initial && w) report.initial = {
        seed: w.seed, gameTime: w.time, stagePlan: structuredClone(w.campaignPlan ?? null),
      };
    }
    return result;
  }
  function stop(reason = 'manual') {
    if (!recording) return report;
    recording = false;
    report.elapsedMs = performance.now() - started;
    report.stopReason = reason;
    clearTimeout(timer); clearInterval(statusTimer);
    for (const observer of observers) observer.disconnect();
    observers = [];
    for (const type of inputTypes) document.removeEventListener(type, input, true);
    document.removeEventListener('visibilitychange', visibility);
    if (Renderer.prototype.render === wrapped) Renderer.prototype.render = original;
    output.textContent = `停止 ${Math.round(report.elapsedMs / 1000)}秒 / JSON保存`;
    return report;
  }
  function start(caseId = panel.querySelector('select').value, seconds = caseId === 'D' ? 600 : 120) {
    if (recording) throw Error('Already recording');
    if (!['A', 'B', 'C', 'D'].includes(caseId) || !Number.isFinite(seconds) || seconds < 1 || seconds > 900)
      throw Error('Invalid case/duration');
    report = { schema: 1, meta: structuredClone(meta), caseId, requestedSeconds: seconds,
      build: 'local-vite-development', physicalAndroidVerified: false,
      environment: { userAgent: navigator.userAgent, screenCss: [screen.width, screen.height],
        viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
        supportedEntries: [...PerformanceObserver.supportedEntryTypes] },
      frames: [], samples: [], longTasks: [], inputToRender: [], events: [], truncated: false,
      unmeasured: ['CPU utilization', 'GPU utilization/time', 'temperature', 'battery', 'GC (use separate trace)', 'input-to-photon'],
    };
    previous = null; lastSample = -Infinity; pendingInput = null;
    started = performance.now(); recording = true;
    Renderer.prototype.render = wrapped;
    for (const type of inputTypes) document.addEventListener(type, input, { capture: true, passive: true });
    document.addEventListener('visibilitychange', visibility);
    observe('longtask'); observe('long-animation-frame');
    output.textContent = '記録中';
    statusTimer = setInterval(() => { output.textContent = `${Math.floor((performance.now() - started) / 1000)}秒`; }, 1000);
    timer = setTimeout(() => stop('duration'), seconds * 1000);
  }
  function download() {
    if (recording) stop();
    if (!report) throw Error('No recording');
    const url = URL.createObjectURL(new Blob([JSON.stringify(report)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url;
    a.download = `android-perf-${report.caseId}-${Date.now()}.json`;
    panel.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  buttons[0].onclick = () => start(); buttons[1].onclick = () => stop(); buttons[2].onclick = download;
  const api = { start, stop, download, result: () => report, dispose() {
    stop('dispose'); panel.remove(); delete window.__androidPerf;
  } };
  window.__androidPerf = api;
  return api;
}
