# 支援報酬とCATENAの統合通信容量

- 基点: `4ef29043f151dde537845046a670771e3e1edd33`。製品コード・fixtureは変更していない。
- 単体: `npx vitest run tests/state-tuples.test.ts -t "400弾・実frontView・31予告"` で2/2成功。旧7胴/v1と支援報酬14胴/Ω/v2の両方に、4人・96敵・160オーブ・400弾・長い名前・31予告を設定。装備cache有無で前線表示の完全一致、敵・弾・オーブ全数、敵省略なし、各送信frame 65,536B以下を確認。新側はチャンク交渉有無と再構成も検査。イベントなしの余裕4,096B超という既存条件も維持。
- 実Worker: `npm run server:test` を127.0.0.1:8789で起動し、`npx vitest run --config vitest.front-integration.config.ts tests/front-network.integration.ts -t "支援報酬対応4人" --reporter=dot` で2/2成功。4接続が全員 `frontSupportRewards:1`、tuple v2を交渉。400弾はチャンクなしで最大65,465B、1000弾は各6チャンクでframe最大17,162B。両方とも各接続96敵・160オーブ・全弾、敵/オーブ省略0、復元エラー0、close4009なし。個別値は [`integrated-capacity-ws.txt`](integrated-capacity-ws.txt)。実Workerの既存密集fixtureは7胴で、14胴/Ωとの合成は上記単体で確認した。
- `npm run typecheck`、対象2テストのPrettier、`git diff --check` は成功。全体suiteと実端末はこの担当では実行していない。
- 通常権限のWorker起動はWranglerログ先EPERMと127.0.0.1:9229 EACCES、通常権限の実通信は127.0.0.1:8789 EACCES。両方とも同じコマンドを正式昇格して成功した。鍵・token値は証拠に記録していない。
