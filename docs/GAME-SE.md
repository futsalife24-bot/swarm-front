# ゲーム内SE — 2026-09-13

## 変更

BGMは追加せず、26種類のゲーム内SEを実装。録音銃声（AR-15／Mossberg）、ロケット、着弾、装填開始／完了、回避、武器切替、装備取り外し／取り付け、メニュー選択、被弾、撃破、ダウン、蘇生。敵は近接・突進・跳躍・着地・酸弾・杭・レーザー・重攻撃と予告を区別。

- `src/client/audio.ts`: オシレーター共通音をサンプル再生へ変更。先読み、初回操作でAudioContext解除、再試行、音量保存との接続、距離減衰／左右定位、同時32音上限、コンプレッサー、種類／発生元別の連続再生制限。ミュート・非表示は停止、一時停止は戦闘音だけを停止。
- `src/client/combat-audio.ts`: 権威状態から発音を抽出。散弾8発を1銃声へ集約、イベントIDで重複防止、射線終端／命中で着弾、成功した回避・切替・装填のみ発音。新しいrunや停止中のイベントを遅れて再生しない。
- `src/main.ts`: 描画の共通音コールバックを廃止し、ソロ更新／受信更新とフレームで音を更新。メニュー選択をcaptureで取得。装備変更成功時だけ取り外し＋装着、同じ装備の再選択は変更音なし。
- `public/assets/audio/se-v1/`: 32kHz mono PCM WAV 26本、合計866,104 bytes。manifestに加工元／SHA256／長さ／ピーク／RMS、CREDITSに作者・配布元・CC0表記。
- `tests/audio.test.ts` とvitestの対象登録。再生成・実ブラウザ検証・試聴ページは `scripts/build-se.mjs` / `check-se.mjs` / `se-preview.html`。
- 更新履歴にユーザー向けの追加内容を記載。

戦闘計算・通信プロトコル・サーバー・既存のモデル／マップは今回変更していない。射撃・命中は既存イベント、行動は状態遷移、敵飛び道具は新規Projectileを利用する。通信のスナップショット間で発生から消滅まで完了する極端に短い飛び道具は発射音を拾えない場合がある。

## 素材

銃声: [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library)、Ben Jaszczak / Brian Nelson / Kevin Heras / Matthew Nanney。装填: [Gun reload sounds](https://opengameart.org/content/gun-reload-sounds)、SpringySpringo。衝突・装備: [Impact Sounds](https://kenney.nl/assets/impact-sounds)、Kenney。各配布ページのCC0を確認。ロケット排気・酸・レーザー等は今回の合成音＋録音レイヤーであり、実銃録音とは区別する。

元アーカイブはGit除外の `dist-work/se-source/`。公開するのは加工した短い音と出典のみ。元ファイルのSHA256は `dist-validation/se/sources.json`。

## 検証

- 最終型チェック成功。SE専用6テスト成功（実fire/stepの散弾・回避・切替・装填と、停止・run変更・敵弾／跳躍等）。
- 全26WAVのブラウザdecode成功、開始遅延0.1秒未満、非無音、クリップなし。48kHzへの再サンプルでピークが元の0.84を少し超えるため、復号後は1.0未満を検証。
- 射撃＋着弾＋回避の3音同時、最大32音、音量0の停止／新規再生抑止、一時停止時の停止を確認。
- 32音を音量1で重ねたOfflineAudioContext出力ピーク0.9604（1未満）。既定音量0.35。
- client / Pagesビルド、production Worker dry-run成功。最終差分の配布検証結果は後記。既存のJS chunkサイズ警告あり。
- 既存 `game.test.ts` のauthoritative combat 10件中6成功／4失敗。失敗は固定HP 4200/4100/75/[51,51,51,75]を期待する旧テストと現行の固定サイズ・HP個体差の不一致。今回未編集のshared計算だけを直接テストしており、SEモジュールをimportしない。SE回帰とは区別し、この依頼で戦闘仕様・旧テストの期待値を書き換えない。
- ブラウザ検証の途中では、マウス固定によるクリック不達、重い描画下で実時間待ちでは装填が終わらないこと、fake clock使用中のスクリーンショット待ちが発生。最終検証ではマウス固定をAPIで解除し、ゲーム時間を固定／進め、音の起動ログとHUDで検証。音の変更に無関係なスクリーンショット待ちは除去。

人間の耳での主観的な音質評価、実Android/iPhoneの出音、遠隔4人同時の聴感は未検証。試聴ページは開発サーバーの `/scripts/se-preview.html`。BGMの追加・ミキシングは未実施。

## Git／監査

branch `codex/home-armory`、base/head `4186f25f7c9695f95ea897ad182db5f85fac3091`（commitなし）。開始時から多数の未コミット／未追跡変更あり、それらを保護して上記のSE差分だけ追加。今回前後の差分とコード・素材は監査ZIPへ格納する。

## 公開前確認

Cloudflare既存Worker `swarm-front`。2026-09-13の管理画面でFree／0ドル／現在のプランを確認。過去24hアカウント1.03k requests、Worker呼出21、errors0、CPU P90 1ms。契約変更なし。公開結果は後記。

## 最終配布検証

844×390の実Chromeで、通常UIの出撃準備・装備2回変更・出撃・ライフル射撃・装填完了・切替・ショットガン射撃・回避・一時停止が成功。実AudioBufferSourceNode起動ログ: rifle4、shotgun1、impact1、reload1、ready1、switch1、dodge1、unequip2、equip2、menu2。初回操作のdecode待ちは短い代替クリック1回。pageerror 0。`dist-validation/se/distribution.json`。

最終追加検証では一時停止にメニュー音1本を残し、音量0では全停止。左／右のパンと13m対65mの減衰も確認。`pause-spatial.json`。

## 公開

既存Workerへ公開成功。Version `2bfa2591-c02b-4c09-b6cb-288ca4615d11`。
https://swarm-front.melosalife-24.workers.dev

更新30ファイル（index.html、JS、SE26本、manifest、CREDITS）。公開されたJS・CSS・音源等30ファイルのSHA256が配布版と一致。`/api/health` 200／ok:true。証拠 `published-assets.json`。

公開版も844×390で出撃・装備着脱・ライフル／ショットガン射撃・着弾・装填完了・切替・回避・一時停止が成功。発音ログは配布版と同じ（rifle4、shotgun1、impact1、reload1、ready1、switch1、dodge1、equip2、unequip2、menu2、初回代替click1）。pageerror 0。`published.json`。公開後確認まで完了。
