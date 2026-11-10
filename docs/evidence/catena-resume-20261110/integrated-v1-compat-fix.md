# 旧v1バイト一致テストの指定修正

- 統合HEAD `c4f2c27ff4ca87192ca103bf3b5fb86522ca1c8a` の全体試験で `tests/pleat-pose-wire.test.ts` の旧受信者比較 `tuples=true` が1件失敗した。CATENA追加後の `prepareState.packet()` の既定がtuple v2になり、歴史的なv1生成器との比較にv2文字列を渡していた。`tuples=false` は成功していた。
- 当該テスト内の4つの現行 `packet()` 呼び出しにだけ `tupleVersion=1` を明示。旧生成器、期待バイト列、復元器、assert、製品コードは変更していない。実Workerの旧接続は既にhello `stateTuples:1` からv1を選ぶ。`scripts/check-catena-omega-gate.mjs` も互換Roomで `stateEncoding === "tuples-v1"` と未切断を確認する既存assertを持つ。
- `npx vitest run tests/pleat-pose-wire.test.ts --reporter=dot` は9/9成功。対象Prettierと `git diff --check` も成功。生結果は [`integrated-v1-compat-fix.txt`](integrated-v1-compat-fix.txt)。全体1752件の結果は修正前HEADの記録として保持。製品コード不変のテスト指定修正で、当該9件を再検査。修正後の全件再走は未実施。
