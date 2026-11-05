# FOUNDRY ZEROへ爆発武器が効かない不具合

2026-11-05。本人のST11・GL-6ホロウの画像付き指摘に対応。

[PR #284](https://github.com/futsalife24-bot/swarm-front/pull/284)でmain反映し、既存Workerへ公開済み。60ファイルの配信一致・health正常・公開起動2サイズを確認。[公開記録](RELEASE.md)。

正本 https://github.com/futsalife24-bot/swarm-front 。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a/task-survival-build`。branch `codex/foundry-explosion-damage-20261105`、base `01860895d3311ed3d5a7989182fd84bb19ad2701`。開始時clean、root/他worktreeの差分を保持。

## 原因と修正

通常型FOUNDRY ZEROは、敵定義の半径4×個体倍率2×描画/判定倍率1.5で当たり判定の半径が12m。弾はこの球の表面で着弾する一方、爆風は中心までの距離で判定していた。GL-6の爆風5m、ロケット6.5m、重ロケット11m、粘着弾4.2mのいずれも、表面への直撃を範囲外として除外していた。

`src/shared/game.ts` の通常爆風と連鎖爆風の2か所で、既存のHARROW用表面距離補正を `kind === "boss"` にも適用した。減衰は `max(0, 中心距離 - 当たり判定半径)` を使用。通常型と連結形態の主爆風を扱い、破壊済みの連結個体では生存部位なしの参照も安全に扱う。壁の遮蔽、その他の通常敵の距離式、武器威力/爆発半径/HP/報酬/保存形式は変更しない。

`server/testing.ts` は本番で参照されない既存foundry fixtureに、許可した4種の装備/配置を準備するオプションだけ追加。既存の連結炉fixtureは維持。テスト専用HTTP/WSを本番へ公開する変更はない。

## 検証

- 新規 `tests/foundry-weapons.test.ts` の13件は、有効な準備状態で修正前に全件失敗（直撃してもHP10500のまま）。修正後は13件とも成功。4種の実射、爆風減衰/範囲外/壁遮蔽、連鎖、連結頭部/破壊済み個体の安全性を確認した。
- `npx vitest run tests/foundry-weapons.test.ts tests/harrow-weapons.test.ts tests/enemies.test.ts tests/foundry-generation.test.ts` は117件すべて成功。HARROWの54件、既存の敵/連結部位/生成処理も維持。[前後の集計](unit-summary.json)。実行時のTEMP/TMPは今回のrepo内 `dist-validation/foundry-explosion/tmp` に限定。全件テストの成功とはしていない。
- 型チェック、Prettier、差分確認成功。
- `scripts/check-foundry-explosives.mjs` を実ローカルWorker8807とVite5186へ実行。844×390/640×360で4種、計8条件成功。権威サーバーのHPと、製品Rendererへ届いた結果を確認し、ページ例外0。[実測](browser-results.json)、[GL-6の90ダメージ](grenade-844.png)、[狭い横画面の重ロケット](heavy-640.png)。
- 両画面で通常型のHP10500から、ロケット10330（170）、重ロケット10070（430）、グレネード10410（90）、粘着弾10365（135）を確認した。標準武器での値であり、所持武器のレア/性能に関係なく同じ数値になるという意味ではない。
- 検証準備だけはfixture（ST11/WAVE2、訓練場の平坦地、通常型、装備、HP、照準）を使用。その後の射撃ボタン、Controls、WebSocket、弾道/爆風/ダメージ/HPの配信、製品描画は実コード。クライアントのWorld観測と照準設定だけをテスト用に露出し、弾/ダメージ処理や通信をモックにしていない。通常攻略や人の通しプレイの証拠ではない。
- 初回の検証器は波番号/連結初期化などの準備を補正した。実画面の初回は新規ユーザーの名前登録、次はPCモードで非表示の射撃ボタン参照で止まったため、隔離した名前とタッチ設定を用意して再実行。これらは製品のダメージ結果に含めず、最後の8条件だけを成功とした。
- 検証ブラウザーと自分のVite5186/Worker8807は終了し、待受0を確認。証拠のdocsへのコピーはVite停止後に実施した。既存のwatch/Hook/Rulesは変更なし。

## 公開の前提

本人がこの会話で「無料プランのまま」と確認済み。その回答を引き継ぎ、同じ確認を取り直さない。通常の継続承認に従い、必要検証・PR/main反映・既存Worker公開/配信確認まで進める。通常の独立Chat監査は2026-10-15の最新方針に従い自動追加しない。新規費用・契約/権限変更・新しい公開先は追加しない。

実装commit/通常PR/main反映、mainからのbuild/Worker dry-run・既存Worker公開・配信照合まで完了。実スマホ/PWA、実回線の協力、人のST11通し攻略は未確認。主担当の実モデルID/推論設定は未確認、子なし。
