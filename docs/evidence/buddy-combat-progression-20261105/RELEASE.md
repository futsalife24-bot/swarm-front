# 進撃バディの公開記録（2026-11-05）

- 実装commit `d0818ff`、Claude納品書修正までのPR head `f57a6ebbcda10f560daa1e835f3a5ce5a1273188`。既存 [PR279](https://github.com/futsalife24-bot/swarm-front/pull/279) を通常merge。
- 公開ソースはmain `a4ffc63131b7932ba127ca743278582dbf9f884f`。PR headと製品内容の差分なし。merge本文のPlayer-Noteから更新履歴を生成し、mainから本番build・既存Worker dry-runを再実行して成功。500KB超チャンクの警告は残る。
- 公開先 https://swarm-front.melosalife-24.workers.dev 。既存Worker Version `e381fb96-7008-4ea3-984f-fffa2629eda7` を公開し、100%配信を確認。[配信割合](deployment.json)。新規サービス・課金・認証設定変更なし。
- main保護/ruleset/Actions workflowの設定は0件、PRのチェック報告も0件。CI合格とは呼ばず、管理者バイパス/forceを使わない通常mergeで反映した。
- 専用 `task-buddy-integration` だけをorigin/mainへfast-forward。既存のmainを開いているtask-survival-build、root、素材制作、Claude UIのworktreeは切替・上書きしない。公開記録は `codex/buddy-release-record-20261105`。

## 配信版の新規プレイヤー確認

`scripts/check-buddy-production.mjs` は配信版の通常操作だけを使用。新規の隔離Edge156.0.4314.58、844×390/640×360。名前の入力補助だけを行い、所持/HP/敵/時間/配信JSは変更しない。採用4体の初回画面→タタラ選択→招集券不足で抽選不可/確率表示→出撃準備→既存の初回会敵スキップ→スキル押下/CD→通常リタイア→装備準備→基地で同行保持。DEVレビューAPIなし、HUD紋章はボタンの56%の実寸を確認。

ローカルの本番ビルドで2サイズ合格。検証器の初回はVite起動未完了で接続拒否、会敵画面中に隠れた操作を待つ順序不備、スキップを2経路で行う競合による立ち止まり/ダウン、結果画面から準備へ戻る操作の欠落で失敗した。製品コードを改変せず、実際の導線と一つのスキップ操作に直して完走した。これら失敗を成功件数には含めない。

公開後も同じ2サイズで全操作が成功、ページ例外0。[公開画面の結果](production-results.json)。[公開タタラ/スキル再使用待ち](production-844-battle.png)、[初回4体選択](production-640-starter.png)を目視。ローカル配信版の結果は [別記録](preview-results.json)。公開された協力部屋の新規作成/人間確認・実回線の協力戦闘は今回未実施で、通常協力の証拠は実ローカルWorkerの2画面と4人通信に限る。

`scripts/check-buddy-delivery.mjs` でHTML/JS/CSS/JSON/WebmanifestとバディGLB/立ち絵等、60ファイルのSHA-256がbuildと一致。health200/ok、DEVレビュー文字列/配信APIなし、Design配下なし。[全照合](delivery.json)。未変更のその他の画像/音声/3DモデルはSHA照合対象外。

既存 `scripts/check-survival-build.mjs` をPRODUCTION=1で公開先へ実行。844×390/640×360で、生存の中立ライフル1枠/初期8カード/カード一覧/戦闘/一時停止/リタイア、防衛の2装備枠と3丁3行の一覧/切替、旧保存維持に合格、ページ例外0。[公開生存/防衛の結果](production-survival.json)。640画面の生存実戦を目視し、バディボタンが出ていないことも確認。

自身が起動したVite5196、preview5197、検証Worker8821は終了し、3ポートの待受0を確認。隔離ブラウザーは各検査で終了。別担当のプロセスには触れていない。公開後は記録・検証器だけの差分で、ゲームコードを変えず再デプロイしない。

## 検証範囲

4種の能力/育成/抽選、4人実WS、2画面協力/再接続、0/1/4体負荷などの範囲は [実装・検証記録](README.md)。実スマホ/PWA、実回線複数端末、全地形・長時間・攻略バランス、音の実聴は未確認。最初の並行協力準備で起きた通信期限切れの根因も未特定。Coilの通常用途と、キュービ種に寄せたヨスガ再制作は別の後続作業。

UIページ/レイアウト/演出の今後の担当は本人指定どおりClaude CodeのClaudeデザイン。保存済み資料の実読取と今回の納品は [受け渡し](../../BUDDY-CLAUDE-DESIGN-HANDOFF-20261105.md) と `design/buddy-ui/HANDOFF.md`。今回の主担当は保存・戦闘・協力・統合・検証・共有記録。主担当/子2体の実モデルID/推論設定は取得不可、Claude画面はOpus 5.5/高。
