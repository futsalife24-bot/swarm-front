# 洞窟とHARROWの出現契約の静的調査（2026-10-07）

既存の`maps.test.ts`失敗は、**通常編成とテスト対象の不整合**に分類する。テストは全敵種を洞窟へ直接生成するが、採用済みの洞窟ST10・ST16にはHARROWがなく、HARROWの出現先は草原ST20・ST25・15-Aである。通常操作から洞窟HARROWを生成する経路は、下記の呼出元・保存復帰の追跡では見つからなかった。製品で再現した不具合とは扱わない。

一方、低水準`spawn`はこの組合せを拒否しない。直接呼出しや編集された中断保存まで安全な組合せに制限する契約は未定義であり、「全入力で製品不具合なし」「合法な洞窟編成が全件成功」とは結論しない。

## 対象と証拠

- 正本: https://github.com/futsalife24-bot/swarm-front 。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
- 対象main/base: `1c2f4ba44348ab95558ca0362f4f50a561e900d0`。開始時にローカルmain・origin/main・GitHub mainの一致とcleanを確認。branch: `codex/cave-spawn-contract-20261007`。
- 既存結果: [5ファイル分類](https://github.com/futsalife24-bot/swarm-front/blob/6b1ceac5d636168162f643d4e151b6a7de8d4664/docs/UNIT-BASELINE-INVESTIGATION.md)、同commitの`docs/evidence/unit-baseline-20261007/result.json`。Windowsでの前回1回の実行はmaps 5成功・1失敗。今回の実行結果ではない。
- [失敗箇所の抽出](evidence/cave-spawn-contract-20261007/reused-maps-failure.json)と[参照ファイルのGit blob/SHA256一覧](evidence/cave-spawn-contract-20261007/manifest.json)。抽出元のSHA256も記録し、原本は既存branchに保持する。
- 今回はソース・採用記録・Git履歴の静的調査のみ。maps/全件単体/ST20/ST25・合法fixture・UI・Worker・buildを実行していない。製品、テスト、期待値、数値、設定、CI、Hooksに変更なし。モデルID・推論設定は未確認。
- 直前のpilot修正・ST20確認は別branch `codex/pilot-input-fix-20261007` / `69faf845c64542038782c0f28207310052e3b38d` に保存済みで保護。本branchへ取り込まない。

## 失敗を説明する順序

1. `tests/maps.test.ts:71–108`は草原・雪峡・洞窟を対象に、床の接続確認後、各マップに最初に対応するSTを選ぶ。洞窟はST10。seed 1〜30で`Object.keys(ENEMIES)`を回し、編成に関係なく`spawn(w, kind)`を呼ぶ。敵種の先頭は`defs.ts:322`のHARROWである。
2. `game.ts:662–751`の`spawn`は、HARROWでも半径3.4・cruise 0を用いて洞窟ノードを選ぶ。初期高度は`supportHeight + cruise`。この後、HARROWに限り`HARROW.flightHeight`を加算する。最終高度での天井再検査や、この敵・マップの組合せを拒否する分岐はない。
3. `defs.ts:320`と`harrow.ts:47`から加算高度は`11.5 × 3 = 34.5`。`cave.ts:68–79`の天井上限は`2 + 6.8 × 1.25 = 10.5`。洞窟の支持面は非負なので、テストが比較する高度＋半径は少なくとも`34.5 + 3.4 = 37.9`となり、天井を超える。ノードや乱数に依存しない。
4. `game.ts:483–502`の`blocked`は地形判定後に`caveBlocked`を使用するため、上記の個体についてfalseを返せない。既存ログの103行目「trueをfalseと期待」と整合する。

既存ログにseed/kindの実測値はない。**最初の失敗がseed 1のHARROWという特定は、列挙順と上記不等式からの静的な推論**である。今回の再現実行として記録しない。HARROWより後の敵種・後続seedは当該試験で到達しておらず、安全性は未確認。

支持面を0とは仮定しない。旧[洞窟導入記録](UNDERGROUND-NEST.md)の「水平な床」は当時の説明で、現行`stages.ts:109`は洞窟にも`registerTerrain`を呼び、`terrain.ts:25–105`はindex 5の非負の地形を登録する。今回はその地形仕様の良否を調査・変更する範囲ではない。また、比較している半径3.4は既存テストの引数であり、実モデル全体の大きさや個体差を検証した値ではない。

## 通常生成と復帰の呼出経路

以下の行番号は対象mainのもの。敵の認識・描画分岐にHARROWがあることと、そこで生成されることを区別した。

| 経路 | 参照箇所と通常の生成条件 | 洞窟HARROWの到達性 |
| --- | --- | --- |
| 通常協力・共通戦闘 | `server/worker.ts:1320–1326,1573–1580`で有効なST番号からworld作成。`game.ts:765–790,1642–1667`で`stageFor`のbossesと`troopAt`を使用 | `stages.ts:256–265,316–324`の洞窟ST10/16は雑魚5種とworm。HARROWなし。戦闘中のST変更は拒否 |
| ソロ・分岐 | `playtest-app.ts:194–205`→`campaignNumber`→`initSolo`→`solo-progression.ts:91–115`。`stages.ts:470–487`で通常編成または15-Aへ解決 | HARROWはST20/ST25（map 3）と15-A（map 3）。保存ID27の15-Aを洞窟と取り違えない |
| 中断保存 | `battle-checkpoint.ts:96`で`stageFor`の編成全体を固定。復帰時は同ファイル154–168。v1は`legacy-campaign.ts:839`で旧編成を復元。`playtest-app.ts:215`は復帰worldをそのまま使用 | 現行の合法編成を洞窟＋HARROWへ変換しない。旧ST10/16もwormで、旧編成全体にHARROWなし。HARROW移行処理は攻撃状態の変換であり、編成やマップを変更しない |
| 協力の保存復帰 | `server/worker.ts:923–932`で自身が保存したworldを復帰し、未休止の戦闘は中断として退避。新規出撃では改めてworld生成 | 通常生成にない敵・地形の組合せを復帰時に追加する処理なし |
| 連結炉の増援 | `foundry-spawning.ts:26–37,89–127`。未確定のkindsを`mapFor(w).foundryAllowed`から選ぶ。`stages.ts:445–461`は同マップの通常雑魚編成の和集合から構築 | `TroopKind`にHARROWなし。洞窟の許可種もcrawler/ant/spider/spitter/hornet。生成済みの合法キューにもHARROWは入らない |
| 防衛 | `daily-defense.ts:12–49`はST先頭waveの雑魚だけを使用。`stages.ts:489–501,519`は専用DEFENSE_MAPSを選択 | ボス配列を生成に使わず、CAVE_BLOCKSでもない |
| 改装版・旧改装版 | `front-run.ts:178–183,443–475,514`、`front-legacy-run.ts:148–153,337–368,406`。ST1または日替わりST1〜3、専用防衛地形。雑魚crawler/spitter/hornet、ボスcrown | 洞窟・HARROWとも生成対象外 |
| 再構築試作・訓練 | `rebuild-run.ts:37,94,206,304–328`はST1、同3雑魚とcrown。`training.ts:26`はcrawler | 洞窟HARROWを生成しない |
| 開発用の直接生成 | `server/testing.ts:117`等はHARROWを直接生成可能。入口は`wrangler.test.jsonc:3` | 本番`wrangler.production.jsonc:4`と通常`wrangler.jsonc:3`の入口は`server/worker.ts`。テスト専用fixtureを通常製品経路と扱わない |

`src`と`server`の`spawn`呼出し・importを検索し、上記の生成元を追跡した。任意の外部コード、将来の編成、全履歴の保存データを網羅する証明ではない。

## 残る契約と最小修正案（未実施）

`spawn`の型は敵kindとworldを独立して受け取るため、テストや手動コードで洞窟HARROWを要求できる。`battle-checkpoint.ts:35–75`の`validPlan`も有効なmap番号とboss名を個別検査するだけで、組合せまでは制限しない。チェックサムは改変防止ではなく破損検出であると明記されている。既に保存された`foundrySpawns[].kinds`も生成時の許可リストへ再照合しない。したがって、**編集した保存・構築したworldまで拒否できるという保証はない**。通常保存がこの組合せを自ら生成する経路は今回見つからず、この限界を通常プレイの再現不具合と混同しない。

最小対応は`tests/maps.test.ts`のfixtureを、採用済み編成の出現安全性と未対応の直接生成に分けること。単にHARROWだけをskipしたり天井の期待値を緩めたりしない。

- マップごとに許可された雑魚・ボス形態・連結炉の増援を明示し、実際の編成がその表から漏れたら失敗させる。元の30 seed、床の接続、最終出現位置の衝突検査を維持する。現行は`boss`を既定crownで呼ぶため、洞窟の実編成worm形態の出現確認も必要。編成から機械的に削除した敵をテストも無条件で追認する構成にはしない。
- `spawn`へ未対応の組合せを渡す場合の「拒否・例外・呼出側の責任」は未定義のまま別に明記する。拒否を実装する場合は、`spawn`が必ず個体を追加すると考える`beginWave`等と、中断保存互換への影響を先に設計する。今回その方針を新仕様として決定しない。
- テストfixtureだけを直す最小案の影響は`tests/maps.test.ts`と対応する検証記録。HARROWの飛行高・洞窟の天井・敵性能・製品保存は変更しない。実装後に合法な全対象を確認する必要があり、今回の静的調査でその検証を代替しない。

不等式と生成経路で今回の分類は可能であり、追加の合法fixtureを1条件実行しても全合法編成の安全性は証明できないため実行しなかった。同じ失敗テストの再試行も不要。依頼された有限調査は記録・自己レビュー・commit/pushまでで完了し、UI・独立Chat・PR・main反映・公開は今回の範囲外。次の修正案は提案であり、この記録から自動で実装・再実行を開始しない。
