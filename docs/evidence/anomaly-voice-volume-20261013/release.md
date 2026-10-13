# 戦闘ボイス音量の抑制を公開（2026-10-13）

[PR180](https://github.com/futsalife24-bot/swarm-front/pull/180)を通常merge。公開ソース92e9a6f175416cefa11c2301f1d4be404f04fb61、Worker b7b72867-82af-4937-bfa5-b8d69bec688a。

全20声の戦闘入力ゲインを0.48→0.24（約-6.02dB）へ半減。最大2声・全体0.65秒/個体2.2秒・距離減衰を維持。音源・他SE/BGM・図鑑/試聴音量は変更なし。

src型・関連17テスト、実ブラウザのSound/Audio/WAVで0.24×2・3声目抑制・銃声0.62維持を確認。最終独立監査0408bc6は必須0/任意0、14確認グループ成功。merge後build・Worker dry-run・deploy成功。配信67/67 SHA一致、manifest一致、health200/ok・durable-object。

公開ゲームの読込は確認したが、既存の別ゲームタブによる保存保護画面だったため、そのタブへ干渉せず確認用タブだけ閉じた。公開後の戦闘実聴、実スマホ、群れとSE/BGM混合の聴感は未確認。入力ゲイン半減を体感音量半減とは主張しない。検証サーバーは終了済み。実装担当モデルID/推論設定は未確認、新規サブエージェントは使用なし。

公開先: https://swarm-front.melosalife-24.workers.dev/front
正本: https://github.com/futsalife24-bot/swarm-front.git
ローカル: C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a
