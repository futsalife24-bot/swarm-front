# 旧式エネミーレポート復元・全解放開発者モード — 2026-09-14

ユーザーの画像は、試遊版だけの簡易 `pt-report`。試遊版の別実装を廃止し、既存 `openBestiary` の敵一覧・3D・モーションボタン・攻撃/移動解説・会敵ムービー・通常炉/連結炉選択を使用する。新しい待機モーションは保持。

通常進行の未遭遇は名称/解説/モデル/動画を未解放、協力遭遇はシルエットだけ、ソロ遭遇で正式表示。通常炉と連結炉の解放は独立。通常版（playtestなし）は従来の全公開レポートを維持。

## 開発者モードの入口

2026-09-14更新: 現行入口は固定パスワードによるサーバー認証。通常/試遊のタイトルと設定→保存データから入る。以下のURLも認証が必要。通常への復帰はlogoutを行う。[現行仕様・検証](DEVELOPER-ACCESS.md)。以下のパスワードなし入口は導入時の記録であり、現行仕様ではない。

- 専用URL: https://swarm-front.melosalife-24.workers.dev/?playtest=1&developer=1
- `?developer=1` 単独でも対応。
- 試遊版の「設定・操作 → 保存データ → 開発者モードを開く（全解放）」から移動。
- タイトル/設定から通常モードへ戻れる。

21ステージ×通常/中難易度（42条件）、敵7形態、3武器系統×5レア度（15丁）、アクセサリ3種×R1–6（18個）、全育成項目、育成120ポイント、コイン/武装片を用意。既存のテスト品指定生成も利用可能。チュートリアルはスキップ。

開発者データはメモリ内でのみ操作。通常/ローカルテストの進行キーへ読書きしない。再読み込みで全解放の初期状態へ戻す。出撃リトライの一時キーも通常版と分離。開発者用武器・戦闘は既存testData扱いで、協力入口は通常版へ移動する。URLは利用者が開ける検証用入口で、認証管理画面ではない。

## 全画面との表示順不具合

実ブラウザで、初回タップのrequestFullscreen完了がshowModalより遅い場合に、全画面レイヤーがレポートを覆うことを確認。`landscape.ts` が処理中のPromiseを保持し、`showModalAfterFullscreen` で解決/拒否のどちらでも完了後に接続中のdialogを表示する。bestiary/menu-uiから共通利用。自動全画面、向き固定、失敗後の再試行は維持。前回待機モーション記録に残した未修正挙動も今回解消。

## 変更ファイル

- `src/client/bestiary.ts`: 旧UIの共通利用、遭遇状況による情報制御、終了通知。
- `src/client/playtest-app.ts`: 簡易レポート削除、共通レポート呼出、開発者モード・設定入口・終了・保存分離。
- `src/client/developer-mode.ts`: 全解放の初期データ生成。
- `src/bootstrap.ts`: 開発者URLの起動先。
- `src/main.ts`: 既存レポート呼出を引数なしのコールバックにする。
- `src/client/landscape.ts`, `menu-ui.ts`: 全画面完了とネイティブダイアログの表示順。
- 検証スクリプト: `check-report-developer.mjs`, `check-report-fullscreen.mjs`, `check-developer-isolation.mjs`。

## 検証記録

型チェック、進行/境界関連15テスト、通常/Pages build、Worker production dry-run成功。既存500KB bundle警告あり。
全画面の既存チェック（要求成功/拒否、実Chromeの武器庫→準備→戦闘中の全画面復帰）成功。Promise成功/拒否とも fullscreen-start → fullscreen-end → dialog の順序を確認。
旧式UIの844×390表示を目視確認。通常のソロ/協力/未遭遇の情報制御を確認。全ステージの出撃可能、ST20実出撃、通常保存保持、通常復帰を検証。
初回の画面検証で表示レイヤーの問題を発見し修正。途中のdevサーバー終了/更新により1回検証が中断、専用devサーバーを起動し最終版で再実施。

## 監査用状態

branch `codex/home-armory`、base/head `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存差分を含む未コミット/未追跡変更あり。commit/mergeなし。
証拠は `dist-validation/report-developer/`。開始時ファイルは `before/`、今回の差分と新規モジュール全文は `changes.patch`、画面は `local-*.png`。外部監査合格/実スマホ受入は未実施。

## 公開結果

Version `2a83029f-63e7-4c46-bcac-e54de13c94c6` で既存Workerへ反映。
ローカル/公開の両方で844×390・1280×582、全7形態の旧式UI・待機/移動/攻撃切替・会敵動画、未遭遇/協力/ソロ情報制御、設定の入口、全42条件の出撃選択、ST20実出撃、通常モード復帰に成功。`local.json` / `published.json`。
開発者モードでの武器ロック・装備変更後も通常/テスト保存の文字列が一致し、再読込後は初期装備/ロック状態へ復帰。`local-mutations.json` / `published-mutations.json`。
公開11ファイルのSHA256一致とhealth正常を確認。全画面待機の解決/拒否順序は `modal-order.json`。画像は `published-*.png`。本番契約は同一セッションで確認済みのFree/$0を使用し、契約変更なし。
