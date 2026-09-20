# LINE共有画像と説明文（2026-09-20）

- Branch: codex/line-share-image。base b322d62d91b622df5402c583a1f9668238a65aa3、実装head e4bd63334a2b226d635ddb4651f32079cadfa497、PR53。
- index.htmlにOGP/Twitter画像・タイトル・説明文を明示。説明は「SWARM FRONT — 仲間と戦う3D協力アクション。」。
- public/share-swarm-front-20260920.jpgはユーザー最終指定の横長1280×720 JPEGの完全コピー。SHA256 b143b8138a5506e756fb9f76705baff39046eb44a4ab6c6a0a4b6185b8b7c8c4。アイコン・ゲーム・Workerは変更なし。
- 修正後Vite build成功、Worker production dry-run成功（Worker不変）。原本/public/dist画像一致。ローカルpreviewはrootと?share=20260920のHTML完全一致、画像200/image/jpeg/SHA一致、JS/CSS12件一致。実iabで横長画像を目視確認。
- 独立監査: https://chatgpt.com/c/6aaf8ac7-f318-83ee-a235-f18657e726da 。差分・HTML・画像・配信設定・検証READMEのZIPを直接添付。最終判定待ち。
- 既存アカウントwhoami成功。契約APIはログイン更新後403（直近Free記録を参照、今回の契約未再確認）。契約・公開先・権限の変更なし。
- Judge入口は正規game側で実行、固定needs_context/live not_run（missing_key、API呼出0）。別worktreeの今回差分を判定した証拠ではない。独立監査の代替にしない。
- LINE実機・送信済みカードの更新は未検証。公開後は?share=20260920の新規共有を案内。
- 既存game作業ツリーに別タスクの未コミット変更があるため保護し、share-image-fix worktreeで分離。
