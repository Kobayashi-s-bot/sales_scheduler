# PROGRESS — 進捗・指示・詰まり（ループの唯一の状態ファイル）

更新：2026-11-09（作成時に Vault の記録・README・CI・PR と照合した）
最新状態の確認順：日誌 → 配布/デプロイ記録 → 進捗 → README。食い違いは下の「食い違い」欄へ。

## 現在地
- **最新のマージ済み：PR #15（マージコミット 945bb94、2026-11-09）「Step A: 取得の安全性強化・候補レビューフロー」**。このPRで #13（公開情報収集基盤）と #14（先行利用版UI）も main に入った。それ以前：#7（基盤・DB・セキュリティ）、#8（営業タイミング推奨）。
- 検証値：Vitest 21 ファイル 118 件・失敗0（ローカル実測）。CI（PR #15時点）：verify ジョブは typecheck/lint/test/check:secrets/build 成功、`npm audit --audit-level=high` のみ失敗（next/zod/vite 等の新規公表脆弱性。package.json は変更していない）。supabase ジョブ（supabase test db）は合格。依存更新は別PRで行う（未着手）。
- git 基点：タグ loop-base が指すコミット（git rev-parse loop-base で確認）

## 本人の確認待ち（人の判断が要る・ループは触れない）
1. この導入PRのレビューとマージ
2. A3 の要件確認
3. 依存更新PRの方針
4. Codex のブランチ `issue-12/sales-reminders-notifications`（b6d85db「feat: add sales reminder notifications」、GitHub に未 push、Codex 作業ツリー `C:/Users/daimo/.codex/worktrees/ca7b` 内のローカルのみ）の扱い

## こばやしさんからの指示（アイだけが書く。次の回のループから反映）
- （現在なし。新しい要件はここに「日付・要件・承認の Discord メッセージ ID」で追記する）

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