# 武器のレア度発光（2026-09-21）

- branch: codex/weapon-rarity-glow / base: 4d77be91a827601dd8afebb4425e4a04a191ee5f
- 手持ちと背中の両方に、各武器のレア度色の輪郭を追加。N灰緑/R緑/SR青/SSR紫/LR金。4秒周期で強度0.35–0.95。既存GLB・元マテリアル・ゲーム性能は変更なし。
- 裏面シェルを視点空間で8mm拡張。深度テスト有効、深度書込みなし、加算合成。遮蔽物や本体を透過しない。装備交換・非同期モデル到着で再生成、交換/兵士破棄時に専用マテリアルだけ破棄。
- 検証: typecheck成功、standard-trooper 4件成功、build成功。scripts/check-weapon-rarity-glow.mjs で実GLBの3種×5レア、異なる両装備色、明暗の実ピクセル差、両スロット持替え、dispose成功。兵士+2武器で最大43 draw calls（比較用シーン）。証拠 dist-validation/weapon-glow/validation.json・rarity-pulse.png。
- Meloso Judge: needs_context、Jev missing_key/not_run（API呼出し0）。参考分類未判定。実スマホ・多数プレイヤー長時間負荷未確認。
- 別作業 .gitignore / AGENTS.md / package.json / CLAUDE.md は保存状態を維持し今回commitに含めない。
- 独立Chat監査・main反映・本番公開は未完了。
