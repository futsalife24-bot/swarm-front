# 起動時の横向き案内とSafari音量修正（2026-10-30）

本人依頼「最初の画面で横向きにする案内と、safariでの音量調整が出来ない不具合」の実装分担。独立監査・公開・実セーブ変更は実施していない。

## 対象と実装

- 作業場所: C:/Users/futsa/.codex/worktrees/coop-comfort-20261030/swarm-rebuild-p1a。
- branch: codex/coop-comfort-ready-20261030、編集開始時HEAD: 61559830890c8e69eab28e85ec218159033cab29。親担当のGPU/PWAなどの未コミット差分を保持。
- index.htmlの既存起動ガードに横向き案内・画面回転ロックの説明を追加。早期CSSをheadから読み、ゲーム本体のJavaScriptや保存ロックを待たず案内する。
- front.html直入口はガードがなく、共通CSSで縦画面の本文だけが隠れていた。同じ案内を追加し、front-app.tsに既存installLandscapeGuardを接続。縦向きで入力を解除し、戦闘中は既存pauseを使用する。
- landscape.tsでは開始ボタンを明示接続し、画面回転/全画面APIが使えない場合は手動回転を案内する。
- BGMはHTMLAudioElement.volumeへの代入だけだった。共通MediaVolumeを追加し、MP3のストリーミングをMediaElementAudioSourceNode → GainNode → destinationへ通す。全体音量×BGM音量と既存0.55補正は維持。
- 同じ原因を持つサウンドテスト/PVの試聴音量、エネミーレポートの声にも適用。ゲーム内SE/兵士・敵ボイスの既存Web Audio経路は維持。会敵ムービーは明示muted・独自音量スライダーなしのため変更していない。
- AudioContextは各media要素の初回操作で1回作り、以後は必要時にresume。BGMは画面・曲を切り替えても同じ要素を使用。試聴/レポートのcloseでは接続解除とcontext.close、再度開く時は新しい要素を作る。閉じた要素の再接続はしない。初期化途中の失敗でも生成contextをcloseする。
- media-menu.tsのPWA事前ダウンロード入口と既存close処理を保持。

## 実検査

- 関連7ファイル45件、client/worker両型、管理用検査scriptのnode --check、git diff --checkが成功。最終検査は親GPU測定と重ねず実施。
- Chrome 156.0.8078.48、空の一時BrowserContext、service worker/外部HTTPS遮断、ローカル5197で検査。[集計JSON](mobile-start-audio-results.json)。実セーブ・公開Worker・外部APIは不使用。
- / と /front.htmlの両入口でJavaScript無効でも390×844の全面案内を表示。JS起動後に縦→横844×390→縦を確認。回転/全画面API拒否でも案内を維持し、横向きでは#ui.inertを解除。
- [代表縦画面](mobile-start-portrait.png)を目視し、案内・ボタン・説明が重ならないことを確認。横画面は既存タイトルdialogが終了するまで待ち、両入口のメニューを目視。既存デザインのまま横844×390に収まり、ガードは非表示。
- 実際のタイトルMP3を同じ再生位置で再生し、出力Gain後のFloat32 PCMをAnalyserNodeで採取。HTMLMediaElement.volumeのsetterを無効化して関連するiOS制約を模し、値表示だけでなく音声信号を比較した。

|設定|RMS振幅|全音量に対する比|
|---|---:|---:|
|全音量|0.0375298414|1|
|25%|0.0095911910|0.255561725|
|ミュート|0|0|
|全音量へ復帰|0.0380671827|1.014317706|

曲切替後のtrackはprepare、MP3のまま、AudioContextは1個・running。サウンドテストの実Contextをsuspendしてから再生ボタンを押し、runningへ復帰した。closeでclosed、再度openは新しいmedia要素と接続で再生、最後のcloseでもclosedを確認。ネイティブmedia controlsに届く操作にも同期unlockを接続。ブラウザの未処理例外0。これはPC Chromeの音声処理経路の検査であり、スピーカーの実聴やSafari実機成功ではない。

再現: Nodeで scripts/check-mobile-start-audio.mjs をrepo rootから実行。出力はdist-validation/mobile-start-audio/。追加パッケージ/ブラウザのインストールは不要で、既存Chromeを使う。

## 検査途中の失敗と修正

検査用Viteの初期構成が無関係なBlender review.htmlを走査してvendor参照警告を出したため、対象をindex/frontへ限定。初回は外部Turnstileを待ってload timeoutになったため、外部HTTPSを遮断。音声用URLがSPA fallbackへ入る問題は生成する専用HTMLへ変更。JS無効ページでCSS適用前に寸法を測った競合は、外部通信遮断後のload完了待ちへ変更して解消。これらは検査側の調整で、製品の依存や認証を変更していない。

## 根拠と残る実機確認

- [Apple: iOS-Specific Considerations](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/Using_HTML5_Audio_Video/Device-SpecificConsiderations/Device-SpecificConsiderations.html) のVolume Control in JavaScriptは、iOSのmedia volumeをJavaScriptから設定できない制約を説明する。アーカイブ文書であり、この資料だけで最新iOS Safariの動作を実測したとはしない。
- [MDN: HTMLMediaElement.volume](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume) は2026-03-08更新、現在もLimited availability。今回の閲覧日2026-10-30。
- [MDN: createMediaElementSource](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource) はHTMLメディア音声を処理グラフへ通す方法とGainNodeでの音量調整を説明する。
- [WebKit: iOS media policies](https://webkit.org/blog/6784/new-video-policies-for-ios/) はclick/touchend/keydownの直接操作内での再生を説明する。BGMには既存pointerdown/keydownに加えてclick/touchendの再開を接続した。試聴の再生ボタン・ネイティブ操作も同期unlockする。
- Safari/iPhone/iPad実機、ホーム画面PWA、音声割込み・画面ロックからの復帰、実音量スライダーの実聴は未確認。Windows上のPlaywright WebKit実行ファイルも未配置（webkit-2359/Playwright.exeが存在しない）。追加DL・インストールはしていない。
- 分担検査ではdev変換された実ソースを確認した。主担当が実装HEAD `8d8c15595e37013f9dd9384a113d2b8e996c8ae2` の製品build・配布素材照合と、実Service Workerでの150件保存・オフライン出撃まで統合検査し成功した。詳細は [PWA検査](pwa-implementation.md)。

変更ファイル: index.html、front.html、src/client/landscape.css（新規）、src/client/landscape.ts、src/client/front-app.ts、src/client/media-volume.ts（新規）、src/client/bgm.ts、src/client/media-menu.ts、src/client/bestiary.ts、tests/bgm.test.ts、scripts/check-mobile-start-audio.mjs（新規）、本証拠MD/JSON/PNG。主担当が `8d8c155` に統合・commit済み。公開・Safari実機検査とは区別する。

実モデルID・推論設定は取得不可のため未確認。状態正本/共有記憶の記録は主担当へ引き継ぐ。
