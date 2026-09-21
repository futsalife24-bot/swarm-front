# 岩の実形状判定と着地後移動（2026-09-21）

branch `codex/rock-jump-collision`、base `5e55f509cf4299914089ce20ce2742543653837d`。

草原・雪山の岩を包むAABBが、見える肩越しの射線まで遮っていた。Blender生成器 `build_maps_v1.py:rock` と同じ6リング・面対角線を共有判定へ再現し、地形リフト後の頂点で射撃・足元支持・着地を照合。低い肩から歩行/ジャンプで草原岩へ乗れる。実体を通る射線は遮断。街区・洞窟の箱/専用判定は維持。モデル読込失敗時の簡易描画も同じ岩形状。

斜面の地面補正後に下降速度が残ると、接地していても空中扱いが続いて上り方向の移動が止まる。接地時の下降速度を0にし、落下スイープで着地したフレームから接地移動へ戻す。

検証: client/Worker型成功。terrain35、関連jump-audit/game/enemies/maps/state-wire98、計133件成功（複数実行の重複を除く）。岩肩越しの実fire被弾、岩本体の遮蔽、通常/高台の全草原岩へ登頂、dt=.016/.05/.1の斜めジャンプ後速度を確認。変更前コードで射撃・登頂2・着地速度2の計5失敗を再現。aim既存1失敗（敵拡大後の距離期待値1.25対1.875）はbaseでも同一再現、今回未修正。

実iab: 配信GLBをliftMapした4マップ/980地点のレイ接点と足元支持を比較。最大誤差は草原0.00000214m、雪山0.015625m（既存地形レイ許容を含む）。実Rendererで岩の頂上に兵士が着地、足元=岩頂上15.8646326065m、下降速度0を目視/数値で確認。ローカルWorkerの2クライアントでジャンプ要求/高度一致/着地成功。証拠 [evidence/rock-collision](evidence/rock-collision/)。UI再現ページ `scripts/rock-collision-fixture.html?drone=1`。

Judge: posttestで実行済み。固定needs_context、Jev not_run/missing_key、API0。監査許可の代わりにはしていない。

限界: 実スマホ操作、長時間・多数敵時の負荷、全作戦の通しプレイは未確認。岩の支持は地面と同じ足元中心の高さ。ジャンプ高度自体は既存1.6mを維持し、岩の斜面から登る。

独立Chat監査・main反映・公開は準備中。別作業 `.gitignore`/`AGENTS.md`/`package.json`/`CLAUDE.md` は保護して今回commitへ含めない。

## 監査送信の承認待ち
PR66: https://github.com/futsalife24-bot/swarm-front/pull/66 。実装・監査対象 `4bd4dc37e393c6bc456c3ee7fd5091b2448e1f51`。同commitのclient buildとproduction Worker dry-run成功。
資料 `dist-validation/rock-collision/rock-4bd4dc3-audit.zip`、7,012,574 bytes、SHA256 `53E8F194E73B817E294EE8F1F23FD2FEB8DB93B0CFEEEA671C9A0105896ADD96`。対象commitのsrc/server/tests、差分、必要設定、岩生成器と既存GLB2点、検証証拠を含む。秘密・無関係なローカル設定は含めない。

停止理由: 自動承認レビューが上記ZIPの通常ChatGPT新規Chat（https://chatgpt.com/）へのアップロードを、具体的payloadと宛先への明示承認不足として拒否。未送信・監査未依頼・main未反映・未公開。
再開条件: 上記ZIPの同送信先への添付についてユーザーの明示承認。内容/ハッシュ照合後、同ZIP添付→独立監査→必須修正/再監査→通常merge→既存Worker公開/配信確認。後続commitは状態記録のみ。

ユーザーの具体的な送信承認後、同一ハッシュのZIPを通常Chat https://chatgpt.com/c/6ab0a700-e9a0-83ee-b8aa-53873299fff0 へ添付・監査依頼済み。旧送信承認待ちは解消。独立判定待ち。

## 初回監査の必須P2・2件を修正
初回4bd4dc3は要修正。`audit-4bd4dc3.txt` に独立報告を保存。①凹んだ上面を扇形分割した見えない足場（雪山 -65.5,-10）、②分節敵の点/目的地判定と経路の4.2m余白の不整合で追跡停止。

①上面を凹多角形に対応するear clippingへ変更。②FOUNDRYの点判定にも経路と同じ岩外周+4.2mを適用し、安全な目的地へ投影する。兵士/射撃の実形状判定は維持。

型成功、terrain/foundry/jump-auditの関連90件成功後、監査の正確な座標・部位破壊条件3件も成功（計93件、重複除外）。追加13回帰は4bd4dc3の2実装ファイルをVite pre-loadした比較で全失敗、修正版で全成功。実IABで上面縁の内外を追加した4マップ2900地点が成功。斜め射線の追加照合は進行中。区域外の非衝突なfoliageへのレイはゲーム衝突対象から除いて照合する。

修正版再監査・main反映・公開は未完了。Free契約を実IAB再確認（9/21 DO requests96/duration1.56GB-sec/SQL read860/write66）。

追加実IAB検証完了: 4マップ2900地点・8700射線成功。岩そのものの最大誤差0.00001743m（合格基準0.001m）。既存地形の1.5cm下側判定と描画補間による斜め射線差は最大0.0307793mとして別記し、地面のみ0.05m基準。非衝突装飾と区域外を除く。岩頂上で足元15.8646326065m、下降速度0を再確認。証拠 `browser-reaudit.json`。ゲーム実装はd6081a7から不変、後続は検証器/証拠のみ。

## 修正版の再監査依頼済み
対象 `6151c91bcc456a816edf376e3f5e1a939cf8f9db`、base不変。通常Chatは上記同一URL。補足ZIP `rock-6151c91-reaudit.zip`、29,234 bytes、SHA256 `7B58B06727A91350C1718E8B7F6F3E535D68D637A5DC2D2254DE6B9DC9926CA3`。初回ZIPの不変依存/GLBと修正差分・ソース・証拠で再監査を依頼し、送信完了と思考開始を実IAB確認。未merge/未公開。後続は記録のみ。
