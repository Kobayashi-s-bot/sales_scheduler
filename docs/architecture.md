# アーキテクチャ

Issue #1を親仕様とする。Issue #2の基盤とIssue #3の営業タイミング計算の上に、Issue #4では公開情報の収集・イベント抽出を追加する。新規候補企業の探索・スコアリングは後続Issueの責務とする。

リクエストはNext.js Route HandlerでZod検証後、Supabase Authの `getUser()` でサーバー検証し、対象organizationへの所属を確認する。その後もユーザーJWT付きクライアントでDBへ接続し、PostgreSQL RLSを最終防御にする。

`contacts` はPII専用テーブルである。分析層は `analysis_companies` view と `src/lib/analysis/company-context.ts` のallowlistだけを利用し、contactsへの依存を持たない。AI連携を将来追加する際もこの境界を越えてはならない。

Service Roleクライアントは `server-only` の独立モジュールに閉じ込め、通常のユーザーリクエストでは利用しない。

営業タイミングエンジンは `src/lib/recommendations/engine.ts` の純粋な通常ロジックである。イベント日から設定済みleadDaysを減算し、直近営業活動がある場合はcooldownを確保する。結果は理由とPII-freeな根拠だけを `sales_recommendations` に保存する。イベントや履歴の登録、ルール変更時にサーバーで再計算し、AIや外部APIは呼び出さない。

公開情報収集はsource adapter（RSS/HTML）、取得ポリシー、鮮度判定、EventAnalyzer、永続化serviceを分離する。日付・hash・再取得判定は通常ロジックで行う。現在のAnalyzer実装は無料の決定論的抽出であり、将来AIへ差し替える場合も`PublicDocument`のallowlist以外を渡さない。
