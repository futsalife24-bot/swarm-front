# 通常Worldの通信容量・読み取り調査

基点: branch `codex/coop-comfort-ready-20261030` / HEAD `bf30da332b6636bc51cbf935912ea0d323de93e6`。開始時Git差分なし。製品コード・主担当script/docs・実セーブを変更せず、証拠ファイルは本フォルダ内だけへ作成した。再委任・外部送信・公開なし。

## 結論

現行の通常協力生存/進撃で、新client（stateTuples:1＋stateChunks:1）へ送る合法Worldが256KiBを超える具体的な再現条件は見つかっていない。合法弾数上界328と各配列の上限は、以前の400/1000弾fixtureより小さい。サーバー内部の姿勢探索/経路・過去の選択履歴も全量送信されてはいない。

ただし本調査は「全合法Worldの最大バイト数が262,144未満」の完成した証明ではない。各生成元の個数制約を調べ、通常より重い合成で現物encodeを通した段階であり、全数値/全optionalフィールドの合法な最大文字幅と同時性までは形式化していない。この不足を残したまま保証完了と扱わない。

## 送信されるものと上限

| 成分 | 現行の根拠/境界 |
| --- | --- |
| 生存の敵 | front-combat.ts:66 enemyCap96。front-run.ts:481-512は通常spawnで96を守り、game.ts:703-719の共通spawnはfront cap+1までを許す。保守的な形状検査では97を使用。現行生存は通常crawler/spitter/hornetと専用BASTION生成で、97体全WORM等にはならない。 |
| 進撃の敵 | defs.ts:469-485の協力cap40。ソロ進撃はprogression.settingsの120で別経路（通信Workerの協力40と混同しない）。 |
| PLEAT | pleat-locomotion.ts:77-83のRESTは4本足。state-wire.ts:113-132はbody/up/forward/poseForward/scale/各足point/normal/plantedだけを送る。探索ray、支持点target、spring/velocity、surface IDなどは送らない。 |
| WORM/FOUNDRY部位 | worm.ts:47-48で胴7＋頭1。state-wire.ts:100-109は各胴の座標/partHp/heading/acidAt/pulseAimだけ。trail、groundPath、履歴は除外。現行STAGESを集計するとWORMは1任務最大1体。guardの64節/512敵は生成上限ではない。 |
| 実体弾 | 別メモlegal-projectiles.mdの安全側上界は生存328、進撃315。新形式は全弾を送る。 |
| 経験値orbs | front-combat.ts:197-220で160個。到達後は先頭valueへ加算し、無制限に個数を増やさない。 |
| mine | front-combat.ts:549-559はownerごと2+afterimage-mine level。融合実効level最大6（front-upgrades.ts:155-164）なので8個/人、4人32個を安全側に数える。 |
| status | front-combat.ts:153,618-620。敵ごとの固定recordで、死亡/消失分を毎tick除去。state-wire.ts:319-325はrecipient本人分だけを残し、他3人のstatusesを空にする。全4人分の大きなstatus表を重複送信しない。 |
| HARROW missile | harrow.ts:40,226-227,306-307,327-328で全体40。origin/target/launch/impact等はcommonRestに入る。 |
| pollen cloud | calyx.ts:33のmaxClouds16。弾本体と独立のWorld配列なので容量検査で別計上。 |
| 敵追加予定 | foundry-spawning.ts:22-40は頭ごと1回のlatch、partsは7以内。kindsは部位数と同数。bossは再帰生成されず、現行rosterのWORM数も有限。サーバー内部キューはcommonRestへ残るので計上対象。 |
| 演出events | defs.ts:485/game.ts:669-682で160。state-wire.ts:358-380は64KiBへ収めるため先に削減。全演出を落としても大きければ、新chunk clientには敵/orbを省略しない元状態を返す。 |
| プレイヤー/装備 | Worker最大4人・1人2丁。worker.ts:1473-1493は許可したweaponフィールドだけをコピーし、未知のトップレベル文字列/オブジェクトをそのまま反射しない。ID最大100ASCII（defs.ts:496-498/progression.ts:65-87）、mods/rolls/varianceは固定キー・範囲検査。武器floatの端数は丸めないため別の文字幅上界が必要。 |
| 私有loot/報酬 | state-wire.ts:307-312はrecipient本人のpending/rewards/dropだけ。進撃pending+未回収weaponは基本3枠（game.ts:977-981）。生存報酬はfront-survival.ts:35-63で最大30丁/本人。全4人120丁を送る形ではない。finishはprojectiles/pollen/harrowMissilesを消し（game.ts:1020-1022）、戦闘最密時と報酬最大は単純同時にはならない。 |
| frontView | front-run.ts:781-861は固定カウンタ、levels/evolved、spawnWarnings、現在offerだけ。run全体やprocessedRequestIds/選択履歴/originalEquipmentは送信しない。 |
| 宛先metadata | worker.ts:1673-1724は4member、stage/clearedStage、preparationGeneration、frontView/serverNow/expiresAt等。終局はmember側にも装備が載るため、World装備との重複分も測定に入れた。 |
| 文字列/時刻 | Worker run/idはrandomUUIDのハイフン除去で32ASCII（worker.ts:124）。nameはsocial.ts:2,28で20 Unicode codepoint（最大80 UTF-8 bytes程度）。dayは10文字ISO日付、offer IDはrun ID+固定語+有限serial。front生存game timeはfront-run.ts:723で3600秒、通常frontは540秒、room有効期限も原則1時間。入力seqは非負safe integerで最大16桁だが、それ以外の全カウンタを含めた最大幅の証明はまだ書き切っていない。 |

