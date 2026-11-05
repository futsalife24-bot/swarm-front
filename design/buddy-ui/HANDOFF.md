# バディUI 受け渡し（2026-11-05、Claude Code／Claudeデザイン担当）

依頼正本：主担当worktreeの `docs/BUDDY-CLAUDE-DESIGN-HANDOFF-20261105.md`（未追跡のため、このbranchには入っていない）。

## 渡すもの

- リポジトリ：https://github.com/futsalife24-bot/swarm-front
- 作業場所：`C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-buddy-ui`（専用worktree）
- branch：`claude/buddy-ui-20261105`
- 基点：`210adf9`（主担当の `codex/buddy-game-integration-20261105` のローカルHEAD。作業開始時点でoriginのPR279は `db14655`。`210adf9` までの主担当commitも、このbranchのpushでoriginに載る）
- mainへの反映とWorker公開はしていない（主担当が統合後に行う）。旧生存カード試作は含めていない。
- 共有STATE・MainVault・主担当worktreeは編集していない。追記案は末尾に置いた。

### 追加したファイル（既存ファイルの変更はなし）

| ファイル | 役割 |
| --- | --- |
| `src/client/buddy-ui.ts` | 製品用モジュール。`mountBuddyMenu`（初回選択・編成/育成・招集）と `createBuddySkillButton`（戦闘HUD） |
| `src/client/buddy-ui.css` | 上記の見た目。`.bd-` 接頭辞。既存の `menu-theme.css` の変数と `.resource-frame` を利用 |
| `public/assets/buddy/portraits/{tatara,yosuga,tobari,oriha}.webp` | 採用GLBから書き出した立ち絵（320×320、透明、各3〜9KB）。素材の色・形は変えていない |
| `design/buddy-ui/index.html`・`preview.ts`・`preview.css` | プレビュー。実際のゲームCSSと基地ヘッダーの構造の中で製品モジュールを表示 |
| `design/buddy-ui/tools/check.mjs` | 撮影と検査（144項目） |
| `design/buddy-ui/tools/portraits.*`・`render-portraits.mjs` | 立ち絵の書き出し |
| `design/buddy-ui/shots/` | 撮影画像と `report.txt` |
| `design/buddy-ui/tsconfig.json` | プレビューと道具の型検査用 |

### Designキャンバス（claude.ai、非公開）

https://claude.ai/artifact/AJQjS8rdyi4KDSa4Yf7Jst

- 主要4画面
- 部品と状態の見本（編集できるマークアップ）
- 状態一覧
- 640×360
- 戦闘HUD

所有者のアカウントだけが開ける。共有は画面の Share から本人が行う。

## 起動と検査

```
npm ci
npx vite --host 127.0.0.1 --port 5191 --strictPort
```

- `http://127.0.0.1:5191/design/buddy-ui/` を開く。
  - 主担当が5186で開発サーバーを使っていても衝突しない。
  - 初回の起動と依存の最適化には1〜2分かかる。
- 左下の「表示」で、場面・動きを減らす・音量0を切り替えられる。URLの `?scene=<名前>&motion=reduce&sound=0` でも同じ。
- 場面の名前：
  - `starter`
  - `roster`・`roster-cap`・`roster-short`・`roster-max`・`roster-unowned`
  - `recruit`・`recruit-short`・`recruit-guarantee`・`recruit-all`・`recruit-busy`
  - `result-new`・`result-dup`
  - `save-fail`・`missing`・`locked`・`hud`

検査（開発サーバーの起動後）：

```
node design/buddy-ui/tools/check.mjs
```

立ち絵の書き出し直し：

```
node design/buddy-ui/tools/render-portraits.mjs
```

プレビューの見本データ（`preview.ts` の stub）は場面の再現用で、抽選・育成・保存の実装ではない。

## 表示契約（主担当のデータ → UI）

`BuddyUiState`：

| 項目 | 内容 | 主担当の出典 |
| --- | --- | --- |
| `catalog[]` | 名前・属性・役割・スキル名・効果文・再使用秒・立ち絵 | 図鑑定義（スキル名は未決。プレビューは役割名を表示） |
| `owned[id]` | `level`・`levelCap`・`xpIntoLevel`・`xpForNext`・`breakthrough`・`breakthroughMax`・`nextLevelCap`・`breakthroughCost` | `buddyLevel`・`buddyXpForLevel`・`BUDDY_LEVEL_CAPS`・`BUDDY_BREAKTHROUGH_COSTS` |
| `selected`・`starterChosen`・`tickets`・`fragments` | 保存値 | `BuddyProgress` |
| `recruit` | `ticketCost`・`odds[]`・`pityCount`・`pityThreshold`・`guaranteedNext`・`duplicateFragments`・`firstClearTickets`・`repeatUnits`・`repeatUnitsPerTicket`・`provisional[]` | `drawBuddy`・`settleBuddyRun` の規則 |
| `locked` | 変更できない理由（出撃中など）。あれば同行変更・招集・突破を止める | 呼出側 |

