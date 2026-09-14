# 選定した武器SEを正式版へ — 2026-09-14

ユーザー指定: AR-04、SG-01、RL-05。「一旦正式版に入れて」により既存Workerへの公開まで承認。

## 変更
- `src/client/audio.ts`: 射撃3種のみ新URL `assets/audio/selected-v1/` から読み込み。最終バスの0.6ゲインでコンプレッサーの過渡的なピーク超過を抑制（全SEに同率適用）。既存の距離減衰・左右定位・音量設定・停止・32音制限を維持。
- `public/assets/audio/selected-v1/`: WAV3音、出典、加工区間・ハッシュを含むmanifest。AR-04はAK-47連射録音の最初の1発（0.255–0.349秒）を抜き出し、ゲームの射撃イベントごとに再生。SG-01とRL-05は無音整理・端点フェード・音量調整。32kHz mono PCM16。
- `src/client/changelog.ts`: 発射音更新とElevenLabsの帰属表示（elevenlabs.io）。出典は公開CREDITSにも記載。ElevenLabs公開ライブラリFAQの無料利用・クレジット表記を参照。購入・有料生成なし。商用利用条件の無条件保証はしていない。
- `src/shared/map-blocks.ts` / `defs.ts` / `stages.ts`: 検証で見つかったdefs→progression→stages→defsの初期化循環を、BLOCKSの定義分離で解消。定義本文が変更前と完全一致することを検証。地形数値・戦闘仕様は変更なし。
- `scripts/build-selected-se.py`、`check-selected-se*.mjs`: 再生成・射撃操作・混合・公開一致の検証。

## 検証
- 型チェック、既存audio 6テスト、通常/Pages build、production Worker dry-run成功。
- Chromeで26音decode、3種の選定バッファが実際に起動すること、ミュート/停止/32音上限を確認。
- 3種32音・音量1で完全同時のピーク0.9281、3msずらした混合0.7276。初回のピーク超過を最終出力の余裕で修正。
- ローカル開発版・配布版で実射撃/装填完了/切替/散弾/回避/一時停止成功、pageerror 0。初回decode待ちの既存fallback click 1回あり。
- 元のaudioテストは初期化循環により0件実行で失敗したが、定義分離後は6件すべて成功。
- 既存chunk size警告あり。人間の主観試聴・実スマホの出音は未確認。

## 監査
branch: codex/home-armory
base=head: 4186f25f7c9695f95ea897ad182db5f85fac3091
commit/mergeなし。開始時から多数の未コミット/未追跡変更あり、既存差分を保護。
今回前後の差分: dist-validation/selected-se/changes.patch
変更前ファイル: dist-validation/selected-se/before/
波形・混合・実ゲームの証拠: dist-validation/selected-se/{engine,three-weapons,browser,distribution}.json

## 公開結果

既存Workerへ公開成功。Version `bb0653da-e1eb-486d-9de7-94fec3875c44`。
https://swarm-front.melosalife-24.workers.dev

公開34ファイルのSHA256一致、health 200/ok。公開Chromeで実射撃・装填完了・切替・散弾・回避・停止成功、pageerror 0。証拠 `dist-validation/selected-se/published.json` と `published-assets.json`。
