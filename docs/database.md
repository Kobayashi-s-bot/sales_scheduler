# データベース設計

`organizations` と `organization_members` がテナント境界を定義する。業務テーブルはすべて必須の `organization_id` を持つ。認証ユーザーは `create_organization` RPCで組織と最初のowner membershipを同一トランザクションに作成する。

- `companies`: 分析可能な企業情報
- `contacts`: 氏名、部署、メール、電話などのPII。分析系から分離
- `sales_history`: 企業単位の営業活動履歴。contact_idは持たない
- `events`: 企業の公開イベントと根拠URL
- `sales_opportunities`: 企業単位の商談
- `scoring_rules`: 将来の決定論的ルール設定。Issue #2では計算しない

子テーブルの `company_id` と `organization_id` の一致はDBトリガーで保証し、組織をまたぐ関連付けを拒否する。全対象テーブルでRLSを有効にし、membership関数を使ったポリシーを設定する。`analysis_companies` は `security_invoker` viewでcompaniesのRLSを継承する。

初回Migrationは `supabase/migrations/20260903000000_foundation.sql`。ローカルSupabaseで `npx supabase db reset` により適用する。
