# 第3弾の検証証拠（2026-11-15）

対象は試聴homeへの差し替え、全シーン共通字幕/字幕設定/専用導線の撤去と「ボイスなし」への改名。詳細は [実装記録](../../impl-status-20261114.md) の第3弾。

- 実装PR https://github.com/futsalife24-bot/swarm-front/pull/341 、公開ソース `3069d315781079436ad4470e5a0b680ae346dfa1`。
- Worker Version `dfc09c94-94a0-461d-b087-87770ae57c75`、公開先 https://swarm-front.melosalife-24.workers.dev/ 。
- [全181ファイル1854テスト](checks/tests.txt)、[型](checks/typecheck.txt)、[書式](checks/format.txt)、[公開ソースbuild](checks/release-build.txt)、[公開ソースdry-run](checks/release-dryrun.txt)。すべて終了コード0。buildの従来の500kB超chunk警告は残る。
- [ローカル実Chrome結果](local/result.json)、[横844設定](local/settings-844.png)、[横568設定](local/settings-568.png)、[残した訓練の操作案内](local/training-guide.png)。
- [公開30ファイル照合とhealth](published-files.json)、[公開実Chrome結果](published/result.json)、[公開横844設定](published/settings-844.png)、[公開横568設定](published/settings-568.png)。
- 旧字幕alwaysを残し、未DL/パック保存/ボイスなし/音声あり/試聴/再読込を確認。字幕DOMの出現を監視し0件、画面例外0。試聴の音声開始は3.36秒。全生成JS/CSSで `control-caption`・「管制AIの字幕」・旧「ボイスなし（字幕のみ）」が0件。全シーンの共通表示経路削除を自己レビューし、全分岐を実操作したとは扱わない。
- 未確認: 実スマホ/iOS、人間の実聴、全台詞/全分岐、多人数インターネット戦。titleの既存クリップは依頼範囲外で変更しない。

再現: `node scripts/check-voice-fix3.mjs <URL> <出力先> --training`。公開確認では `--training` を外しタイトル/設定/試聴のみ実施。配信照合は `node scripts/check-voice-delivery.mjs <URL> <公開ソースSHA> <出力先>`。ブラウザは新規の隔離コンテキストを使い、既存利用者の保存には触れない。
