# 全7形態の攻撃予備動作強化 — 2026-09-14

ユーザー指定: 全モンスターのためを強くし、PRISMは浮遊板を個別に縦回転させる。

- `enemy-windup-clip.ts`: 現行Lungeを60fpsで再サンプルし、予備動作だけを種別ごとに強調。PLEATは0.13m、VOLLEYは0.18m、LEAPERは0.20mの追加沈み込みと外装/背板/リングの構え。既存の足先目標をIKで保つ。PRISMは8枚が僅かに時差を持って各自一回縦回転し、板間を広げて戻る。RAYはひれを更に折り、尾を引き上げる。通常FOUNDRYはクレーンを振りかぶる。
- `hound-motion.ts`: 同じ生成クリップを既存GPUパレットへ取り込み、戦闘とレポートで共有。
- `foundry-worm.ts`: 連結炉は頭部6発射器の開きと全8レーザーの持ち上げ。発射時は既存位置・方向へ復帰。中断時はリセット。
- shared/server、攻撃時刻・ダメージ・射程・弾生成、既存待機クリップ・会敵待機MP4は変更なし。

branch `codex/home-armory` / base=head `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存の未コミット/未追跡変更を保持。commit/mergeなし。

## 検証

`dist-validation/enemy-windup/` に変更前2ファイル、全6スキン数値比較、旧/新の予備動作30/65/90%画像、連結炉の比較を保存。
- 6スキン: 攻撃時点以後の位置/姿勢は旧版と最大3e-7相当、足先差は最大2.1e-7m。地面の最低点が旧版より下がらないことを検査。PRISM各板の角度移動は6.28rad以上（一周）。形状数値は全種有限。
- 連結炉: 全8レーザー構え0.52rad、6発射器0.51rad。発射方向差0、原点差8.5e-7m未満。World不変・中断復帰確認。
- 既存関連36テスト成功（structure-motion / enemy-report-motion / foundry-movement）。
- LEAPER追加沈み込み0.28mは脚メッシュが地面に触れたため0.20mへ調整し、再検査成功。

変更差分は `changes.patch`、数値は `numeric.json` / `worm-numeric.json`、画面操作は `local-release.json` / `published-release.json`。
型チェック、通常build、Pages build成功（既存の500KB bundle警告）。ローカル844×390 / 1280×720の全7形態の攻撃再生・モード切替・閉じる/再開成功、ブラウザ例外なし。

Worker production dry-run成功。既存Workerへの公開成功: Version 902658d5-da39-4671-98a3-43774aacd708。公開先 https://swarm-front.melosalife-24.workers.dev/?developer=1 。
公開版も全7形態×2寸法の攻撃再生・切替・閉じる/再開成功。11配信ファイルSHA256がローカルdistと一致、/api/health成功、ブラウザ例外なし。
