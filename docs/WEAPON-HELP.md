# 武器ヘルプ（2026-09-09）

武器獲得一覧・出撃準備の共通行に武器種の「?」、武器庫の選択詳細にも武器種ヘルプを追加。特殊効果名からネイティブdialogで説明を表示。閉じる・背景クリック・Esc、フォーカス復帰に対応し、親行の装備操作への伝播を止める。
高速装填はユーザー指示により特殊効果欄に表示せず、装填時間にも説明ボタンを設けない。基礎性能は数値表示のみとし、説明は武器種と特殊効果に限定する。既存の戦闘計算・保存形式は変更なし。新武器は未追加、未公開。

変更: src/main.ts（表示接続）、src/client/weapon-help.ts（説明と開閉）、src/mobile-ui.css（小画面配置）、e2e/armory-ui.spec.ts（ヘルプ操作検証）、playwright.weapon-help.config.ts（専用実行）。既存の未コミット作業を保持。
branch: codex/home-armory / base・HEAD: 2be699f160c83d641fb68bb1304e4da8059920dc。今回も未コミット。

型チェック・ビルド成功（既存500kB警告）。640×280 Chromeでタッチ開閉、Esc、Enter、フォーカス復帰、保存データ不変、背景閉じを検証。証拠は dist-validation/help-layout-final.log、dist-validation/evidence/weapon-help-mobile.png、help-gear.png。
武器獲得画面は共通行に反映済みだが、実際の勝利からの通し確認は未実施。既存の武器庫全体テストは完了結果未取得で成功扱いしない。

