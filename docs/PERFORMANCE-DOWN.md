# 2026-09-14 基準・低下の下線廃止と青い二段▼

同じ一時試遊URLへ反映済み。固定Worker未変更。

白（基準・固定装弾）と青（負補正）の下線を外した。数値は白。負補正のみ数値右側に青い▼を縦2段、7px文字/6px行高で表示。黄・橙・赤の下線と最大補正★は維持。共有PNGも負補正は二段三角形、基準は下線なしに統一。変更はsrc/client/playtest.cssとweapon-sharing.ts。

型/build成功、既存チャンク容量警告あり。4寸法×通常/整理の必須一覧検証成功、行高30px・列幅・固定比較維持。check-performance-down.mjsで白数値/下線条件/青マークのスタイル確認。一覧・詳細・共有PNGを生成して確認。公開10ファイルと最終distのSHA256一致。実スマホ受入未確認。

branch codex/home-armory、base/head 4186f25f7c9695f95ea897ad182db5f85fac3091、未コミット。開始前の差分を保持。証拠はdist-validation/performance-down/のbefore、changes.patch、styles.json、layout.json、delivery.json、各PNG。
