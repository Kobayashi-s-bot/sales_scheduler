# Web公開手順（無料枠優先）

Vercel HobbyとSupabase Freeを前提にする。どちらも利用上限・商用利用条件を公開前に確認する。

1. Supabaseで本番projectを作成し、CLIまたはDashboardから`supabase/migrations`を順番に適用する。
2. Supabase AuthのSite URLをVercelの本番URLにし、必要なRedirect URLを登録する。
3. GitHub repositoryをVercelへImportする。Framework PresetはNext.js、Build Commandは`npm run build`を使う。
4. VercelのProduction環境だけに`NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`を設定する。
5. `SUPABASE_SERVICE_ROLE_KEY`は毎日の自動取得（`/api/cron/collect`）でだけ使う。Production環境のServer-side environmentだけに保存し、`NEXT_PUBLIC_`を付けない。通常画面では使わない。
5-2. `CRON_SECRET`（32文字以上のランダムな値）をProduction環境に設定する。値が無い・短い・一致しない場合、`/api/cron/collect`は401を返す。Vercelは設定した`CRON_SECRET`を、Cron実行時に`Authorization: Bearer <値>`として自動で付ける。`CRON_SECRET`はデプロイ時に取り込まれるため、値を設定・変更した後は再デプロイしないと反映されない（出典：https://vercel.com/docs/cron-jobs/manage-cron-jobs）。
6. Deploy後、別組織のURLへorganizationIdを書き換えても閲覧・更新できないこと、ログアウト後にデータを取得できないことを確認する。

本番DBに`supabase db reset`は実行しない。Migration適用前にbackupを取得し、SupabaseのRLSが全対象tableで有効なことを確認する。preview環境を本番Supabaseへ接続しない。

## 毎日の自動取得（A4）の確認

`vercel.json`のCronは毎日 UTC 21:00（日本時間 6:00）に`/api/cron/collect`を呼ぶ。Hobbyでは実行時刻が最大59分ずれる場合がある。実行は本番Deploymentに対してだけ行われる。

1. VercelのCronsの画面に、`/api/cron/collect`が表示されること。
2. 秘密なし、または誤った値で叩くと401になること（`curl -i https://<本番URL>/api/cron/collect`）。
3. 翌朝の実行ログが200で、本文が`selected`・`succeeded`・`failed`・`skipped`・`documents`・`analyzedDocuments`・`extractedEvents`・`stoppedBy`の数値と列挙値だけであること。URL・ID・エラー文が含まれないこと。
4. 取得元の`next_check_at`が進み、候補が`pending`として候補画面に並ぶこと。`events`と推奨は、人が採用するまで変わらないこと。

## 利用条件と運用上の注意（2026-11-10時点で公式文書を確認）

- Vercel Hobbyは非商用の個人利用に限られる（https://vercel.com/docs/limits/fair-use-guidelines）。勤務先の業務での利用は、商用に当たる可能性がある。業務データを入れる前に、規約上の扱いを決める。
- Supabase Freeは、1週間ほどDBへのアクセスが少ないと自動で停止する（https://supabase.com/docs/guides/platform/free-project-pausing）。毎日のCronが読み取りを行うが、停止しない保証はない。停止後も1年以内ならDashboardから復元できる。
- Supabase Freeは自動バックアップが無い。業務データを置く場合は、自分で定期的にバックアップを取る。
- 本番に実データを入れる前に、ダミーデータだけで5項目（上記1〜4と、別組織のデータが見えないこと）を確認する。
