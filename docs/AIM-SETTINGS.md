# 視点感度・ジャイロ・上向き照準（2026-09-12）

- ホーム設定と戦闘中の一時停止へ射撃ボタン専用感度（0.1〜6）を追加。通常の視点感度から独立。既存セーブでは初期値を従来の感度から引き継ぐ。
- ジャイロのオン／オフを同じ2画面に追加。初期オフ、端末保存、必要なブラウザではボタン操作から利用許可を要求。許可拒否・非対応時は設定をオンに変更せず案内。
- devicemotionの回転速度を画面の縦横方向へ変換して照準へ加算。一時停止・非表示・フォーカス喪失・オフ中は反映しない。長いイベント間隔や画面回転後は最初の入力を捨て、視点飛びを防ぐ。
- 上向きは0.65rad（約37度）から80度へ拡大。下向きは維持。サーバーの入力検証も同じ上限。上向き時のカメラ高さは地面より0.35m以上。

変更: src/client/input.ts（入力）、src/client/save.ts（保存互換性・値検証）、src/main.ts（両設定UI）、src/shared/aim.ts（角度・センサー変換）、src/shared/game.ts（ネットワーク検証）、src/client/render.ts（カメラ床下防止）、src/client/changelog.ts、tests/aim.test.ts、vitest.config.ts、e2e/smoke.spec.ts。

自己検証: 型チェック成功、関連既存41テスト成功、新規3テスト成功、本番client build成功、本番Worker dry-run成功（初回sandboxのログ・親ディレクトリ参照制限で失敗、権限付き再実行で成功）。新規単体テストは初回config未登録で実行対象外、登録後に縦横変換テストの入力値の符号誤りを修正して3件成功。既存バンドル500kB超警告あり。

Chrome実タッチ: 射撃ボタン外ドラッグ・連射・移動同時入力・touchEnd/cancel・専用感度2と通常感度3の分離・上向き80度を確認。画像: dist-validation/aim-upward-mobile.png。設定保存・許可拒否/許可・ジャイロオン/オフ・一時停止は模擬センサーイベントで確認。画像: dist-validation/aim-settings-pause.png。実スマホのジャイロ操作感・実機の権限画面は未確認。

センサー仕様参照: https://www.w3.org/TR/orientation-event/ 。回転速度はdeg/sで受信し、画面角度で軸を変換。

branch: codex/home-armory。base / HEAD: 4186f25f7c9695f95ea897ad182db5f85fac3091。開始時から射撃ドラッグ対応の未コミット変更（input/changelog/smoke/STATE、FIRE-DRAG.md）が存在し保持。今回分も未コミット、commit/mergeなし。

ブラウザ検証の実行結果: 拡張した射撃ドラッグテストは次のテストへ進むことを確認（検証項目成功）。ジャイロ設定テストはPC/横持ちとも全assertionとスクリーンショット保存完了まで確認したが、ブラウザの後片付けで終了しないため中断。page fixtureから明示context管理へ変更しても再現。E2Eランナー全体の完走・合格とは扱わない。実スマホセンサーは未検証。

公開の経緯: 初回は自動承認レビューが「今回の具体的な本番デプロイへの明示承認がない」として拒否。その後ユーザーが「承認します」と明示し、2026-09-12に既存Workerへ公開完了。

監査用差分: dist-validation/aim-settings.patch（既存の未コミット差分も含む）、新規ファイルはsrc/shared/aim.tsとtests/aim.test.ts。本記録とdocs/STATE.mdに状態を記録。

## 承認後の公開確認

URL: https://swarm-front.melosalife-24.workers.dev 。Version: `d501ed15-86ba-4ed9-be34-ffa942966c08`。JS: `index-Bx4L2sCn.js`。

`scripts/check-aim-published.mjs` で公開HTML 200、JS/CSSのSHA-256一致、横持ちホーム設定の通常3.0/射撃2.0の個別保存と再読込、戦闘中設定への反映、出撃・撤退、API health 200/ok、JS例外なしを確認。証拠 `dist-validation/aim-settings-published.json` と `aim-settings-published-home.png` / `aim-settings-published-pause.png`。初回接続はsandboxのネットワーク制限で失敗し、権限付き再実行で上記確認完了。

今回の公開承認で未公開状態は解消。実スマホのセンサー操作感と、先のE2E全体の完走は引き続き未確認。branch/base/HEADと未コミット状態は前節のとおり。
