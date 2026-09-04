# データベース設計

`organizations` と `organization_members` がテナント境界を定義する。業務テーブルはすべて必須の `organization_id` を持つ。認証ユーザーは `create_organization` RPCで組織と最初のowner membershipを同一トランザクションに作成する。

- `companies`: 分析可能な企業情報
- `contacts`: 氏名、部署、メール、電話などのPII。分析系から分離
- `sales_history`: 企業単位の営業活動履歴。contact_idは持たない
- `events`: 企業の公開イベントと根拠URL
- `sales_opportunities`: 企業単位の商談
- `scoring_rules`: 将来の決定論的ルール設定。Issue #2では計算しない
- `sales_recommendations`: イベントとルールから算出した推奨日、説明、PII-freeな根拠、状態

子テーブルの `company_id` と `organization_id` の一致はDBトリガーで保証し、組織をまたぐ関連付けを拒否する。全対象テーブルでRLSを有効にし、membership関数を使ったポリシーを設定する。`analysis_companies` は `security_invoker` viewでcompaniesのRLSを継承する。

## メンバー権限

- ownerはownerを含むメンバーの追加・役割変更・削除を行える。
- adminはowner以外のメンバーだけを管理できる。ownerの付与、ownerへの昇格、ownerの降格・削除はRLSで拒否する。
- memberはメンバー構成を参照できるが変更できない。
- 最後のownerの降格・削除は `organization_members_protect_last_owner` トリガーが、RLSを迂回する管理経路を含めて拒否する。

初回Migrationは `supabase/migrations/20260903000000_foundation.sql`。ローカルSupabaseで `npx supabase db reset` により適用し、`npx supabase test db` で実RLS/RBACテストを実行する。

Issue #3のMigrationは `20260904000000_sales_timing_engine.sql`。イベント日は不明を表現できるようnullableとし、日付不明のイベントは保存するが推奨計算から除外する。イベントの組織・企業・種別・日付・タイトル・URLが同一の重複はDB制約で拒否する。推奨のevent/rule/company/organization整合性はトリガーで保証する。

`scoring_rules.rule_type = 'event_timing'` のconfigurationは次を使う。

- `eventType`: 対象イベント種別
- `offsetDays`: イベント日から営業開始までの日数
- `cooldownDays`: 直近営業活動から確保する最小日数

event timing configurationはDB制約でも型と0〜3650日の範囲を検証する。ルールの閲覧は組織memberに許可し、追加・変更・削除はowner/adminだけに限定する。
