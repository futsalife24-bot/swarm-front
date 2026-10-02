# P1a 新PCでの再開・画面検証（2026-10-02）

対象ブランチ: `codex/rebuild-p1a-cloud-20261001`。開始HEADは `88eb6c9273f6a4a784ade4ac77bb8b37b3e81e9d`、mainの比較基準は `4520c57ede444d44b8699753645f36ce479b72bf`。

GitHub: https://github.com/futsalife24-bot/swarm-front

新PCの作業場所: `C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a`。空の場所へ新規cloneし、開始時のtracked/untracked差分なしを確認した。旧PCの差分、他PRのブランチは取得・変更していない。main統合・本番公開は今回の対象外。

## 今回の修正

- 試作HTMLに既存アイコンの参照を追加。Chromeが存在しないfavicon.icoを取得し、console errorになる問題を解消。
- 画面検証は通常GPU描画を既定にし、ソフト描画は `SWARM_SOFTWARE_GL=1` で明示選択する。
- PCの射撃テストはPC用の照準面を使う。非表示のタッチボタンを操作しない。
- スティックのドラッグは `hasTouch: true` のブラウザ条件で確認する。物理タッチ端末の確認とは区別する。
- 1秒の再開予告は、実際のclickとDOM変更を観測し、操作解禁まで950ms以上・予告中の時計/操作停止を検証する。固定sleepと複数の往復で短い表示を見逃す方法を置き換えた。アプリ内部状態の書換えやイベントの合成はしない。
- HUD停止の比較は取得とassertの両方でinnerTextを使い、表示上の改行とtextContentの連結を混同しない。

## 新PCでの環境

Windows / PowerShell、Node v24.19.0、npm 11.9.0、インストール済みChrome。依存は既存package-lock.jsonからnpm ciで取得し、lockfileは変更していない。

システムのnpmはなかったため、公式registry.npmjs.orgのnpm 11.9.0を作業親フォルダ `.task-tools/package` に展開した。PC全体のPATHやnpm設定は変更していない。

このcheckoutで再開する場合:

```powershell
Set-Location C:/Users/futsa/Documents/Codex/2026-10-02/github/swarm-rebuild-p1a
$env:PATH = 'C:\Users\futsa\Documents\Codex\2026-10-02\github\.task-tools;' + $env:PATH
npm run dev
```

入口: http://127.0.0.1:5186/rebuild-p1a.html 。通常ゲームとは別の、保存・報酬なしの試作。

通常のnpmがある別PCは [REBUILD-P1A.md](REBUILD-P1A.md) の手順で再現できる。ソフト描画を選ぶ場合だけ `SWARM_SOFTWARE_GL=1` を指定する。

## 検証と失敗の区別

今回、新PCでclient/Worker型チェック、P1a単体120件、保存回帰147件、試作build、通常build、Worker production dry-runが成功した。通常の500kB超bundle警告は残る。全体テストの過去4 suite失敗は [10/1検証記録](REBUILD-P1A-VALIDATION.md) の基準版比較を参照し、今回は無関係な全件を再実行していない。

初回のソフト描画テストではfavicon 404と未実行だったテスト側の問題を検出した。この実行は途中終了し、全ケース完走とは扱わない。続く通常描画の完走は3成功/3失敗/1skip（約5.5分）。失敗は再開表示の固定待ち、HUDテキスト比較、PCでタッチスティックを操作する条件に対応する。

最終確認は2回に分けた。中間版の全7ケースは4成功/2失敗/1skip、299.01秒。初回GPUシェーダー準備が10秒の観測待ちを超える点と、観測登録前にクリックできる競合をテスト側で修正。観測の登録完了をconsoleの準備通知で待ち、待機上限は既存の素材待ちと同じ65秒にした。予告中の時計/操作停止と最低950msのassertは維持する。該当2ケースの再実行は2成功、実測は [results.json](evidence/rebuild-p1a/new-pc-20261002/results.json) に保存した。

2回を合わせて6ケースの成功を確認。修正後の全7ケース一括実行とは報告しない。background lifecycleはheadless Chromeでdocument.hidden=falseのため1skip、実背景タブの確認は未実施。画面検証の成功は人間の楽しさやAndroid性能の合格を意味しない。

画面証拠: [844×390](evidence/rebuild-p1a/new-pc-20261002/selection-844x390.png)、[640×360](evidence/rebuild-p1a/new-pc-20261002/selection-640x360.png)。両方で横3枚のカードと選択ボタンが画面内に収まり、console errorなし。GPUの既存shader warningはerrorと区別する。

新PCのソース20ファイルのcheckout実バイトとLF正規化後のSHA-256を [source-hashes-20261002.json](evidence/rebuild-p1a/source-hashes-20261002.json) に記録。10/1のLinuxハッシュ表は履歴として保持し、WindowsのCRLFによるバイト差を隠さない。

Worker dry-runの初回はsandboxの親ディレクトリ読み取り制限で失敗。許可された同じdry-runを通常の権限で再実行し成功した。公開操作なし。

## 独立監査と残件

指定スキル: [swarm-front-audit-release](skills/swarm-front-audit-release/SKILL.md)。新PCのIABで通常ChatGPTを開けたが未ログイン。

ログイン開始は自動承認レビューに拒否され、その後ユーザーが承認したためログインダイアログまで進んだ。続く「Googleで続行」は「ログイン開始だけでは具体的な認証方式・アカウント選択の明示承認がない」と拒否された。別方式や別ブラウザで迂回しない。ZIP添付・監査依頼送信・独立判定は未実施。

停止理由: 通常ChatのGoogle OAuth操作に対する自動承認レビュー拒否。ローカルの自己検証を独立監査合格にしない。

再開条件: ユーザーが新PCのIAB通常ChatGPTへ既存Googleアカウントでログインし、今回のP1aソース・差分・テスト・画面証拠ZIPを独立監査目的で同Chatへ添付・送信する具体的操作を承認する。アカウントは本人指定/既存選択に従い、新規権限追加や新規アカウント作成は行わない。

人間の試遊、物理Androidの入力・フレーム時間・発熱、実背景タブの停止確認、指定の独立監査は引き続き受入項目。P1b/協力/製品接続へは拡張していない。

実行モデルID・effortは未確認。モデル切替・サブエージェント使用なし。
