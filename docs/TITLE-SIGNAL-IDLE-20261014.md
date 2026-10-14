# タイトルの待機演出と開始モーション（2026-10-14）

ユーザー指定: TAP START的な案内、通信不良を思わせる定期的なロゴノイズ、タップ後にドットが一旦縮んでから拡大。base c797f0c1253624994618502d3ed4efa7c65c6100。製品変更はsrc/client/title-entry.ts/cssだけ。

既存ロゴ下にTAP STARTを配置し、2.8秒周期で明度をゆっくり変える。6.8秒周期に短い横ずれ2回と走査線を入れる。全面点滅は使わず、元のロゴを維持。タップ時にノイズ/案内を停止。元画像のドットを黒い下地で覆い、同じ位置の水色円を120msで58%へ縮小し、680msで全画面へ拡大、240msでメニューへフェード。低モーションでは待機アニメーションと開始アニメーションを省略。入力ガード/直接入口/全画面待機は既存を維持。

型・関連11件・ビルド成功。公開用ビルドで案内表示→クリック→メニュー→ソロ作戦選択を確認。844×390の案内下端322.6pxで画面内。局所probeは既存UIと本物の演出を使い、ソロだけカウンターへ置換。requestAnimationFrameのDOM記録でscale1→0.58→拡大とタップ後prompt0/noise:noneを確認。低モーションでnoise/promptのanimation:none、Enterで入口解除を確認。noiseFrameは撮影のためCSS周期3秒地点で一時停止したテスト専用。実機スマホ/Safari/Firefox未確認。独立監査・main反映・公開は未完了。

証拠: docs/evidence/title-signal-idle-20261014/。主担当モデルID/effortは取得不可、サブエージェント不使用。

## 独立監査
対象f54b992は限定合格、必須P0/P1/P2各0。53件通過。raw原文audit-f54b992.txt。任意改善のidle-844.jpg（ロゴ読込み前）はidle-844-loaded.jpgで補足し、型/11テストはconfirmed-checks.logにHEAD/終了コードを追加。製品変更なし。

## 公開完了
PR185をmain反映。公開ソース16ff61383e281ac87e5cf25f72fb74ceceeeddf5、Worker Version 4c97a5f1-4fd2-4d1e-8842-fdd6711e321b。mainからbuild/dry-run/deploy成功。54ファイル配信一致、health正常。iabでTAP START・6.8sノイズ設定・タップ後のソロ作戦選択を確認。
