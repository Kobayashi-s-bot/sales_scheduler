# SPEC — 仕様と受け入れ基準

製品の恒久仕様（変わりにくいもの）＋機能ごとの節。機能の節は計画（Opus）が追加し、検収の基準になる。
経緯の詳細は README・Vault（履歴）。ここには結論だけを書く。

## 1. 製品の恒久仕様
- 既存顧客への再アプローチ時期と新規営業候補の判断を支援するWeb/PWA。Next.js App Router / TypeScript / Tailwind / shadcn/ui / Supabase Auth・PostgreSQL・RLS / Zod / Vitest。無料枠を優先し、有料APIは使わない。
- データ：Supabase PostgreSQL。組織単位のテナント分離とRLSを適用し、業務データは organization_id で分離する。contacts はPII専用で分析系から分離。SPEC が明示しない限り不変。
- 秘密情報の扱い：秘密情報は `.env*` で管理しリポジトリ・ログに書かない。Service Role は server-only。ユーザーリクエストは認証済みユーザーJWTとRLSを使う。

## 2. 現在の機能の要点
- 営業タイミング推奨：イベント日・leadDays・直近営業活動・cooldownDaysから通常ロジックで推奨日を計算し、PIIなしの根拠を保存する。
- 公開情報収集：公開RSS/HTMLを取得し、記事を重複排除してイベント候補として保存する。候補は採用されるまでイベント・営業推奨に反映されず、採用後にイベント化して推奨を再計算する。
- 先行利用版UI：組織内の営業対象・企業・カレンダーを確認し、企業情報、担当者、営業結果、イベントを扱う。

## 3. 全機能共通の受け入れ基準（`scripts/check.sh` が機械判定）
1. `scripts/check.config.json` の steps（typecheck / lint / test / check:secrets / build）がすべて成功し、テスト件数が基準以上。
2. 凍結ファイル（既存テスト等）の SHA が、SPEC が許す変更以外で不変。
3. 変更は `scripts/allowed-files.txt`（loop-base 時点）の範囲内。ゲートファイル・PROGRESS の指示欄は不変。
4. DBテスト(supabase test db)は Docker が無いため CI で実行し、結果を PR に記載。その間、DB は未検証。

## 4. 機能ごとの節（計画が追記）
現在なし。A3（候補レビュー画面）以降は計画（Opus）が追記する。