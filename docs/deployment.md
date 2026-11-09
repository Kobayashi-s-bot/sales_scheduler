# Web公開手順（無料枠優先）

Vercel HobbyとSupabase Freeを前提にする。どちらも利用上限・商用利用条件を公開前に確認する。

1. Supabaseで本番projectを作成し、CLIまたはDashboardから`supabase/migrations`を順番に適用する。
2. Supabase AuthのSite URLをVercelの本番URLにし、必要なRedirect URLを登録する。
3. GitHub repositoryをVercelへImportする。Framework PresetはNext.js、Build Commandは`npm run build`を使う。
4. VercelのProduction環境だけに`NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`を設定する。
5. `SUPABASE_SERVICE_ROLE_KEY`は現在の通常画面では不要。将来設定する場合もServer-side environmentだけに保存し、`NEXT_PUBLIC_`を付けない。
6. Deploy後、別組織のURLへorganizationIdを書き換えても閲覧・更新できないこと、ログアウト後にデータを取得できないことを確認する。

本番DBに`supabase db reset`は実行しない。Migration適用前にbackupを取得し、SupabaseのRLSが全対象tableで有効なことを確認する。preview環境を本番Supabaseへ接続しない。
