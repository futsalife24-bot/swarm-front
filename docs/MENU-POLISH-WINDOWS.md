# PR142のWindows再検証・監査記録（2026-10-07）

作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。
正本: https://github.com/futsalife24-bot/swarm-front 。[PR142](https://github.com/futsalife24-bot/swarm-front/pull/142)、継続ブランチ `ccr-3d467d84-o5t70k`。
base main `1026fccaa509723c74e1b85bbdde934afe6d82f6`、実装監査対象 `7ef32289a4662afa940c1c7accbfc9f42bb179e6`、開始時HEAD `f240329519f1fde57220f0094455e726bc8c1e2e`。fetchでmainの進行なし・開始時cleanを確認。実装以降の既存差分は文書と証拠だけ。

## Windowsで実行した確認

- Node 24.19.0、npm 11.17.0。`npm ci`成功。旧Vite preview（5431）がrolldownのファイルを使用していたため、モジュールの完全パスとPIDを照合してそのプロセスだけ終了し再実行。npmが報告した既存依存のhigh 5件は更新していない。
- 型チェック、save147件、front73件、progression6件、media-dialog3件、本番build、`npm run server:build`のdry-run成功。front73件は、以前DOMなしimportで実行できなかったfront-feedback7件を含む。既存の大きいbundle警告あり。
- Windows Chrome（既定のchannel chrome、d3d11）の `check-menu-effects.mjs`、`check-menu-effects-network.mjs`、`check-menu-effects-rapid.mjs`成功。通常/reduced、保存失敗/再試行、作成/合成、育成、改装版の一時選択と成功演出0、試聴停止、協力シルエット、reduced途中切替、連続操作/離脱後の演出残り0、pageerror0。
- 実ローカルWorker8789とdev5186で、2人のready初回2回・再準備で1回追加、週間150コイン受取と成功演出1回・終了を確認。実APIを使用し、成功応答は捏造していない。認証値は証拠に含めない。
- 844/640の通常/reducedを実通信でも確認。reducedのready演出0、週間成功処理1回・実行中演出/残存DOM0。MutationObserverが同期除去済みノードの追加も通知することを検証側で区別。既存ローカル保存先はクラウド作成日次上限429に達したためその状態を保持し、未実行の640幅2ケースは独立した新規ローカル保存先`dist-validation/pr142-worker-matrix`で実行。制限値・Worker実装・本番の状態は変更しない。
- 武器行確認の初回は1280通常の高さが30.0000076pxになり、`row===30`で失敗。mainをgit archiveで隔離した5348でも30.0000305pxで同じ失敗。入場中のtransformが測定に含まれた。確認スクリプトへ実アニメーションの自然終了待ちを追加し、判定閾値・レイアウトは変更しない。
- 再実行はPR142・mainとも4サイズ×通常/整理の8表示と操作が成功。表示件数1280:11、915:6、844:6、640:5。844以上の横スクロール0、640は既存どおり補助スクロールと名前/ロック固定、見出し同期。cellOverlapなし。

ログとJSON: [Windows証拠](evidence/menu-polish-windows-20261007)。前回のLinux既知失敗は[元の記録](MENU-POLISH.md)を参照。無関係な全件単体を再実行して全合格と主張してはいない。

## 実時間の演出確認

`scripts/check-menu-polish-motion.mjs`でChromeの実描画動画とrequestAnimationFrameサンプルを取得。Web Animationsのpause/seekや時刻の固定は行っていない。844×390・640×360、通常/reducedの各9場面（タイトル、装備、作成/合成、育成、敵レポート、設定保存、試聴3本メーター、改装版ガイド）を確認し、横溢れ0・pageerror0、reducedの実行中演出0。3本メーターは実再生中に表示、pauseイベント後に非表示。実時間の数値は各JSONのms/currentTimeで確認する。

最終動画は実描画フレームをChromeの時刻で20fpsへ割り当てて保存。演出の実時間はJSONのms/currentTimeでも照合する。使い捨て生成物の`dist-validation/menu-polish-motion/`へ保存し、監査ZIPへ直接同梱。Playwright任意ffmpeg取得がタイムアウトしたため既存ffmpegで記録。録画開始のタイミング・非同期操作後の計測継続を修正し、全4条件を最終再実行して成功（`motion-final.txt`と`motion-final-summary.json`）。操作スクリプトではpauseイベント/ダイアログ除去完了を待って測定するよう調整。製品ソースの修正はない。初回の失敗ログは補完前の記録として保持。

## 監査・公開と残件

独立監査は指定されたiabの通常新規Chatを使用する。共有UI貸出UI-20261007-008を受領して実画面と送信を進行中。既存CloudflareのOAuth認証と既存アカウントを確認済み。契約APIは権限不足403だったが管理画面ではFree/$0/Current planを確認。当日153/100,000 requests、10/1〜10/7のrequests2.72k・CPU2,035ms。変更せず読み取りのみ。監査判定、通常merge、本番構成dry-run、Worker公開、配信照合は未実施。

実際のタブ非表示時cleanup、実機タッチ、GPU長時間負荷、全敵モデルの見え方は未実測。headlessの別タブはvisibleのままだった。戦闘演出と兵士音声PR137は保留。

使用モデルID・推論設定は未確認。
