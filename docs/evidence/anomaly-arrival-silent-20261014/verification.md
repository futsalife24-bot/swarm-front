# ANOMALY出現SEのみ無効化（2026-10-14）

本人が採用した声は保持し、邪魔と感じる出現SEを無しにする依頼。通常個体の出現予告とボス出現が出すburstイベントが爆発SEも再生していた。現行front・互換front・rebuildの6生成箇所だけsilent:trueを付与。CombatAudioはイベントIDを消費した後にsilentを除外。イベント自体・出現演出・攻撃/判定/出現数は保持。Eventへoptional booleanを追加し、既存prepareState/JSON経路で保持。旧イベントは従来通り鳴る。

声質・0.24ゲイン・最大2声・発声間隔、攻撃予告SE、兵士ボイス、通常爆発は変更なし。base main0c6c64da09feb85655914a70d83626e4a42c14c4、branch codex/anomaly-arrival-silent-20261014。

自己検証: src/worker型exit0。既存audio/anomaly-voice/anomaly-audio-lifecycleの3ファイル32テスト成功。新規6テストは実run生成・状態更新・実prepareStateのJSON往復を使い、6出現イベントが残る/無音/消費済み・同半径の非silent爆発は鳴ることを確認。通信パケット生成の確認で、実WebSocket接続ではない。初回はテスト設定の明示include未追加で未実行、その後fixtureの空metadataと未確定初期選択を正規の入力へ修正して6件成功。製品の不具合修正ではない。

build・ブラウザ・独立監査・公開は後続工程。音の実聴・実スマホは未確認。

確定670c2eaからvite build exit0（9.62秒）、後続の既存Worker dry-run exit0。同じ通常Chatへ前回ZIPを基礎とした差分全文・対象SHA・検証限界を追加提出し、user message e3286131-b7b4-4930-9c02-c0a8d7d3fef9の永続反映を確認。独立判定は待機中。

実ブラウザ確認用ページをdist-validation/anomaly-arrival-silent-20261014/check.htmlへ用意。実Sound/AudioContext/実run生成を用い、出現時0ソース→通常burst1→声1を観測する構成。ただし現時点では未実行。Chromeがツール一覧に無く、iabでもPage.navigate/Emulation.setFocusEmulationEnabledの時間切れ。既存タブの標準読み取り・新規タブ1回で復旧しなかった。確認サーバーは127.0.0.1:5206。実再生/画面確認の成功とは扱わない。

iabの画像取得は成功し、標準Playwrightのボタン操作で実再生検証も復旧。実画面の結果: context=running、arrivalEvents=2、allSilent=true、arrivalSources=0、combatSources=1、voiceSources=1、decoded=true、pass=true。出現演出用イベントが2件残り、出現SEの音源ノードは0、通常burstとHARROW声は各1であることを実Sound/AudioContext/実WAVで確認した。画像はツール目視、PNG保存なし。聴感評価とは区別する。
