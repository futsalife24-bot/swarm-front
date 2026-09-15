# 2026-09-10 片脚支持と滞空を持つ走りへ再制作

ユーザー指摘: 先の方向修正は滑らかになったが、足運びが歩行のまま。片脚ではねる走りを学び直して実装する。必要なら体格縮小も可。

## 調査で設計へ反映した点

- [AnimSchool / Angelo Sta Catalina「The Key Poses of a Run Cycle」](https://blog.animschool.edu/2024/04/10/the-key-poses-of-a-run-cycle/): 着地、荷重による沈み込み、押し出し、空中の頂点を別の姿勢として作る。接地脚の伸びと曲げの対比を付け、一直線に伸ばし切る表現は避ける。
- [Hamner & Delp, Journal of Biomechanics 46 (2013), 780–787](https://ortho.stanford.edu/content/dam/sm/ortho/documents/humanperformance/publications/Hamner2013.pdf): 実測に基づく走行モデルでは、支持の前半で身体が下がり、後半で前上方へ加速する。足首の蹴り出しと身体の上下を同じ位相にする根拠とした。研究は10名・2～5m/sのデータであり、ゲームの兵士を生体力学的に完全再現したという意味ではない。
- [MoCap Online「Run Cycle Animation」](https://mocaponline.com/blogs/mocap-news/run-cycle-animation): 滞空、短い接地、前傾、方向別の扱いを確認。武器を構える戦闘走りとして、自由な腕振りではなく両手の把持を維持する。

先の実装は足先を小さな周期曲線で前後させ、片脚ずつ接地し続け、腰の振幅も小さかった。再生速度や方向だけでは走りの重量感を作れなかったため、Runクリップそのものを作り直した。

## 実装

- 左右を半周期ずらし、各脚の支持を周期の32%に設定。支持間に滞空を作る。接地→沈み込み→蹴り出し→反対脚の着地を腰と脚で同期。
- 支持足を後方へ送り、つま先で押し出す。遊脚は踵を引き上げ、膝を曲げて前へ運び、着地直前に下腿を開く。
- 全区間で減速停止する補間を避け、速度を持ったHermite曲線を使用。靴底の実頂点と足首角度から接地高を計算。
- 腰の上下と約8度の前傾を追加。回復脚の過度な折り畳みを連続コマで見つけ、最大膝屈曲を約154度から約140度へ調整。
- 実行時の位相は描画移動距離とGLBの実クリップ長から計算。前回の旧Run向け逆再生を撤去。後退時の逆向き再生と腰方向制御、上半身の武器姿勢を継続。
- 武器切替0.5秒、共有移動・当たり判定・回避性能は維持。
- 最終GLBは旧原本へRunだけを移植。形状・UV・ウェイトと他11クリップをバイナリ比較して同一確認。身体の縮小は不要。
- `standard_trooper_v2.glb`へURLを変更。cache-firstのService Workerが旧GLBを返し続けないようにした。v1と武器3GLBは元のハッシュを維持。

## 検証結果

最終GLBの121時点を測定。両足の底が2.5cm超浮く時点は約26.4%。両足同時接地は0時点、左右の片脚接地は各約34%。腰の上下差約18.6cm、最大膝屈曲約139.7度。最高点約1.918m。地面への最小沈み約0.30mm。

- 前・横・後・斜めの5方向で左右交互の先行と支持足の後方移動を確認。
- 正確な時間指定で40コマをレンダーし、側面の着地・沈み・蹴り出し・滞空を目視確認。通常速度WebMと1/3速度表示のレビューHTML、スローGIFを保存。
- Chrome 1280×720 / 844×390で移動、2武器射撃、往復切替、回避・復帰成功。
- 実Worker＋独立2画面で切替中射撃制限、Heavy、回避無傷、状態同期、双方モデル描画成功。初回は回避入力が間に合わずHP120で失敗。描画検証と重なった実時間タイミングの影響が疑われ、単独再実行では無変更で成功。実機・インターネット遅延下の成功保証ではない。
- 型チェック、175単体テスト、production build成功。既存の500KB超bundle警告あり。
- 最終Blender原本を再度開き、24ボーン・12クリップ・参照画像パックを確認。

## 再生成と証拠

順にBlenderで `assets/blender/scripts/build_standard_trooper.py` → `preserve_standard_trooper_geometry.py` → `validate_standard_trooper_run_source.py` を実行。最初にv2候補を作り、次に元のv1形状へRunだけを移植する。v1原本は書き換えない。

原本: `assets/blender/source/standard_trooper_v2.blend`。配信: `public/assets/characters/standard_trooper_v2.glb`。再検証: `scripts/check-trooper-run*.mjs`。成果・記録: `dist-validation/trooper-run/`（gait-summary、preservation、source、game、network、published各JSON、key-poses.png、run.webm、run-slow.gif、review.html、task.patch、checks.json）。

branch `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。commitなし。既存の多数の未コミット・未追跡変更を保持。今回着手時との差分をtask.patchに分離。公開結果は以下へ追記。

## 公開完了

- URL: https://swarm-front.melosalife-24.workers.dev
- Version: `8c6df17a-5ffd-408b-a299-15eb08d8d402`。直前: `8512e285-8b74-45bf-bf24-26fc09dbadd9`。
- JS: `/assets/index-D7R79FBn.js`、兵士: `/assets/characters/standard_trooper_v2.glb`。
- 公開JS・新兵士・武器3種のSHA256がローカル最終ビルドと一致。PC/横画面で射撃・0.5秒切替・回避を確認し、API health 200/ok:true、開発診断非公開も成功。
- 公開直後の初回JSハッシュ照合は不一致で停止。反映後の再実行で同一URLが一致し、操作確認まで成功。未確認を成功扱いして先へ進めていない。
