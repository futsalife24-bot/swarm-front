# 現行素材の事前ダウンロード調査・カタログ（2026-10-30）

対象: 専用worktree C:/Users/futsa/.codex/worktrees/coop-comfort-20261030/swarm-rebuild-p1a、branch codex/coop-comfort-20261030、基点main 3e1dc640e15d747cc2a06ac72c59833db2072f74。独立監査ではない。

最初は提案調査として開始。その後、本人の「それはぜひ実装してほしい」という明示承認を主担当から引き継ぎ、ワシはカタログ/manifest生成だけを実装した。保存エンジン・画面・Service Workerの実装と実ブラウザ保存検証は主担当の範囲。本担当はゲームコード・sw.js・実ブラウザ保存・公開先を変更していない。

## 現状と効く範囲

調査開始時のpublic/sw.jsはすでにPWA用キャッシュを持ち、HTMLから直に参照するshell素材をinstall時に保存する。その他は同一origin/scopeのGETを実際に取得した時にcache-firstで保存する。ただしfront.html等は現行除外条件があり、全モデルを明示的に一括取得する処理はない。manifestはfullscreen/landscape、src/client/app-install.tsで登録とインストール案内を行う。

事前保存で短縮できるのは再取得待ち・回線切断の影響。GLBの解析、骨アニメーションの加工、GPUへの転送、shader compileAsync、実フレームの描画、権威サーバーやマルチ通信の遅延は別である。src/client/battle-loading.tsのprepareBattleはそれらの準備まで待つので、事前DLだけで全カクつきが解消するとは説明しない。協力通信やTurnstile/APIはオンラインが必要で、外部challengeスクリプトやAPIを素材packへ入れない。

## 実参照とパック方針

- 兵士: src/client/standard-trooper.tsのloadStandardTrooper。現行swarm-soldier.glbのcontent digest付きURLとrealism-v2の基礎武器3種を取得。旧standard_trooper_v*等は不採用。
- 敵: enemy-motion-assets.ts → hound-motion.ts → structure-motion.ts。Renderer初期化が通常8種のStructureMotionを作り、prepareBattleが全loadingを待つため、この8種は現状では共通。BASTIONはbastion-view.ts、FOUNDRYの節はfoundry-worm.tsの現行URLを追加。debug用・旧モーション・Blender原本は除外。
- 武器: progression-weapons.tsがrealism-v2/${model}_${rarity}.glbを取得。実描画モデル3種×レア度0〜4を対象にする。progression-v1は不採用。
- マップ: map-assets.tsとshared/stages.ts。通常6種と遠景5種は進撃用の個別pack。高台ルートは同じassetIndexのGLBを再利用し、追加形状はコード生成。洞窟に別遠景GLBはなく、訓練場はコード生成。
- 生存: mapForはworld.frontでもDEFENSE_MAPSへ入る。新規生存のcreateFrontRunはstage=1なので現行はdefense_0_v2.glbのみ。MapAssetsのDEFENSE_MAPS分岐はdistantStatusをreadyにしてreturnし、GLB内のDISTANT_を使うため別distant_0は不要。defense_1〜5は今回未採用。armory_v2はworld.defense時だけloadし、現行生存では不要のため除外。廃止モードをUIへ復活させない。
- 戦闘音: audio.tsのLEVELS分岐、soldier-voice.tsの11クリップ、anomaly-voice.tsの11プロフィール×2声から導出。Soundは構築時にもpreloadするが、これは端末に明示する一括完了/更新/再開管理とは別。
- BGM: bgm.tsのメニュー7曲＋map6曲。HTMLAudioElement、preload=noneのstreaming。任意packとして初期オフ。
- 映像: encounter-film-files.tsの現行report-v3の10本だけ。encounter-film.tsは本人が開いた時に完全Blobを取得する。参考動画・旧会敵動画は不採用。任意packとして初期オフ。

調べた対象GLBは38個。外部buffer/画像URIは0個で、現在の選定GLBは必要データを内包している。生成器は将来外部buffer/画像URIが現れた場合にも同じpackへ追加し、remote依存や欠損を黙って完了扱いしない。

## 容量（生ファイル、HTTP転送圧縮・CacheStorage overhead別）

