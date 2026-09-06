# Android LANプレイテスト

本番公開や外部トンネルを使わず、同じWi-Fi内で実機確認する。外部監査はユーザーの再指示まで休止。ゲームの主な仕様はmainのda502b5から変更しない。今回の画面変更はURLに`?qa=1`がある場合のFPS表示だけ。

## 起動

1. PowerShell 7で `./scripts/setup-lan.ps1 -LanAddress <PCのWi-Fi IPv4>`。RFC1918のローカルIPv4に限定。証明書と秘密鍵はGit除外のdist-lan内へ保存し、OSの信頼ストアは変更しない。有効期限30日。既存ファイルや異なるIPの証明書は自動上書きしない。
2. `$env:VITE_SERVER_URL='https://<同じIP>:5443/api'` を指定して `npm run build -- --outDir dist-lan/site`。
3. 別ターミナルで `npm run server -- --persist-to .wrangler/lan-preview --var ALLOWED_ORIGINS:https://<同じIP>:5443 --log-level error`。通常Workerを127.0.0.1のみに起動。作成キーは既存の.dev.varsから読む。
4. `node scripts/lan-preview.mjs`。指定したWi-Fi IPの5443のみでHTTPS配信し、APIとWSSをローカルWorkerへ中継する。配布ビルドだけを配信し、Vite・ソース・秘密・fixtureは配信しない。
5. 同じWi-FiのAndroidで `https://<同じIP>:5443/?qa=1` を開く。自己署名のローカル証明書のため初回に警告が出る。自分のPCの上記アドレスであることを確認し、このサイトだけ続行する。全サイトの証明書検査や安全機能を無効化しない。Chromeが続行を認めない環境では無理に解除せず接続方法を再検討する。

自己署名証明書のLAN URLでは、ChromeがService Workerを拒否するためPWAのホーム画面追加は確認できない。LANでは協力プレイ確認だけを行い、PWAの実機インストールは信頼済みHTTPSの公開候補で確認する。

PCが起動し、2プロセスが動いている間だけ利用可能。別Wi-Fiや携帯回線では利用できない。IP/オリジン変更でブラウザの武器庫は別扱いになる。証明書警告の続行操作・実機からの到達性はPC模擬検証と区別する。

## 確認順

- ソロ: 配置編集、移動＋視点＋射撃、縦横回転、勝敗→武器装備→再読込→再出撃。
- 10〜15分連続: 敵が多い場面のFPS、操作遅延、熱さを記録。FPSは描画処理の実測値。40敵fixtureやWindowsのソフトウェア描画値を実機性能と混同しない。
- 2台協力: 1台目で「協力プレイ → ルームを作る → 招待リンクを共有」。2台目はリンクを開き「招待ルームに参加」。作成キーや接続先の入力は不要。蘇生、通信切断と復帰、個別報酬の保存を確認し、以後4人へ拡大する。

自動確認: 稼働中に `node scripts/verify-lan.mjs`。HTTPSでのsecure context、ソロ、任意FPS、2ブラウザの実WSSと状態一致、無資格作成401、秘密経路404。テストの自己署名許容は独立したブラウザcontextだけに限定。

結果はdist-lan/verification.jsonとevidence。Android実機1台でのLANソロ起動と描画修正、実機2台協力と戦闘中再読み込み復帰はユーザー確認済み。PWAの実機インストール、修正後の長時間観戦・蘇生は未検証。試遊用プロセスは依頼により稼働させておく。終了依頼時はこのLAN gatewayとlan-preview指定Workerだけを停止する。

初回の自動検証では、意図的に参加者別となるpending/rewards/dropsまで同一とする誤った比較で失敗した。検証を共通戦闘状態（HP・敵・進行等）の比較へ修正。ゲーム・サーバーの個別報酬仕様は変更していない。
