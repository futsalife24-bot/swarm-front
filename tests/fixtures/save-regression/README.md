# 固定した旧保存fixture

個人データを含まない合成データ。現行の `freshProgress()` から毎回生成せず、JSONを固定して読込側の変更を検出する。入力SHA256・生成元の完全commit SHA・旧保存キーは [manifest.json](manifest.json)。

| 入力 | 元コード | 固定した値と期待 |
| --- | --- | --- |
| inventory-v1 | `157df95` の `save.ts` とその時点の依存 | quick効果、power 1.123、旧rolls、装備2本、お気に入り、武装片40、音量0.72、旧受領履歴を保持。新しい取得順は3/4/5、frameRate既定60 |
| progress-v2 | `157df95` の `progression-save.ts` とその時点の依存 | coins137、powder29、points18、materials2、兵士2人と個別育成・装備、選択兵士、装着/ロック済みアクセサリ、ミッション・遭遇・履歴を保持 |
| shared-v2 | `d947dd8` の `progression-save.ts` とその時点の依存 | 上記に `armoryMigration:1, revision:8`。再インポートせずv3キーへコピー、現行revisionは1から開始 |

生成時は各commitのモジュールと相対importをGitから読み、esbuildで束ねた旧 `fresh()` / `freshProgress("normal")` に上表の合成値を加え、**旧版のvalidator**で受理されることを確認した。実プレイヤーの書出しデータや、全過去リリースを網羅する資料ではない。

`index.mjs` は入力ハッシュと期待値を照合するテスト専用コード。旧入力は移行後も元キー・backupキーにbyte単位で残ること、移行は1回だけであることを単体と実Chromeの両方で確認する。fixtureの意図的な更新時は期待値とmanifestの根拠もレビューする。