|パック|URL数|bytes / MiB|
|---|---:|---:|
|appのpublic静的部分（build時のみ）|8|2,047,907 / 1.95 MiB＋現行build HTML/JS/CSS等|
|common：共通データ|116|83,225,348 / 79.37 MiB|
|map-0：灰明の街区（進撃）|2|17,349,508 / 16.55 MiB|
|map-1：薄暮の倉庫地区（進撃）|2|3,357,128 / 3.20 MiB|
|map-2：蒼鉄の工業区（進撃）|2|10,922,656 / 10.42 MiB|
|map-3：風渡る草原（進撃）|2|15,716,744 / 14.99 MiB|
|map-4：白嶺の雪峡（進撃）|2|3,179,644 / 3.03 MiB|
|map-5：晶脈の地底巣（進撃）|1|4,857,828 / 4.63 MiB|
|map-survival-0：生存：灰明の街区|1|11,593,464 / 11.06 MiB|
|bgm：音楽（任意）|13|38,499,704 / 36.72 MiB|
|movies：会敵ムービー（任意）|10|17,253,338 / 16.45 MiB|

common内訳:

|範囲|URL数|bytes / MiB|
|---|---:|---:|
|兵士|1|15,341,532 / 14.63 MiB|
|現行ANOMALY（8種＋BASTION＋FOUNDRY節）|10|29,678,712 / 28.30 MiB|
|武器realism-v2（3モデル×5レア度）|15|8,603,028 / 8.20 MiB|
|戦闘WAV（効果音・兵士・敵声）|63|4,080,262 / 3.89 MiB|
|必要UI画像（title/lock/強化）|27|25,521,814 / 24.34 MiB|

初期選択はapp/common、マップは個別、bgm/moviesはoptional:trueで初期オフ。未取得の大きいUI画像も含めてcommonは約79.4MiBなので、0バイトに近いshellだけが保存されると誤解させない。次の進撃1マップまたは現行生存1マップを選ぶ形が容量を抑えやすい。

## manifest/plugin接続

scripts/asset-download-catalog.mjsが現行ローダー/HTML/CSSの参照からURLを導く。scripts/asset-download-manifest.mjsのassetDownloadManifestPluginをViteへ接続し、asset-download-manifest.jsonを出力する。pure生成関数generateAssetDownloadManifestは入力を読み、結果を返し、ファイルを書き換えない。形式はversion:1、revision:SHA-256、packs（id/label/description/optional/assets）、各assetはBASEからの相対URL/実bytes/実SHA-256。queryのcontent digestも保持する。

buildはgenerateBundleで出力名だけを予約し、writeBundle(order:post)でそのbuildの全chunk/CSS/HTML/その他runtime出力の最終ファイルを読み、index.html/front.htmlの欠損を拒否する。closeBundle(post)でもmanifest全件の実bytes/SHAを再検査する。distの古い残骸やpublic全体を列挙しない。source mapは除外。SW登録スクリプト自体はブラウザが管理するためpackへ重複保存しない。

開発serverはBASE付きの同endpointをmiddlewareで返す。Viteの変換済みTS/HTMLをrawファイルのhashで保存済みにしないため、devのappは空＋説明文とする。appが空の開発環境を完全保存/オフライン対応とは表示しない。common/map/mediaは実データhashが使える。watch変更時に再生成し、応答はno-store。

現在のdevカタログrevision: 48ebdb566866f6c63966413aec27c64ea7d669d0e8d5cfae86e811ebef27b81b。本番revisionは現行bundleが加わるため異なる。

## 更新・容量不足・中断再開の安全な接続案

以下は保存エンジン担当へ渡す設計であり、本担当がブラウザへ保存した結果ではない。

