# 撮り直し・新規クリップ一式（2026-11-15）

全68クリップ、ElevenLabs eleven_v4 / 日本語固定 / stability 0.5 / similarity_boost 0.75、WAV 44.1kHz mono。
フォルダ構成は output-v4 のセット名そのまま。ゲーム内表示テキストは変更なし（読み指定は音声側のみ）。

## 管制AI 3声（voice-control-hiromi-v1 / hiyori-v1 / yoko-v1、各18件）

- weapon-rifle / smg / shotgun / slug / rocket / heavy / sniper / grenade / sticky / laser / kick / medic（12件）: 型番を落としカタカナ名のみで再生成（リーフ／ワスプ／ブレイカー／スパイク／コメット／メテオ／ソーン／ホロウ／リンバー／グリム／ケストレル／ブルーム）
- anomaly-calyx: 「識別名、カリクス。」で再生成（旧読みケイリクスを訂正）
- boss-detected: 読み指定「おおがた反応を検知。警戒してください。」（表示文は「大型反応を検知。警戒してください。」のまま）
- final-large: 読み指定「最終おおがた、出現。」
- loading: 「戦場を、準備中です。」（「準備中」のイントネーション調整で句読点変更）
- guide-step-1: 句読点調整で再生成（文面は同じ）
- retire-ack: **新規**「撤退を確認しました。部隊は帰投してください。」（任意撤退時）

## 兵士・隊長（voice-soldier-ryunosuke-v1 / voice-soldier-akio-v1 / voice-captain-v1、各3件）

- warning: 「[urgent] おおがた接近！ 全員、構えろ！」（表示文は「大型接近！ 全員、構えろ！」）
- empty: 「[panicked] くっ、たまぎれだ！ くそっ！」（表示文は「弾切れだ」）
- empty-var: 「[panicked] しまった、空だ！ たまぎれだ！」

## 隊長のみ追加（voice-captain-v1）

- retire-order: **新規**「[urgent] 全員、撤退だ！ 生きて帰るぞ！」

## バディ（各1件）

- voice-buddy-tatara-v1 / voice-buddy-tobari-v1: retreat **新規**「了解、撤退しよう。無事に帰るぞ。」（声：Tao）
- voice-buddy-oriha-v1 / voice-buddy-yosuga-v1: retreat **新規**「了解です。無理せず撤退しましょう。」（声：Suzu）
