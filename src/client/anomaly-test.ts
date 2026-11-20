import "./anomaly-test.css";
import {
  ANOMALY_ACTION_NAMES,
  ANOMALY_BOSS_IDS,
  ANOMALY_STAGE_LABELS,
  anomalySkillsFor,
  anomalySkillLabel,
  anomalyStageIds,
  type AnomalySkillId,
  type AnomalyStageId,
  type AnomalyTestAction,
  type AnomalyTestStance,
} from "../shared/anomaly-test";
import {
  ANOMALY_TEST_LIMIT,
  anomalyTestConfig,
  anomalyTestBossCount,
  anomalyTestCompare,
  anomalyTestCurrentCount,
  anomalyTestMetrics,
  anomalyTestTotalCount,
  createAnomalyTestWorld,
  requestAnomalyTestUpdate,
  type AnomalyTestConfig,
  type AnomalyTestEnemySetting,
  type AnomalyTestLoadout,
  type World,
} from "../shared/game";
import {
  ENEMY_REPORT_NAMES,
  type EnemyReportId,
} from "../shared/enemy-identity";

const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

type DialogFactory = (title: string, body: string) => HTMLDialogElement;

interface EnemyDraft {
  count: number;
  action: AnomalyTestAction;
  skill?: AnomalySkillId;
  sequence?: AnomalySkillId[];
  stance?: AnomalyTestStance;
}

export interface AnomalyTestPreparationOptions {
  start: (config: AnomalyTestConfig) => Promise<void>;
  armory?: Pick<AnomalyTestConfig, "weapons" | "levels" | "accessory">;
  initial?: AnomalyTestConfig;
}

const enemyIds = Object.keys(ENEMY_REPORT_NAMES) as EnemyReportId[];
const isBossId = (id: EnemyReportId) =>
  (ANOMALY_BOSS_IDS as readonly string[]).includes(id);

const defaultDrafts = (): Record<EnemyReportId, EnemyDraft> => {
  const drafts = Object.fromEntries(
    enemyIds.map((id) => [id, { count: 0, action: "free" as const }]),
  ) as Record<EnemyReportId, EnemyDraft>;
  drafts.crawler.count = 1;
  drafts.harrow.stance = "ground";
  return drafts;
};

const ensureDraftSkills = (id: EnemyReportId, draft: EnemyDraft) => {
  const skills = anomalySkillsFor(id, draft.stance);
  if (draft.action === "repeat" && !skills.some((s) => s.id === draft.skill))
    draft.skill = skills[0]?.id;
  if (draft.action === "sequence" && !draft.sequence?.length)
    draft.sequence = skills.map((skill) => skill.id);
};

const draftsFromConfig = (
  config?: AnomalyTestConfig,
): Record<EnemyReportId, EnemyDraft> => {
  const drafts = defaultDrafts();
  for (const [id, value] of Object.entries(config?.enemies ?? {}) as [
    EnemyReportId,
    Partial<AnomalyTestEnemySetting>,
  ][]) {
    const current = drafts[id];
    if (!current) continue;
    drafts[id] = {
      ...current,
      ...value,
      count: value.count ?? current.count,
      sequence: value.sequence ? [...value.sequence] : current.sequence,
    };
  }
  for (const id of enemyIds) ensureDraftSkills(id, drafts[id]);
  return drafts;
};

const draftSummary = (drafts: Record<EnemyReportId, EnemyDraft>) => {
  const total = enemyIds.reduce((sum, id) => sum + drafts[id].count, 0);
  const bosses = ANOMALY_BOSS_IDS.reduce(
    (sum, id) => sum + drafts[id].count,
    0,
  );
  return `合計 ${total}体 · ボス ${bosses}体`;
};

