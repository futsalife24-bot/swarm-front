# Standard Trooper v5 — 人体・装甲・モーション再構築

## 現在の状態

モデル制作の第1〜4段階が指定Chat監査で合格。本体適用・必要検証・既存Workerへの公開・公開後確認まで完了。ユーザーから目標達成後の公開を明示承認済み。

新モデルは `public/assets/characters/standard_trooper_v5.glb`。元v4のblend・生成スクリプト・GLBを保持。編集可能な正本は `assets/blender/candidates/trooper/stage4/trooper_stage4_candidate.blend`、再現手順は同階層README。

## 変更

首〜肩、胸郭・腹部・骨盤、腕・太腿・膝、掌・親指を修正。服を連続した人体形状にし、その上に装甲を配置。体格を装飾の追加で補う方法は採らず、ヘルメットと既存配色の方向を保持。

57骨・48,384三角形・18試作クリップ。元15Actionはblend内でカーブ・ハンドル・補間を含め保持。配信用GLBには試作18本を収録し、ランタイムで `Trial_` 接頭辞を外して従来のクリップ選択へ接続した。装填3本はゲームが管理する実装填時間へ正規化して再生。戦闘の時間・威力・移動・当たり判定は変更なし。

背面ライフルを65mm後退・銃身軸反転、ロケットを100mm外へ移動。第2段階から残る55骨bindを保持。v4とは一部bindが異なるので、形状の違う衣装を移植する場合はv5のinverseBindMatricesを基準とする。配色APIは試作服の材質名にも対応。

## 検証

- 指定監査役：第1・2段階合格に続き、第3・4段階も合格。最終回答 `assets/blender/candidates/trooper/stage4/audit-final-pass.md`。監査役は画像閲覧・31.07秒/932フレームの動画デコードで確認。データ本体やFPSの独立確認とは区別。
- 保存後再読込：57骨・18試作、元15Actionハッシュ一致、全整数フレーム有限、8ループ端点差0。
- 接地Z=0.000500m、上端Z=1.866500m、全高1.866000m。
- 本体クラス：装備9通り・切替378時点で有限値/接続親一致、3武器の装填、4隊員の骨格・材質独立。
- 実step＋Rendererの隔離fixture：逆順Rocket/Rifle、移動7m、両武器射撃、装填で32発へ復帰、切替中の大型被弾、回避、構え復帰、ステージ再開始が成功。
- 通常ゲームUI：装備選択・新モデル表示・往復Q切替・敗北後の再出撃を確認。短いポインタークリックは射撃を十分に保持しなかったため、射撃確認は上記fixtureと区別する。
- 型、関連12テスト、production client build、Worker dry-run成功。PC1280×720と横持ち844×390で配布版を実表示。JS/CSS/モデル/契約JSON/武器3点の計7ファイルがdistと一致。

証拠：`dist-validation/trooper-v5/` と候補stage4内。初回Worker dry-runはsandboxのログ/読取制限で失敗し、承認された権限で再実行して成功。既存500KB超bundle警告とHOUNDのGPUコンパイラー警告を記録。兵士の読み込みエラーは確認なし。

## 申し送り・保護

ユーザー方針によりSFゲームの通常速度・縮小表示を優先。瞬間的な干渉や速い手首回転は許容。装填は給弾/エネルギー供給部の簡潔な操作で、個別のマガジン・弾薬物理は含まない。

実スマホ・インターネット経由の協力・長時間性能は未検証。全組合せの接続数値確認を、全ての姿勢の独立視覚監査と混同しない。

着手/適用時のbranchは `codex/home-armory`、base/head `2be699f160c83d641fb68bb1304e4da8059920dc`。既存の未コミット・未追跡差分を保持。今回の本体変更は接続TS、更新履歴、新v5 GLB/JSON、状態文書。適用前TS・更新履歴・状態文書は `dist-validation/trooper-v5/before/` に保存。commit/push/mergeなし。

ロールバックは保存したTSへ戻し、保持したv4 GLBを読ませる前版を再ビルド・再公開できる。現在公開された版を戻す際は別途ユーザー指示に従う。

## 公開結果

- URL: https://swarm-front.melosalife-24.workers.dev
- Version: `d499d59f-d9b4-493b-b61d-0b2949306813`。
- 公開JS: `index-Cyk_wuhV.js`。JS/CSS/兵士GLB/契約JSON/武器3点の7ファイルが検証済みdistのSHA-256と一致。API healthはHTTP200 / ok=true。
- 新GLBのSHA-256: `b615a52a5c3332ffba73c596e18f4bf9ee1344c6d3525d4abafa4ca82b46a6f6`。監査提出GLBと同一。
- 公開PC1280×720・横持ち844×390で新モデル表示、出撃、Qによるスロット変更を確認。JSエラーなし。初回読込中の既存フォールバックから新モデルへ正常に切り替わった。
- Python urllibの公開URL取得は403となったが、通常ブラウザは正常表示。既存の公開検証と同じNode fetch方式で7ファイル照合とAPI確認に成功。
- `dist-validation/trooper-v5/deploy.log`、`published-assets.json`、`published-ui.json`。
