# 2026-09-10 走り方向・武器切替短縮

- 走りの判定・位相を描画位置の移動距離から計算。権威更新の間に距離0となり、RunとIdleが交互に現れる問題を修正。
- 腰と脚を移動方向に回し、上半身は照準方向を維持。後退は脚の運びを反転し、腰の180度ねじれを避ける。元Runクリップの接地足が前へ流れる再生方向を補正し、接地中は後ろへ、浮いた足は前へ運ぶ。
- 武器切替中の移動も下半身Runを合成。
- 切替1秒→0.5秒。GLBの1秒クリップを2倍速で最後まで再生し、格納0.225秒・取り出し0.3秒・射撃再開0.5秒を共有時間に同期。回避中の一時停止・復帰0.08秒は維持。

## 検証

- 型チェック、175単体テスト、production build、Worker dry-run成功。
- 5方向（前・右・後・左・斜め）の実GLBで左右の足が進行方向に交互に先行し、接地足が後方へ動くことを数値確認。前・横移動のPNGを目視確認。
- Chrome 1280×720 / 844×390で移動、2武器射撃、往復切替、回避・復帰成功。
- 実ローカルWorkerと独立2画面で切替中射撃制限、Heavy被弾、回避無傷、双方のモデル描画・状態同期を確認。
- 500KB超の既存bundle警告あり。実機の操作感・インターネット経由の協力操作は未確認。
- 通常sandboxのWranglerログ/親ディレクトリ・外部fetch制限は、承認済みの権限付き実行で検証。

## 監査・公開

- branch: `codex/home-armory`。base/head: `2be699f160c83d641fb68bb1304e4da8059920dc`（commitなし、既存の未コミット・未追跡変更あり）。
- 今回の実装差分: `src/client/standard-trooper.ts`、`src/client/render.ts`、`src/shared/defs.ts`。対応テスト・更新履歴を更新。
- 再実行用: `scripts/check-trooper-motion{,-game,-network,-published}.mjs`。
- 今回着手時との差分・変更前後SHA256・JSON・PNG: `dist-validation/trooper-motion/`。`task.patch`は既存の変更を含むHEAD差分とは別。
- 既存Worker公開Version: `8512e285-8b74-45bf-bf24-26fc09dbadd9`。直前: `aa1a33b7-2ec9-48d6-bd24-1ad723b7524b`。
- 公開JS: `/assets/index-BOrzYyyP.js`。
- 公開検証成功: 配信JS・4 GLBのSHA256がローカルと一致。PC/横画面で射撃・切替中の射撃待ち・再開・回避、API health 200/ok:true、開発診断非公開を確認。証拠は `published-validation.json`。