const validateDrafts = (
  drafts: Record<EnemyReportId, EnemyDraft>,
): { id?: EnemyReportId; message: string } => {
  let total = 0;
  let bosses = 0;
  for (const id of enemyIds) {
    const draft = drafts[id];
    if (
      !Number.isInteger(draft.count) ||
      draft.count < 0 ||
      draft.count > ANOMALY_TEST_LIMIT
    )
      return {
        id,
        message: `${ENEMY_REPORT_NAMES[id]} は0〜${ANOMALY_TEST_LIMIT}の整数で指定してください`,
      };
    total += draft.count;
    if (isBossId(id)) bosses += draft.count;
    if (
      draft.action === "repeat" &&
      !anomalySkillsFor(id, draft.stance).some((skill) => skill.id === draft.skill)
    )
      return { id, message: `${ENEMY_REPORT_NAMES[id]} の技を選んでください` };
    if (draft.action === "sequence") {
      const allowed = anomalySkillsFor(id, draft.stance).map((skill) => skill.id);
      if (!draft.sequence?.length || draft.sequence.some((s) => !allowed.includes(s)))
        return { id, message: `${ENEMY_REPORT_NAMES[id]} の順番を選んでください` };
    }
  }
  if (total > ANOMALY_TEST_LIMIT)
    return { message: `合計は${ANOMALY_TEST_LIMIT}体までです。現在${total}体です` };
  if (bosses > 3)
    return {
      message: `HARROW・CATENA・FOUNDRY ZEROは合計3体までです。現在${bosses}体です`,
    };
  return { message: "" };
};

const enemySettings = (drafts: Record<EnemyReportId, EnemyDraft>) =>
  Object.fromEntries(
    enemyIds.map((id) => {
      const draft = drafts[id];
      return [
        id,
        {
          count: draft.count,
          action: draft.action,
          skill: draft.action === "repeat" ? draft.skill : undefined,
          sequence:
            draft.action === "sequence" ? [...(draft.sequence ?? [])] : undefined,
          stance: draft.stance,
        },
      ];
    }),
  ) as AnomalyTestConfig["enemies"];

const actionOptions = (action: AnomalyTestAction) =>
  (Object.keys(ANOMALY_ACTION_NAMES) as AnomalyTestAction[])
    .map(
      (value) =>
        `<option value="${value}" ${value === action ? "selected" : ""}>${esc(ANOMALY_ACTION_NAMES[value])}</option>`,
    )
    .join("");

const skillOptions = (
  id: EnemyReportId,
  stance: AnomalyTestStance | undefined,
  selected?: AnomalySkillId,
) =>
  anomalySkillsFor(id, stance)
    .map(
      (skill) =>
        `<option value="${skill.id}" ${skill.id === selected ? "selected" : ""}>${esc(skill.label)}</option>`,
    )
    .join("");

const sequenceText = (id: EnemyReportId, draft: EnemyDraft) => {
  const sequence = draft.sequence ?? anomalySkillsFor(id, draft.stance);
  return sequence
    .map((skill) => (typeof skill === "string" ? anomalySkillLabel(skill) : skill.label))
    .join(" → ");
};

const enemyRow = (
  id: EnemyReportId,
  draft: EnemyDraft,
  current?: number,
) => `<article class="anomaly-test-enemy" data-enemy="${id}">
  <header><b>${esc(ENEMY_REPORT_NAMES[id])}</b>${isBossId(id) ? "<small>ボス枠</small>" : ""}${current === undefined ? "" : `<small>現在 ${current}体</small>`}</header>
  <label>体数（0〜${ANOMALY_TEST_LIMIT}）<span class="anomaly-test-count-row"><button type="button" data-count-step="-1" aria-label="${esc(ENEMY_REPORT_NAMES[id])}の体数を減らす">−</button><input data-count type="number" min="0" max="${ANOMALY_TEST_LIMIT}" step="1" value="${draft.count}" aria-label="${esc(ENEMY_REPORT_NAMES[id])}の設定数"><button type="button" data-count-step="1" aria-label="${esc(ENEMY_REPORT_NAMES[id])}の体数を増やす">＋</button></span></label>
  <small class="anomaly-test-error" data-error-for="${id}" role="status"></small>
  <label>行動<select data-action>${actionOptions(draft.action)}</select></label>
  ${id === "harrow" ? `<label data-stance-row>姿勢<select data-stance><option value="ground" ${draft.stance === "ground" ? "selected" : ""}>地上歩行</option><option value="air" ${draft.stance === "air" ? "selected" : ""}>飛行</option></select></label>` : ""}
  <label data-skill-row hidden>技<select data-skill>${skillOptions(id, draft.stance, draft.skill)}</select></label>
  <p class="anomaly-test-sequence" data-sequence-row hidden></p>
</article>`;

