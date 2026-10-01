# リビルド P1a: 爆発1系統の試作

2026-10-01。28枚の提案資料を確認したユーザーから実装着手と、PC引き継ぎに支障が出ない版管理を依頼された。対象は共同設計の **P1a**。まず一発から群れが崩れる操作感を試す、既存版と独立したソロ試作である。

## 保存場所と境界

- 正本: `https://github.com/futsalife24-bot/swarm-front.git`
- 開始時の remote main: `4520c57ede444d44b8699753645f36ce479b72bf`
- 作業ブランチ: `codex/rebuild-p1a-cloud-20261001`
- 作業環境: dot側の独立Linux作業領域。ユーザーの旧PC・新PC上では作業していない
- 両PCの未pushコミット、未コミット差分、未追跡ファイル、設定、移行状況は取得していない。このブランチだけで両PCの移行が完了したとは扱わない
- PR114の音声、PR109の名称分離、PR101のPV、PR100の行動計測、PR98の実機準備は別作業。この試作へ取り込まず、ブランチを変更しない
- mainへのmerge、本番Workerへの公開、既存セーブ移行は今回行わない

後続の完全SHAはこのブランチのコミット履歴とPRで特定する。別PCでも同じSHAをcheckoutすれば同じソースから再開できる。以下の実装・検証記録は進捗に合わせて更新する。

## 仕様の正本と今回の範囲

- [共同設計v1](design/rebuild-20260929/DESIGN.md) 第2〜4・7〜10節
- [採否と試遊条件](design/rebuild-20260929/DECISIONS-AND-TESTS.md)

既存の1面・兵士1人・対応武器1タイプを2枠で使い、手動射撃・装填・回避・切替を維持する。初期3択とXPによる追加最大6回、爆発3枚、汎用3種類を各4段階、自動進化1種類、既存大型1体。戦闘約7分は目標であり、選択・ロードを含めた実所要時間の保証ではない。

試作内だけで基礎性能を標準化する。元の武器・レア度・強化値・所有物・日替わり台帳・セーブは変更せず、報酬は付与しない。進化後60秒以上操作できることや7回取得は試遊で測る目標で、敗北や分散選択でも必ず達成させる仕様ではない。

3構成への拡張、防衛比較、実2〜4人協力、報酬・解放・既存進行との接続はP1b以降。持込性能を製品でも標準化するか、旧モードを置き換えるか、報酬をどう接続するかは未決であり、この試作では決めない。

## 起動と再開

既存の作業フォルダを上書きしない。新しい空の場所へcloneするか、既存checkoutのorigin・HEAD・変更状況を確認したうえで、このブランチを取得する。未保存差分へreset/clean/stashを自動実行しない。

```sh
git clone --branch codex/rebuild-p1a-cloud-20261001 https://github.com/futsalife24-bot/swarm-front.git swarm-rebuild-p1a
cd swarm-rebuild-p1a
git status --short --branch
git rev-parse HEAD
npm ci
npm run typecheck
npm run test:rebuild
npm run dev
```

試作入口は `http://127.0.0.1:5186/rebuild-p1a.html`。通常の入口・bootstrap・save-writerとは別のHTMLを使う。通常公開用buildに試作入口を追加しない。

```sh
npm run build:rebuild
npm run test:save
npm test
npm run build
npm run server:build:production
npm run test:rebuild:e2e
```

LinuxでChromeではなくChromiumを使う場合は `CHROMIUM_PATH=/usr/bin/chromium npm run test:rebuild:e2e`。権限のないホームディレクトリを持つ一時環境ではWranglerのログ/設定先だけを作業可能な一時領域へ指定する。認証情報の追加やデプロイは不要。

## 完了・受入の区別

1. 実装・自動検証: 初期/追加選択、候補保証、再抽選、爆発起源と上限、XP/時間境界、全停止、勝敗/再挑戦、報酬・保存分離
2. 実ブラウザ: 844×390 / 640×360、選択・再開・押しっぱなし・blur・繰返しクリック、旧保存不変、コンソールエラー
3. 人間の試遊: 1分で違いを説明でき、狙う最初の敵を変える理由があるか。自動botの勝率は面白さの合格証明にしない
4. 実スマホ: 可読性・入力体感・フレーム時間・10分の発熱は物理端末で別途確認
5. 独立監査: リポジトリ指定のIAB通常Chat経路。自己レビューや自動テストで代替しない

現時点では実装作業中。最終コードに対する検証結果、既存失敗、未実施範囲、停止理由を以下へ追記してから引き継ぐ。

## 検証記録

- 開始時のcheckoutはclean、originと完全SHAを照合済み
- Node v24.19.0 / npm 11.9.0。lockfileどおりの `npm ci` 成功
- 開始時のclient/Worker型検査と通常build成功。既存の500kB超チャンク警告あり
- 初回のWorker dry-runはホーム配下のWranglerログフォルダが存在せず失敗。書込み可能な一時ログ/設定先で再確認する
- 実装後の結果は未記載。上記の開始時成功を最終実装の合格として扱わない
