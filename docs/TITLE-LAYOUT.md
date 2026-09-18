# タイトルの操作階層と背景（2026-09-17）

base `6d48ea818be46649e1712a59a24b8f3f2b1611e9`、branch `codex/title-command-layout`。

ユーザー承認の4点: 補助ボタンを2列・1行ラベル化、日替わり/週間をチャレンジ行へ分離、チュートリアル/設定を控えめな枠へ、ソロ出撃準備に左の次作戦と同じ作戦名を表示。既存のロゴ・上位4入口・通知バッジ・遷移を継承。週間通知は既存の実進捗から算出する受取可能件数を維持。保存・報酬・通信・戦闘ルールは変更しない。共有homeMarkupに空のチャレンジ枠を置き、通常進行のみ既存2ボタンを挿入する。

新素材 `public/assets/ui/title-atmosphere-v1.png`（1536×1024、1,813,295 bytes）は組み込みimage_genで生成した原本兼配信素材。低コントラストの構造体背景、ミントの主操作・金色のチャレンジ・静かな補助枠。CSSのURLはViteがPagesのbaseにも変換する。画像に文字や操作は焼き込まず、HTMLのラベル/フォーカスを維持。

生成プロンプト:
> Use case: stylized-concept. Asset type: subtle background texture for SWARM FRONT tactical sci-fi game title UI. Create a wide 1536x1024 atmospheric illustration of abstract fractured architectural slabs and fine tactical topographic contour lines, charcoal navy and desaturated deep teal, a few muted mint edge highlights, very low contrast. Existing interface has a big white logo in left upper half and opaque command buttons on right. Keep center and entire upper half extremely quiet and near-black; architectural detail concentrated in lower left perimeter, receding into mist. Sophisticated restrained tactical terminal mood, subtle depth, no characters, no weapons, no text, no letters, no numbers, no symbols, no logos, no UI, no buttons. This will sit behind readable live HTML interface. No bright focal points.

自己検証: typecheck成功。`scripts/check-title-layout.mjs` の実Chromeで1280×582/1440×900/844×390/667×375/640×360/568×320の全入口画面内・押下位置・横溢れなし・小ボタン1行/高さ38px以上、週間通知3件、3ダイアログ開閉/フォーカス復帰、日替わり入口、ソロ出撃準備遷移、pageerror0を確認。568×320のPWA追加ボタン+チャレンジ+最長作戦名の表示も確認。最初のソロ遷移待機は初回プレイヤー名登録画面で停止したため、検証に正規の登録操作を追加して成功。実装不具合ではない。

証拠 `docs/evidence/title-layout/`。実スマホ・実PWAインストールイベントは未確認。追加ボタンのレイアウトだけ共有レンダラーのinstall=trueで検証。クラウド報酬処理を変更していないため、報酬受取の再通信テストは対象外。独立監査・main反映・公開はこれから。

## 保存と監査の停止点

[PR37](https://github.com/futsalife24-bot/swarm-front/pull/37)、監査対象 `e747dc55ada9b401e4ee65de2fd8ca85fdc3e98d`。型/通常・Pagesビルド成功（既存chunkサイズ警告のみ）。Pages CSSの背景URLが `/swarm-front/assets/ui/title-atmosphere-v1.png` に変換されることも確認。

監査ZIP `dist-validation/title-audit-e747dc5.zip`（6,347,884 bytes）の通常ChatGPTへの添付は自動承認レビューが具体的payload/宛先の承認不足として拒否。資料に非公開ソース・差分・関連テスト・生成PNG・UI証拠を含む。依存キャッシュ・認証設定・.envは含まない。送信は未実施で、独立監査/main反映/公開は未完了。継続承認から推測して別経路へ送信しない。今回のZIPの監査目的送信についてユーザー承認後に再開。
production Worker dry-run成功。初回はsandboxの親ディレクトリ/ログ書込制限で失敗し、許可された権限で同じdry-runを実行して成功。公開操作は未実施。

## 監査再開

ユーザーが上記ZIP送信を明示承認。通常Chatへ添付/依頼送信し、[独立監査](https://chatgpt.com/c/6aabdd4d-2610-83e9-9ff8-8e6edd83bddd)がZIPとGitHubのbase/head/後続文書のみを確認して監査中。公開直前のFree契約・既存使用量をiabで確認（preflight.json）。

## 独立監査の必須指摘修正

初回e747dc5は要修正・中1件: 667×375でCOMMAND MENU見出し上端がクリップ。ボタンだけの境界チェックでは見出しを検出できていなかった。低高さ時の見出し省略を360px以下から400px以下に広げ、メニュー全体/表示中見出しの上下境界チェックを追加。667×400/401も追加し、8条件の実Chromeで全体/見出しの画面内表示・小ボタン1行・操作/通知確認が成功。型チェック成功。証拠画像を更新。任意の背景圧縮は今後の候補、今回必須ではない。

## 再監査添付の承認待ち

修正対象 `f87740a7998fdcdc9746608b3a94ac46182c3de1` をpush済み。8条件UI/型/通常・Pages build成功。修正以外の実装変更なし。

自動承認レビューは `title-reaudit-f87740a.zip`（3,826,663 bytes、修正CSS/差分/検証スクリプト/更新画像/記録）の同じ監査Chatへの添付も「初回ZIPとは別の具体的payloadの承認不足」として拒否。初回監査は必須1件、修正後の再監査は未依頼・未合格。別形式の本文送信等へ迂回せず、修正版の送信承認を待つ。main未反映・未公開。

## 独立再監査合格（2026-09-18）

ユーザーの修正版送信承認後、同じ通常監査Chatへtitle-reaudit-f87740a.zipを添付/依頼。最終対象f87740a7998fdcdc9746608b3a94ac46182c3de1は合格・必須残件0。監査はCSS/検証スクリプトのGitHub blob一致と修正差分、667×375/400/401画像、8条件の全体境界を独立照合。実Chromeスクリプトの監査側再実行、実スマホ、実PWAイベントは未実施。初回の背景圧縮は将来候補で非ブロッキング。

本日の公開前Cloudflare契約画面へのread-onlyアクセスは自動承認レビューが「公開自体の明示承認不足」として拒否。main反映/公開は未実施。PR37通常merge、既存公開アカウントのFree契約/使用量閲覧、既存Worker公開/配信確認をまとめて明示承認依頼する。継続承認の推定で別経路へ迂回しない。
