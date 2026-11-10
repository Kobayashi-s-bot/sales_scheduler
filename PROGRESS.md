# PROGRESS — 進捗・指示・詰まり（ループの唯一の状態ファイル）

更新：2026-11-09（作成時に Vault の記録・README・CI・PR と照合した）
最新状態の確認順：日誌 → 配布/デプロイ記録 → 進捗 → README。食い違いは下の「食い違い」欄へ。

## 現在地
- **開発ループ導入 PR #16 もマージ済み（マージコミット 624171b、2026-11-09）。直前の機能は：PR #15（マージコミット 945bb94、2026-11-09）「Step A: 取得の安全性強化・候補レビューフロー」**。このPRで #13（公開情報収集基盤）と #14（先行利用版UI）も main に入った。それ以前：#7（基盤・DB・セキュリティ）、#8（営業タイミング推奨）。
- A4 毎日の自動取得（`/api/cron/collect`＋Vercel Cron）：実装・check 完全合格（154件）・Opus 検収 PASS（差し戻し2回）。**実機確認（Vercel／Supabase 上、SPEC F-A4 §7）は未。** 本人確認待ち：再試行で failure_count が1日に2回進むこと、不正 URL の行が毎日枠を1つ使うこと。
- A3 候補レビュー画面：実装・check 完全合格・Opus 検収 PASS（差し戻し1回）。**画面の実機確認（SPEC §6）は未。DB の変更は無い。**
- 検証値：Vitest 23 ファイル 132 件・失敗0（ローカル実測。A3 の後）。PR #15 時点は 21 ファイル 118 件。CI（PR #15時点）：verify ジョブは typecheck/lint/test/check:secrets/build 成功、`npm audit --audit-level=high` のみ失敗（next/zod/vite 等の新規公表脆弱性。package.json は変更していない）。supabase ジョブ（supabase test db）は合格。依存更新は別PRで行う（未着手）。
- git 基点：タグ loop-base が指すコミット（git rev-parse loop-base で確認）

## 本人の確認待ち（人の判断が要る・ループは触れない）
1. **A3 は画面確認なしで PR #17 をマージ済み（51da7c5、本人判断 Discord 1569517479116546161）。SPEC §6 の画面確認は未。** Supabase Free＋Vercel Hobby を用意（docs/deployment.md）し、A4 の後に実データで確認する
2. A3 の要件確認
3. 依存更新PRの方針
4. Codex のブランチ `issue-12/sales-reminders-notifications`（b6d85db「feat: add sales reminder notifications」、GitHub に未 push、Codex 作業ツリー `C:/Users/daimo/.codex/worktrees/ca7b` 内のローカルのみ）の扱い

## こばやしさんからの指示（アイだけが書く。次の回のループから反映）
- 2026-11-09｜**A3 候補レビュー画面**｜承認：Discord 1569213091349135402（「進めていいですよ」）。要件文面は README ロードマップ A3 の記述に基づく**アイの案**（本人は SPEC 確認時に修正できる）。
  1. 新規ページ `/candidates?organizationId=...`。状態タブ（未確認 pending／採用済み accepted／却下 rejected）。既定は未確認。一覧は `page.tsx`（Server Component）が `event_candidates` を直接読む（案A・本人承認 Discord 1569229947422113893。最新順・最大100件・企業名を埋め込み）。既存 `GET /api/candidates` は使わない。
  2. 各候補に表示：企業名・イベント種別・タイトル・イベント日（未定は「日付未定」）・確信度（%）・抽出日（created_at）・記事公開日（published_at）・要約・出典URL（外部リンク。`https://` のみリンクにし rel を付ける）。
  3. 操作：**採用**（種別・日付・タイトルを修正して採用できる。日付が未定の候補は日付の入力が必須）／**却下**。既存 `POST /api/candidates/[candidateId]/accept|reject` を使う。成功後に一覧を更新。404/409/400 は固定の日本語文言で表示し内部情報は出さない。
  4. ナビ：AppShell（PC・スマホ下部）に「候補」リンクを追加。スマホで操作できる（ボタンの高さ 44px 以上）。
  5. 変更しない：DB・移行・RLS・既存 API・既存テスト・認可の境界。新規の純関数・コンポーネントは新規ファイルに置く。例外：`proxy.ts` の `protectedPage` に `/candidates` を1項目足す（SPEC R11）。