const updateEnemyRow = (row: HTMLElement, id: EnemyReportId, draft: EnemyDraft) => {
  const skillRow = row.querySelector<HTMLElement>("[data-skill-row]")!;
  const sequenceRow = row.querySelector<HTMLElement>("[data-sequence-row]")!;
  skillRow.hidden = draft.action !== "repeat" && draft.action !== "sequence";
  sequenceRow.hidden = draft.action !== "sequence";
  if (!skillRow.hidden)
    skillRow.querySelector<HTMLSelectElement>("select")!.innerHTML = skillOptions(
      id,
      draft.stance,
      draft.skill,
    );
  if (!sequenceRow.hidden) sequenceRow.textContent = `順番: ${sequenceText(id, draft)}`;
};

const wireEnemyRows = (
  root: HTMLElement,
  drafts: Record<EnemyReportId, EnemyDraft>,
  onChange: () => void,
) => {
  for (const id of enemyIds) {
    const row = root.querySelector<HTMLElement>(`[data-enemy="${id}"]`)!;
    const countInput = row.querySelector<HTMLInputElement>("[data-count]")!;
    const action = row.querySelector<HTMLSelectElement>("[data-action]")!;
    const stance = row.querySelector<HTMLSelectElement>("[data-stance]");
    const skill = row.querySelector<HTMLSelectElement>("[data-skill]")!;
    countInput.oninput = () => {
      drafts[id].count = Number(countInput.value);
      onChange();
    };
    row.querySelectorAll<HTMLButtonElement>("[data-count-step]").forEach((button) => {
      button.onclick = () => {
        countInput.value = String(
          Number(countInput.value || 0) + Number(button.dataset.countStep),
        );
        countInput.dispatchEvent(new Event("input", { bubbles: true }));
      };
    });
    action.onchange = () => {
      drafts[id].action = action.value as AnomalyTestAction;
      ensureDraftSkills(id, drafts[id]);
      updateEnemyRow(row, id, drafts[id]);
      onChange();
    };
    if (stance) {
      stance.onchange = () => {
        drafts[id].stance = stance.value as AnomalyTestStance;
        drafts[id].sequence = anomalySkillsFor(id, drafts[id].stance).map(
          (entry) => entry.id,
        );
        drafts[id].skill = anomalySkillsFor(id, drafts[id].stance)[0]?.id;
        updateEnemyRow(row, id, drafts[id]);
        onChange();
      };
    }
    skill.onchange = () => {
      drafts[id].skill = skill.value as AnomalySkillId;
      onChange();
    };
    updateEnemyRow(row, id, drafts[id]);
  }
};

export { createAnomalyTestWorld };

