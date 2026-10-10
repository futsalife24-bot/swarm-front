共有
あなたの発言:
menu-effects-audit-6dd4dbb(1).zip
ファイル
Swarm Frontの独立コード/UI監査をお願いします。実装担当とは別の監査として、添付ZIPを展開しchanges.patchと必要ソース・証拠を照合してください。
PR140: https://github.com/futsalife24-bot/swarm-front/pull/140
BASE: 800410d501fd5ac3610e19b6087976088cbca1d8
対象HEAD: 6dd4dbba336361c06cd7c8bdb51282bcae69581a
ZIP: menu-effects-audit-6dd4dbb.zip、SHA256 bc6bccc2246d2bcf5239f667ebb4d7a606df2968d8abcf729c86e4d628e33b31。297ファイルはGit archiveの対象blob、manifest付き。
範囲はタイトルからのメニュー12場面（docs/MENU-EFFECTS.md）。装備保存、作戦、協力ready、武器preview、アクセサリ作成/合成、育成、敵レポート、週間報酬、ガイド、設定、履歴、実音声playingに短い独自WAAPI/SVG/CSS演出を追加。既存UIと保存/通信を保ち、動きを減らす設定・DOM除去・非表示でcleanup。戦闘中の演出/音声素材/課金は対象外。
自己検証は型、関連31単体、武器一覧8表示、育成アクセサリ3サイズ、844x390通常/reduced実UI、実ローカルWorkerへの2人協力と週間受取、本番build/dry-run成功。実機タッチ/GPU長時間・全敵の見え方は未実測。資料外の秘密/認証/無関係素材は除外。使用モデルID/推論設定は未確認。
成功演出が失敗/キャンセル/未保存に出ないこと、非同期close/連続操作、情報制限、入力・可読性・横画面構成、reduced motionとcleanupを重点確認し、合格/要修正・対象SHA・必須P0/P1/P2（具体箇所と再現）・任意指摘・監査側の検証限界を確定回答してください。
…
展開
7m 14s考えました
ChatGPT の発言:
監査結果：要修正

対象HEAD: 6dd4dbba336361c06cd7c8bdb51282bcae69581a
BASE: 800410d501fd5ac3610e19b6087976088cbca1d8
必須: P0 0 / P1 0 / P2 1
任意: 2件

ZIP SHA256は指定の bc6b...33b31 と一致。SOURCE-MANIFEST.json の297ファイル全件でSHA256一致、changes.patch の変更30ファイルも、同梱HEADのGit blob SHAとpatch側new hashが全件一致しました。資料の取り違えは見当たりません。

必須 P2-01：改装版の装備演出だけ「保存成功後」になっていない

箇所: src/client/front-app.ts:438-463

改装版の出撃準備では、武器選択時に

ownedEquipment / kinds をメモリ上で変更
prep(coop) で再描画
直後に menuEquip() を実行

となっており、保存処理を一度も通っていません。

再現は、改装版の出撃準備で装備変更 → 成功演出を確認 → 出撃せずページ再読込、です。モジュール内だけの変更なので、保存済み装備へ戻ります。それでも変更時点では「保存成功」と同じ線・発光が出ます。

これは今回の明記条件である**「成功演出が未保存に出ないこと」**と、MENU-EFFECTS.md の「保存成功後」に反します。

対照的に、従来側 src/main.ts:738-748 は write(n) の成功後だけ、playtest側 src/client/playtest-app.ts:2027-2032 も commit() 成功後だけ menuEquip() を呼んでおり、こちらは正しいです。

最小修正: front-app 側も実保存成功を確認してから演出するか、この装備選択が仕様上あえて一時状態なら、保存成功を示す演出として扱わず別の単なる選択フィードバックへ分離するのが妥当です。

そのほかの重点確認

成功条件まわりは概ね堅いです。アクセサリは作成失敗・合成キャンセル・完成品0で粒子が出ず、育成も確定保存後のみ発光。週間報酬は実claim→再取得後、設定は保存成功後、敵レポートはreadyかつ協力シルエットでない場合だけ解析演出、音声は実playingイベント起点になっています。

cleanup基盤も menu-effects.ts:5-59 で、DOM切断・document非表示・reduced motion変更・96 animation上限をまとめて処理しています。武器previewの非同期closeも、previewWeapon()自身がdetached hostを検出してWebGLを破棄するため、閉じた後の遅延完了は問題なしと判定します。

844×390の証拠画像も確認し、装備、育成確認、協力ロビー、週間報酬について新規演出由来の横崩れ・入力遮蔽・主要文字の可読性低下は見当たりません。

任意指摘
check-menu-effects-network.mjs は協力ready/週間報酬について演出が一度出現したこと自体をassertしていません。最終的に消えたことは確認しています。出現→1回だけ→消滅まで検証すると証拠が強くなります。
prefers-reduced-motion は開始時のreduce/no-preference双方を確認済みですが、演出途中で設定を切り替えるケースと実visibilitychangeは証拠上の実動作確認がありません。実装上は停止処理があります。
検証限界

同梱環境にはnode_modulesがないため、こちらでは型チェック・31単体・Playwrightを再実行していません。また、型/31単体の個別ログ自体は証拠フォルダに含まれておらず、文書上の成功報告として確認しています。build/dry-runログ、通常/reducedの実UI結果JSON、実Worker通信結果、各PNGは直接照合済みです。実機タッチ、GPU長時間、全敵モデルは申告どおり未検証です。

結論として、P2-01を直せば、今回確認した範囲ではP0/P1の阻害要因はありません。

ChatGPT は間違えることがあります。重要な情報は確認してください。
最新の応答




高