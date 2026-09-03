# 営業カレンダー

既存顧客への再アプローチ時期と、新規営業候補の判断を支援するWeb/PWAの基盤です。現在の実装範囲は [Issue #2](https://github.com/Kobayashi-s-bot/sales_scheduler/issues/2)（親仕様: [Issue #1](https://github.com/Kobayashi-s-bot/sales_scheduler/issues/1)）で、認証・組織分離・DB・セキュリティまでです。スコアリングやWeb収集は未実装です。

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
