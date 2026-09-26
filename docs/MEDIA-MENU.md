# 設定のサウンドテスト・PV（2026-09-26）

依頼: メニューまたは設定からサウンドテストとPV映像を再生する。

## 変更

- ソロ・協力の既存設定の先頭に「サウンドテスト」「PVを見る」。同じネイティブダイアログ・テーマを継承。
- 全13 BGMを用途/マップ名と曲名で選択。初回は停止状態、曲を変更するとその曲を再生。曲末で停止し、clear試聴からvictoryへ自動遷移しない。
- 最新保存版のPV v10（30秒/1080p/24fps）をゲーム内再生。元映像の編集・音声を保持し映像を約13MBへ圧縮。[素材/再現情報](../public/assets/video/README.md)。
- 再生・一時停止・シーク・再読込・試聴音量。初期音量は設定を引き継ぎ、試聴中の変更は保存しない。音量0はミュート。
- 試聴画面を開いている間は通常BGMを同じ位置で停止、閉じる/Escで最新シーンへ復帰。設定の親ダイアログも閉じた場合は子を閉じる。非表示/pagehideで試聴停止。ダウンロード中の変更/破棄はabortし、古い応答は適用せずBlobを解放。
- 既存BGMのpending play中に停止→同じ曲へ復帰した際、追加ジェスチャーまで再生されない非同期競合をrevision比較で解消。

## 検証

- client/worker型チェック成功。`media-playback`9件と既存BGM/回収配置復帰/効果音28件、計37件成功。
- 新規テストは古い応答の破棄、読込中close/pause、非表示、404/再生拒否からの再試行、複数停止所有者、シーン変更/ミュート、pending play競合を検査。
- 実Chromeで全13曲のduration取得・再生開始・背景BGM停止・errorなし。[全曲](evidence/media-menu/catalog.json)。全曲全長の主観的試聴を意味しない。
- ソロの設定/試聴/PV、844×390と667×375を実ブラウザ確認。PVは両サイズでbody縦スクロール0。IABのviewport指定は実寸に反映されなかったため、寸法検証はChromeで行い実innerWidth/Heightを確認した。
- 実ローカルWorkerの協力ロビー→装備変更→設定からclear試聴（7.6秒で停止）、PV再生、close/Esc後prepareの続き・プレイヤー1個への復帰を確認。[協力](evidence/media-menu/coop.json)。保存/通信コードは変更しない。
- PV全長デコード成功。実IABで19.9秒、Chromeで20.2秒/終端30秒の再生を確認、1920×1080、errorなし。[UI観測](evidence/media-menu/ui.json)。
- 自己レビュー: UI入口2箇所、共通プレイヤーのライフサイクル、BGM復帰、メディア資産パスを照合。

未確認: 実スマホ（Safari/iOS等の音量制約）、実機タッチシーク、主観的な音響品質、協力複数人の長時間同時操作。ローカル協力の初期接続先8787不在によるFailed to fetchは8797設定前の既存接続条件で、新規メディアエラーではない。

## 作業情報

- GitHub: https://github.com/futsalife24-bot/swarm-front
- 作業場所: `スワフロ/share-image-fix`（既存のclean worktreeを再利用）。元の`game`は別作業のdirty状態を保護。
- branch: `codex/media-menu`、base: `c46f2484d39c7e9a2308c505ab4356ccd9be211b`。
- モデル実行ID・effort: 未確認。モデル切替・サブエージェント使用なし。
- 独立監査・main反映・公開: 検証後、既存の通常Chat監査・既存Worker公開手順で実施し記録を追記する。

AAC圧縮パケットSHA256（元/配信用とも同一）: 9eac2653b49dbb8dccd36c40b76e1ea7c0c953cf4b5e4d89257af576a4d6e619。

## 全画面待機中の親close修正

通常Chat監査中に報告された終了処理漏れを、実ネイティブdialogでも再現した。showModalAfterFullscreenの待機中は`open=false`で、ネイティブ`close()`がイベントを発生させない。親設定の終了後に子が表示され、BGM停止権・fetch/Blob/observerが残る。

