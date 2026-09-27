# デフォルト兵士ボイス: Fenrir

2026-09-27。ユーザー指示により3声切替は保留し、生成済みFenrirのみ実装。
GitHub: https://github.com/futsalife24-bot/swarm-front / 作業場所: 既存balance-t7 worktree。
base: df3b0c2670997300bd264d68b139b50b659abab4 / branch: codex/fenrir-default-voice。

- 自分の兵士だけが発声。全体/SE音量に従う。設定追加・セーブ形式変更・通信変更なし。
- 装填開始の60%で「装填中！」「リロード！」を抽選。弾数0の場合だけ「くっ、弾切れだ！」も候補。前回と同じ装填台詞を除外。
- 生存しているboss/harrow/calyxが55m以内へ入った時「大型接近！」。初回読込/復帰時は抑制。一般敵の予備動作音には紐付けない。
- 20m以内のダウンした接続中の味方がいる状態で自分が射撃すると、20秒に1回だけ35%の抽選で「援護する！」。
- 通常発声後6秒、警告後10秒の間隔。同一更新で警告を優先。抑制されたイベントを後から再生しない。
- 読込未完了/非表示/中断/死亡/切断/ミュート時に通常発声しない。非表示時は再開の基準状態を取り直す。音声デコード前の代替ノイズや遅延再生はしない。音声のピッチ変更なし。
- サウンドテストの既存選択欄に5台詞を追加。試聴は抽選/戦闘クールダウンを通さない。

## 素材と検証

public/assets/audio/voice-fenrir-v1に5本。assets-src/voice-fenrir-v1に原本・再生成条件・SHA256・長さ。
生成元モデル: gemini-3.8-flash-tts。Codex実行モデルID/effortは取得できず未確認、切替なし。

- tsc client/worker成功。
- 関連テスト41件成功（既存32 + 兵士発声9）。実reload状態遷移、空弾限定、無発声、継続中の再抽選なし、切替/初期読込/非表示復帰/死亡、警告優先、援護抽選間隔を含む。
- Vite build成功。既存の大きいchunk警告あり。
- IABの実ゲーム設定→サウンドテストを操作し、5本のデコード・再生開始がエラーなし。警告は2.24秒のended=true/error=nullを確認。証拠: docs/evidence/fenrir-voice。
- 音の主観的な聴感・物理Androidでの戦闘中の聞き取りは未評価。協力の実通信は今回変更なし、今回の新規実通信テストは未実施。
- .meloso-judge/run.cjsはこのworktreeに未導入。自動取得・代替有料判定は行わず未判定。

独立監査・main反映・公開は完了（末尾参照）。以下の監査待ち記述は経過記録。追加36本、別声の切替はIssue102で保留。

## 独立監査

PR103 / 実装HEAD e3c391846486d3467483e38be60a1460f62da724。source.zip（1,170,541 bytes）を通常Chatへ添付・送信し展開開始を確認。監査Chat: https://chatgpt.com/c/6ab8fa97-e29c-83ee-8e98-a719e1af5a50 。必須判定待ち。Worker dry-runも権限制約を解消して成功済み。

## 監査再現に対する修正

初回監査の途中報告で復帰/再接続/AudioContext中断後の旧発声残存と多数SEによる警告停止を確認。ボイスをSE用32音プールから分離し、stop/resetSpeechで即停止と基準状態リセット。AudioContext statechange・unlock時の中断・非表示・run/owner変更・死亡/切断/ミュートを処理。Networkの接続ごとのfirstStateをonWorldへ渡し、古いworldを描画していても初回受信時に基準を取り直す。プロトコル/サーバー/認証変更なし。読み込み中のonWorldで戦闘ボイスを鳴らさない。

再生回帰8件と接続境界1件を追加し、関連合計53件成功（52件実行後、接続境界追加を含む12件成功）。型/build成功。最終指摘との照合と独立再監査は未完了。

初回正式監査: e3c3918はP0=0/P1=0/P2=4で要修正。F1再接続初回、F2非表示による間隔/前回台詞消失、F3AudioContext中断、F4SE上限による警告停止。F2はSoldierVoice.suspendで観測基準のみ再設定し、同run/ownerの6秒/10秒/20秒期限と前回台詞を保持するよう追加修正。全リセットは新run/ownerだけ。該当回帰4件を追加し最新25件成功、既存32件と合わせ57件（型成功）。原本と出荷WAVは全て不変。

サウンドテストの初期音量は全体音量を使用し、SE係数と独立した既存の試聴音量で調整する仕様。戦闘ボイスは全体×SEに従う。

## 独立再監査 PASS

対象843e7390ffaf597d4175721ba6b47cbb138ba9b3。通常ChatでF1〜F4すべて解消、必須P0/P1/P2各0。独立の隔離ブラウザ25件成功、限定型成功。native AudioContext中断後の旧サンプル0、32/40SEでの警告保護、6/10/20秒維持と新run/ownerリセット、実Networkハンドラ＋mainコールバック初回抑制を確認。音声素材不変。監査記録: docs/evidence/fenrir-voice/audit-final.txt。自己検証も関連57件を最終版で一括実行成功。

## 公開完了（2026-09-27）

PR103を通常merge。公開ソースはmain `30e520c5651eeb36c73bb9f5171eaa670322864a`、既存Worker Versionは `466c57c7-7ec6-4920-8f6b-fb072f928ee5`。公開URL: https://swarm-front.melosalife-24.workers.dev 。merge後のproduction build・Worker dry-run成功。公開記録の後続commitは文書/証拠のみで再公開しない。

- index・JS/CSS・音声5本の計18ファイルはHTTP200、ローカルbuildとSHA256一致。healthは200、ok=true。詳細: [release.json](evidence/fenrir-voice/release.json)。
- 公開された警告WAVはIABで2.24秒を完走、ended=true/error=null。[再生記録](evidence/fenrir-voice/public-playback.json)。
- 公開ゲームには既存の中断作戦案内があり、再開/終了は操作していない。[公開画面](evidence/fenrir-voice/public-resume.png)。公開サウンドテスト画面からの再生操作は未確認。ローカル実ゲームの[サウンドテスト画面](evidence/fenrir-voice/sound-test.png)と5本のデコード/再生開始を確認済み。
- 物理Androidでの聴感、今回の新規協力実通信確認、未導入Judgeの判定は未実施。3声切替と追加36本の制作は[Issue102](https://github.com/futsalife24-bot/swarm-front/issues/102)の後続範囲。