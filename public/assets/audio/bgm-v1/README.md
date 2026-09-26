# Scene BGM

User-supplied Suno MP3 originals downloaded 2026-09-16 from the specified Drive folder. Audio bytes are preserved; no trimming, transcoding or normalization.

| File | 曲名 / 使用場面 |
| --- | --- |
| title.mp3 | 戦線の灯 / タイトル・初回画面 |
| base.mp3 | 帰還した場所 / 基地・武器庫・アクセサリ・育成 |
| prepare.mp3 | 出撃待機 / 出撃準備・ステージ選択 |
| lobby.mp3 | 集結、次の戦場へ / 協力ロビー |
| report.mp3 | 不完全な模倣 / エネミーレポート |
| clear.mp3 | 作戦完了 / クリア時1回（7.6秒） |
| victory.mp3 | 次の戦場へ / 勝利後の回収・報酬選択・戦果 |

## Map battle music (2026-09-26)

| File | マップ / 曲名 |
| --- | --- |
| map-0.mp3 | 灰明の街区 / 灰色の前線 |
| map-1.mp3 | 薄暮の倉庫地区 / 交差する射線 |
| map-2.mp3 | 蒼鉄の工業区 / 蒼鉄圧力 |
| map-3.mp3 | 風渡る草原 / 風を裂く進軍 |
| map-4.mp3 | 白嶺の雪峡 / 凍てつく戦線 |
| map-5.mp3 | 晶脈の地底巣 / 晶脈の鼓動 |

Map tracks are Suno v6 MP3 originals, downloaded from the user's existing account.
Maps 0–2 reuse existing unreleased candidates; maps 3–5 were generated for this task.
Titles, submitted styles, source URLs, original byte hashes and full-decode measurements
are recorded in `docs/MAP-BGM-SOURCES.json`. No trimming, normalization or transcoding.
Solo and cooperative battle screens use the active world's stage plan, including
saved plans and elevated routes. Daily defense uses its map's track. Training and
defeat remain silent. Clear plays through before victory music; leaving the result
flow cancels it. Other tracks loop in full (not a sample-accurate seamless edit).
Playback begins on user interaction, follows the existing volume setting at a 0.55
relative gain and pauses while hidden. Native media volume behavior on physical
mobile browsers and subjective listening quality are unverified.
