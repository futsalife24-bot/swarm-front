# 戦闘中のANOMALY音量を抑制（2026-10-13）

本人の「群れの声が流れると大きすぎるので控えめに」へ対応。全20声の戦闘再生ゲインを0.48から0.24へ半減（約-6.02dB）。最大2声・全体0.65秒/個体2.2秒の間隔・距離減衰を維持。採用済み音源、BGM/他SE、図鑑・比較試聴の音量は変更なし。体感音量が半分になったという主張ではない。

base main 419043b62e6793f12c91e4794fc0292706abf89b。製品変更はsrc/client/audio.tsの1行だけ。src型チェックexit0、関連2ファイル17テスト成功。独立監査・main反映・公開はこれから。

確定実装0408bc6からvite build exit0、後続の本番Worker dry-run exit0。既存監査Chatへ差分全文を追加送信し、user message 263769e1-1e7c-4980-a695-34f63ad0dc0dの永続反映を確認。前回ZIP＋合格済み表示差分を基礎資料とし、今回の音量1行を限定監査。PR180 https://github.com/futsalife24-bot/swarm-front/pull/180 。

ブラウザは同じChromeの新タブが読み込みを完了した後に復旧。実Sound/実AudioContext/実WAVを使うローカル検証ページで実行。monsterCount=2、各gain=0.23999999463558197、3声目抑制true、rifleGain=0.6200000047683716、全bufferデコード済み、context=running、effectsVolume=0.35を確認。ノード生成を観測したもので音源・Audioをモックに置換していない。実聴による評価やゲーム全体の群れ戦闘検証とは区別。検証用HTMLはdist-validation/anomaly-voice-volume-20261013/check.html（非配信・Git除外）。
