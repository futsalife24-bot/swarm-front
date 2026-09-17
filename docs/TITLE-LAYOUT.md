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