export function openAnomalyTestPreparation(
  container: HTMLElement,
  options: AnomalyTestPreparationOptions,
) {
  const config = options.initial;
  const drafts = draftsFromConfig(config);
  const mode = config?.mode ?? "observe";
  const stage = config?.stage ?? 1;
  const difficulty = config?.difficulty ?? "normal";
  const loadout = config?.loadout ?? "standard";
  const stageOptions = anomalyStageIds()
    .map(
      (id) =>
        `<option value="${id}" ${id === stage ? "selected" : ""}>${esc(ANOMALY_STAGE_LABELS[id])}</option>`,
    )
    .join("");
  container.innerHTML = `<section class="panel menu-screen pt-screen anomaly-test-preparation"><header class="menu-header"><div><div class="eyebrow">DEVELOPER TEST</div><h1>ANOMALYテスト</h1></div></header><div class="anomaly-test-controls"><label>モード<select id="pt-anomaly-mode"><option value="observe" ${mode === "observe" ? "selected" : ""}>観察</option><option value="live" ${mode === "live" ? "selected" : ""}>実戦</option></select></label><label>強さの基準<select id="pt-anomaly-stage">${stageOptions}</select></label><label>難易度<select id="pt-anomaly-difficulty"><option value="normal" ${difficulty === "normal" ? "selected" : ""}>通常</option><option value="hard" ${difficulty === "hard" ? "selected" : ""}>ハード</option></select></label><label>装備<select id="pt-anomaly-loadout"><option value="standard" ${loadout === "standard" ? "selected" : ""}>基準装備</option><option value="armory" ${loadout === "armory" ? "selected" : ""} ${options.armory ? "" : "disabled"}>開発者兵舎の装備</option></select></label></div><div class="anomaly-test-summary"><article><small>地形</small><b>武器庫防衛拠点</b></article><article><small>編成</small><b id="pt-anomaly-summary">${esc(draftSummary(drafts))}</b></article></div><div class="anomaly-test-enemy-list">${enemyIds.map((id) => enemyRow(id, drafts[id])).join("")}</div><p id="pt-anomaly-message" class="pt-status" role="status">初期設定のまま出撃できます。観察では自機が倒れず、指定個体を倒すと補充されます。</p><footer class="anomaly-test-actions"><button id="pt-anomaly-back">開発者ホームへ戻る</button><button id="pt-anomaly-start" class="primary">ANOMALYテスト出撃 ↗</button></footer></section>`;
  const message = container.querySelector<HTMLElement>("#pt-anomaly-message")!;
  const summary = container.querySelector<HTMLElement>("#pt-anomaly-summary")!;
  const clearErrors = () => {
    container.querySelectorAll<HTMLElement>("[data-error-for]").forEach((node) => {
      node.textContent = "";
    });
    message.textContent = "初期設定のまま出撃できます。観察では自機が倒れず、指定個体を倒すと補充されます。";
  };
  wireEnemyRows(container, drafts, () => {
    clearErrors();
    summary.textContent = draftSummary(drafts);
  });
  container.querySelector<HTMLButtonElement>("#pt-anomaly-back")!.onclick = () => {
    container.dispatchEvent(new CustomEvent("anomaly-test-home"));
  };
  container.querySelector<HTMLButtonElement>("#pt-anomaly-start")!.onclick = () => {
    const result = validateDrafts(drafts);
    clearErrors();
    if (result.message) {
      message.textContent = result.message;
      if (result.id) {
        const field = container.querySelector<HTMLElement>(
          `[data-error-for="${result.id}"]`,
        );
        if (field) field.textContent = result.message;
      }
      return;
    }
    const selectedLoadout = container.querySelector<HTMLSelectElement>(
      "#pt-anomaly-loadout",
    )!.value as AnomalyTestLoadout;
    const config: AnomalyTestConfig = {
      mode: container.querySelector<HTMLSelectElement>("#pt-anomaly-mode")!
        .value as AnomalyTestConfig["mode"],
      stage: Number(
        container.querySelector<HTMLSelectElement>("#pt-anomaly-stage")!.value,
      ) as AnomalyStageId,
      difficulty: container.querySelector<HTMLSelectElement>(
        "#pt-anomaly-difficulty",
      )!.value as AnomalyTestConfig["difficulty"],
      loadout: selectedLoadout,
      enemies: enemySettings(drafts),
      ...(selectedLoadout === "armory" && options.armory
        ? options.armory
        : {}),
    };
    void options.start(config);
  };
}

