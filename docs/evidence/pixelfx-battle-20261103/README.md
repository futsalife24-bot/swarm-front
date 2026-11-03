# PixelFXを使った戦闘演出（2026-11-03）

## 出典と利用範囲

本人が指定した投稿で紹介された [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx) の `a84159688af3ca37a4be05a0d422b94451b2e24e` を参照。MIT License、著作権者はPatchとHugo Duprez。ライセンス・NOTICEは `public/third-party/pixelfx/` に同梱。ライセンス対象外のギャラリーフォントは使用しない。配信時に同ディレクトリを公開する。

`impacts/hit-spark`、`projectiles/muzzle-pistol`、`explosions/small-explosion`、`explosions/dirt-explosion`、`spawn/spawn-portal`、`nature/acid-splash` を作者のレンダラーで12fps・透過・キャラなしで作成し、初期部分を固定トリミングして1枚のアトラスに収めた。酸は既存の青緑色に合わせた。生成手順は `scripts/generate-pixelfx-atlas.py` 冒頭。スクリプトはPinned上流を `output/pixelfx-upstream` に配置し、`node tools/render.mjs impacts/hit-spark projectiles/muzzle-pistol explosions/small-explosion explosions/dirt-explosion spawn/spawn-portal nature/acid-splash --sheet --fps 12 --no-actor --bg none` を実行した後に使う。Pillowが必要。

アトラスを初回ロードして共有し、戦闘中は絵の参照のみ切替。発砲・通常命中・爆風・酸とANOMALY地上／転移出現に適用し、判定・音・危険範囲の輪・既存演出の寿命は維持。雪原では茶色の土煙絵を追加せず既存の白い煙を維持。出現自体は従来最大24、追加の絵は同時最大8。未ロードや読込失敗時は既存表現を継続する。

## 検証

- `npm run typecheck` 成功。関連既存39件と発砲方向・上限の新規1件成功。テスト用一時ファイルの作成にsandbox内で失敗したため、許可された環境で再実行して成功。
- `node scripts/check-pixelfx-battle.mjs --baseline` は既存main `b27b4af7691aeee7227ff094b63679078b065846`、引数なしは変更後を比較。実際の演出クラスとHOUND/RAYのモデルを使う簡易シーン。0.15/0.4/0.75秒の描画回数は爆風・地上・転移それぞれ旧59/12/14、59/12/14、47/12/14 → 新60/13/15、60/13/15、48/13/15。壁で全面を遮る1条件に成功。40体同時で出現24、追加8、停止中の時間停止、終了・再生抑止、ゲーム状態の不変を確認。`baseline*.png`、`phase*.png`、`preview.json`。
- `node scripts/check-pixelfx-shots.mjs` は簡易シーンで発砲・着弾・酸それぞれの新素材の割当を確認。`shots-*.png`、`shots.json`。敵は簡易箱で実モデル・実戦ではない。
- `node scripts/check-pixelfx-game.mjs` はローカル実ゲームの生存戦で、発砲時にPixelFXの画像が割り当てられた描画4フレーム、地上型出現の追加演出2件、画面例外0を観測。命中0件、出現と爆風は画角外で、実戦画面上の見え方・転移型出現・命中は未確認。ゲーム状態を書き換えない一時的な観測コードを配信時のメモリー上に加えた。`game-result.json`。
- `npm run build:production` 成功。
- 本人のスマホでの見た目や性能、複数端末での負荷、壁・遮蔽の全条件は未確認。簡易シーンでの描画回数はスマホのFPSを意味しない。

公開・実戦の状況は `docs/STATE.md` を参照。主担当モデルID/推論設定は取得できず未確認。子エージェントなし。
