# RULES — 毎回守るルール（実装・計画・検収の全員が読む）

対象：営業カレンダー（既存顧客への再アプローチ時期と新規営業候補の判断を支援するWeb/PWA）。技術構成：Next.js App Router / TypeScript / Tailwind / shadcn/ui / Supabase (Auth, PostgreSQL, RLS) / Zod / Vitest。
この文書は短く保つ。履歴・経緯は Vault `プロジェクト/sales_scheduler/`（人が読む履歴。ループの入力にしない）。

## 1. 役割
- 計画（SPEC 作成）・検収：Opus（プロファイル `workout-review` を共用。ツールなし・入力は review-packet の出力のみ。1機能につき各1回、差し戻しは2回まで）
- 実装：GPT 系サブエージェント（`loop.sh` は使わず、`check.sh` と `review-packet.sh` を使う。ollama が戻ったら `loop.sh` を試す）
- 会話・相談・PROGRESS の書換・ループ起動：アイ（Sonnet）
- 最終確認・仕様判断・実機確認・**main へのマージ**：本人（エージェントは PR 作成まで。自前でマージしない）

## 2. 絶対に守ること
1. **合否は `scripts/check.sh` の終了コードだけで決める。** LLM が「できた」と判断しない。
2. **check が通っていないコードを検収へ渡さない。**
3. **テストを書き換えて通さない。** 既存テストの変更は SPEC に明記された範囲だけ。凍結 baseline・過去証跡を書き換えない。
4. **範囲外のファイルを変更しない。** SPEC の「変更してよいファイル」だけ触る。
5. **データ形式・DB スキーマ・認可（RLS 等）は SPEC が明示しない限り不変。** 既存データの破損を黙って初期化しない。
6. **権限追加・外部通信・課金・公開は本人の明示承認が無い限りしない。** AI 利用枠の自動課金・購入・プラン変更は禁止。
7. **秘密情報（API キー・トークン・署名鍵）をリポジトリ・ログに書かない。** `.env*` は git 対象外。
8. **重い処理（ビルド・DB 起動等）は 1 本ずつ直列に実行する。** 並列起動は偽の失敗を生む。
9. **エラーは原因調査が先。** 原因未確認のまま同じ操作・モデル呼び出しを繰り返さない。想定外は停止して報告する。
10. **緑のテスト＝仕様適合・実機合格ではない。** 実機・画面で未確認の項目は「未」と書く。
11. **承認ダイアログが時間切れなら「未実行」。** 再送せず、本人の再開を待つ。
12. **ゲートを触らない。** `scripts/`（check・設定・凍結一覧・allowed-files）、RULES/SPEC/PROMPTS、PROGRESS の「指示」欄はループが変更できない。変更できるのは、アイが受理後に git タグ `loop-base` を進めるときだけ。ループは git の commit・tag・branch もしない。check は `loop-base` との差で判定する（コミット済みの変更も検出する）。
13. **変更範囲は `scripts/allowed-files.txt`（loop-base 時点のもの）だけ。** 空なら PROGRESS 以外は一切変更できない。
14. **既存ファイルを1バイト変えると連鎖して壊れる仕組み（照合テスト・スナップショット・生成物）が無いか、計画で先に洗い出す。** あるなら機械生成で直し、ループに literal を書き写させない。

## 3. ツールと環境
- 作業は F:\project\営業カレンダー 内。システム PATH・他案件を変更しない。
- コマンド：`npm run typecheck` / `npm run lint` / `npm run test` / `npm run check:secrets` / `npm run build`（build は `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` のダミー値で実行。実キーは使わない）。DB テスト `supabase test db` は Docker が必要でこのホストではローカル実行不可。CI で実行し、PR に結果を記載する。DB 移行を含む機能は check 完全合格でも DB が未検証であることを明記。
- 注意：AGENTS.md は `next dev` が再生成するのでルール置き場にしない（ルールは RULES.md）。Next.js は既知の版と異なるため、Next.js API を書く前に `node_modules/next/dist/docs/` を読む。既存 tests/ は migration SQL をテキスト検査している（`tests/*migration-security.test.ts`）。移行SQLを変えると照合テストが連鎖して壊れる可能性がある（RULES §2-14）。既存ファイルは CRLF 混在。新規ファイルは LF でよい。DBスキーマ・認可（RLS）・秘密情報の境界は SPEC が明示しない限り不変（Service Role は server-only、contactsはPII専用で分析/AI層から参照しない）。

## 4. 作業の流れ
1. 本人が要件を伝える（Discord）。アイが PROGRESS の「指示」を更新（本人承認後）。
2. 計画：Opus が RULES + 要件 → SPEC の該当節（受け入れ基準・変更ファイル・実機確認項目）。
3. 実装：GPT 系サブエージェント（`loop.sh` は使わず `check.sh` と `review-packet.sh` を使う）。RED→GREEN で実装し PROGRESS の進捗欄だけ追記。
4. 検収：`scripts/review-packet.sh` の出力だけを Opus に渡す。PASS/FAIL + 指摘。差し戻しは2回まで。
5. 本人：画面・実機確認 → PR レビュー → マージ → Vercel への反映は本人。**PC 合格は完了ではない。**

## 5. 書き込み権限（PROGRESS）
- 「こばやしさんからの指示」欄：アイだけが書く（本人承認後）。
- 「進捗」欄：実装役が追記。
- 書き換えはループ停止中のみ。git に記録し、履歴から戻せる。

## 6. 止まる条件
- 人の判断が要る項目（仕様判断・実機確認・承認待ち）／想定外の失敗／8回で未達 → 停止して PROGRESS に詰まりレポートを書き、アイが本人へ報告する。
- **利用枠の上限（429 / usage limit）→ `loop.sh` は quota（exit 12）で周回を消費せず即停止。** アイは本人に「待つか／別モデルに替えるか」を確認する。**実装役のモデルは自動で替えない。** 課金・プラン変更・クレジット購入は禁止。
- 詰まりの検出は PROGRESS「## 詰まりレポート」節の行頭 `- STUCK:` だけ。解消したらアイがその行を `- 解消済み:` に書き換えてから再開する。
- `loop.sh` の終了コード：0 review-ready／10 stuck／11 limit／12 quota／13 no-change（check 合格だが変更0件。完了と見なさない）／2 error（原因を調べるまで再実行しない）。