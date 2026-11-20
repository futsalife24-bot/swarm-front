# 武器12種の独立監査・公開記録

## 公開完了（2026-11-12）

- [PR #319](https://github.com/futsalife24-bot/swarm-front/pull/319) を通常merge。公開ソース `50125e6d63d966c25b4d0424b82991dbedd5abfe`。監査対象 `8d44d6f36c4acb1020849a31e43ca3def07ab85b` 以降は文書/証拠6ファイルだけで製品差分0。
- PR最終HEAD `0dc3e32cbcfb8d6174951437616038b16b3611f4` にstatus/workflow runsは0件、mainの必須check設定はなし。CI合格と呼ばず、保護やHookを変更せず通常mergeした。merge本文に日本語 `Player-Note` を保存。
- merge後の `npm run build:production` と `npm run server:build:production` はexit 0。60 GLBのpublic/build/manifestのbytes/SHA・v2ヘッダー/宣言長、build SWとsourceの一致を確認。
- 既存 `wrangler.production.jsonc` で公開。Worker Version `00b4e105-aa09-4dad-9042-62e9d608d753`、deployment `ca9fc070-10ff-49a0-bbf3-90f83a06d0aa`、公開時刻 `2026-11-12T09:20:31.148863Z`、100%配信を履歴の実取得で確認。新規サービス・課金・移行なし。
- 公開直前の切戻し先は `6ec9ecc1-5d43-4049-bd15-683169679a51`。公開ゲート合格のため切戻しは未実施。
- 公開先: https://swarm-front.melosalife-24.workers.dev

`node scripts/check-weapon-realism-release.mjs https://swarm-front.melosalife-24.workers.dev` はexit 0。90ファイル（60 GLBを含む）のHTTP 200・buildとのSHA一致、GLBヘッダー/長さ/HTML以外のContent-Typeを確認。844×390と1280×720で名前入力・開始・射撃による弾数減少・武器切替・一時停止・モデルHTTP 200、画面例外0。healthはHTTP 200かつok=true。[実測JSON](published-release.json)、[844画面](published-844.png)、[1280画面](published-1280.png)。両画像を主担当が目視し、画面の主要UIと兵士/武器が表示されていることを確認した。

推奨補足のmanifest.webmanifestもHTTP 200・Content-Type・bytes/SHAがbuildと一致し、orientation=landscape。[補足検査](published-supplement.json)、[再実行スクリプト](check-release-supplement.mjs)。スクリプトはrepoルートから実行し、dist-validation/weapon-final-auditへ結果を保存する。スクリプト初回はGLBディレクトリのmanifest.jsonも対象にしたため検査側で失敗し、拡張子をGLBへ限定して再実行成功。基準や製品は変更していない。

公開UI検査はSWを無効にした使い捨てChrome。実スマホ・12丁すべての公開プレイ・実旧Worker通信の確認ではない。推奨された旧→新SW更新は、公開前の専用persistent profileで登録/有効化を確認できず未実施。公開後の別条件では登録成功・installingを観測したが、7秒の有効化待機期限に達し、制御・テストHTML保存・公開GLB回復は未確認。[未完了の生結果](published-sw-incomplete.json)。製品の不具合と確定しておらず、有効化成功や旧版更新成功とも報告しない。実SWのHTML拒否/回復は先のローカル検査と独立再監査で確認済み。実スマホの表示・負荷・聴感、全連続動作の接触、既存の床入り込み、旧Workerでの元等級色制限も未確認/既知の範囲として維持する。

制作を追加で磨き込まず現在版で動作を優先する本人判断に従い、指定の独立再監査・main反映・公開と必須配信検査を完了。元Claude worktreeと元の現行3種は保持。作業場所は `task-weapon-models-20261111`。主担当 `gpt-6-astra`、推論設定は未確認。

以下は監査と公開前の経過記録。

## 独立再監査合格（2026-11-12）

修正HEAD `8d44d6f36c4acb1020849a31e43ca3def07ab85b` をcommit/push済み。型確認・関連10テスト・本番build・Worker dry-run成功。全60 GLBのbuild/public/manifest一致と修正版SWの一致を[検査](audit-fix-build-assets.json)。ローカル本番90配信ファイルの一致、844×390・1280×720の開始・射撃・一時停止、画面例外0を[確認](audit-fix-built-release.json)。先行ローカル接続のEACCES/ETIMEDOUTは検査未開始として区別し、正式な権限でpreviewと検査を同一実行環境に揃えて成功した。実配信の確認はまだ行っていない。

- 差分ZIP: `dist-validation/weapon-final-audit/recheck/weapon-recheck-8d44d6f3.zip`（1,735,996 bytes・24ファイル）
- SHA-256: `0fdf914e3d80edd24085b4c25d668343e3143d0494099004c0b255989b12a158`
- 初回ZIPへ上書きする修正2ソース、関連テスト・検査スクリプト、前後の証拠、旧2ソース、差分・manifestを収容。GLBは初回から不変なので再収容しない。CRC・収容物のハッシュを照合し、簡易機密点検で検出なし。

本人が「許可します」と明示し、今回と同じ監査指摘への追加修正版も同じ通常Chatへ共有する許可を確認した。上記確定ZIPを[同じ監査Chat](https://chatgpt.com/c/6af56982-8070-83e8-928b-6d91dee8a9be)へ送信済み。完了した最終判定は合格で、P1/P2を閉鎖、追加必須修正0、main反映可、提示した検査・切戻し条件付きで既存Worker公開可。[最終回答](audit-8d44d6f3.md)と[合格画面](audit-8d44d6f3.jpg)を保存した。goalは `active` への復帰を実取得で確認した。

送信時PR HEADは `e48b356bffdd27f3c6f2051192880c1b728ecf6a`。修正対象 `8d44d6f36c4acb1020849a31e43ca3def07ab85b` との差分は、STATE・本記録・build資産/実HTTP検証JSONの記録4ファイルのみとGit照合し、依頼本文に明示済み。製品・tests・scriptsの追加変更はない。

過去経過（解消済み）: 自動承認審査は「初回ZIPの許可は修正版を含まない」として添付を拒否した。同じ共有確認待ちが3回のgoalターンで続いたため `blocked` にしたが、今回の明示許可後に同じ正式経路で送信でき、goalも復帰した。別経路で拒否を回避しておらず、現在の停止理由にはしない。

独立再監査は、通常main反映→merge後build/dry-run→既存Worker公開→直後の実配信検査→不合格時切戻しの順序を認めた。公開後は60 GLB・SW・HTML・配信manifest・JS/CSSの照合とhealth・2画面UIを必須とし、推奨されたmanifest.webmanifestの照合と使い捨てプロファイルのSW更新確認も行う。公開成功はこれらの実確認後に記録する。既存Workerの公開履歴を実取得し、現在100%の切戻し候補versionは `6ec9ecc1-5d43-4049-bd15-683169679a51`（2026-11-11T13:02:50.552892Z）と確認。切戻し自体は未実施。

## 初回監査と必須修正（2026-11-12）

[初回回答の表示本文](audit-5b4a1aab.md)は「要修正」。P0なし、P1は新武器URLのHTML誤キャッシュ、P2は旧Workerの融合後に未読込等級が要求されると旧3形状へ戻る経路。造形の追加磨き込み、既存の床への入り込み・指の接触は今回の必須修正から除外された。

- P1: `public/sw.js` の新武器 `unique-v1/*.glb` だけに、GLB v2ヘッダー・長さの検査を追加。PRELOAD→SHELL→ネットの順で正常品を使い、不正な保存分は正常品を得た場合のみ対象キーを回復する。実SWの修正前再現と修正後のHTML拒否・復旧・オフライン・Rangeを確認。容量不足はNodeモックのみ。[検証範囲](weapon-glb-cache-recovery.md)。
- P2: `progressionWeaponModel()` はexact等級を優先し、未読込なら同kindの既存モデルを返す。通信・性能値・新規読込は追加しない。追加テストは修正前に失敗、修正後は既存ローダー/融合を含む10件成功、型確認成功。実GLBと兵士による27条件の手持ち/背負い、9kindのexactへの切替を確認。[比較と限界](tier-fallback-browser.md)。実旧Worker通信と元等級色の復元は未確認・未解決の範囲を維持する。
- 公開検査へ `front.html`・`sw.js`・ダウンロードmanifestの配信SHAと、全60 GLBのヘッダー/宣言長・HTMLでないことの検査を追加した。公開先に対する実行はまだ行っていない。

今回の製品変更は上記SWとモデル選択の2箇所。45新GLBと15旧GLB、造形、射撃、通信・保存の実装は変えない。修正ソースの本番ビルド・Worker dry-runと、同じ監査Chatでの再判定を行ってから通常main反映・公開へ進む。

## 初回監査資料と経過（2026-11-12）

- 本人が現行造形を受け入れ、追加の磨き込みとPBR量産を停止。製品は画像なし `unique-v1` 45 GLBで凍結。
- PR: https://github.com/futsalife24-bot/swarm-front/pull/319
- 監査対象: `5b4a1aab204220bc088868cebffa133dfa4f566e`
- 基点: `d7d1399c5ba452b96b432819b69d3076ca668352`
- ZIP: `dist-validation/weapon-final-audit/weapon-audit-5b4a1aab.zip`（34,380,468 bytes）
- 送信後の画面添付名: `weapon-audit-5b4a1aab(1).zip`（内容は確定ZIPと同じ）
- SHA-256: `70c5029bcca0feb8b9e1a0732589045b8999b9d4debbcacdd23e9d6e4d9f0096`
- 589元ファイルのハッシュ照合・ZIP CRCを確認。秘密情報・利用者絶対パス・メール・画像メタデータの簡易点検は検出0件。網羅的な機密検査ではない。
- `AUDIT/REQUEST.md` と `AUDIT/manifest.json`、対象ソース差分、全変更パス一覧を収容。Git履歴と全ゲーム素材は含まず、ZIP単体で完全再現できるとは保証しない。

本人の「許可する」を受け、確定ZIPと監査依頼を通常Chatへ送信済み。[監査Chat](https://chatgpt.com/c/6af56982-8070-83e8-928b-6d91dee8a9be)で監査者がZIP・収容物・実コード・GLB検査を実施した。初回の完了した判定は上記の「要修正」。goalはactiveへの復帰を実取得で確認した。

送信時のPR HEADは `c4fce32fa7ff00d3e0d6186f10c568a69bd7b25a`。監査対象 `5b4a1aab204220bc088868cebffa133dfa4f566e` との差分は `docs/STATE.md` と本記録の2文書のみであることをGit照合し、監査依頼本文にも明示済み。製品の追加変更はない。

過去経過（共有承認待ちは解消済み）: 通常Chat（Workではない）・画面のHigh選択を確認した初回添付は、自動承認審査が非公開ソース・モデル・検証資料の具体的共有許可不足として拒否した。そのため本人へ確定ZIP・送信先・目的を明示して確認した。拒否は別経路で回避せず、明示許可後に同じ正式経路で送信した。

独立再監査の判定後に通常main反映、merge後ソースの本番ビルド・Worker dry-run、既存Worker公開、配信ハッシュ・health・844×390と1280×720の実UI確認を行う。新規サービス・課金・移行の追加はない。初回監査対象の製品コードと公開モデルは最終検証ソース `fc1fea1` から変更なしだったが、今回は上記2箇所を修正した。

主担当モデル: `gpt-6-astra`。推論設定は未確認。

過去のgoal停止: 同じ送信承認待ちが3回のgoalターンで継続し、独立して進められる公開準備も完了した時点で `blocked` へ切り替えた。現在は本人の明示許可・送信・goal復帰が確認されており、停止理由にはしない。次は独立監査の完了した判定を確認し、必須指摘があれば修正・再監査する。監査前mergeは行わない。