## 既存encodeによる計測

保管した測定元は [測定script](world-bound-measure.mjs)、結果は [JSON](world-bound-results.json)。repo rootで `node docs/evidence/coop-comfort-20261030/world-bound-measure.mjs` を実行すると再現でき、出力先は `dist-validation/coop-comfort-20261030/world-bound/`。原本のREADME/measure.mjs/results.json/run.logと生成bundleも同フォルダに残す。ローカルesbuildとNodeの短い計測だけで、ブラウザ/Worker戦闘/ベンチは実行していない。

すべて **合成した成分境界/ストレス** であり、そのまま合法な実戦状態・合法な最大値とは呼ばない。例えば97体全PLEAT、全328弾をplayer grenade形状、HARROW弾40とpollen16の同時併記、±123.45m座標、全status/mines等は実生存の生成経路では同時成立しない。各生成源を取りこぼさないために過剰合成しているが、数値の最大文字幅まで含めた数学的上界でもない。

| 合成条件（装備cacheなし） | UTF-8 bytes | 分割 | tuple復元 |
| --- | ---: | ---: | --- |
| 生存成分境界: 97PLEAT＋328実体弾＋160orb＋32mine＋40HARROW弾＋16pollen＋本人97status＋frontView/metadata | 110,176 | 7片、最大18,443B | 成功・敵/orb省略なし |
| 進撃成分境界: 40敵（PLEAT38/WORM1/HARROW1）＋315弾＋40HARROW弾＋16pollen＋予定敵3群＋本人drop/pending/reward各3 | 69,990 | 5片、最大18,614B | 成功・省略なし |
| 生存終局: 実finish＋実報酬生成関数を成分境界へ適用、30丁本人報酬＋終局member装備 | 72,344 | 5片、最大17,938B | 成功・省略なし |
| 512WORM・各胴7の照準/数値を追加した形式ストレス（現行spawn/rosterから到達不可） | 399,811 | 拒否（undefined） | 拒否 |

生存成分境界の主なWorld内訳: enemies約38KB、projectiles約36.7KB、front約18.1KB、HARROW弾約9KB、players約3.8KB。metadata約2.5KB。演出は空で測定した。

25文字の数値tokenを全数値へ機械的に割り当てた抽象ストレスは生存361,790Bとなった（JavaScript数値は例えば `-0.0000010000000000000002` が25文字）。これは全normal/angle/IDへ非物理的な長数値を割り当てるため合法反例ではない。逆に一律16文字と仮定した幅計算は248,921Bだが、武器端数等は16文字を越し得るので、この数字も保証に使っていない。最初の途中報告の「24文字抽象値349,249B」はこの25文字版へ訂正した。

## 残余条件と次に直す具体的対象

1. **256KiBの全体保証を完了する条件**: PLEAT4足/WORM7部位、kind別のoptional項目、位置/正規化vector/時刻/serial等の丸め後token幅、武器だけの非丸め幅、終局member装備重複を含むfield別の上界表を生成し、`prepareState.packet(... tuples=true,chunks=true)` と復元budgetの両方をassertする。現物110KBを全体保証へ言い換えず、ここが未完。上限やバランスを変える根拠は今回見つからなかった。
2. **実際に残る拒否条件**: 新clientでも演出削減後の全状態が262,144B超ならencodeStateChunksがundefinedになり、worker.ts:1727-1731は従来の巨大単一message送信拒否4009へ戻る。state-wireはchunks対応には敵/orbを削らないため、この場合は敵省略でなく切断になる。さらにtuple復元はstate-tuples.ts:192-231の総budget50,000・深さ16・文字列1024等を持つ。bytesだけを増やしても復元拒否は別に残る。
3. **旧clientの残余条件**: stateChunksを交渉しないclientは64KiB境界のまま。frontでstateOmissions対応なら敵/orb省略、それ以外は大容量拒否になり得る。これは新clientの256KiB保証とは別の後方互換経路。現行両clientは新capabilityを送るが、旧配信/cache clientの挙動まで新形式として扱わない。
4. **次の製品修正は反例を取ってから**: もし通常生成で上記bytes/budget境界へ近づくなら、内容・認証値ではなく成分bytes/件数とcapabilityをローカル検査証拠へ出し、原因成分を特定する。敵/予告弾削除や新game上限、根拠のないsnapshot上限拡大を先に入れる必要は認めていない。

本調査では全合法Worldの256KiB超過を立証しておらず、超過しない全体証明も未完成。確定した生成上限・合成計測の成功・形式ストレスの拒否を分けて引き渡す。呼出指定gpt-6.1-sol/high、実行モデルID/effortの実値は取得できず未確認。
