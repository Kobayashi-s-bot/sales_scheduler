# 営業カレンダー

既存顧客への再アプローチ時期と、新規営業候補の判断を支援するWeb/PWAです。[Issue #2](https://github.com/Kobayashi-s-bot/sales_scheduler/issues/2)の認証・組織分離基盤、[Issue #3](https://github.com/Kobayashi-s-bot/sales_scheduler/issues/3)の営業タイミング推奨に加え、Issue #4で公開情報収集基盤を実装しています。新規候補企業のスコアリングは未実装です。

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

## 公開情報収集

`POST /api/collection/run` は認証・組織所属確認後、企業に紐づくRSSまたはHTMLを取得します。公開HTTPS URLだけを許可し、robots.txt、ホスト単位のアクセス間隔、取得失敗時の指数バックオフに配慮します。取得記事はURLで重複排除し、SHA-256 content hashで同一URLの更新を検知します。

```json
{"organizationId":"...","companyId":"...","sourceUrl":"https://example.com/feed.xml","sourceType":"rss","refreshIntervalMinutes":1440}
```

`published_at`（記事公開日）とイベント日を別々に保持します。AI実装は`EventAnalyzer` interfaceの外側へ差し替え可能で、入力は公開記事のURL・題名・本文・公開日時だけです。contactsの担当者情報は参照しません。有料企業DBや有料APIには依存しません。
