# アーキテクチャ

Issue #1を親仕様とする。Issue #2のアプリ基盤、DB、認証・認可、セキュリティ境界の上に、Issue #3では既存顧客の営業タイミング計算・企業詳細・月別カレンダーだけを追加する。新規候補企業の探索・スコアリング、公開情報収集は後続Issueの責務とする。

リクエストはNext.js Route HandlerでZod検証後、Supabase Authの `getUser()` でサーバー検証し、対象organizationへの所属を確認する。その後もユーザーJWT付きクライアントでDBへ接続し、PostgreSQL RLSを最終防御にする。

`contacts` はPII専用テーブルである。分析層は `analysis_companies` view と `src/lib/analysis/company-context.ts` のallowlistだけを利用し、contactsへの依存を持たない。AI連携を将来追加する際もこの境界を越えてはならない。

Service Roleクライアントは `server-only` の独立モジュールに閉じ込め、通常のユーザーリクエストでは利用しない。

営業タイミングエンジンは `src/lib/recommendations/engine.ts` の純粋な通常ロジックである。イベント日へ設定済みoffsetを加算し、直近営業活動がある場合はcooldownを確保する。結果は理由とPII-freeな根拠だけを `sales_recommendations` に保存する。イベントや履歴の登録、ルール変更時にサーバーで再計算し、AIや外部APIは呼び出さない。
