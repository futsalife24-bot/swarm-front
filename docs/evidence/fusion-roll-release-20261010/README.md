# 融合開示・回避動作の公開記録

- PR: https://github.com/futsalife24-bot/swarm-front/pull/159 （通常merge）
- 公開ソース/merge: `c6c1408037ec73c09d369380c218be50c431e419`
- Worker Version: `4b27773e-518f-4faf-bd28-89e07e647307`
- 公開先: https://swarm-front.melosalife-24.workers.dev/front （従来版 `/` 維持）
- 独立監査: https://chatgpt.com/c/6aca4ac8-6c54-83e8-91d7-519c052e15c9
- 対象: `19b18fbb8391e2ebf59b34fc1b5b946177f4963f`、必須P0/P1/P2各0・合格。全文はaudit-final.txt。合格後はSTATEの記録だけを追加、実装追加修正なし。

merge本文に日本語Player-Note保持。cleanなmainを既存main worktreeで通常fast-forwardし、この作業場所も同じmerge HEADへdetached checkoutして本番build・wrangler.production.jsonc dry-runを実行。その成果を既存Workerへdeploy。新規契約・公開先・権限変更なし。

## 配信確認

delivery.json: HTML、SW、JS/CSS、新11音声等37/37ファイルのローカル/公開SHA256一致。health HTTP200/ok:true。再現は既存 `docs/evidence/young-soldier-release-20261010/delivery.mjs` のDELIVERY_OUTPUTで出力先指定。

public-ui/ui-results.json: Windows Chrome、844×390/640×360、no-preference/reduceの4条件が成功。隔離プロフィールで公開版の未発見基地→実ソロ開幕選択→一時停止→既知発見fixtureで基地表示を確認。既知fixtureはその隔離localStorageだけへ設定、本人の保存や本番データを操作しない。各条件console/page error0。640×360の一時停止実画像も確認し、9件の融合と共通条件文・操作を枠内に表示。

```powershell
$env:FUSION_ORIGIN='https://swarm-front.melosalife-24.workers.dev'
$env:FUSION_PUBLIC='1'
$env:FUSION_OUTPUT='dist-validation/fusion-roll/public-ui'
node scripts/check-fusion-discovery.mjs
```

回避モーションの比較動画/骨盤角速度/authority不変は先行 `../fusion-roll-20261010/roll/` の固定fixtureで確認。今回の公開確認で人の自然さ最終採否・実機スマホ・長時間GPUを確認したとは扱わない。監査側のWindows再実行・動画全フレーム評価も未実施。別件のClaude共同調査はこの監査の対象外。
