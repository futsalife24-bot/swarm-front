# swarm-front
本作専用の独立した3D協力アクション。別作品の資料・ルールを持ち込まない。
ユーザーの2026-09-09指示により、特に別指示がなければ必要な検証から既存Workerへの公開まで完了する。外部リポジトリ作成、merge、課金はユーザー承認待ち。ローカル実装・無料依存・テストは許可済み。
戦闘ルールは src/shared、描画と入力は src/client、権威サーバーは server。通信をモックに置き換えて完成扱いしない。
コマンド: npm ci / npm run dev / npm run server / npm run typecheck / npm test / npm run test:e2e / npm run build / npm run build:pages / npm run server:build。
README.md、docs/STATE.md、docs/TESTS.md、docs/FREE-TIER.md を必要時だけ参照。未検証を合格と記さない。

敵デザイン・Blender敵モデル・敵モーション制作では、先に docs/STRUCTURE-ANOMALY-v2.md の第1・2節（造形正本）と docs/art/ANOMALY_TASK_TEMPLATE.md（1体制作手順）を読む。過去の制作記録を現行仕様・新規約の承認と取り違えない。