`BuddyUiActions`：

| コールバック | 動き |
| --- | --- |
| `chooseStarter(id)`・`equip(id or null)`・`breakthrough(id)` | 新しい `BuddyUiState` を返す。同期でも Promise でもよい |
| `draw(requestId)` | `{ state, outcome: { buddyId, duplicate, guaranteed, fragmentsGained } }` を返す |
| `requestId()` | 新しい招集の要求IDを返す |
| `sound?(cue)` | 既存の `Sound.play` へ渡す |

- 例外を投げると、UIは理由と「再試行」を表示する。
- 招集の再試行は同じ `requestId` で呼ぶ。`applyBuddyAction` が準備済みの結果を保持する設計に合わせた。
- 成功するまで、UIはチケットも結果も変えない。

UIが自分で計算しないもの：抽選、保証の判定、確率、育成数値、報酬、保存。すべて受け取った値を表示する。

### 変換の例（主担当側に置く想定。このbranchでは未コンパイル）

```ts
import {
  BUDDY_IDS,
  BUDDY_LEVEL_CAPS,
  BUDDY_BREAKTHROUGH_COSTS,
  buddyLevel,
  buddyXpForLevel,
  type BuddyProgress,
} from "../shared/buddy-progression";
import { applyBuddyAction } from "./buddy-controller";
import type { BuddyUiState, BuddyUiActions } from "./buddy-ui";

// 下の数値は drawBuddy・settleBuddyRun の現行の固定値。shared から定数として export すると、UI側で二重に持たずに済む。
const PITY = 4, TICKET_COST = 1, FIRST_CLEAR = 2, REPEAT_PER_TICKET = 3;

export function buddyUiState(p: BuddyProgress, locked: string | null = null): BuddyUiState {
  const owned: BuddyUiState["owned"] = {};
  for (const id of BUDDY_IDS) {
    const g = p.owned[id];
    if (!g) continue;
    const level = buddyLevel(g), cap = BUDDY_LEVEL_CAPS[g.breakthrough];
    const max = g.breakthrough >= BUDDY_BREAKTHROUGH_COSTS.length;
    owned[id] = {
      level,
      levelCap: cap,
      xpIntoLevel: level >= cap ? 0 : g.xp - buddyXpForLevel(level),
      xpForNext: level >= cap ? null : buddyXpForLevel(level + 1) - buddyXpForLevel(level),
      breakthrough: g.breakthrough,
      breakthroughMax: BUDDY_BREAKTHROUGH_COSTS.length,
      nextLevelCap: max ? null : BUDDY_LEVEL_CAPS[g.breakthrough + 1],
      breakthroughCost: max ? null : BUDDY_BREAKTHROUGH_COSTS[g.breakthrough],
    };
  }
  const missing = BUDDY_IDS.filter((id) => !p.owned[id]);
  const guaranteed = missing.length > 0 && p.pity >= PITY;
  const pool = guaranteed ? missing : [...BUDDY_IDS];
  return {
    catalog: BUDDY_CATALOG, // 名前・属性・役割・効果文・再使用秒（BUDDY_COMBAT.cooldown）・立ち絵
    owned,
    selected: p.selected,
    starterChosen: p.starterChosen,
    tickets: p.tickets,
    fragments: p.fragments,
    recruit: {
      ticketCost: TICKET_COST,
      odds: pool.map((id) => ({ id, percent: 100 / pool.length })),
      pityCount: missing.length ? p.pity : 0,
      pityThreshold: PITY,
      guaranteedNext: guaranteed,
      duplicateFragments: 1,
      firstClearTickets: FIRST_CLEAR,
      repeatUnits: p.repeatUnits,
      repeatUnitsPerTicket: REPEAT_PER_TICKET,
      provisional: ["難度別の反復報酬"],
    },
    locked,
  };
}

// playtest-app.ts の save を、成功で返った save だけで更新する。
const act = (a: Parameters<typeof applyBuddyAction>[1]) => {
  const r = applyBuddyAction(save, a, { inBattle: false });
  save = r.save;
  return r;
};
const actions: BuddyUiActions = {
  requestId: () => crypto.randomUUID(),
  chooseStarter: (id) => buddyUiState(act({ kind: "starter", buddyId: id as BuddyId }).save.buddies!),
  equip: (id) => buddyUiState(act({ kind: "equip", buddyId: id as BuddyId | null }).save.buddies!),
  breakthrough: (id) => buddyUiState(act({ kind: "breakthrough", buddyId: id as BuddyId }).save.buddies!),
  draw: (requestId) => {
    const r = act({ kind: "draw", requestId });
    return {
      state: buddyUiState(r.save.buddies!),
      outcome: {
        buddyId: r.receipt!.buddyId,
        duplicate: r.receipt!.duplicate,
        guaranteed: r.receipt!.guaranteed,
        fragmentsGained: r.receipt!.duplicate ? 1 : 0,
      },
    };
  },
  sound: (cue) => sound.play(cue),
};
```

