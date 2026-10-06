# 強化追加と全モード共通の戦闘演出の公開記録

2026-10-06、強化3種・融合3種を追加し、通常22種／融合9種に拡張。射撃・弾道・ロケットの見やすさを旧攻略を含む全モードの共通処理へ反映し、地雷は登場する全成長規則で共通描画する。既存HUD・画面配置・導線は維持。[能力・融合元・上限](FRONT-EXPANSION-EFFECTS.md)。

- 公開先: https://swarm-front.melosalife-24.workers.dev/front （従来攻略は `/`）
- 通常統合したPR135: https://github.com/futsalife24-bot/swarm-front/pull/135
- base: `8380074d13c0d2cc3274d4cdf5c98636293b7e6b`
- 監査対象: `f723189e24225a364e6a7ba33d9a2f5c962ff25a`
- 最終ソース修正: `649190a1072ae94f3b4f47c622bdd5d6e47a209f`
- 公開ソース: `e1ee7c0eea0e2e20c56b779460a15698077fb178`
- Worker Version: `7d1cd91a-2df6-4510-9f1c-b508b737a7cd`
- 既存Worker／既存Free契約。10月6日11時27分ごろFree・$0・当日307/100000リクエストを画面確認済み。課金やサービス追加はない。

独立監査は[通常Chat](https://chatgpt.com/c/6ac47ab9-bbf4-83ee-8430-73d8485b6083)へ対象ZIPを添付。初回P2は候補保存の旧上限19の残存1件。カタログ件数から上限を導く修正と20/21/22種類の保存境界・実画面22種保存の検証を追加し、再監査は必須・任意とも残存0、確定合格。[初回](evidence/front-expansion-20261006/audit-first.md)／[確定回答](evidence/front-expansion-20261006/audit-final.md)。監査対象以後のPR変更はSTATE・監査回答・資料受領記録だけで、実装は不変。通常merge、保護の迂回なし。

型、強化73、既存戦闘143、保存147、実通信6＋ロビー復帰1、横640/844、実2人協力、従来モードの射撃・武器切替、32地雷と5系統の弾描画、全22種の実画面保存・再読込を確認。最終ソース649190aで保存ブラウザ4系統成功、186ソースハッシュ一致。本番ビルドと既存Worker設定dry-runを統合mainから再実行して成功。[詳細検証](evidence/front-expansion-20261006/checks.md)。

公開health200・配信48/48ファイルのSHA256一致。[配信証拠](evidence/front-expansion-20261006/delivery.json)。アプリ内ブラウザで公開版を再読込し、基地に新3種と攻略1/3/5の解放条件が表示されること、出撃準備→初期三択→残像地雷選択→戦闘HUDと1/6枠を確認。公開先のconsole errorは0。PCで非表示のタッチ視点領域へ回避キーを送る試行は操作対象不一致となり、公開実戦での回避・地雷発生は未確認。確認用出撃は無操作のため17秒で終了し、タイトルへ戻した。地雷・弾の描画証拠はローカルGPU検証、公開配信の一致であり、公開実戦での発生確認と混同しない。

実機タッチ、モバイル実端末FPS、60分連続負荷、人による全ビルドの体感バランスは未確認。弾と発光の共用24枠は射撃演出のための予約枠で、最大180枠飽和時の全弾表示を保証しない。

使用モデルID・推論設定: 未確認。ローカル: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。開発ブランチ `codex/fusion-expansion-effects`、公開記録 `codex/expansion-effects-release-record`。
