# HARROW v10 独立確認

- PR: https://github.com/futsalife24-bot/swarm-front/pull/85
- 初回資料対象: `ff05099b823499f42bb8dcd00d472c7bdb34e664`
- 最終実装対象: `486697581c354f8b9c1165c1e6522733365d8244`
- base: `d3c0e431cd4841d010d6099a5d6000ff5496578d`
- Chat: https://chatgpt.com/c/6ab5bf74-6c1c-83ee-a04d-fcc517f9a5c6
- ZIP: `dist-validation/harrow-v10/HARROW-v10-ff05099-audit.zip`、27,397,828 bytes、SHA256 `8fcfb2944d53c5808a6f4b5338df8cfa63eed45acdfab617ac2ebf899e3d6d38`。
- 対象GLB SHA256: `d8bc54ef568b5e8995ca3d5ac01ed3273c19ca07babc14294d7df367d9a8ff75`。

初回監査は3D本体を合格とし、比較プレビューの非同期読込競合をF1/P2として1件指摘。最新request IDだけがsceneを更新する修正と両方向の逆順完了テストを `4866975` に反映した。

限定再監査は独立テスト24件を全通過し、逆順完了・連続要求・失敗時にも選択版、scene実体、再生時間、ステータスが一致すること、指定commitとPR85 HEADの一致を確認。最終判定は **P0 0件／P1 0件／P2 0件、F1解消済み、候補ソースとしてmain保存可**。

この合格は単体3D候補と比較プレビューのソース保存を対象とする。ユーザーの造形承認、ゲーム採用、実戦・実スマホ性能、公開の合格を含まない。監査後はこの記録とSTATEだけを更新し、実装・モデルは変更していない。

