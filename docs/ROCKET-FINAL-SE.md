# ロケット発射・爆発SE正式採用 — 2026-09-14

ユーザー承認: EX-05を爆発音へ、最初に制作した発射SEへ戻し、正式採用して公開。

- 発射: `se-v1/rocket.wav`をそのまま復元。0.75秒、SHA256 570fd95fbd430e3e0547d8938c6d2fd36e9a1c5bfc3fdf5661269b0517615a41。元manifestと一致。再合成なし。
- 爆発: EX-05 / Mixkit「Bomb explosion in battle」2800。無音整理、端点フェード、音量調整、32kHz mono PCM16。`rocket-final-v1/rocketBurst.wav` 2.038秒。公開CREDITSとmanifestに出典・加工範囲・ハッシュ。
- `game.ts`: 既存Event.weaponにrocketを記録（直撃爆発と誘爆）。ダメージ・半径・発生条件は変更なし。
- `combat-audio.ts`: rocketタグ付きburstを専用rocketBurstへ。他のburst・近接音は保持。
- `audio.ts`: 発射は初期URL、rocketBurstは新URL。爆発距離減衰を維持。AR-04/SG-01、出力余裕、音量・ミュート・停止は保持。
- `changelog.ts`: 正式採用を追記。

検証: 型チェック、audio 7テスト成功。実fire/stepによる発射→着弾の鳴り分けと重複抑止、敵大攻撃・近接の音保持を確認。Chrome全27音decode、選択バッファ、32音混合ピーク0.9497（完全同時）/0.6008（3msずれ）、ミュート・停止を確認。開発版の実射撃・装填・切替・回避・停止成功、pageerror0。

branch codex/home-armory / base=head 4186f25f7c9695f95ea897ad182db5f85fac3091。既存の未コミット・未追跡差分あり、今回分のみ編集。commit/mergeなし。
監査: dist-validation/rocket-final/changes.patch と before/、engine.json、mix-all.json、browser.json。人間による主観試聴・実スマホの出音は未確認。

通常/Pages build、production Worker dry-run成功（既存chunk size警告のみ）。配布版の実射撃・装填・切替・回避・停止成功、pageerror0。

公開Version: 4dbb61c1-aec5-43db-b4ba-dd47169406bd。公開46取得のSHA256一致・health 200/ok。
https://swarm-front.melosalife-24.workers.dev

公開Chromeでも射撃・装填完了・切替・散弾・回避・停止成功、pageerror0。証拠: dist-validation/rocket-final/published.json / published-assets.json。初回decode中の既存fallback click 1回。