1. 現行manifestをnetwork-firstで取得し、保存済みmanifestはオフライン時のfallbackに限定。URLが同じmap_v1/weapon名でも内容更新を検出できるよう、revisionと個別SHAを正本にする。
2. 既存SWのcache-firstが古い実体を返す経路を避け、検証用fetchのreload要求をSWで素通しする。200の完全応答だけを受け、実bytesとSHAを確認して専用素材cacheへ格納。HTMLやAPIへ見えるエラーページを誤ってassetとして完成扱いしない。
3. 新版は検証完了したファイルだけを段階保存し、必要packの全ファイルが確認できるまで保存済みにしない。旧版の使用中ファイルを途中で消さず、切替後に不要な素材cacheだけ整理する。実セーブ/ログイン/部屋情報のstorageを消さない。
4. 容量は選択URLの重複を除いた実bytesで表示。storage.estimateの空き容量は目安、persist要求も成功保証にしない。QuotaExceeded等の失敗時は『容量不足・未完了』として残し、取得済みの正しいファイルと既存セーブを保護する。
5. AbortControllerで中止し、再開は完了済みファイルを照合して不足分から。未完ファイルは完全取得から再試行し、現行配信で保証されていないbyte-range再開を約束しない。BGMの206は既存SWがcache.putしないため、明示保存は完全200のfetchを用い、再生/seekのオフライン挙動は実ブラウザで確かめる。
6. 原則1〜2本ずつ、戦闘開始時は事前DLを止めるなど、GLB decode/GPU準備や協力通信と帯域・CPUを奪い合わない。隠れたbackground大量DLやモバイル回線での自動全取得は追加しない。

## 本担当の検証と未確認

新規tests/asset-download-manifest.test.tsは最終16件成功。現行URL限定、任意media分離、同じ入力のrevision再現、同長内容変更の検出、query維持、実bytes/SHA、欠損、path escape拒否、GLB buffer/texture、remote依存拒否、両HTML要求、BASE付きdev GET/HEAD、実Viteのpreload処理・後続generate・disk-only書換え後の最終byte一致を確認した。node --check両script、Prettier担当3ファイル、git diff --checkも成功。

本担当は隔離した一時rootで実Vite buildまで確認した。実プロジェクト全体の次build・manifest配信・SW保存・容量不足・中止再開・生存オフライン出撃・実スマホは主担当の統合確認と区別し、未実施を成功とは扱わない。費用発生、公開、commit/pushなし。実モデル/effort実値は未確認、呼出指定gpt-6.1-sol/high。

## 現行URL・個別サイズ一覧

以下は上のカタログを実ファイルへ照合した調査時点の値。正本となる実行時リストは生成manifest。サーバーURLはBASE_URL＋以下の相対URL、ローカルはpublic/＋queryを除いた相対パス。

