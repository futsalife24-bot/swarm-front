# 爆風と ANOMALY 出現のドット調（2026-11-02）

## 内容

既存の爆風の炎・煙と、地上型／転移型の出現時の煙・破片をドット調に変更。爆風範囲の輪・球、出現の輪、寿命、個数、ゲームの判定と音は変更しない。出現時は敵本体が見えるよう煙の透過を調整した。既存の GPU 準備用素材も新しい素材に合わせた。

## 確認

- `npm run typecheck`、`npm run build:production` 成功。
- `npx vitest run tests/front-pixel-particles.test.ts` 16件、`tests/render.test.ts` 8件、`tests/anomaly-arrival-audio.test.ts` 6件、`tests/front-pixel-impact.test.ts` 3件、`tests/front-expansion.test.ts` 6件成功。9種類の敵、4地形、40体同時の演出上限、停止・終了、爆風範囲などを確認。
- `node scripts/check-pixel-blast-spawn.mjs --baseline` と引数なしで簡易シーンを旧版（基点 `919ddddc955ff54e391c7d7964c4f0eaad038872`）と比較。実際の演出クラスと HOUND / RAY モデル、簡易地面を使用。`baseline-phase-*.png` と `phase-*.png` に0.15/0.40/0.75秒を保存。各時点の描画回数は同じ（爆風・地上・転移の順に59/12/14、59/12/14、47/12/14）。壁で完全に隠す1条件の比較も成功。これはスマホの性能や全地形・全距離の視認性の証明ではない。
- `node scripts/check-pixel-blast-spawn-game.mjs` はローカル配信の実ゲームで生存戦に入り、爆風イベント6件、ドット演出オブジェクト、地上型出現2件を観測、画面例外0。`game-result.json`。演出は画角外で、実戦画面上の見た目、ロケット命中、転移型の実戦表示は未確認。ゲーム状態を書き換えない一時的な観測コードを配信時のメモリー上に加える。実スマホは未確認。
- 公開前の Cloudflare 使用量確認は 2026-11-02 20:44 JST に HTTP 403 / code 9109 `Invalid access token`。認証の復旧と使用量の再確認が必要。契約が無料であることは本人が本会話で確認済み。接続元のブラウザー一覧は0件で `Local browser use is disabled in Work settings`、実設定・原因は未確認。公開後画面は未確認。

主担当モデルID・推論設定は取得できず未確認。子エージェントなし。
