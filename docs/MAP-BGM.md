# 出撃マップ6曲のBGM（2026-09-26）

作業場所: `../share-image-fix`（正規 `game/` と同じGitHubリポジトリの既存worktree）。
GitHub: https://github.com/futsalife24-bot/swarm-front 。branch `codex/map-bgm-suno`。
base `782543709a7479fdeabd9114df48d47bc95a3f1d`。元 `game/` の別作業差分は保護。

## 曲と制作記録

| マップ | Sunoタイトルの曲名 | 再生時間 |
| --- | --- | --- |
| 灰明の街区 | 灰色の前線 | 3:04 |
| 薄暮の倉庫地区 | 交差する射線 | 1:34 |
| 蒼鉄の工業区 | 蒼鉄圧力 | 3:04 |
| 風渡る草原 | 風を裂く進軍 | 2:26 |
| 白嶺の雪峡 | 凍てつく戦線 | 2:20 |
| 晶脈の地底巣 | 晶脈の鼓動 | 2:45 |

全曲のSunoタイトルは `スワフロ：マップ名「曲名」`。街区・倉庫・工業区は既存の未実装候補を採用し、草原・雪峡・地底巣は今回スタイルを制作してv6で各1回生成（各2候補）。歌詞欄は空。
草原は弦と開放的な音色、雪峡は冷たいプラックと低弦、地底巣は低い脈動と結晶的な打鍵音で区別。短い反復モチーフと控えめな中高域、効果音を含めない指定でSEのための空間を確保する方針。
生成クレジットは2310→2280、3回・30使用。既存Proのダウンロード枠17から6曲を解除。追加購入・プラン変更なし。

入力スタイル、除外指定、曲URL、候補ID、SHA256、実測値は [MAP-BGM-SOURCES.json](MAP-BGM-SOURCES.json)。新規曲のstyleは送信した原文で、Sunoが表示する自動整理後の説明文とは区別する。MP3原本を無加工で `public/assets/audio/bgm-v1/map-0.mp3` ～ `map-5.mp3` に保存。取得時の一時ファイル名から、埋込のSuno原曲URLを照合して取り込んだ。元のダウンロードファイルは変更・削除しない。

## 実装

コピー用のタイトル・スタイル全文は [MAP-BGM-PROMPTS.md](MAP-BGM-PROMPTS.md)。

`src/client/bgm.ts` の `musicForBattle` が `stageFor(world).map` から曲を選ぶ。ソロ・協力それぞれの画面切替から実際のworldを渡し、保存済みcampaignPlan・高台ルート・日替わり防衛も同じ地図の曲を使う。訓練、world不在、不明なmapは無音。
既存のAudio要素1個で再生し、同曲の再描画では先頭へ戻さない。音量は既存設定の0.55倍、非表示時停止・操作での再生許可・クリア曲から勝利曲・敗北時停止を維持。全曲全長リピートで、サンプル単位のシームレス編集はしていない。戦闘ルール・通信契約・保存形式・メニュー表示の変更なし。

## 自己検証

- client/Worker型チェック成功。
- `npx vitest run tests/bgm.test.ts tests/audio.test.ts`: 26件成功。6マップのソロ/協力選択、25面と分岐、高台、保存済みplan優先、訓練/無効値/敗北、既存SEの回帰。
- `node scripts/check-map-bgm-assets.mjs ../pv/edit/ffmpeg.exe`: 6原曲URL照合、全曲の最後までデコード、非無音・ピーク0dB未満を確認。平均-17.9～-16.5dB、ピーク-4.3～-3.2dB。証拠 [assets.json](evidence/map-bgm/assets.json)。
- 実iabの [音楽制御fixture](../scripts/map-bgm-preview.html): 6曲再生、1要素、ループ指定、同曲継続、ミュート復帰、レポート復帰、クリア完走後勝利、敗北/訓練停止、ロビー→戦闘に成功。worldだけfixtureで実音源・実Audio・実BGM制御を使用。[結果](evidence/map-bgm/browser-controls.json)。
- 実ソロUIでST1へ出撃、街区曲を28秒以上再生、loop=true、音声エラーなし、console errorなし。[証拠](evidence/map-bgm/solo-battle.json)。
- 実ローカルWorker `127.0.0.1:8797` / WebSocketの協力UI（1クライアント）でロビー曲→ST1街区曲・敗北停止を確認、音声/consoleエラーなし。[証拠](evidence/map-bgm/coop-battle.json)。マップ変更操作はST1のままだったため他マップの実協力出撃は未確認。
- production build / 既存本番設定のWorker dry-run成功。既存の500kBチャンク警告あり。dry-run初回はサンドボックスのログ/読込制約で失敗し、権限付き通常実行で成功。
- Judgeはこのworktreeに入口がなく未判定、API呼び出しなし。Codexの実行モデルID/effortは取得できず未確認、切替なし。Sunoのモデル表示はv6。

主観的な全曲試聴、実スマホの音量挙動、多人数長時間、曲末のつながりの聴感評価は未確認。ファイルを解析していない箇所を試聴済みとは扱わない。

## 公開状態

監査中にmainが `3d69619270963f25597faa69df20ab95edc0f7e7` へ更新（PR88の保存テスト・文書のみ）。通常merge `3ee55ac3f670944eea7d81456059ac4bfb703f45` で取り込み、STATEの競合は両記録を保持。統合時点のsrc/server/publicのtreeは初回監査対象と完全一致、型/関連26件を再確認。

### 初回監査F1の修正

回収中の一時停止→操作ボタン配置→復帰で `battleUI()` が戦闘BGMを選び、その後screen/DOMだけ回収へ戻す経路を修正。`battleUI(next)` に復帰先を渡し、回収曲→勝利曲の既存ガードを通したまま回収画面へ直接復帰する。画面・保存・戦闘ルールの仕様変更なし。

`tests/bgm-layout-return.test.ts` は実ソースのbattleUI/pause関数と配置復帰callbackを抽出して隔離Node VMで実行（DOM等はスタブ）。BGMクラスを代用しての実音声試験ではなく、誤った中間画面を選ばない境界テスト。初回ソース66fb41dでは回収ケースが失敗、修正版では2件とも成功。関連合計28件、型/対象TS書式も成功。ブラウザfixtureにもclear再生中と勝利曲移行後のlayout→collection継続確認を追加。

実iabの新しいローカルorigin `127.0.0.1:5378` で6曲と全切替が成功し、追加2条件の曲・時間継続を確認。[修正後結果](evidence/map-bgm/browser-controls-f1.json)。旧origin5376では追加項目のない旧モジュールが読み込まれたため、その結果を修正版の証拠には採用しない。実ゲームで勝利までプレイして配置画面へ往復する全行程は未再実行。

実装 `66fb41d0b7e1bb7805553bcaebe618b210d5b8de` を [PR89](https://github.com/futsalife24-bot/swarm-front/pull/89) へpush。
[通常Chat独立監査](https://chatgpt.com/c/6ab739e8-5018-83e9-a65f-ca0fff0ed08e) に、39,468,215 bytesの `dist-validation/map-bgm/map-bgm-audit-66fb41d.zip` を添付・送信して監査開始を確認。ZIP SHA256 `a7b17f719bfe225f7915cbf0ee2cc72aa8281d3ed77f990c6ebd8e7231b08a45`。画面のモデル表示はPro（詳細IDは未確認）。独立結果→必要修正→main反映→既存Worker公開へ続ける。