|pack|URL|bytes|
|---|---|---:|
|app（静的）|assets/fonts/rajdhani/Rajdhani-Bold.ttf|400,680|
|app（静的）|icon-swarm-v4-180.png|74,779|
|app（静的）|icon-swarm-v4-192.png|86,143|
|app（静的）|icon-swarm-v4-512-maskable.png|417,504|
|app（静的）|icon-swarm-v4-512.png|539,155|
|app（静的）|icon-swarm-v4-64.png|11,048|
|app（静的）|icon-swarm-v2-512.png|517,806|
|app（静的）|manifest.webmanifest|792|
|common|assets/audio/anomaly-voice-v3/ant-0.wav|71,724|
|common|assets/audio/anomaly-voice-v3/ant-1.wav|71,724|
|common|assets/audio/anomaly-voice-v3/bastion-0.wav|99,244|
|common|assets/audio/anomaly-voice-v3/bastion-1.wav|99,244|
|common|assets/audio/anomaly-voice-v3/boss-0.wav|134,444|
|common|assets/audio/anomaly-voice-v3/boss-1.wav|134,444|
|common|assets/audio/anomaly-voice-v3/boss-linked-0.wav|137,644|
|common|assets/audio/anomaly-voice-v3/boss-linked-1.wav|137,644|
|common|assets/audio/anomaly-voice-v3/boss-separated-0.wav|107,564|
|common|assets/audio/anomaly-voice-v3/boss-separated-1.wav|107,564|
|common|assets/audio/anomaly-voice-v3/calyx-0.wav|118,444|
|common|assets/audio/anomaly-voice-v3/calyx-1.wav|118,444|
|common|assets/audio/anomaly-voice-v3/crawler-0.wav|112,044|
|common|assets/audio/anomaly-voice-v3/crawler-1.wav|112,044|
|common|assets/audio/anomaly-voice-v3/harrow-0.wav|118,444|
|common|assets/audio/anomaly-voice-v3/harrow-1.wav|118,444|
|common|assets/audio/anomaly-voice-v3/hornet-0.wav|105,644|
|common|assets/audio/anomaly-voice-v3/hornet-1.wav|105,644|
|common|assets/audio/anomaly-voice-v3/spider-0.wav|83,244|
|common|assets/audio/anomaly-voice-v3/spider-1.wav|83,244|
|common|assets/audio/anomaly-voice-v3/spitter-0.wav|110,124|
|common|assets/audio/anomaly-voice-v3/spitter-1.wav|110,124|
|common|assets/audio/ar-hit-v1/impactHard.wav|30,764|
|common|assets/audio/ar-hit-v1/impactShell.wav|30,764|
|common|assets/audio/ar-hit-v1/impactSoft.wav|30,764|
|common|assets/audio/rocket-final-v1/rocketBurst.wav|130,478|
|common|assets/audio/se-v1/acid.wav|41,644|
|common|assets/audio/se-v1/burst.wav|80,044|
|common|assets/audio/se-v1/charge.wav|44,844|
|common|assets/audio/se-v1/dodge.wav|32,044|
|common|assets/audio/se-v1/down.wav|44,844|
|common|assets/audio/se-v1/equip.wav|32,044|
|common|assets/audio/se-v1/hurt.wav|14,124|
|common|assets/audio/se-v1/impact.wav|14,124|
|common|assets/audio/se-v1/kill.wav|25,644|
|common|assets/audio/se-v1/land.wav|28,844|
|common|assets/audio/se-v1/laser.wav|51,244|
|common|assets/audio/se-v1/leap.wav|25,644|
|common|assets/audio/se-v1/lunge.wav|25,644|
|common|assets/audio/se-v1/melee.wav|27,564|
|common|assets/audio/se-v1/menu.wav|4,844|
|common|assets/audio/se-v1/ready.wav|24,364|
|common|assets/audio/se-v1/reload.wav|41,644|
|common|assets/audio/se-v1/revive.wav|35,244|
|common|assets/audio/se-v1/rocket.wav|48,044|
|common|assets/audio/se-v1/spit.wav|26,924|
|common|assets/audio/se-v1/stake.wav|22,444|
|common|assets/audio/se-v1/switch.wav|26,924|
|common|assets/audio/se-v1/unequip.wav|22,444|
|common|assets/audio/se-v1/warning.wav|12,844|
|common|assets/audio/selected-v1/rifle.wav|6,060|
|common|assets/audio/selected-v1/shotgun.wav|94,524|
|common|assets/audio/voice-young-soldier-v1/cover.wav|42,284|
|common|assets/audio/voice-young-soldier-v1/empty.wav|80,204|
|common|assets/audio/voice-young-soldier-v1/fire-alt.wav|52,844|
|common|assets/audio/voice-young-soldier-v1/fire.wav|37,004|
|common|assets/audio/voice-young-soldier-v1/hurt-alt-v2.wav|95,564|
|common|assets/audio/voice-young-soldier-v1/hurt.wav|22,124|
|common|assets/audio/voice-young-soldier-v1/reload-alt.wav|38,924|
|common|assets/audio/voice-young-soldier-v1/reload.wav|44,204|
|common|assets/audio/voice-young-soldier-v1/warning.wav|51,884|
|common|assets/audio/voice-young-soldier-v1/wave-alt.wav|75,884|
|common|assets/audio/voice-young-soldier-v1/wave.wav|64,844|
|common|assets/characters/swarm-soldier.glb?v=d1028fd14cb42cfab2a0c484c57fa99032dc73609f8c3a08684abdec76f35269|15,341,532|
|common|assets/enemies/bastion_v1.glb?rev=8dedf5952722|1,554,584|
|common|assets/enemies/calyx_motion_v1.glb?rev=d1a7573d5976e284|629,024|
|common|assets/enemies/foundry_zero_mechanical_legs_v2.glb|1,787,652|
|common|assets/enemies/foundry_zero_motion_v1.glb|1,885,412|
|common|assets/enemies/harrow_motion_v14.glb|14,151,632|
|common|assets/enemies/hound_motion_v1.glb|605,876|
|common|assets/enemies/leaper_motion_v3.glb|3,802,608|
|common|assets/enemies/pleat_motion_v5.glb|4,394,424|
|common|assets/enemies/prism_motion_v1.glb|443,412|
|common|assets/enemies/ray_motion_v1.glb|424,088|
|common|assets/ui/title-atmosphere-v1.png|1,813,295|
|common|assets/ui/title-logo-v2.png|1,032,285|
|common|assets/ui/weapon-locked.png|873,911|
|common|assets/ui/weapon-unlocked.png|876,093|
|common|assets/weapons/realism-v2/rifle_0.glb|792,224|
|common|assets/weapons/realism-v2/rifle_1.glb|792,224|
|common|assets/weapons/realism-v2/rifle_2.glb|792,224|
|common|assets/weapons/realism-v2/rifle_3.glb|792,224|
|common|assets/weapons/realism-v2/rifle_4.glb|792,220|
|common|assets/weapons/realism-v2/rocket_0.glb|483,424|
|common|assets/weapons/realism-v2/rocket_1.glb|483,424|
|common|assets/weapons/realism-v2/rocket_2.glb|483,424|
|common|assets/weapons/realism-v2/rocket_3.glb|483,424|
|common|assets/weapons/realism-v2/rocket_4.glb|483,420|
|common|assets/weapons/realism-v2/shotgun_0.glb|444,960|
|common|assets/weapons/realism-v2/shotgun_1.glb|444,960|
|common|assets/weapons/realism-v2/shotgun_2.glb|444,960|
|common|assets/weapons/realism-v2/shotgun_3.glb|444,960|
|common|assets/weapons/realism-v2/shotgun_4.glb|444,956|
|common|rebuild/upgrades/afterimage-mine.png|104,027|
|common|rebuild/upgrades/armor-piercer.png|71,657|
|common|rebuild/upgrades/armor.png|132,454|
|common|rebuild/upgrades/blast-core.png|107,467|
|common|rebuild/upgrades/blast-radius.png|1,848,906|
|common|rebuild/upgrades/boost-coil.png|1,362,642|
|common|rebuild/upgrades/burst-cell.png|1,370,090|
|common|rebuild/upgrades/compressed-charge.png|126,047|
|common|rebuild/upgrades/emergency-armor.png|2,295,064|
|common|rebuild/upgrades/fuse.png|77,290|
|common|rebuild/upgrades/fusion-aegis.png|2,048,204|
|common|rebuild/upgrades/fusion-atlas.png|2,366,679|
|common|rebuild/upgrades/fusion-collector.png|1,461,088|
|common|rebuild/upgrades/fusion-reactor.png|1,865,659|
|common|rebuild/upgrades/interceptor.png|64,851|
|common|rebuild/upgrades/line-shot.png|67,061|
|common|rebuild/upgrades/magazine.png|58,446|
|common|rebuild/upgrades/magnet.png|1,698,184|
|common|rebuild/upgrades/opening-shot.png|1,944,674|
|common|rebuild/upgrades/recovery-pack.png|1,621,588|
|common|rebuild/upgrades/reload.png|72,946|
|common|rebuild/upgrades/ricochet.png|68,145|
|common|rebuild/upgrades/tactical-reload.png|93,061|
|map-0|assets/maps/distant_0_v1.glb|2,754,680|
|map-0|assets/maps/map_0_v1.glb|14,594,828|
|map-1|assets/maps/distant_1_v1.glb|509,736|
|map-1|assets/maps/map_1_v1.glb|2,847,392|
|map-2|assets/maps/distant_2_v1.glb|1,058,804|
|map-2|assets/maps/map_2_v1.glb|9,863,852|
|map-3|assets/maps/distant_3_v1.glb|505,916|
|map-3|assets/maps/map_3_v1.glb|15,210,828|
|map-4|assets/maps/distant_4_v1.glb|850,992|
|map-4|assets/maps/map_4_v1.glb|2,328,652|
|map-5|assets/maps/map_5_v1.glb|4,857,828|
|map-survival-0|assets/maps/defense_0_v2.glb|11,593,464|
|bgm|assets/audio/bgm-v1/base.mp3|4,643,957|
|bgm|assets/audio/bgm-v1/clear.mp3|206,299|
|bgm|assets/audio/bgm-v1/lobby.mp3|1,394,591|
|bgm|assets/audio/bgm-v1/map-0.mp3|4,323,720|
|bgm|assets/audio/bgm-v1/map-1.mp3|2,290,162|
|bgm|assets/audio/bgm-v1/map-2.mp3|4,412,117|
|bgm|assets/audio/bgm-v1/map-3.mp3|3,449,488|
|bgm|assets/audio/bgm-v1/map-4.mp3|3,267,529|
|bgm|assets/audio/bgm-v1/map-5.mp3|3,844,903|
|bgm|assets/audio/bgm-v1/prepare.mp3|2,248,347|
|bgm|assets/audio/bgm-v1/report.mp3|3,808,185|
|bgm|assets/audio/bgm-v1/title.mp3|3,374,244|
|bgm|assets/audio/bgm-v1/victory.mp3|1,236,162|
|movies|assets/encounters/report-v3/ant-20261015.mp4?v=c99de7b5a417|1,539,179|
|movies|assets/encounters/report-v3/bastion-20261018.mp4?v=79f14d199441|1,688,424|
|movies|assets/encounters/report-v3/boss-20261015.mp4?v=ed60fcf09355|1,656,747|
|movies|assets/encounters/report-v3/calyx-20261015.mp4?v=8557f0143310|1,155,454|
|movies|assets/encounters/report-v3/crawler-20261015.mp4?v=5fdd8cbc8f66|1,760,141|
|movies|assets/encounters/report-v3/harrow-20261015.mp4?v=81161e9bbbd3|3,051,535|
|movies|assets/encounters/report-v3/hornet-20261015.mp4?v=aa842551120f|1,453,743|
|movies|assets/encounters/report-v3/spider-20261015.mp4?v=18079378e93f|1,648,103|
|movies|assets/encounters/report-v3/spitter-20261015.mp4?v=5cffaeed30aa|2,018,023|
|movies|assets/encounters/report-v3/worm-20261015.mp4?v=e3b73bd91414|1,281,989|

