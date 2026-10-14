# メディア通知のロゴ修正（2026-10-14）

本人のAndroid通知画像で旧月を確認。現行faviconの `icon-swarm-v3-512.png` は月、既存 `icon-swarm-v2-512.png` は正式SWARM FRONT.ロゴであることを実画像で確認した。

共通BackgroundMusic初期化時にMediaMetadataのtitleとartworkを明示し、512×512の既存正式ロゴを指定。生存・進撃・協力の共通BGMに適用。BASE_URLに対応し、非対応/制限環境で音声初期化を妨げない。再生状態やアクションハンドラは変更しない。画像加工やfavicon/インストール済みアプリの画像変更は今回含めない。

確認: bgm.test.ts 16件（追加5件）、media-playback 9件、型チェック成功。初回のVitest一時SSRファイルENOENTは再実行で解消。別途bgm-layout-return 2件は既存のcancelOperationCueスタブ不足による失敗で、今回修正していない。Android実機通知パネルの最終表示は未確認。仕様根拠: https://web.dev/articles/media-session 。

実装担当のモデルID/推論設定は未確認。独立Chat監査へ分割シャッターの修正と一緒に追加する。正本PR187。既存アイコン原本を維持し、通知画像の読み取り先を明示する変更。