const metricSummary = (world: World) => {
  const metrics = anomalyTestMetrics(world);
  const damageLabel =
    world.anomalyTest?.mode === "observe" ? "無敵で防いだ相当量" : "累積被ダメージ";
  return `95パーセンタイル ${metrics.p95.toFixed(1)}ms · ${damageLabel} ${metrics.damage.toFixed(1)} · 撃破数 ${metrics.kills} · 経過時間 ${metrics.elapsed.toFixed(1)}秒`;
};

export function openAnomalyTestSettings(
  world: World,
  dialog: DialogFactory,
  onResume: () => void,
  onRestart: (config: AnomalyTestConfig) => void,
) {
  if (!world.anomalyTest) throw Error("ANOMALYテストではありません");
  const drafts = draftsFromConfig(world.anomalyTest);
  const summary = () =>
    `${draftSummary(drafts)} · 実出現 ${anomalyTestTotalCount(world)}体 · ボス ${anomalyTestBossCount(world)}体`;
  const d = dialog(
    "ANOMALY設定",
    `<div class="anomaly-test-setting-grid"><article class="anomaly-test-summary"><small>編成</small><b id="pt-anomaly-draft-summary">${esc(summary())}</b><small>計測</small><b>${esc(metricSummary(world))}</b></article><div class="anomaly-test-enemy-list">${enemyIds
      .map((id) => enemyRow(id, drafts[id], anomalyTestCurrentCount(world, id)))
      .join("")}</div><p id="pt-anomaly-message" role="status">確定すると次のシミュレーション更新で差分を反映します。一時停止と背景時間は計測に含みません。</p><footer class="anomaly-test-setting-actions"><button id="pt-anomaly-restart">同条件でやり直す</button><button id="pt-anomaly-cancel">キャンセル</button><button id="pt-anomaly-apply" class="primary">確定</button></footer></div>`,
  );
  const message = d.querySelector<HTMLElement>("#pt-anomaly-message")!;
  const draftSummaryNode = d.querySelector<HTMLElement>("#pt-anomaly-draft-summary")!;
  const clearErrors = () => {
    d.querySelectorAll<HTMLElement>("[data-error-for]").forEach((node) => {
      node.textContent = "";
    });
    message.textContent = "確定すると次のシミュレーション更新で差分を反映します。一時停止と背景時間は計測に含みません。";
    draftSummaryNode.textContent = summary();
  };
  wireEnemyRows(d, drafts, clearErrors);
  d.querySelector<HTMLButtonElement>("#pt-anomaly-cancel")!.onclick = () => d.close();
  d.querySelector<HTMLButtonElement>("#pt-anomaly-restart")!.onclick = () => {
    const result = validateDrafts(drafts);
    clearErrors();
    if (result.message) {
      message.textContent = result.message;
      if (result.id) {
        const field = d.querySelector<HTMLElement>(`[data-error-for="${result.id}"]`);
        if (field) field.textContent = result.message;
      }
      return;
    }
    const base = anomalyTestConfig(world);
    d.close();
    onRestart({
      ...base,
      enemies: { ...base.enemies, ...enemySettings(drafts) },
    });
  };
  d.querySelector<HTMLButtonElement>("#pt-anomaly-apply")!.onclick = () => {
    const result = validateDrafts(drafts);
    clearErrors();
    if (result.message) {
      message.textContent = result.message;
      if (result.id) {
        const field = d.querySelector<HTMLElement>(`[data-error-for="${result.id}"]`);
        if (field) field.textContent = result.message;
      }
      return;
    }
    const changes = enemyIds.filter((id) => {
      const current = world.anomalyTest!.enemies[id];
      const draft = drafts[id];
      return (
        current.count !== draft.count ||
        current.action !== draft.action ||
        current.skill !== (draft.action === "repeat" ? draft.skill : undefined) ||
        current.stance !== draft.stance ||
        JSON.stringify(current.sequence) !==
          JSON.stringify(draft.action === "sequence" ? draft.sequence : undefined)
      );
    });
    changes.sort(
      (left, right) => drafts[left].count - drafts[right].count,
    );
    try {
      for (const id of changes) {
        const draft = drafts[id];
        requestAnomalyTestUpdate(world, id, draft.count, {
          action: draft.action,
          skill: draft.action === "repeat" ? draft.skill : undefined,
          sequence:
            draft.action === "sequence" ? [...(draft.sequence ?? [])] : undefined,
          stance: draft.stance,
        });
      }
      d.close();
    } catch (error) {
      message.textContent = (error as Error).message;
    }
  };
  d.addEventListener("close", onResume);
  return d;
}

