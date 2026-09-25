# HARROW v10 独立確認

- PR: https://github.com/futsalife24-bot/swarm-front/pull/85
- 初回資料対象: ff05099b823499f42bb8dcd00d472c7bdb34e664
- 最終実装対象: 56da5e1117db90ceb978634cb007c1be9736603e
- base: d3c0e431cd4841d010d6099a5d6000ff5496578d
- Chat: https://chatgpt.com/c/6ab5bf74-6c1c-83ee-a04d-fcc517f9a5c6
- 2026-09-25に通常Chatへ資料を添付・送信。初回は38件hash、非胴体183メッシュ・材質・骨・スキニング・既存10動作の保持、左右7/5周期、全12動作CPU再計算に異常なしという途中報告まで確認。最終判定前にInternal Server Error、再読込後にReact error #185を確認。同じChatで再試行したが最終判定未取得。合格扱いにせずmain未反映。
- ZIP: dist-validation/harrow-v10/HARROW-v10-ff05099-audit.zip、27,397,828 bytes、SHA256 8fcfb2944d53c5808a6f4b5338df8cfa63eed45acdfab617ac2ebf899e3d6d38。
- 対象GLB SHA256 d8bc54ef568b5e8995ca3d5ac01ed3273c19ca07babc14294d7df367d9a8ff75。

候補品質とmainへのソース保存を確認対象とする。ユーザーの造形承認、ゲーム採用、実戦・実スマホ、公開の合格を含まない。

## 再開

同じChatの完了結果を確認。追加のプレビュー2行（56da5e1）のメッセージは一度送信表示されたが、サーバーエラー後の保存済み会話では消失したため、最終判定後に差分を再送して新headの判定を得る。差分は dist-validation/harrow-v10/preview-56da5e1.patch とGitの ff05099..56da5e1。モデルhashは不変。合格後、記録差分のみを明示してPR85を通常merge。単体候補保存のみでゲーム差し替え・公開は対象外。

