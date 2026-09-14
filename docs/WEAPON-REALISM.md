# 全武器の実物写真ベース外観刷新 — 2026-09-14

対象は通常版3系統と試遊版3系統×5レア度。別名realism-v2のGLBに切り替え、旧資産を保持。

## 外観の参照

- ライフル: 旧型FN SCAR 16S。[参照写真の掲載ページ](https://goodlandguns.com/fn-scar-16s-556-nato-16-30-1-fde/)。折り畳み銃床、チークレスト、上下機関部、曲がった弾倉、側面スロット、上部レール、照準器を目視参照。現行メーカー頁は新世代型なので、その形状と混同しない。
- 散弾銃: [Mossberg 590A1 20-inch SpeedFeed写真](https://www.midwayusa.com/product/1020325520)。段付き固定銃床、ポンプのリブ、平行な銃身と管状弾倉、ゴーストリングを目視参照。
- ロケット枠: [Saab AT4メーカー写真](https://www.saab.com/globalassets/event/aeroindia/at4---combat-proven-future-ready.pdf)。複合材の筒、端部保護リング、照準器、肩当て、塗装表示を目視参照。

写真は参照のみ。テクスチャへの転用や製品ロゴの複製なし。写真からの外観再構成であり寸法計測済みの工業的複製ではない。既存兵士の手元原点・前方向を維持し、全長とグリップをゲームへ適合。AT4の単発構造と異なるゲームの装弾数・装填動作は既存仕様を保持。レア度差は小さな識別インレイの5色。実物にない発光ブロックを追加しない。

## 実装と証拠

- scripts/build-realistic-weapons.py: Blender 5.2.1で外観メッシュと15GLB生成。編集元はassets/blender/source/weapon-realism-v2/の3blend。
- src/client/standard-trooper.ts: 通常装備も新しいN外観へ。
- src/client/progression-weapons.ts / weapon-sharing.ts: 手持ち・詳細プレビュー・共有画像をrealism-v2へ。
- public/assets/weapons/realism-v2/manifest.json: 全15件の三角形数、境界、ファイルサイズ。
- dist-validation/weapon-realism/: 着手前3ファイル、今回だけのchanges.patch、hashes.json、写真、15外観一覧、3系統手持ち画像、motion.json、配布/公開検証。

branch codex/home-armory、開始base/head 4186f25f7c9695f95ea897ad182db5f85fac3091、未コミット。既存の多数の差分を保護。今回のコード差分は読み込みパス3箇所、生成・検証スクリプト、別名の新規資産、記録。commit/mergeなし。

## 検証

型検査、通常/Pagesビルド、公開設定Worker dry-run成功。既存の500KBチャンク警告あり。兵士・描画の関連9テスト成功。全15プレビューと共有PNG生成成功、全15手持ちとLv0/Lv5/旧仕様の持ち替えタイミング成功。写真・外観一覧・手持ち3系統を目視確認。実スマホでの外観・継続性能は未確認。

公開承認は本タスク中のユーザー「公開版にしてリンク教えて。友達に触ってもらうから。」。管理画面でWorkers Free/$0が現在のプランと確認、アカウント一覧の9/1〜9/14は175リクエスト/CPU143ms。契約変更なし。APIの契約参照403を成功扱いせず管理画面で代替。

## 公開

固定Workerへ公開済み。Version `b447f835-344b-4c6a-80ab-ab53fc17e735`。
友人向け試遊リンク: https://swarm-front.melosalife-24.workers.dev/?playtest=1
通常入口も新しい基本3モデルを使用。試遊版はソロの育成・報酬ループ。既存の協力へ戻る経路では旧成長仕様を使用する。
配布版では26ファイル一致、844×390 / 1280×720でタッチ出撃・射撃・切替・一時停止、描画例外0を確認。検証スクリプトのポインターロック干渉、HUD反映待ち、初遭遇紹介のスキップ競合を修正して成功した実行のみ採用。製品UIの修正は不要だった。
公開後検証も成功: 26配信ファイルのSHA256一致、844×390 / 1280×720で出撃/射撃/切替/停止、pageerror 0、api/health 200/ok。証拠: dist-validation/weapon-realism/published.json と published-*.png。