const comparisonMarkup = (world: World) => {
  const comparison = anomalyTestCompare(world);
  if (!comparison)
    return "<p>比較できる直前の試行がありません。</p>";
  if (!comparison.sameConditions)
    return "<p>条件変更あり：編成・行動・装備・難易度が揃っていないため数値差を表示しません。</p>";
  const row = (label: string, before: number, after: number, unit: string) =>
    `<tr><th>${esc(label)}</th><td>${before.toFixed(1)}${unit}</td><td>${after.toFixed(1)}${unit}</td><td>${(after - before >= 0 ? "+" : "") + (after - before).toFixed(1)}${unit}</td></tr>`;
  return `<table class="anomaly-test-compare"><thead><tr><th>項目</th><th>直前</th><th>今回</th><th>差</th></tr></thead><tbody>${row("95パーセンタイル", comparison.previous.metrics.p95, comparison.current.metrics.p95, "ms")}${row("被ダメージ", comparison.previous.metrics.damage, comparison.current.metrics.damage, "")}${row("撃破数", comparison.previous.metrics.kills, comparison.current.metrics.kills, "")}${row("経過時間", comparison.previous.metrics.elapsed, comparison.current.metrics.elapsed, "秒")}</tbody></table>`;
};

export function anomalyTestResultMarkup(world: World): string {
  const test = world.anomalyTest;
  if (!test) throw Error("ANOMALYテストではありません");
  const result = test.lastResult;
  const title = world.phase === "victory" ? "試行完了" : "試行終了";
  const damageLabel = test.mode === "observe" ? "無敵で防いだ相当量" : "累積被ダメージ";
  return `<section class="anomaly-test-result"><p class="pt-status">${esc(result?.reason ?? title)}</p><div class="anomaly-test-summary"><article><small>${esc(damageLabel)}</small><b>${test.metrics.damage.toFixed(1)}</b></article><article><small>撃破数</small><b>${test.metrics.kills}</b></article><article><small>経過時間</small><b>${test.metrics.elapsed.toFixed(1)}秒</b></article><article><small>描画負荷（95パーセンタイル）</small><b>${anomalyTestMetrics(world).p95.toFixed(1)}ms</b></article></div><h2>同条件比較</h2>${comparisonMarkup(world)}<footer class="anomaly-test-actions"><button id="pt-anomaly-edit">編成を変更</button><button id="pt-anomaly-home">開発者ホームへ</button><button id="pt-anomaly-retry" class="primary">同条件で再挑戦</button></footer></section>`;
}

export function anomalyTestHudDetail(world: World, fps: number): string {
  if (!world.anomalyTest) return "";
  const roster = enemyIds
    .filter((id) => world.anomalyTest!.enemies[id].count > 0)
    .map((id) => `${ENEMY_REPORT_NAMES[id]} ${world.anomalyTest!.enemies[id].count}`)
    .join(" / ");
  return `実出現 ${anomalyTestTotalCount(world)}体 · ボス ${anomalyTestBossCount(world)}体 · ${fps}FPS · ${roster || "空の戦場"}`;
}
