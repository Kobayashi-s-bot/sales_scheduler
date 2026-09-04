# アーキテクチャ

Issue #1を親仕様とし、Issue #2ではアプリ基盤、DB、認証・認可、セキュリティ境界のみを実装する。営業タイミング計算、候補企業スコアリング、公開情報収集は後続Issueの責務とする。

リクエストはNext.js Route HandlerでZod検証後、Supabase Authの `getUser()` でサーバー検証し、対象organizationへの所属を確認する。その後もユーザーJWT付きクライアントでDBへ接続し、PostgreSQL RLSを最終防御にする。

`contacts` はPII専用テーブルである。分析層は `analysis_companies` view と `src/lib/analysis/company-context.ts` のallowlistだけを利用し、contactsへの依存を持たない。AI連携を将来追加する際もこの境界を越えてはならない。

Service Roleクライアントは `server-only` の独立モジュールに閉じ込め、通常のユーザーリクエストでは利用しない。
