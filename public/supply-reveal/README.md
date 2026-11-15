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

結果配列は元の `gacha.js` と同じ1件または10件です。`type` は `weapon` / `shard` / `buddy`、武器の `rarity` は `N` / `R` / `SR` / `SSR` です。`new`、`amount`、`art` も元の契約に従います。`play(results, { effects: [launch, drop, opening] })` は検証用の局面指定で、各要素は採用IDか0です。単一IDも指定できます。結果と演出の下限・複数局面条件・最後枠の色が合わなければエラーです。`effects: 0` は明示FXなしで、最後枠のデフォルト色による②の合図は計数します。未指定時は再生前に一つの凍結済み計画を作り、`state().plan` で確認できます。選択は報酬内容や確率を変えません。

採用IDは既存 `1, 2, 3, 4, 9, 10`、新規 `response, signature, heartbeat, multilock, sonic, reverse, reverseSeal, lamp, landing, delayed, skeleton` です。旧5〜8は通常候補に入りません。①BUDDYの2案は同時に選ばず回ごとに選びます。箱を指す合図は計画内の対象indexへ固定します。10連の最後枠がデフォルト色なら②を占有し、他②は出ません。複数局面は10連ならSSR2個以上またはBUDDYあり、単発ならBUDDYありの場合だけです。BUDDYと別局面のSSR合図から別のSSR報酬を約束しません。

操作は `tap()` / `skip()` / `close()` / `destroy()`、設定は `setFast(bool)` / `setReduced(bool)` / `setSound(bool)` です。`ready` は素材の準備、`state()` と `model()` は現在の状態、`timeline()` と `seek(t, idle, tap, fx)` は検証用です。`captions: true` のときだけ元動画と同じ見出し・副題を表示します。通常は字幕なしです。射出前・昇格・開封待ちはタップで進み、⑦は長押しから離すと解放します。短いタップ、途中で離す、指が外れる場合も自動で進みます。Escとスキップは即座に最終結果へ移ります。

## 元動画との対応（導入当時の記録）

生成元は `design/gacha-reveal-max-20261111/kakutei/kakutei-preview.mjs` の `CLIPS` です。`reference-scenes.js` はその `c01` と `CLIPS` の範囲をそのまま抽出しました。`core.js` の `createRenderer` 全文と `kakutei-fx.js` の `FX` オブジェクト全文は元ファイルと文字単位で一致します。①～⑩の時刻、FX引数、追加音の合図は `CLIPS` から計算し、元の描画式・色・粒子・素材・効果音波形は変えていません。10連の⑤～⑩は該当する当たりポッドの時刻・位置へ同じ式を適用します。

描画素材10ファイルは元 `assets/` と全件SHA-256一致です。OFLライセンスは文言を保持し、末尾空白だけ整えました。`gacha.css` SHA-256 `DE9835141AA8FED4F1947226DCCC2E6EC06AD5B3E3264985D4D44A9A2432C502`、`sfx-worker.js` `BAA2A1467213D1A378CF76239A18ADCDBCFCBDC58956710BFEC0476D30E2122D` は原本と一致します。`sfx.js` の波形生成・mixは原本のままで、ブラウザーの音量設定への接続と破棄時のAudioContext/Worker解放だけを追加しました。`core.js` は外部操作・音の合図・音量・入力後始末の口だけ、`kakutei-fx.js` はマウント場所と破棄処理だけを変更しました。

## 検証

`node public/supply-reveal/verify.mjs --foundation` は既存候補だけの土台検証、`--effect <ID>` は追加ごとの固定結果確認、引数なしは採用全案と局面の組合せを実Chromeで検査します。単発/10連、通常/動き減、対象箱/結果不変、最後枠、スキップの獲得確認、終了後の残留を確認し、`docs/evidence/gacha-signals-20261115/` へJSONと画像を保存します。実機の見た目と実聴の最終評価は本人の確認事項です。
