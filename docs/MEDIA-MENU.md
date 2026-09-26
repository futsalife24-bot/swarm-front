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