## 最終build実体との不一致修正（追加）

実ブラウザ保存がassets/legacy-O-U9Q0tN.jsで「版が切り替わりました」と止まるとの主担当報告を受け、既存distは読み取りだけで全183assetを照合した。2件だけ不一致、残る181件は一致した。

|URL|旧manifest bytes|最終dist bytes|差|
|---|---:|---:|---:|
|assets/legacy-O-U9Q0tN.js|15,870|16,614|+744|
|assets/playtest-app-DK1ROlut.js|79,684|79,940|+256|

両JSの最終実体に__vite__mapDepsがあり、現行Vite 8.2.2の内部vite:build-import-analysisがgenerateBundleでpreload依存表を挿入してchunk.codeを変更することを、node_modules/vite/dist/node/chunks/node.js:28958と29117–29133で確認。初回生成器はその前のchunk.codeをhashしていた。版の実更新を検出したのではなく、ワシの生成時点と配信実体の不一致だった。初回単体は仮bundleだけで、Vite後続処理まで検査していなかった。

方式の比較:

- generateBundleを単にpost順へ寄せるだけなら今回のpreload処理後に回せる可能性はあるが、diskのみの後続書換えやpublicコピーの最終実体までは保証しない。
- closeBundleだけで生成すると終端に寄せられる一方、各output/writeやwatchの更新点として扱いづらい。
- 採用した方式は、generateBundleで未完の名前だけ予約し、writeBundle(order:post/sequential)で実際に書かれた現行bundleファイルとpublicコピーからhash/bytesを生成する。closeBundle(post)で全件を再照合し、別writerが後で変えていればbuildを失敗させる。現在のRolldownはhookを逐次実行すると型定義にも明記されている。

manifestは検証後に一時ファイルからatomic renameする。isWrite=falseのbuildは最終byte保証ができないため成功扱いせず、明示エラーとする。純生成関数は従来どおり別に利用できる。dev endpointとBASE相対URL契約は維持。

正式回帰として、一時rootの実Vite buildに /swarm-test/ BASE、dynamic importとCSSによるVite preload挿入、後続generateBundleの書換え、bundleオブジェクトには反映しないdisk-only書換えを重ねた。最終出力の全assetについてbytes/SHA一致、BASE維持、書換え後codeの採用を確認した。さらに出力を故意に改変するとverifyAssetDownloadManifestが拒否することを確認した。最終16件成功、両script構文・Prettier・diff check成功。実プロジェクトのdistは本担当が変更せず、主担当の次buildへ引き渡した。

またsrc/client/media-session.tsの実参照icon-swarm-v2-512.png（517,806B）をappのshellへ追加した。v2という名前でも現在使われているため除外しない。app静的部分は8URL・2,047,907B、common116URLの容量は変わらない。

実build後に `verifyAssetDownloadManifest('dist')` を呼べば、manifest全件の最終現物照合とchecked/revisionを取得できる。主担当による本体build・配信保存成功はその実結果で判断する。
