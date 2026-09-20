# ドローン撮影カメラ

兵士を中心に上空から追従・周回する、URL限定の撮影カメラ。敵出現、戦闘、通信、保存、スコアは変更しない。自由に別地点を飛ぶカメラではなく、兵士を注視する。

## 使い方

- `?drone=1&clean=1`: 高さ32m・水平距離24mの斜め上空。8度/秒で自動周回。
- `?drone=1&clean=1&droneRadius=0&droneHeight=48&droneSpeed=0`: 真上48mの固定角度。四方の群れを見渡す構図向け。
- `&tracers=off`: 曳光線も消す。通常のcleanでは25%濃度で残る。
- ポーズの「ドローン撮影」を開き、高さ・水平距離・向き・自動周回を調整。「真上／斜め上空」で構図切替。チェックを外せば通常カメラへ戻る。
- キーボード: I/Kで上昇/下降、J/Lで左右周回、U/Oで近づく/離れる、Bで自動周回の停止/再開、Vで真上切替。兵士の移動・射撃キーは従来どおり。
- URLの範囲: `droneHeight` 8〜120m、`droneRadius` 0〜100m、`droneYaw` -180〜180度、`droneSpeed` -30〜30度/秒。0は有効、範囲外は丸め、不正/非有限値は初期値を使う。
- 設定はメモリー内だけ。再読み込みでURLの設定に戻る。フラグなし・`drone=0`・`drone=true`では起動しない。cleanだけでも通常カメラ。

## 実装と回帰

`src/client/drone-camera.ts` がURL判定、カメラ位置、操作パネルを担当。Rendererで通常の戦闘カメラ位置だけを上書きし、兵士座標・照準入力・Worldを書き換えない。main.tsの変更は既存ポーズ領域へのパネル受け渡し1行。ソロ入口はplaytest-appで同様に渡す。通常時はインスタンスも追加DOMも作らない。CSSは撮影パネルに限定。既存ポーズの再開/離脱を維持する。

スコープ中も撮影視点は俯瞰を維持し、兵士を表示する。照準/弾の飛び方は従来どおりで、画面上の敵をクリックして狙う俯瞰操作へは変更しない。初遭遇の紹介演出は既存どおり優先。

## 検証（2026-09-20）

- `npm run typecheck`: 成功。
- `npx vitest run tests/drone-camera.test.ts tests/clean-capture.test.ts tests/render.test.ts tests/encounter-camera.test.ts tests/layout.test.ts --reporter=dot`: 34件、5ファイル成功。
- 新規単体: フラグ無し/不正フラグ、数値検証、注視点不変、周回、真上の有限な姿勢、通常視点への復帰、停止時のキー解除/ドリフト抑制、無効時のカメラ不変。
- `node scripts/check-drone-capture.mjs`: Windows実Google Chrome（headless + SwiftShader）。844×390 / 667×375で通常カメラ/斜め上空/真上を比較。描画前後のWorld JSON一致、兵士表示、敵24体、pageerror 0。
- 実ソロ667×375: キーで高さ変更、ポーズ設定がスクロールなしで収まること、高さ48mと真上設定から再開、clean HUD非表示、操作配置の保存値不変を確認。pageerrorとwindow errorは0。初回試作の設定展開時にResizeObserver通知警告が出たが、パネルを圧縮した最終再検証では未発生。
- フラグ無し実ソロ844×390 / 667×375: 通常カメラの高さ約2.85m、HUD表示、撮影パネル無し、pageerror 0。no-flag/no-flag-pauseの4画像とnormal-results.jsonに保存。
- 全件npm testはこの変更で再実行していない。直前のclean対応時の既存失敗3件は [CLEAN-CAPTURE.md](CLEAN-CAPTURE.md) に記録。今回の関連34件は成功。

## 証拠と限界

[証拠フォルダー](evidence/drone-capture/) に画像とJSON。844/667-normal、oblique、topの6枚は、カメラ比較のため24体を円状に配置した静止検証シーン。**実戦の敵配置を再現した証拠でも、四方同時出現を追加した機能でもない。** top画像は高さ48m、obliqueは32m。actual-topとpause-controlsは通常ソロを操作した画像。

実スマホ、全マップ、協力の実通信、長時間動画、GPU性能は未検証。洞窟や建物の屋根が上空視点を遮る場合がある（世界の描画は消さない）。敵の出現方向は既存ルールのままなので、四方から必ず同時に押し寄せる演出には別の撮影シナリオが必要。兵士の無敵化・自動戦闘・動画録画/出力は含まない。

公開・独立監査は準備中。main反映/公開済みとは扱わない。
