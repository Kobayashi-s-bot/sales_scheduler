# PROGRESS — 進捗・指示・詰まり（ループの唯一の状態ファイル）

更新：2026-11-09（作成時に Vault の記録・README・CI・PR と照合した）
最新状態の確認順：日誌 → 配布/デプロイ記録 → 進捗 → README。食い違いは下の「食い違い」欄へ。

## 現在地
- **開発ループ導入 PR #16 もマージ済み（マージコミット 624171b、2026-11-09）。直前の機能は：PR #15（マージコミット 945bb94、2026-11-09）「Step A: 取得の安全性強化・候補レビューフロー」**。このPRで #13（公開情報収集基盤）と #14（先行利用版UI）も main に入った。それ以前：#7（基盤・DB・セキュリティ）、#8（営業タイミング推奨）。
- 検証値：Vitest 21 ファイル 118 件・失敗0（ローカル実測）。CI（PR #15時点）：verify ジョブは typecheck/lint/test/check:secrets/build 成功、`npm audit --audit-level=high` のみ失敗（next/zod/vite 等の新規公表脆弱性。package.json は変更していない）。supabase ジョブ（supabase test db）は合格。依存更新は別PRで行う（未着手）。
- git 基点：タグ loop-base が指すコミット（git rev-parse loop-base で確認）

## 本人の確認待ち（人の判断が要る・ループは触れない）
1. A3 の実装後の画面確認（PC・スマホ）と PR レビュー
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

## 次の作業候補（未着手・本人の承認が出るまで着手しない）
1. A3 候補レビュー画面
2. A4 期限到来取得元の定期実行
3. 依存更新（npm audit、別PR）
4. Issue #12 営業リマインド・通知（Codex 実装済・未 push、確認要）
5. Issue #5 新規候補の Lookalike・#6 営業結果フィードバック

## 食い違い（Vault 記録同士・記録と実物）— 本人またはアイが解消するまで残す
1. リポジトリは `C:\Users\daimo\projects\sales_scheduler` から `F:\project\営業カレンダー` へ移動済み（Vault の進捗.md には旧パスが残る）。
2. README の「担当と手順」は検収=アイと書かれているが、導入後は計画・検収=Opus（README に追記して解消）。

## 進捗ログ（ループが追記。1回 1〜3 行、証跡パス付き）
- 2026-11-09：ループ運用を導入（RULES/SPEC/PROGRESS/PROMPTS、scripts/、git タグ loop-base）。

## 詰まりレポート（ループが停止したとき、ここに書く。行頭を `- STUCK:` にする。進捗はここに書かない）
- なし