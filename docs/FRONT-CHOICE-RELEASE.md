# 3択の取得区別・強化一覧を公開（2026-10-06）

- 公開先：[改装版](https://swarm-front.melosalife-24.workers.dev/front)。[旧版](https://swarm-front.melosalife-24.workers.dev/)も維持。
- [PR129](https://github.com/futsalife24-bot/swarm-front/pull/129)を通常merge。公開ソース `d1c26b63256a3904020da8e8b2f14a247d86a11a`。
- Worker Version：`2d56c76b-db83-42cb-98f2-56b3fecdf6e6`。
- [独立監査](https://chatgpt.com/c/6ac3c0a5-3640-83ec-bb48-ebc43ab69e38)：対象 `a71241ee153a3d1a4ddd79cf1511ee10893a4ed5` 合格、必須P0/P1/P2なし。[確定全文](evidence/front-choice-distinction-20261005/audit-final.md)。以降の変更は状態と監査の記録のみ。

## 公開した変更

新規獲得は青緑の＋、段階アップは金色の↑。文字と段階変化でも判別できる。中央3択の左上に「現在の強化 取得数/上限」を追加し、段階・効果・進化条件を確認して同じ候補へ戻れる。詳細閲覧は選択回数を消費しない。協力の期限は従来どおり。

## 確認結果

- 型、単体41件、実ブラウザ7件成功。3サイズの実操作、混在表示、詳細最大6種、Esc、実2人での開閉を検証。[実装記録](FRONT-CHOICE-DISTINCTION.md)。
- 統合済みmainから本番ビルドと既存構成dry-run成功後に公開。既存の大きなチャンク警告はあるがビルドは成功。
- 公開health 200、41ファイルのSHA256がローカルdistとすべて一致。[配信照合](evidence/front-choice-distinction-20261005/delivery.json)。
- アプリ内ブラウザで公開版の出撃準備→3択の新規表示→現在の強化を開く→同じ3択へ戻る（ボタンへのフォーカス復帰も確認）→誘爆核取得→即戦闘再開→一時停止で1/3段階→タイトルへ復帰を確認。ブラウザエラーログ0。
- 実機タッチと詳細表示中の実時間期限切れは未実測。監査でコード経路を確認し、必須修正なし。タッチ向けボタン高とフォーカス復帰の自動検証追加は任意改善として記録。

実行モデルID・推論設定は取得できず未確認。作業場所 `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。本記録の追加でゲーム本体は再変更しない。
