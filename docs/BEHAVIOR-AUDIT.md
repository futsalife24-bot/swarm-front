# T5 通常Chat独立監査

[監査Chat](https://chatgpt.com/c/6ab88518-6aac-83ee-be14-43a18266c34a)。Codex iabの新規通常Chat、UIのPro選択を確認。実装担当の自己レビュー/単体結果とは別。

## 初回判定（2026-09-27）

ゲームbase `df3b0c2670997300bd264d68b139b50b659abab4`、対象 `98275bdea1ce8cff42323e809796a03d1f033653`。判定は**要修正、必須P0=0/P1=0/P2=2**。Hub側は必須指摘なしだが、統合全体のmerge準備可判定は保留。

- F1/P2: 保存競合を正常に復旧して新しい勝利報酬が保存されても、当日勝利フラグ/first_victory/sortie_againが欠測。同一タブの復旧と起動時journal復旧の両方で独立再現。
- F2/P2: 初期保存済み戦果のprepareChoiceが保存失敗→再試行した場合、正常にchoice/resultへ進んでもvisitが欠測。
- O1/任意: checkpointのfalse返値を成功扱いしない防御。通常UI到達の立証がないため必須外だが実装側で対応。
- O2/任意: 管理者登録後に送信済みadmin=falseを遡及訂正する仕様ではないことを明記。既存の最大2試行/同一payloadを維持して文書で明確化。

F1はrecoverUnsavedResultに「freshRunかつwinかつpersistProgress成功後」の引数なし通知を追加して両呼出しへ接続。通知例外は保存成功を失敗に変えない。既受領/recoveryId再実行/敗北/保存失敗では通知なし。F2はshowHome/choice/resultの構築完了へvisitを接続し、一度きりの初期loadMode後判定を除去。イベント定義や保存形式は不変。

## 独立検証の範囲

ZIP同一性・収録301ファイルのhash一致・base/HEADのdiff blob照合。ゲームは実ソースの対象関数と実保存/recovery/checkpointモジュールを使ったDOM stub/Map保存の11群＋F1/F2反例。送信moduleはDEV無効・endpoint拒否・lock不能・成功/拒否/通信失敗/timeoutなど9条件。HubはNode＋実SQLiteの独立adapterで9群・721assertion（600以上は上限反復で、721種類ではない）。

監査側のnpm ciはDNS障害、Chromium初回接続はERR_BLOCKED_BY_ADMINISTRATORで拒否。独立の実ブラウザ検証は0件、workerd/全型/全テスト/build/dry-runは再実行していない。主担当の実ブラウザ/Worker証拠とは区別。物理Android/人間/本番/インフラログ・alarm保証は未確認。主担当の合成勝利・初回保存ブラウザtimeout原因未確定も引き継ぐ。

## 最終限定再監査: PASS

ゲーム **1538c5842b4d4f65a542be5f48680ba5433c2c72**、Hub **711edf5bbfadfd6a5923596884a76c143072dc36** に限定してPASS、必須P0=0/P1=0/P2=0。F1/F2解消、O1修正/O2文書化を確認。「非本番実装のmerge準備可能」であり、本番有効化・公開の承認を含まない。

独立ゲーム30条件・送信module9条件が成功。同じ確認を初回SHAへ戻した対照ではF1競合/F1journal/F2/O1の4条件すべてで旧不具合を検出。保存ブラウザ証拠163ファイル（runtime3ファイルを含む）と今回ソースが一致し、初回の計測module照合不足も解消。Hub本体24ファイルは初回と同一で、初回の確認を引き継ぎ再実行件数にはしない。実ブラウザ独立実行0など上記の限界は継承。

追補ZIP `../t5-audit/t5-fixes-1538c58-711edf5.zip`、SHA256 `7b522959599010a8aeeb3b870751fe0ddcbf2b7e2e59ac87b2edad6eed7bbef8`。[主担当の最終自己検証記録](verification/t5/self-check.json) は監査判定と区別する。監査後の変更は記録文書・証拠のみ。merge/公開/本番有効化は実施せず、本番送信0。
