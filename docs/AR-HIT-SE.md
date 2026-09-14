# AR命中音3種の暫定採用 — 2026-09-15

ユーザー指定のHIT-05・07・10をARの敵命中へ暫定採用。

| 候補 | 敵 | 質感の割り当て |
|---|---|---|
| HIT-05 / impactShell | PLEAT、HOUND / VOLLEY・LEAPER | 乾いた硬化層・砕ける外殻 |
| HIT-07 / impactHard | PRISM、FOUNDRY ZERO通常・連結炉 | 硬質な面・機械的な表面 |
| HIT-10 / impactSoft | RAY | 柔軟な被覆、短い打撃 |

比較動画のWAVをバイト単位でそのまま採用（各0.32秒、48kHz mono PCM16）。ゲインは既存impact同様0.24。Kenney Impact Sounds CC0、素材・加工条件・ハッシュはpublic/assets/audio/ar-hit-v1/manifest.json。

## 実装

- shared/game.ts: hitイベントへ敵種と直接射撃の武器種を付加。撃破・敵削除後も音色が確定。shotにも敵種を付けARの射線終端から同じ着弾を二重生成しない。戦闘計算は変更なし。
- client/combat-audio.ts: ARのみ対応表で鳴り分け。旧イベント・壁や地面・SG/RLは従来音を維持。
- client/audio.ts: 3素材の先読み。距離減衰、同一発生元75ms制限、32音上限、ミュート・停止を継承。
- client/changelog.ts: ユーザー向け更新履歴。

## 検証

- 型チェック、audio 15テスト、通常/Pagesビルド、production Worker dry-run成功。
- Chromeで6種＋連結炉の全7形態の選択バッファ一致、旧impactとの二重再生なし、同一イベント再生なし。
- 音源30本デコード、新3本のRMS約0.12。ミュート/停止、同一ownerの音色違いも75ms抑制、別ownerは併存、最大32音、13mでgain 0.5。
- 32音を最大音量で混合: 同時ピーク0.73454、3ms間隔0.37531。クリップなし。
- ローカル専用Workerと実WebSocket 2接続: AR→bossの同一イベントが両者へ届き、両者impactHard。模擬通信は不使用。
- 配布版の実射撃・装填完了・切替・SG・回避・停止成功、pageerror 0。新3音の配布版デコードも成功。初回操作時の既存fallback click 1回。
- 実スマホの出音、人間による最終聴感評価は未実施。

9/15公開前、ChromeのCloudflare契約画面でFree / 0ドル / 現在のプランを確認。Workers画面の表示期間9/1〜9/14で240 requests、CPU 210ms。プラン・権限変更なし。

## 監査

branch codex/home-armory、base=head 4186f25f7c9695f95ea897ad182db5f85fac3091。既存未コミット/未追跡差分を保持、commit/mergeなし。今回の変更前5ファイルはdist-validation/ar-hit/before/、今回差分はchanges.patch。新規素材・検証スクリプト・本記録を追加。

証拠: dist-validation/ar-hit/{browser,network,distribution,distribution-decode}.json。再現: scripts/check-ar-hit.mjs、check-ar-hit-network.mjs、check-ar-hit-release.mjs。素材確認と配布メタデータ作成: scripts/package-ar-hit.mjs。

## 公開

既存Workerへ公開完了。Version `64e99a11-07cc-4ffd-81c5-a6ad8af3825a`。更新13ファイル。https://swarm-front.melosalife-24.workers.dev

公開版の18配信ファイル（JS/CSS/index/新3WAV/出典・manifest）のSHA256一致、health 200/ok。公開Chromeでも新3素材のdecode、実射撃・装填完了・切替・SG・回避・停止成功、pageerror 0。公開操作は敵への命中を必須にせず、全7形態の命中音選択はローカルChromeで確認し、公開コード・素材の一致を照合した。`published.json` / `published-assets.json`。

環境上の途中失敗: 制限付き実行ではWranglerのログ書込み・親ディレクトリ参照と公開先ネットワークが拒否された。承認レビューを通した権限付き実行で必要な検証を完了。ゲームコードの失敗ではない。
