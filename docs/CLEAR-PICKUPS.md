# クリア表示と回復・武器ドロップ（2026-09-16）

base/main: `ce0c31d70c89ebb703adfd5a450ca44b067fd371`
branch: `codex/clear-and-pickups`

クリア中のメニュー背景を透明化し、最後3秒の暗転を撤去。タイトルを上部で小さく表示し、「結果へ」を下中央に配置。背景への入力透過を維持し、ボタンだけクリックを受ける。既存10秒の回収時間、回収・保存ルールは変更していない。

回復は白い救急ケース＋緑の十字、武器は暗い横長ケース＋水色の銃マーク。両面に識別マーク、天面にもアクセントを配置。原本は `src/client/drop-design.ts` のコード生成形状で、外部画像・GLBは不要。種類別のInstancedMesh各24枠で描画し、既存の所有者フィルター、地形高さ、投下位置、回収後非表示を維持。共有Rendererなので協力の武器ドロップにも適用される。

## 検証

- `npm run typecheck` 成功。
- `npx vitest run --config vitest.playtest.config.ts tests/playtest.test.ts` 11件成功。
- `npm test -- tests/render.test.ts` 5件成功。
- `npm run build` / `npm run build:pages` 成功（既存のchunkサイズ警告あり）。
- `node scripts/check-clear-pickups.mjs` 実Chrome成功。844/1280/667×390で透明背景・入力透過・暗転なし、移動、回復＋武器の回収、結果ボタンを確認。pageerror 0。検証専用routeで終端状態とドロップを投入し、実アプリの回収処理を通した。出荷コードに状態変更フックは追加していない。
- [844×390画像](art/clear-pickups/clear-844.png)を目視確認。[検証結果](art/clear-pickups/result.json)。
- 初回の単体コマンドは通常configの対象外で未実行。上記専用configへ修正して11件成功。

実スマホ・実協力通信は未確認。Chat独立監査、main反映、Worker公開は未実施。READMEの独立監査条件を維持する。
