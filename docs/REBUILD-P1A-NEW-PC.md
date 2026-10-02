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

## 3択画面の整理（2026-10-02・ユーザー指示）

[下書きPR #115](https://github.com/futsalife24-bot/swarm-front/pull/115) を継続。今回の変更前HEADは `b468d98a224d56b8fab4a81b451b3da928f2c4d6`。3択の下の操作説明・停止案内・試作条件・取得済み一覧と重複見出しを除去。カードは画像・名前・短い効果説明に集約し、再抽選は追加強化時だけ見出し行へ表示する。詳しい効果は読み上げ用の名前に保持する。戦闘HUDと停止ボタンは選択中に隠し、Escでの停止は維持する。

カードは380msで下から浮かび、70msずつ左から順に表示。新しい候補組への再抽選でも表示をやり直す。動きを減らす端末設定ではアニメーション・遷移を無効にする。戦闘・強化抽選・保存仕様は変更していない。

生成アイコン6点: `public/rebuild/upgrades/{blast-core,fuse,compressed-charge,armor,reload,magazine}.png`。内蔵画像生成ツールを使用。原画像はCodexの生成画像保管場所に保持し、内容・構図を変えず256×256へ縮小、透過を保持してゲームへ組み込んだ。6点の容量は合計約561KiB。採用原画像名・SHA-256・四隅の透過確認は [アイコン記録](evidence/rebuild-p1a/new-pc-20261002/upgrade-icons.json) を参照する。

生成指示の共通仕様（日本語表記）: 3択強化カード用の正方形アイコン。厚い面取り金属と明るい縁取りを使った戦術SF装備の手描き風立体イラスト。中央に一つの題材、約75%の大きさと安全余白。64pxで判別できる輪郭、控えめな細部、炭色鋼材。背景は完全透過。文字・数字・枠・ロゴ・透かし・背景景色・無関係な物体なし。初回3点は同仕様の英語指示で生成し、日本語限定の指示後の残り3点は日本語で生成した。

- 誘爆核: 橙色に発光する装甲付き爆発炉心と放射状の爆発。
- 導火: 小さな敵のシルエットに赤い照準印、火花のある短い導火線。
- 圧縮炸薬: 鋼製クランプに圧縮された3つの橙色炸薬。
- 装甲補強: ミント色の盾の輪郭を持つ重層鋼板の胸部装甲。
- 整備手順: 小型弾倉に差し込む弾とミント色の曲線矢印。
- 拡張弾倉: 真鍮の弾頭と金色の拡張部を持つ長い弾倉。

共通指示 `C:/Users/futsa/.codex/AGENTS.md` と本リポジトリのAGENTS.mdに、日本語のみ・不要な思考実況なし・必要な結果だけ簡潔に伝える規則を保存。[共通指示の変更前後SHA-256と追加本文](evidence/rebuild-p1a/new-pc-20261002/japanese-output-rule.json) を記録した。既存のHooksや権限制御は変更していない。

旧監査ZIP `p1a-b468d98-audit.zip` は今回のUI変更を含まないため、この版の監査資料として送らない。Google方式の監査用ログインは前記の自動承認レビュー拒否の状態を維持し、独立監査は未完了。

今回のUI変更後の検証: client/Worker型チェック、試作build、E2Eの横3枚（844×390・640×360）、アイコン読込、案内の除去、通常の表示遅延と動き軽減設定、ロード/繰返し選択/1秒再開の3ケース成功（99.20秒）。再試行・再読み込み・旧セーブ不変の1ケースを別実行し成功。計4ケースで、新しい版の全7ケース一括試験ではない。共有戦闘・保存コードを変更していないため、成功済み単体120件・保存回帰147件の再実行はしていない。実測は [今回の結果](evidence/rebuild-p1a/choice-design-20261002/results.json)、画面は [844×390](evidence/rebuild-p1a/choice-design-20261002/selection-844x390.png) と [640×360](evidence/rebuild-p1a/choice-design-20261002/selection-640x360.png)。既存bundleサイズ警告は残る。

監査資料の再開場所: 作業親フォルダ `.task-tools/p1a-choice-design-audit.zip`。今回の修正をcommitした固定版から作り直し、ZIP内の「監査案内.md」とハッシュ表で対象を照合する。添付・監査依頼の送信・独立監査判定は未実施。