- 現在の初期設定では、全員所持のときの保証カウントは0に戻る（`allOwnedPity: "reset"`）。そのため、全員所持中は保証の表示をせず、「被りは突破素材」と表示する。
- 難度別の反復報酬は「調整中」の注記として出す。値が決まれば `repeatUnits`・`repeatUnitsPerTicket` を渡すだけでよい。
- `persistProgress` が `SaveConflictError` を投げた場合も、UIは理由と再試行を表示する。既存の `showSaveConflict` に回したい場合は、コールバックの中で処理してから投げ直す。

## 製品への接続箇所（主担当が編集する。こちらは編集していない）

1. **基地メニュー**：`src/client/playtest-app.ts` の `base()`。
   - `.pt-base-menu` に `<button id="pt-base-buddy"><strong>バディ</strong><span>編成・育成・招集</span><small>…</small></button>` を足す。
   - `bind("pt-base-buddy", buddy)` を足す。
2. **バディ画面**：`function buddy() { setScreen("buddy"); header("バディ", '<div class="pt-buddy"></div>'); mountBuddyMenu(ui.querySelector(".pt-buddy")!, buddyUiState(save.buddies ?? freshBuddyProgress()), actions); }`
   - `header()` の `eyebrow` に `screen === "buddy" ? "BUDDY"` を足す。
   - 枠は `.pt-screen` を使い、`.pt-buddy` に `flex: 1; min-height: 0`（`design/buddy-ui/preview.css` の2規則）を当てる。
   - 未選択の保存では、最初に初回選択が出る。
   - 画面を離れるときは `destroy()` を呼ぶ。
3. **出撃準備・出撃直前**：初回未選択のまま進撃へ入る場合の案内は、主担当の判断。UIは `starterChosen:false` で初回選択を出すだけ。
4. **戦闘HUD**：
   - `const skill = createBuddySkillButton({ onActivate: () => controls.activateBuddySkill(), sound: (c) => sound.play(c) })` を `#controls` に追加する。
   - 毎フレーム `skill.update({...})` を呼ぶ。
     - `remaining` は `max(0, entry.skillReadyAt - world.time)`。時刻の基準は `buddy-combat.ts` と同じものを使う。
     - `activeRemaining` は、効果の残り秒（任意）。
     - `unavailable` は、押せない理由（例：`entry.visible === false`）。
   - 同行なし・進撃以外では `update(null)` で隠す。
5. **操作配置**：
   - `src/client/layout.ts` の `CONTROL_IDS`・`LABELS`・`defaultLayout()` に `buddy` を足す。標準配置は `BUDDY_SKILL_PLACEMENT`（x0.92・y0.86・size 1）。
   - 足すと、既存の配置編集と `placeControls` で位置・大きさ・不透明度を扱える。
   - 既存の保存配置に `buddy` が無い場合は、`parseLayout` で標準配置を補う（`jump`・`pause` と同じ扱い）。
   - プレビューでは、この位置が既存の全ボタンと重ならないことを `resolveLayout` で確認した（844×390・640×360）。
6. **CSSの読み込み**：`buddy-ui.ts` が `buddy-ui.css` を import する。既存の共有CSSは変更不要。

## 確認結果（2026-11-05、Chrome／Playwright、開発サーバー上）

`node design/buddy-ui/tools/check.mjs`：844×390・640×360 × 動きの通常／軽減で、**144項目すべてOK**（`shots/report.txt`）。

- 16場面すべてで次を満たす。
  - 横スクロールなし。画面外のボタンなし。文字の横はみ出しなし。
  - 押せる場所は最小36px。
  - 画面内の欄にスクロールが残らない。
- 初回選択：選ぶまで確定できない。確定すると同行中になる。
- 同行の変更と解除ができる。
- 限界突破：成功するとLv上限が10→20になる。素材不足・上限未到達・最大突破では押せず、理由を表示する。
- 招集：
  - チケットが3→2になり、結果を表示する。結果を閉じると戻る。
  - 不足時は、ボタンに不足枚数を出し、入手方法を表示する。
  - 処理中は二重に送らない（送信1回）。
- 保存失敗：理由を表示し、同じ要求IDの再試行で成功する。
- 欠損：立ち絵が無い・読めない場合は紋章を出す。出現率が無い場合は招集を止める。
- 出撃中：同行変更を止め、理由を表示する。
- 動き：
  - 結果の登場は、通常では `bd-reveal`、動きを減らす設定では `none`。
  - 常時動き続けるアニメーションは0件。
