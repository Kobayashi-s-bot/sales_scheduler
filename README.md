# 営業カレンダー

既存顧客への再アプローチ時期と、新規営業候補の判断を支援するWeb/PWAです。[Issue #2](https://github.com/Kobayashi-s-bot/sales_scheduler/issues/2)の認証・組織分離基盤、[Issue #3](https://github.com/Kobayashi-s-bot/sales_scheduler/issues/3)の営業タイミング推奨に加え、Issue #4で公開情報収集基盤を実装しています。新規候補企業のスコアリングは未実装です。

## ブラッシュアップ ロードマップ（ステップA：新規発見に向けた土台）

AI連携・新規企業発見の前に、「AIが誤っても営業判断を汚さない」関門を先に作る。AI自体はステップAでは入れない。

優先順位：**1. AI連携の準備 → 2. 画面の使い勝手**（ステップAの後、ステップBでAI差し込み、ステップCで新規企業発見）。

| 段階 | 内容 | 実装 | 検収 |
|---|---|---|---|
| A0 | 公開情報収集基盤(PR #13)と先行利用版UI(PR #14)を作業ブランチに統合 | アイ | アイ |
| A1 | 取得の安全性強化：DNS解決後の私的アドレス拒否、リダイレクト検査、robots.txtの`Allow`・ワイルドカード対応 | GPT系サブエージェント | アイ |
| A2 | 候補テーブルと採否フロー：抽出結果は候補として保存し、採用後に限りイベント・推奨へ反映。DB移行とRLSテストを含む | GPT系サブエージェント | アイ |
| A3 | 候補レビュー画面：出典URL・確信度・抽出日を見て、採用／却下／日付修正ができる | GPT系サブエージェント | アイ |
| A4 | 登録済みRSS等の取得を1日1回自動実行（`next_check_at`の消化）。Service Roleは専用エンドポイント＋秘密の合言葉で限定（本人承認 2026-11-09） | GPT系サブエージェント | Opus（計画・検収） |
| A5 | 企業の業態属性（小売・スーパー・飲食等）の追加。登録時の初期取得（創業年から周年を計算、過去事例）。過去事例の遡り取得の情報源は無料の範囲で調査して決める | GPT系サブエージェント | Opus |
| A6 | 展示会と出展履歴（企業×展示会×年）のデータと検索画面（企業側・展示会側の両方から検索） | GPT系サブエージェント | Opus |
| B | 抽出のAI化（社名変更・合併の噂、事例、出展情報の読み取り）。候補フロー経由のみ | GPT系サブエージェント | Opus |

### 担当と手順

- **実装**：GPT系サブエージェント（段階ごとに作業指示書を渡す）。A0とREADMEはアイ。
- **検収**：アイ。差分レビュー、`npm run typecheck`・`lint`・`test`・`check:secrets`・`build`、可能なら`supabase test db`を実行し、結果を各段階で報告する。最終承認はロンリーこばやし。
- **差し戻し**：検収で不合格なら、アイが指摘と再現手順を付けて実装担当へ戻す。同じ段階で2回差し戻しても合格しなければ作業を止め、ロンリーこばやしが方針を決める。
- **マージ**：ロンリーこばやしがレビューした後に行う。エージェントは自前でマージしない。
- 停止指示が出たら、サブエージェントと背景処理も止め、明示的な再開指示まで進めない。

### 開発ループ型の仕組み（追加）

- ルールは `RULES.md`、仕様は `SPEC.md`、状態・指示は `PROGRESS.md`、固定指示文は `PROMPTS.md`。
- 合否は `scripts/check.sh` の終了コードだけで判定する。検収は `scripts/review-packet.sh` の出力を Opus に渡す（1機能に各1回・差し戻し2回まで）。
- `loop-base` タグは段階開始時に置く。アイは check と review-packet の実行、PR 作成をする。
- この節は上記「担当と手順」の「検収：アイ」だけを上書きし、ロードマップ・CI・PR・マージの運用は変えない。

## 技術構成

- Next.js App Router / TypeScript / Tailwind CSS / shadcn/ui
- Supabase Auth / PostgreSQL / Row Level Security
- Zod / Vitest / GitHub Actions

すべてOSSまたは無料枠で利用できます。有料API・有料企業DBは使用しません。

## セットアップ

1. Node.js 20.9以上とDocker、Supabase CLIを用意します。
2. `npm ci` を実行します。
3. `.env.example` を `.env.local` にコピーし、SupabaseのURLとanon keyを設定します。
4. `npx supabase start`、`npx supabase db reset`、`npx supabase test db` でローカルDBへMigrationを適用し、実DBのRLS/RBACを検証します。
5. `npm run dev` で `http://localhost:3000` を開きます。

## 検証

`npm run typecheck`、`npm run lint`、`npm test`、`npm run check:secrets`、`npm run build`、`npm audit --audit-level=high` を実行します。CIでは公式SupabaseローカルスタックにMigrationを適用し、`supabase/tests/database/rls.test.sql` で未認証拒否、組織間IDOR拒否、正当な組織アクセス、owner保護も検証します。

詳細は [アーキテクチャ](docs/architecture.md)、[DB設計](docs/database.md)、[セキュリティ](docs/security.md) を参照してください。

## 営業タイミング推奨

営業推奨日は `max(イベント日 − leadDays, 前回営業日 + cooldownDays)`。営業履歴がない場合はイベント日からleadDaysを引きます。例：2027-12-25のクリスマス施策にleadDays=120を設定すると、2027-08-27から営業を推奨します。cooldownがイベント基準日を超える場合は、理由に営業間隔の調整を表示します。

- `event_timing` ルールの `eventType`、`leadDays`、`cooldownDays` をDBで変更可能
- イベント日と直近営業活動から通常ロジックだけで推奨日を計算
- 推奨理由、イベント・ルールID、根拠URLをPIIなしで保存
- `/companies/[companyId]?organizationId=...` で企業詳細、`/calendar?organizationId=...&month=YYYY-MM` で月別表示

イベント、過去案件・アプローチ履歴、タイミングルールの登録APIは、それぞれ `/api/events`、`/api/sales-history`、`/api/timing-rules` です。すべて認証と組織所属確認が必要です。

## 先行利用版UI

ログイン後に組織を作成・選択し、`/dashboard`で今日・今週・今月の営業対象を確認できます。企業一覧は会社名・業種・備考の検索、業種絞り込み、会社名・業種・推奨日順に対応しています。企業詳細では企業・担当者の編集、営業結果とイベントの入力、推奨理由と時系列履歴を確認できます。スマホでは画面下部のナビゲーションから営業対象・企業検索・カレンダーへ移動できます。

Web公開はVercel HobbyとSupabase Freeを優先します。本番環境変数、Auth URL、Migration、公開後の認可確認は[Web公開手順](docs/deployment.md)を参照してください。本番では`supabase db reset`を実行しません。

## 公開情報収集

`POST /api/collection/run` は認証・組織所属確認後、企業に紐づくRSSまたはHTMLを取得します。公開HTTPS URLだけを許可し、robots.txt、ホスト単位のアクセス間隔、取得失敗時の指数バックオフに配慮します。取得記事はURLで重複排除し、SHA-256 content hashで同一URLの更新を検知します。

```json
{"organizationId":"...","companyId":"...","sourceUrl":"https://example.com/feed.xml","sourceType":"rss","refreshIntervalMinutes":1440}
```

`published_at`（記事公開日）とイベント日を別々に保持します。AI実装は`EventAnalyzer` interfaceの外側へ差し替え可能で、入力は公開記事のURL・題名・本文・公開日時だけです。contactsの担当者情報は参照しません。有料企業DBや有料APIには依存しません。抽出結果は `event_candidates` に候補として保存し、採用されるまでeventsや推奨には反映されません。
