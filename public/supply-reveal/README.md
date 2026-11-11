# 補給ポッド表示モジュール

`runtime.js` の `createSupplyReveal(host, options)` は、サーバーで確定・保存された結果を表示するだけです。抽選、券、確率、保存、課金は含みません。

使用画面では `/supply-reveal/gacha.css` を `<link rel="stylesheet">` で読み込みます。

```js
import { createSupplyReveal } from '/supply-reveal/runtime.js';
const reveal = createSupplyReveal(host, {
  label: '補給券',
  assetBase: '/supply-reveal/assets/',
  onClose: () => {},
  onEvent: (event) => {},
});
await reveal.play(finalizedResults);
```

結果配列は元の `gacha.js` と同じ1件または10件です。`type` は `weapon` / `shard` / `buddy`、武器の `rarity` は `N` / `R` / `SR` / `SSR` です。`new`、`amount`、`art` も元の契約に従います。`play(results, { effects: 1..10 })` は検証用の番号指定で、結果と演出の下限が合わない場合はエラーです。`effects: 0` で追加演出なし、未指定なら適合する番号を表示側で順番に選びます。バディは⑩を優先します。選択は報酬内容や確率を変えません。

操作は `tap()` / `skip()` / `close()` / `destroy()`、設定は `setFast(bool)` / `setReduced(bool)` / `setSound(bool)` です。`ready` は素材の準備、`state()` と `model()` は現在の状態、`timeline()` と `seek(t, idle, tap, fx)` は検証用です。`captions: true` のときだけ元動画と同じ見出し・副題を表示します。通常は字幕なしです。射出前・昇格・開封待ちはタップで進み、⑦は長押しから離すと解放します。短いタップ、途中で離す、指が外れる場合も自動で進みます。Escとスキップは即座に最終結果へ移ります。

## 元動画との対応

生成元は `design/gacha-reveal-max-20261111/kakutei/kakutei-preview.mjs` の `CLIPS` です。`reference-scenes.js` はその `c01` と `CLIPS` の範囲をそのまま抽出しました。`core.js` の `createRenderer` 全文と `kakutei-fx.js` の `FX` オブジェクト全文は元ファイルと文字単位で一致します。①～⑩の時刻、FX引数、追加音の合図は `CLIPS` から計算し、元の描画式・色・粒子・素材・効果音波形は変えていません。10連の⑤～⑩は該当する当たりポッドの時刻・位置へ同じ式を適用します。

素材11ファイルは元 `assets/` と全件SHA-256一致です。`gacha.css` SHA-256 `DE9835141AA8FED4F1947226DCCC2E6EC06AD5B3E3264985D4D44A9A2432C502`、`sfx-worker.js` `BAA2A1467213D1A378CF76239A18ADCDBCFCBDC58956710BFEC0476D30E2122D` は原本と一致します。`sfx.js` の波形生成・mixは原本のままで、ブラウザーの音量設定への接続と破棄時のAudioContext/Worker解放だけを追加しました。`core.js` は外部操作・音の合図・音量・入力後始末の口だけ、`kakutei-fx.js` はマウント場所と破棄処理だけを変更しました。

## 検証

`node public/supply-reveal/verify.mjs` は実Chromeで10案と10連への適用、通常・動き減、スキップ、実時間のタップ進行、close/destroy後の残留を検証します。短い確認は `SUPPLY_QUICK=1`、10連での実時間確認は `SUPPLY_LIVE_MULTI=1` を付けます。検証器はローカルの静的サーバーを使用し、新たな依存のインストールや外部送信はしません。
