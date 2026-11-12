# 補給ポッドの武器画像修正

通常補給と開発者の演出確認は共通の `supplyResults` を使う。従来は武器の種類を３種類の画像へまとめていたため、名前と異なる旧形状が表示された。現行の12 GLBを詳細プレビューと同じ照明・カメラで描き、透過部分を余白付きで収めた `w-v2-<kind>-<grade>.webp` を使用する。５等級分を用意し、見た目の等級は `weaponVisualTier` に合わせる。旧画像と既存３武器のGLBは保持。

`render.json` は60画像と元GLBのSHA-256・寸法情報。`models-12.png` は12種のN等級の比較。再生成は `node scripts/render-supply-weapons.mjs`。実ブラウザーの `weaponCutout` を使用し、ネット送信はしない。描画環境の違いで再生成画像のハッシュが変わる可能性がある。

検証: `npm run test:supply` 75件、`npm run typecheck`、ローカルbuild成功。隔離ローカルWorkerの通常10連と認証済み演出確認を844×390・640×360で実行し、全画面で表示された画像と武器名・等級の対応、1024×512の画像読込、ページ例外0を確認。演出確認はローカルのみ乱数を固定してST-3・MD-4・RL-9を含め、保存変更なし。通常はローカルWorkerの通常抽選・券・受領を実行。`ui-report.json` と `preview-844.png` 等が証拠、再現はローカルWorkerを8796で起動後 `node scripts/check-supply-weapon-art-ui.mjs`。実スマホ・実聴・公開Workerでの認証済み操作は未確認。
