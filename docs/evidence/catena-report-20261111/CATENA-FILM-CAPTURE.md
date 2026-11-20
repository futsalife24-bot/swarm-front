# CATENA会敵ムービー再収録（2026-11-11）

## 変更と入力

- 旧参照：`src/client/encounter-film-files.ts`の`worm`が`report-v3/worm-20261015.mp4?v=e3b73bd91414`を指していた。旧動画は7胴時代の録画なのでファイルを残し、新動画へ参照だけを切り替えた。他の9種の参照・動画は変更しない。
- 新動画：`public/assets/encounters/report-v3/worm-20261111.mp4`。SHA-256 `c712e47513cc41aa5a7b0a207a28b389fbf933ff35d0b221ad2ae84323839721`、2,066,624 bytes。filemapのキャッシュ値はSHA先頭12桁。
- 入力モデル：`public/assets/enemies/foundry_zero_mechanical_legs_v2.glb`、SHA-256 `cefb976551d55167ba6b2ecf7ec9c7144105d890a85cb1c5335e24db90c275ab`。14胴はこのGLBを本番の`FoundryWormView`が複製して構成する。
- 台本と検査は`scripts/record-catena-report-20261111.mjs`。現行の`scripts/current-encounters.ts`へローカルViteの`enforce: pre`変換を収録時だけ適用し、製品ソースと他種の収録台本は変更していない。

## 再現手順

専用worktreeルートで既存依存、ローカルChrome、FFmpegを使用する。追加インストールなし。試走・本収録は次の順に実施した。

```powershell
node scripts/record-catena-report-20261111.mjs --trial
node scripts/record-catena-report-20261111.mjs --record
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames -show_entries format=duration -of json public/assets/encounters/report-v3/worm-20261111.mp4
```

ローカル`127.0.0.1:5210`のViteとChrome `--use-angle=d3d11`を使い、終了時に双方を閉じる。ViteキャッシュとWebCodecsの生`worm.ivf`、試走PNG、実行ログはGit除外の`dist-validation/catena-report-film-20261111/`。映像は現行レポート収録と同じ1280×720・30fps・11秒・WebCodecs VP9→H.264 MP4、1種だけ生成する。

既存の収録器はWorldを凍結し砲口Idleだけを動かすため、14胴は映っても本人が指定した自然跳躍は示せなかった。専用変換では元Worldを保存したまま映像用複製を`stepOmega`で進め、その節座標を本番`FoundryWormView`と`OmegaWarning`へ渡す。着地時刻・予告円・関節の動きは共有ロジックのまま。14胴全体を収めるため、収録専用カメラだけ斜め側面に置き、飛行上昇量を含めて画角を計算する。本体のカメラ・戦闘・レポートUIには入れない。

## 実測と目視

- 短い640×360試走で14胴、予告15円、`idle→brace→warn→flight→landed`、最大上昇19.228m、`worldFrozen=true`、画面例外0を確認。正面カメラは胴全長が重なったため、斜め側面へ変更した後に再試走した。踏切は頭側から上がり、尾へ遅れが伝わる。旧文字Ω形状は見えない。待機中も本番`inspectionIdle`で砲口を動かし、2.0秒と2.4秒の砲口四元数差0.0805268を測定した。
- 本収録は330/330フレーム生成、`worm-manifest.json`に録画入力・検査値・SHAを保存。FFmpegで全フレームをデコードし、FFprobeで1280×720・30/1fps・330フレーム・11.000秒を確認した。待機中のデコード済み60/72フレームもMD5が異なり、元モデルの砲口姿勢差と合わせて`idleAnimated=true`の根拠とした。`allDecoded=true`は全フレームのデコード成功後だけ記録する。
- `worm-contact.jpg`は全11秒の抜粋、`worm-motion-contact.jpg`は予告→踏切→飛行→着地の4コマ。いずれも新MP4から抽出して目視した。14胴の全景と赤い着地予告が同じ画角で見え、頭から尾へ動きが伝わる。
- 旧動画は保存した。`encounter-film-files.ts`の差分は`worm`のURL1行のみ。`tests/encounter-film-assets.test.ts`は新manifestの`worm`行を旧一覧より先に読み、既存の名前・モデルSHA・動画SHA・凍結・デコード・Idle・解像度・fps・フレーム数の全assertを保って1/1成功した。他9種は旧一覧を継続。親が担当する実レポートUI・型・総合検証、公開版配信はこの収録結果と別に確認する。