- 2026-11-09｜**A4 毎日の自動取得**｜承認：Discord 1569540426833334363・1569544066843148460（Service Role の導入を含め本人承認）。要件文面はアイの案（SPEC 確認時に修正可）。
  1. 登録済みの取得元（`public_sources`）のうち `next_check_at` が期限切れのものを、1日1回、自動で取得する（RSS／HTML。既存の取得・安全性・候補保存の経路を使う。結果は `event_candidates` のみ。events・推奨へは直接書かない）。
  2. 実行は無料の仕組み（Vercel Cron Hobby＝1日1回、または GitHub Actions のスケジュール）から専用エンドポイントを呼ぶ。エンドポイントは秘密の合言葉（環境変数。リポジトリ・ログに出さない）が無いと拒否する。
  3. Service Role は**このエンドポイントのためだけ**に使い、通常のユーザーリクエストでは使わない（`server-only` の既存モジュール）。権限は取得元の読み取り・取得記録・候補の保存に限り、contacts を一切参照しない。
  4. 1回の実行で処理する件数と時間に上限を置く（Vercel の実行時間制限内）。失敗は既存の指数バックオフに従い、1件の失敗が他を止めない。結果（取得数・候補数・失敗数）は PII なしで返す。
  5. 変更しない：既存 RLS・既存 API の挙動・既存テスト。DB 変更が必要なら SPEC に明記された最小のもの。
  6. 本人の作業（実装後）：Vercel／GitHub 側の環境変数・秘密の登録と有効化。外部公開・課金は本人承認。

## 次の作業候補（未着手・本人の承認が出るまで着手しない）
1. （A3 候補レビュー画面は実装・検収済み。PR のレビューと、PC・スマホでの画面確認待ち）
2. （A4 毎日の自動取得は実装・検収済み。PR のレビューと、Vercel／Supabase 上での実機確認待ち）
3. 依存更新（npm audit、別PR）
4. Issue #12 営業リマインド・通知（Codex 実装済・未 push、確認要）
5. Issue #5 新規候補の Lookalike・#6 営業結果フィードバック

## 食い違い（Vault 記録同士・記録と実物）— 本人またはアイが解消するまで残す
1. リポジトリは `C:\Users\daimo\projects\sales_scheduler` から `F:\project\営業カレンダー` へ移動済み（Vault の進捗.md には旧パスが残る）。
2. README の「担当と手順」は検収=アイと書かれているが、導入後は計画・検収=Opus（README に追記して解消）。

## 進捗ログ（ループが追記。1回 1〜3 行、証跡パス付き）
- 2026-11-09：ループ運用を導入（RULES/SPEC/PROGRESS/PROMPTS、scripts/、git タグ loop-base）。
- 2026-11-09：A3 差し戻し1回目の対応（Opus 検収 FAIL：公開日の表示形式・A8 の無効な検査・A15 のテスト欠落・SPEC 外の sr-only リンク）。実装役の編集が1行コードの patch で `page.tsx` を壊した（read_file が長い行を切り詰めるため書込みガードが全文読み扱いにならない）。アイが `.new` に書いて置換し復旧、テストを追加（132件）。長い1行のファイルは今後、整形した複数行で作る。
- 2026-11-09：A3 候補レビュー画面を実装。連鎖確認：既存UIテストのAppShell照合なし、snapshot・生成型・PWAなし、proxy保護対象の追加を確認。Next.js docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md・02-components/link.md・04-functions/use-router.md。

- 2026-11-10：A4 実装役の1回目はプロバイダ HTTP 400 で中断（原因未確定。直前に write_file の path 欠落が2回）。2回目で `collection-scheduled.test.ts` の偽 collect の誤りを修正しテストを拡充。アイが不足の AC10・AC11・AC12・AC15（時間不足で再試行しない）のテストを追記（151件）。2回目の実装役が「詰まりレポート」の見出し行を進捗の1行で上書きしたため、アイが見出しを復元した。
- 2026-11-10：A4 Opus 検収1回目 FAIL（AC3・AC5・AC6 のテストが無効、不正な source_url の行で実行全体が 500 になる欠陥）。アイが `scheduled.ts` に `hostOf` を追加して修正し、回帰テストを追加（153件）。Next.js docs 確認：`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`（`export const maxDuration`）・`route.md`（GET）。ルートは request ヘッダを読むため動的。本番での 300 秒指定の有効性は未確認。
- 2026-11-10：A4 Opus 検収2回目 FAIL（R12：再試行経路で同一ホストの間隔が守られない）。アイが `processRow` の finally でホスト時刻を記録するよう修正し、回帰テストを追加（154件）。差し戻し2回目の対応。

## 詰まりレポート（ループが停止したとき、ここに書く。行頭を `- STUCK:` にする。進捗はここに書かない）

- なし