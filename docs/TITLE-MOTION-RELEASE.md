# タイトル操作演出の公開記録（2026-10-07）

タイトルの押し込みと戻り、選択強調、短いアクセント・次画面入場を改装版と従来版へ公開した。既存の配置・文言を継承し、最初の入力を演出待ちにしない。[変更と検証](TITLE-MOTION.md)。

- 公開先: https://swarm-front.melosalife-24.workers.dev/front （従来版 `/`）
- 通常統合PR138: https://github.com/futsalife24-bot/swarm-front/pull/138
- base: `c67628040c747ab22c7dbfa45021c7a2cdb9ca52`
- 最終監査対象: `77c76935a4558e1d0d54fff59fe9d7b95f708b3e`
- 公開ソースmain: `0a4e668c08d765ba11e504c876b909139b136342`
- Worker Version: `27d4d8d7-e173-4d10-b841-23b3cff29940`

[通常Chat監査](https://chatgpt.com/c/6ac58aa7-bc70-83ee-a4f6-7915a7e3d003)は3回。初回必須P1は非同期処理中のタイトル決定競合、P2は前のボタンのfocusoutによる次の押下解除。Promise終了までの後続決定guard、closed menu dialogの抑止、target一致時の押下解除を追加。再監査の残存P2（管理者終了のPromise破棄）と任意のインストールPromiseも保持へ修正。最終は必須0・任意0の合格。[確定回答](evidence/title-motion-20261007/audit-final.md)。以後の変更は監査回答・状態記録だけ、保護の迂回なしで通常統合した。

client/Worker型、修正版本番build、dry-run、実ブラウザ12項目成功。統合mainから本番buildとdry-runを行い既存Workerへ公開。ビルド待機が無出力で長引き再実行したが、両実行とも最終成功。[main buildログ](evidence/title-motion-20261007/build-main.txt)。最初の準備dry-runは同時build中のファイル入替で失敗したため、以後はbuild完了後に実行し成功を確認した。

公開health200、HTML・全実行JS/CSS・タイトル画像の25件がSHA256一致。[最終配信結果](evidence/title-motion-20261007/delivery.json)。公開直後の初回はJS3件が不一致、同一応答hashだった。[初回結果](evidence/title-motion-20261007/delivery-first.json)を保護し、該当JSの正常JavaScript応答を確認後に再照合し25/25一致した。不一致の原因自体は未特定。

公開版IABでガイドへのEnter決定、戻る際の元ボタンの選択復元、ソロ準備とタイトルへ戻る、従来版への往復を確認。従来版の日替わり防衛では既存の「クラウド保存が必要」の失敗通知が出て、閉じた後に別入口から正常遷移できた。ブラウザconsole errorは0。[公開画面](evidence/title-motion-20261007/published-title.jpg)。

実機タッチ/GPU、別viewport、協力一覧の実通信、実管理者logout通信と実PWAインストールは未確認。非同期競合は実ブラウザfixtureとコード独立監査で確認し、これらの本番実操作を試験済みとは扱わない。音声PR137は保留のまま、今回音声生成・課金切替は行っていない。

使用モデルID・推論設定は未確認。作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。公開後記録は `codex/title-motion-release-record` から通常PR統合し、main一致とcleanを確認する。
