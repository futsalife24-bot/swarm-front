# 武器外周のネオンライン（2026-09-21）

- branch codex/weapon-neon-outline / base 56b0f88f07d72ba2f7cad50da1eaf3969e2c375c。
- 部品ごとの膨張シェルを廃止し、既存Blenderモデルの大きな外形に沿う左右の閉じたネオンチューブを追加。ねじ・レール歯を個別に光らせない。GLB/元材質/性能は変更なし。
- 芯半径3.5mmは不透明、にじみ半径7mmは通常透過（加算なし）。角は二次曲線で丸める。レア色を維持し、4秒周期、芯78–100%・にじみ10–18%の穏やかな明滅。全周の線は暗い側でも消さない。既存の持替え/装備更新/兵士破棄に追従。
- 主な変更: src/client/weapon-rarity-glow.ts と既存2検証スクリプト。旧膨張シェル専用検査を新しい閉ループ/通常合成/原本不変/所有資源破棄へ更新。
- 検証: typecheck成功、関連standard-trooper 4件成功。実3種×5レア度で両装備色/明暗ピクセル/持替え/破棄成功。全15GLBで2描画層・両側閉ループ・有限頂点・元法線不変・geometry2/材質2の破棄・元破棄0を確認。3種×3角度を目視確認。検証シーン最大draw calls32（前版43）、生成最大28.2ms（このPCの単回測定で保証値ではない）。
- 証拠: dist-validation/weapon-glow/rarity-pulse.png・validation.json、dist-validation/weapon-neon/neon-angles.png・validation.json。
- Meloso Judgeはneeds_context、live未実行（missing_key、API呼び出し0回）。既存の別作業4ファイルはcommit対象外。
- build/dry-run成功。残り: プロジェクトWORKFLOW指定のmerge前独立監査、main反映・本番公開。実スマホ/長時間負荷は未確認。

- 監査対象93cabd224747b82b5d04f6fb370df0b9473b1326、PR75。ZIP neon-93cabd2-audit.zip（5,942,566 bytes、SHA256 2859C969C3D7FE9804EC05973430D781B8383311FC1BF299469D8926BEAFE3B3）を通常Chatへ送信済み。監査URL: https://chatgpt.com/c/6ab114f9-a904-83ee-858a-439423d5a864 。後続変更は記録のみ。
- 独立監査合格、必須P0-P2なし。任意P3: 本体FOV65/AAなしで移動・カメラ回転/固定姿勢の明暗確認、実端末・複数兵士の生成/フレーム/GPU資源推移。監査側は代替Nodeハーネス4/4、正式WebGL/型/build/dry-run未再実行。追加自己確認AAなし15組合せ成功・画像目視、実戦移動条件全体の保証ではない。
- 公開完了: PR75通常merge、source 1f80fa61717aa4855cccd6aeac576cfe0f650341。cleanな既存main worktree share-image-fixでbuild/dry-run後deploy成功。Worker Version abb54537-fec3-4c6b-baca-677a7662324e。https://swarm-front.melosalife-24.workers.dev の配信13SHA一致・health200、iab中断画面正常/error0。既存ST1・13秒のセーブ保護で再開/破棄せず。証拠 dist-validation/weapon-neon/published.json。後続は記録のみ。
