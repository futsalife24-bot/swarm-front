# 作戦演出（出撃など）の表示サイズ修正（2026-10-17）

本人依頼: 「出撃のサイズがでかすぎる（他の文字でも同じ？）のでチェック&修正して」。添付画面は生存の出撃演出 `srv-sortie`（出撃 DEPLOY）が強化選択のカードを覆っている状態。

## 原因

7種類の作戦演出（`adv-sortie` 出撃／`adv-extract` 撤収完了／`adv-failed` 作戦失敗／`adv-complete` 作戦達成／`srv-sortie` 出撃／`srv-extract` 撤収完了／`srv-ended` 戦闘終了）は共通の `.operation-cue.has-image` で「幅100%・最大960px・縦横比960:336」。高さの上限がなく、横画面のスマホでは帯が画面幅いっぱいになり、高さが画面の62〜78%を占めていた。1280×720でも47%。7種類とも同じ規則なので「他の文字」も同じ状態だった。

## 修正

`src/client/operation-cue.css` だけを変更。帯の高さを画面の高さの30%（`dvh`、非対応環境は `vh`）までに抑え、幅は縦横比から決める。安全領域を除いた画面幅と最大960pxの上限、上端中央の位置、画像・時間・取消・読み上げなどの動作は従来どおり。割合は CSS 変数 `--operation-cue-max-height` 1か所で調整できる。

| 画面 | 修正前（帯の幅×高さ・高さ比） | 修正後 |
|---|---|---|
| 667×375 | 667×233・62% | 321×112・30% |
| 740×360 | 740×259・72% | 309×108・30% |
| 844×390 | 844×295・76% | 334×117・30% |
| 915×412 | 915×320・78% | 353×124・30% |
| 1280×720 | 960×336・47% | 617×216・30% |
| 1920×1080 | 960×336・31% | 926×324・30% |

7種類すべてで同じ値（[計測](evidence/operation-cue-size-20261017/measure-after.json)）。実際のソロ出撃（出撃準備→出撃→強化選択と同時に出る `srv-sortie`）を同じページで修正前（旧CSSを差し込み）と修正後で撮影: [915×412](evidence/operation-cue-size-20261017/sortie-before-after-915x412.jpg)、[844×390](evidence/operation-cue-size-20261017/sortie-before-after-844x390.jpg)、[1280×720](evidence/operation-cue-size-20261017/sortie-before-after-1280x720.jpg)。修正後は強化カードを覆わない。横画面のスマホでは上端の「強化を選べ」の見出しに約2秒だけ一部が重なる（1280×720では重ならない）。7種類の修正後: [844×390一覧](evidence/operation-cue-size-20261017/all-cues-after-844x390.jpg)。

## 検証

- E2E `e2e/operation-cue.spec.ts`: 5寸法×3種類で「高さが画面の30%以内・比率20:7・上端中央」を追加し合格。既存のライフサイクル（取消・連打・設定切替・APNG失敗）も合格。
- 実画像 `e2e/event-banners-real.spec.ts`: 7種類×標準/スマホの読込・保持・消去が合格。この試験が過去の証拠フォルダへ書くスクリーンショットは元に戻した。
- 既存の失敗2件（`mobile image is decorative and skip stays in menu flow` と `OS reduce loads the received PNG only and mobile menu remains operable`）は、変更前のコードでも同じく失敗する。タイトル画面のダイアログが試験中のボタン操作を遮るためで、今回の寸法とは無関係（未修正）。
- 型チェック、単体 `tests/front-operation-cue.test.ts` 7件、整形チェック。
- 実機（Android/iPhone）は未確認。ヘッドレス Chrome の寸法・画面で確認。

## 公開

- [PR197](https://github.com/futsalife24-bot/swarm-front/pull/197) を通常merge。公開ソース main `8f21cecfebfe2a5280fd24fa003898c727494945`、既存Worker `swarm-front` の Version `572d5fc9-172e-4c43-876d-47e3246ac78b`。
- 配信照合: 27ファイルのSHAがbuild成果物と一致、`/api/health` 200（[delivery.json](evidence/operation-cue-size-20261017/delivery.json)）。
- 公開版 `https://swarm-front.melosalife-24.workers.dev/front?solo=1` で実際に出撃し、`srv-sortie` の帯を計測: 667×375 で 321×112、844×390 で 334×117、915×412 で 353×124、1280×720 で 617×216。すべて高さ比30%（[live-measure.json](evidence/operation-cue-size-20261017/live-measure.json)、[844×390の画面](evidence/operation-cue-size-20261017/live-844x390.jpg)）。