`closeMenuDialog`で、接続中かつ未表示の場合も既存closeリスナーを実行し、nodeを外して遅延showを取り消す。表示済みの通常close/Escは既存のネイティブ経路を維持。media側の親closeだけが新ヘルパーを使う。再生仕様・PV素材・音量処理は不変。

型チェック、関連40件成功。`scripts/media-dialog-preview.html`はローカル検証専用で、全画面要求のPromiseだけを遅延させる。実menuDialog/mountMediaMenu/BackgroundMusic/MediaPlaybackを使い、親close前後とPromise解決後を確認。旧07e4b6eのmedia-menu.ts（importのみ実srcへリベース）ではサウンド/PVとも子1個残存・解決後open1個・BGM停止。修正版では両方とも解決前後の子0個・BGM再開。[反例/修正の数値](evidence/media-menu/fullscreen-regression.json)。テストのtouch/fullscreen遅延模擬であり実スマホ検証とはしない。

監査待ちの追加自己検証: production bundleの667×375でBGM/PV正常、clearは7.6秒で停止。ミュート設定を引き継ぎ、試聴音量変更後も元設定0を維持。[公開用ビルド](evidence/media-menu/built-ui.json)・[音量](evidence/media-menu/mute.json)・[ネイティブシーク](evidence/media-menu/seek.json)。

初回独立監査は07e4b6eを要修正（P0=0/P1=0/P2=1、F1）と判定。[報告全文](evidence/media-menu/audit-07e4b6e.txt)。F1の製品修正は `b7513d83342e1a149fbb931b9839c69b6f720c66`。

追加の実ブラウザ再現: サウンド/PV×全画面fulfilled/rejectedの4条件で、ロード開始直後の親closeはrequest1/abort1・子0・BGM再開。[計測](evidence/media-menu/fullscreen-final.json)。素材ロード完了後の親closeも4条件で、Blob作成1/解放1、dialogに付いたobserver4/切断4、子0・BGM再開。[計測](evidence/media-menu/fullscreen-loaded.json)。全observer集計の追加1個はdialog外なので、dialog対象の4個を別集計した。127.0.0.1側の検証ページの古いモジュールキャッシュを検出し、最新計測フィールドを確認できたlocalhostの新規オリジンで成功/失敗の決着状態まで測定し直した。

任意指摘O1（親子一括close後のfocusがbody）は保留。O2の初期画像は、settings-844.pngがホーム、settings-667.pngがPV終端、coop-settings-667.pngが装備という遷移直前のフレームだった。これらを設定ダイアログ表示の証拠と扱わず、DOM観測・最終試聴/PV画像と区別する。

設定画面の最終画像は [settings-final-667.png](evidence/media-menu/settings-final-667.png)。production previewの667×375で設定の2項目が表示されたフレームを目視照合した。

f38fad494af38b18b9f7e2975a3586edd3137a0fの再監査資料reaudit.zip（429,182 bytes）を同じ通常Chatへ送信済み。送信は最初に自動承認レビューで承認根拠不足として拒否されたが、正規game/AGENTS.mdの明示的な通常Chatへの初回・修正版ZIP送信継続承認と資料範囲を確認し、同じ経路の再試行が許可された。

## 最終独立監査

同じ[通常Chat](https://chatgpt.com/c/6ab74d13-d1cc-83ee-8e40-ee02bdcdc5dc)の限定再監査は `f38fad494af38b18b9f7e2975a3586edd3137a0f` でPASS。必須P0/P1/P2各0件、F1解消。[報告](evidence/media-menu/audit-f38fad4.txt)。以降の監査記録・画像追加は製品コード不変。

監査側は独自20ロジックテスト、限定TS5.8.3型、実Chromiumネイティブdialogで旧4条件の再現、修正後12条件（fetch待ち/データ待ち/ロード完了）、通常終了6条件、BGM状態4条件を検証。素材と全画面Promiseの一部制御を含む共通コンポーネントfixtureであり、実スマホ/本番HTTP/全体40テスト・指定版型/buildの独立再実行ではない。

O1は任意で保留、O2は文書訂正を監査側確認。追加O3/P3は親子のnative closeを同一処理内で呼ぶとclose通知/共通observer切断が重複しうる保守上の注意。media dispose/BGM release/Blob解放は一回で、残存や再オープン不能はないため必須外。現行の冪等cleanupを維持する。
