# 最終状態: 再監査合格・公開完了

対象 d8ecc2e8a6b7f154169ac8b5374d133135250dae の独立再監査は必須P0/P1/P2各0。接続障害は新規タブで復旧し、通常merge/既存Worker公開と配信・公開UI確認まで完了。[公開記録](evidence/harrow-v13-release-20261012/README.md)。以下は過去の引き継ぎ記録。

# HARROW v13 監査への引き継ぎ

## 修正版の保存と再開点

- 修正commit/ビルド対象: `d8ecc2e8a6b7f154169ac8b5374d133135250dae`、PR171へpush済み。base `cbda0481234fe494dd4d1ab023869e9812ea978d`。
- 修正後122テスト、型、素材/姿勢/40発射元、build、production dry-run合格。後続変更はこの記録のみ。
- 修正版監査ZIP: `dist-validation/harrow-v13/harrow-v13-audit.zip`、142ファイル、90,940,188 bytes、SHA256 `57d58ab0b5f51fb8e46160cf575d27c6c052ca5948fa0a01b3914c3d47df0f32`。CRCと全manifest照合済み。初回ZIPは `harrow-v13-initial-audit.zip` として保存。
- 添付用文面: `dist-validation/harrow-v13/reaudit-message.txt`。既存監査Chatは上記URL。画像/動画は初回GLBの証拠であり、P2修正後の歩行実画面は未確認。ZIP内の `ui-review.json` に元SHAを保持。
- 停止理由: CUAの状態取得と既存監査Chat接続が連続タイムアウトし、kernel reset。ビルド待機中の再確認でも復旧せず。再監査未送信・main/公開未実施。公開HARROWはv12、CALYXは修正公開済み。
- 再開条件: iab接続復旧後、ローカルプレビューを再起動して歩行境界を実画面確認し、同じChatへ修正版を添付。技術監査合格後に通常merge→merge後build/dry-run→既存Worker公開・配信/UI確認。追加の操作承認は不要。
- 一時検証サーバー5200/8798は停止。別件下書きは全文復元済みで、Git/監査ZIPには含まない。主担当モデル/推論設定は未確認、制作補助は `gpt-6-sol` / `medium`。
## 初回判定とP2修正

初回の独立監査は `cc66f070c2eacf0075cc413821fdcda41ea6d8ab` に対してP0/P1各0、P2・1件で保留。P2はIdle↔Locomotionの0.32256mの位置差。監査側はZIP/manifest・22プリミティブの形状保持・画像/動画抜粋・発射座標の証拠整合を実確認し、低い基本/飛行姿勢と翼幅拡大を確認した。検証コマンドの独立再実行・実スマホ・全動画フレーム精査は未実施。

歩行軌道の一定オフセットを補正してP2を修正。最終GLBは `c5a8e2e241cc441473519ed7f12e24e7b508c916d00cf7270427cc4a0a7ef0ba`。実境界差はIdle→Locomotion `0.000005692m`、逆 `0.000005683m`。全39骨の厳密行列回帰を追加し、修正前は失敗、修正後122テスト/型/asset/posture/40発射口で合格。全クリップ実トラック比較で変更はLocomotionのみ。接地ドリフト最大0.108329mは従来同水準。

修正後の再監査送信・実画面再確認は未実施。CUAはゲーム画面再読込後、再接続・全体状態取得・既存監査Chatへの接続のいずれもタイムアウトし、各回でkernel resetを返した。追加の経路変更や保護回避はしていない。接続復旧後、同じ監査Chatへ修正後資料を送り、技術判定を確認する。通常リリースは既存の本人継続承認内であり、本人の美術的採用とは区別する。

以下は初回資料の対応と過去経過。

2026-10-12。PR171: https://github.com/futsalife24-bot/swarm-front/pull/171

- branch: `codex/harrow-low-posture-v13-20261012`
- base: `cbda0481234fe494dd4d1ab023869e9812ea978d`
- 実装・ビルド対象: `cc66f070c2eacf0075cc413821fdcda41ea6d8ab`
- GLB: `772541a2735b465e2d04f8830f556f11e47ca29dee7335f8b17446a1857e0431`
- 自己検証: 122テスト、型、実Worker2接続22項目、asset/posture/40 launcher、build/production dry-runすべて成功。
- 素材・実ゲーム画像・3動作動画・ソース・差分・検証を収録した監査ZIP: `dist-validation/harrow-v13/harrow-v13-audit.zip`、136ファイル、90,928,929 bytes、SHA256 `dab6949eaf5afe66bf3556fb24ffcc1498c36a268dd72ca695fe90d873d47e0b`。CRC/全manifestハッシュ照合済み。無関係な下書きはZIPに含めていない。
- 実画面は地上・飛行中・地上/空中山なり弾・直射・爆撃・ダイブを確認。動画の全フレーム精査や実スマホ性能、本人の美術的採用は未確認。足滑り最大0.10833m、歩行境界0.323mが残る。

## 監査依頼済み・判定待ち

本人が「一時置換と全文復元を承認する」と明示回答後、通常Chatへ上記ZIPと対象SHAを送信した。[監査Chat](https://chatgpt.com/c/6acc6d2a-fae8-83ee-9950-2f70807c9693)。別件下書き496文字は送信後に新規ホームへ全文復元し、保存前の文字列との完全一致を確認済み。下記の操作承認待ちは解消した過去経過。監査合格・main・公開は判定確認後に続行する。

## 解消済みの停止理由

通常Chat新規画面にも別件の496文字の下書きが引き継がれる。既存別タブ・メモリ・Git対象外のローカルファイルへ全文保存し、496文字一致を確認したが、空欄への置換は自動承認レビューに2回拒否された。理由は下書き喪失リスク。レビューが示した「新しいチャット」も試したが下書きは残った。設定・セキュリティ変更や別監査経路への迂回はしていない。

監査資料のアップロード/依頼送信は未実施。監査合格・main反映・Worker公開は未完了。公開はCALYX修正済み/ HARROW v12のまま。

再開条件: 下書きの一時置換と送信後の全文復元への明示承認、またはユーザーによる下書き整理後、iab通常Chatで添付・独立監査を再開する。資料SHAは上記実装を対象とし、その後の変更はこの進行記録のみ。合格後は通常merge→merge後build/dry-run→既存Worker公開→配信SHA/health/実UI→公開記録main反映。

下書きの永続保護先は `dist-validation/harrow-v13/preserved-chat-draft.txt`、SHA256 `e3e251ac41629809eda84317d3801127014a7d8cc9c6c14fb69367e1e802a112`。内容はGitHub/監査ZIPへ送らない。主担当モデル設定は未確認、制作補助は `gpt-6-sol` / `medium`。