- 音量0：再生要求は0件で、結果は表示される。通常時の要求は `menu,equip`。
- HUD：
  - 既存ボタン・上部HUD（88px）と重ならず、画面内に収まる（44px以上）。
  - 再使用待ちを、数字と読み上げ（「再使用まで12秒」）で示す。
  - 使用可能→押す→効果中・再使用待ち、の順に変わる。
- ページ例外は0件。
- 型検査は、`tsc -p tsconfig.json`・`tsc -p tsconfig.worker.json`・`tsc -p design/buddy-ui/tsconfig.json` のすべてでエラー0件。

### 未確認

- 実ゲームへの接続（このbranchでは接続していない）と、実データ・`applyBuddyAction` との結合
- 実スマホ、安全領域のある端末（プレビューは安全領域0で確認）
- 実際の音の聞こえ方（UIは既存の `Sound.play` のキーを渡すだけ）
- 戦闘中の負荷（実測していない。`update` は毎フレーム呼ぶ想定だが、DOMは輪の進み1%刻み・秒・状態が変わった時だけ書き換える）
- キーボードでの固有スキルの割り当て（主担当の `Controls` 側）

## 参考資料と利用

| 資料 | 使ったもの |
| --- | --- |
| Motion Reference（2026-10-11の調査ノート） | 「目的→動きの種類→短さ→落ち着く位置」の順で選んだ。<br>・結果の登場は「マスクによる出現」の原理（上から開く340ms、ease-out）。<br>・文字は短い遅れで上がる（260ms）。<br>コード・映像は転載していない（ノートの利用条件どおり） |
| Claude向けアニメーション見本帳（10/12） | 映像用の演出をUIに直接載せない、という切り分けだけ使った。採用した演出はない |
| NANKA DEKIRU（82件） | 照合した。閃光・色ずれ・ひびなどの戦闘系は、操作画面には採用しない判断 |
| Scrolltide・TakayuStudio資料 | 参照のみ。素材・コードの取得はしていない |
| 素材8選・Earshot | 音素材は追加していない。既存の `Sound` のキーだけ使う（menu・equip・unequip・warning・ready）。<br>Earshotは10/24時点の「検討依頼」の記録で、今回も生成・導入・アカウント作成はしていない |

新しい外部素材・フォント・音源は入れていない。立ち絵は採用GLBからの書き出しだけ。

## 仮置き・判断してほしいこと

- **スキル名**：未決。プレビューでは役割名（範囲攻撃・自己回復・防御・身体強化）を表示し、効果文は依頼正本の数値から作った。
- **呼び名**：画面の呼び名は「招集」「招集チケット」「突破素材」にした。「ガチャ」表記にするかは本人と主担当の判断。
- **属性の色と紋章**：火炎＝橙・炎、風＝緑・流線、氷結＝水色・結晶、電撃＝黄・稲妻。GLBの外観色からは推測していない。
- **初回選択の文言**：「あとから変更はできません」は初回の1体の選択についての文言。同行の変更はいつでもできる。
- **定数の export**：保証回数・チケット費用・初回報酬・反復の積算は、shared から定数として export すると、変換コードの二重持ちが無くなる。
- **HUDの配置**：固有スキルボタンを `layout.ts` に入れるかどうか。入れない場合、配置編集で動かせない。

## 共有記録への追記案（直接は編集していない）

### docs/STATE.md 先頭への追記案

```
# バディUI（2026-11-05、Claude Code、未統合）
branch `claude/buddy-ui-20261105`（基点 `210adf9`）。
- 内容：製品用の `src/client/buddy-ui.ts`・`.css` と、立ち絵4枚を追加した。プレビューと検査は `design/buddy-ui/`。
- 画面：初回選択、編成・育成・突破、招集（確率・保証・不足・処理中・結果・被り・保存失敗）、戦闘HUDの固有スキル。
- 確認：844×390・640×360 × 動きの通常／軽減で144項目合格。
- 未接続：playtest-app・layout・HUDへの接続は主担当（`design/buddy-ui/HANDOFF.md`）。
- 未確認：実スマホ、実データとの結合。
```

### MainVault（10_プロジェクト/swarm-front.md）への追記案

```
## バディUI（2026-11-05、Claude Code、未統合）
- branch claude/buddy-ui-20261105 の src/client/buddy-ui.ts・.css。プレビューは design/buddy-ui/、Designキャンバスは claude.ai の非公開ページ。
- 方針：既存の基地ヘッダーを継承。属性は紋章＋文字。抽選・保存はUIに持たず、主担当の値とコールバックを表示する。
- 動き：Motion Referenceの原理で、短いマスク出現だけを使う。音は既存SEのキーだけ。
- 次：主担当が applyBuddyAction・layout・HUD へ接続する。スキル名・呼び名・定数のexportが判断待ち。
```
