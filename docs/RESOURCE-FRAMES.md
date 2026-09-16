# 消費アイテムの共通表示枠（2026-09-16）

コイン（金・硬貨）、武装片（青・破片）、解放素材（紫・結晶）、育成ポイント（緑・昇格印）に共通resourceFrameを導入。アイコン・名前・用途（所持/獲得/消費/使用）・桁区切り数量を同時に表示する。色だけに依存しない。基地/武器庫/育成/アクセサリの所持一覧、出撃報酬、報酬選択/戦果、初回報酬、解体確認/作成費/解放費/再配分費と協力側武器庫へ適用。説明文章・エラーメッセージ・ネイティブselectの選択肢は平文を保持。保存形式と経済計算は変更なし。

自己検証: typecheck成功。既存武器UI基準4幅（1280/915/844/640）成功。scripts/check-resource-frames.mjsで667/844/1280×390、9画面ずつ27枚、9桁の所持数、画面/枠の横溢れなし、作成で武装片10減少、解放で素材1減少、初回報酬の3種表示、pageerror 0を確認。667戦果/育成、844アクセサリ画像目視済み。検証scriptは先にcheck-gear-ui-baseline.mjsでfixture生成しlocalhost:5347のdevを使用。実スマホ・協力側旧武器庫の実画面は未確認。

base b5ac63110c0402812332566e27552cb74a8686c2、branch codex/resource-frames。証拠 dist-validation/resource-frames/ と dist-validation/gear-pinned/。独立監査・main反映・公開準備中。

## 独立監査

対象9c58d9708082f6e668cdf50d492b46411fe8f3bc。[PR #26](https://github.com/futsalife24-bot/swarm-front/pull/26)、[監査Chat](https://chatgpt.com/c/6aaa76b1-ed38-83ee-91f2-5b37a03ab2a0)にresource-frames-audit.zip（約4.5MB）を送信済み。commit後の通常/Pages build・production dry-run成功。

再監査対象081e20f5080254bb37ebc475d5d41edbd30a651aは合格・必須指摘なし。初回指摘（旧/協力武器庫の分解成功通知の平文）を共通枠へ修正。再監査でGitHub実差分一致を確認。任意の育成ポイント分母は所持枠重複/横幅を避け維持。監査環境で依存取得できずbuild等再実行なし。追加成功通知の実画像は未確認、前回27画面と共通renderer/DOM限定を根拠に合格。
