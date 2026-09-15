# 固定パスワードと通常進行の往復 — 2026-09-14

ユーザー指示: 通常プレイを続けながら、固定パスワードで本人が開発者モードへ出入りする。端末ごとの初回設定方式は不採用。

## 操作とデータ

通常URL・試遊URLの両タイトルに「開発者モード」を追加。設定→保存データにも同じ認証入口を置く。固定パスワードで認証後に全解放の開発者モードへ移動する。タイトル/設定の「通常モードへ戻る」は認証を終了し、入ってきた通常URLまたは試遊URLへ戻る。

通常/テスト/旧ゲーム保存は変更しない。開発者の装備や進行は従来どおりメモリ内だけで、再読込時は全解放の初期状態に戻る。開発者側のリトライキーも分離する。未認証のdeveloper URLは通常画面とパスワード入力を表示し、通常リトライを消費しない。

## 認証

- 固定パスワードは192bitのランダム値を生成。平文はユーザー向けのローカル非公開ファイルだけに置き、SHA256ハッシュをWorker Secret `DEVELOPER_PASSWORD_HASH` に登録。ソース・配信・ログには平文を載せない。既存の `swarm-local` は開発環境だけの旧テストセーブ切替用であり、この開発者認証には使えない。
- `/api/developer/login`・`session`・`logout` を追加。既存Gateクラスの専用インスタンス `developer-access` と独立した保存キーを使い、協力部屋の受付・戦闘・データには触れない。新しいDOクラス/移行/契約変更なし。
- login/logoutは同一OriginのPOSTのみ。入力最大1024bytes、パスワード1〜256文字。比較は固定64文字のハッシュ比較。誤入力はIPハッシュ単位で15分に5回、全体100回。IP平文を保存せず、記録上限1000。
- 認証後はランダムトークンのHttpOnly/SameSite=Strict/Secure Cookie（HTTPS時）。サーバーにはトークンのハッシュを保存。有効期限8時間、同時32セッションまで。全レスポンスno-store、APIは既存Service Workerキャッシュ対象外。
- logoutでサーバーのセッションを失効。URL起動・再読込はサーバー確認後にモードを確定。開発者画面では60秒ごと・復帰時にも確認し、失効/通信失敗時は通常側へ戻す。通常プレイ起動に認証通信は不要。明示logoutの通信失敗時は認証終了したと偽らず再試行案内を表示する。
- 保護対象は公式UI/URLからの開発者入口。ローカルゲームのソース改変・保存データ改変を防ぐ仕組みではなく、管理者APIや本番操作権限を与えるものでもない。別の公開メニューサンプルは従来の範囲のまま。

## 差分・検証

branch `codex/home-armory` / base=head `4186f25f7c9695f95ea897ad182db5f85fac3091`。既存未コミット/未追跡変更を保持、commit/mergeなし。

- `server/developer-auth.ts` / `server/worker.ts`: 認証と専用Gateへの配送。
- `src/client/developer-access.ts` / `src/bootstrap.ts`: 共通パスワード画面・認証確認・通常への復帰。
- `src/main.ts` / `src/client/playtest-app.ts`: 両入口・認証結果による開発者起動・保存分離・再確認。
- `tests/developer-auth.test.ts` / `vitest.config.ts`: 設定欠落、未認証、cookie属性、偽token、logout失効、異Origin、不正/過大入力、回数制限、期限/パスワード変更による失効の5テスト。
- 型チェック、認証5テスト、進行境界4テスト、通常/Pages build、Worker dry-run成功。既存500KB bundle警告あり。最後のボタン改行調整後も両build成功。
- 実ローカルWorker+実DOで通常/試遊の入口・誤入力・全解放・装備変更・再読込・通常復帰・通常/テスト保存の文字列一致・logout失効・未認証の直URL拒否・設定入口を確認。844×390と1280×720で画像確認。11配信ファイルSHA一致、平文パスワードの非混入、health成功。

証拠: `dist-validation/developer-access/` の変更前ファイル、`changes.patch`、`local.json`、各画像。実スマホは未確認。パスワード値/認証Cookieは監査差分・記録に含めない。

## 公開

固定パスワードのハッシュ登録と既存Workerへの公開成功。Version `67f6a3dd-e8fe-4b9a-be17-2738243d30c6`。公開URL https://swarm-front.melosalife-24.workers.dev/?playtest=1 。

公開版でも通常/試遊の両経路、誤入力・固定パスワード認証・HttpOnly/Secure Cookie・全解放・装備変更・通常/テスト保存保持・再読込時の開発者データリセット・元画面への復帰・logout失効・未認証直URL拒否・設定入口が成功。11配信ファイルSHA一致、配信へのパスワード非混入、health成功、ブラウザ例外なし。`published.json` と公開4画像を保存。
