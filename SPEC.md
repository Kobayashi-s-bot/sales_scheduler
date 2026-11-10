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

### F-A3：候補レビュー画面（2026-11-09 計画。Opus）

状態：確定（2026-11-09、本人承認：Q1=案A・他は既定案。Discord 1569229947422113893）。着手してよい。

### 1. 要件（PROGRESS 指示 2026-11-09 の確定形）

R1. 新規ページ `/candidates?organizationId=<uuid>&status=<pending|accepted|rejected>` を作る。
- status が無い、または不正な値なら `pending` として扱う。
- organizationId が無いときは、dashboard と同じく「組織を選択してください。」を表示する。
- 組織の確認は既存の `requireOrganizationContext` を使い、既存ページと同じ挙動にする。

R2. 状態タブを置く：未確認（pending）／採用済み（accepted）／却下（rejected）。
- タブは Link で作り、organizationId を引き継ぐ。
- 選択中のタブには `tab-active` クラスと `aria-current="page"` を付ける。

R3. 一覧の条件：組織内、指定状態、created_at の新しい順、最大100件。
- 100件ちょうどのときは「最新100件を表示しています」と注記する。
- 0件なら empty-state に「該当する候補はありません」と表示する。
- 取得経路：`page.tsx` が `event_candidates` を直接読む（案A。条件は §7 Q1）。

R4. 各候補カードに次を表示する。

| 項目 | 表示 |
|---|---|
| 企業名 | 取得できない場合は「企業不明」 |
| イベント種別 | そのまま |
| タイトル | そのまま |
| イベント日 | null なら「日付未定」 |
| 確信度 | `Math.round(confidence*100)` に % を付ける。null・非数・0〜1の範囲外は「—」。number と数値文字列の両方を受ける |
| 抽出日 | created_at |
| 記事公開日 | published_at。null なら「不明」 |
| 要約 | null や空なら表示しない |
| 出典URL | 下記 |

- 日付の形式は既定案で `YYYY-MM-DD`。timestamptz は Asia/Tokyo の暦日に変換する。
- 出典URL は `new URL()` で解釈でき、protocol が `https:` のときだけ `<a href target="_blank" rel="noopener noreferrer">` にする。それ以外はリンクにせず、テキストとして表示する。

R5. 採用の操作（pending のカードだけ）
- 「採用」を押すと、カード内に修正フォームを開く。
  - 種別：text。初期値は現在の値。
  - 日付：`input type="date"`。初期値は現在の値か空。
  - タイトル：text。初期値は現在の値。
- 「この内容で採用」で `POST /api/candidates/{id}/accept` を送る。
- クライアント側の検証：
  - 種別は trim 後 1〜100 文字。
  - タイトルは trim 後 1〜300 文字。
  - 日付は空、または実在する `YYYY-MM-DD`。
  - 元の候補の occurred_on が null なら、日付は必須。
- 送るボディは `{ organizationId }` に、元の値から変わった項目だけを足す（trim 済み）。空文字は送らない。
- 検証に通らない場合は送信しない。

R6. 却下の操作（pending のカードだけ）
- 「却下」で `POST /api/candidates/{id}/reject` に `{ organizationId }` を送る。
- 確認ダイアログは出さない。

R7. 操作中と結果
- 送信中は、そのカードのボタンをすべて disabled にする（二重送信の防止）。
- 成功したら `router.refresh()` で一覧を更新する（data-forms.tsx と同じ方式）。
- 失敗時は HTTP ステータスだけから固定の日本語文言を出す。応答ボディ（error・issues）は画面に出さない。

| 状況 | 文言 |
|---|---|
| 400 | 入力内容を確認してください。 |
| 404 | この候補は見つかりませんでした。一覧を更新してください。 |
| 409 | この候補はすでに処理済みです。一覧を更新してください。 |
| 401 | ログインし直してください。 |
| 403 | この組織の候補を操作する権限がありません。 |
| その他・通信失敗 | 処理できませんでした。時間をおいて再試行してください。 |

401・403・その他の文言は既定案で確定（§7 Q6）。

R8. ナビ
- AppShell の PC ナビとスマホ下部ナビの両方に「候補」（`/candidates?organizationId=<id>`）を加える。
- 位置は「カレンダー」の次。
- スマホ下部ナビは `grid-cols-3` を `grid-cols-4` にする。
- 既存リンクの href とラベルは変えない。

R9. スマホでの操作
- 採用・却下・送信のボタンは `primary-button`／`secondary-button` を使う（min-height 2.75rem = 44px）。
- フォームの入力欄は `field` クラス、幅100%。
- カードは1列で、長いタイトルや URL は折り返す（`break-words` 等）。

R10. 変更しないもの
- DB、移行SQL、RLS、既存 API（src/app/api/**）、src/lib/validation/**、既存テスト、認可の境界。
- 新しい純関数とコンポーネントは新規ファイルに置く。
- 新規ファイルでは contacts・service role・admin クライアントを参照しない。

### 2. 連鎖して直すファイルの洗い出し（RULES §2-14）

着手前に実装役が機械的に確認する。結果は PROGRESS の進捗欄に記録する。

1. `tests/early-access-ui.test.tsx` と `tests/recommendation-ui.test.tsx`
   - AppShell を描画しているか、ナビのリンク数・`grid-cols-3`・既存のマークアップ全体を照合していないかを調べる。
   - 確認コマンド：`grep -nE "AppShell|app-shell|grid-cols-3|営業対象|カレンダー|toMatchSnapshot|toMatchInlineSnapshot" tests/`
   - 照合している場合は、既存テストの変更が必要になるので停止して報告する（SPEC 改訂の対象）。
2. スナップショットと生成物
   - `__snapshots__/` と Supabase の生成型（例 `src/types/database*.ts`）の有無を確認する。
   - 生成型は変更しない。必要な型は新規ファイル内にローカル定義する。
3. ルート保護
   - `src/proxy.ts`／`src/middleware.ts` 等の matcher やパスの許可リストを確認する。
   - パスを列挙する方式で `/candidates` の追加が必要なら停止して報告する（変更してよいファイルに含めていないため）。
4. PWA
   - `public/` の service worker や manifest がルートを列挙していないかを確認する。
   - 列挙していれば停止して報告する。
5. `tests/early-access-security.test.ts`
   - app-shell.tsx の本文を読み、service role の文字列が無いことを検査している。
   - リンクを足すだけなら影響しない。
6. `tests/analysis-boundary.test.ts` と `recommendation-pii-boundary.test.ts`
   - src 配下を走査して contacts の参照を禁止している可能性がある。
   - 新規ファイルに `contacts` という文字列を書かない（コメントも含む）。
7. 移行SQLの照合テスト（`*migration-security.test.ts`）
   - SQL を変えないので影響しない。
8. `app-shell.tsx` の改行コード
   - 既存の改行コードを保ち、該当箇所だけを編集する。全体の改行コード変換や整形は禁止。

#### 事前確認の結果（アイ、2026-11-09 実測。実装役は再実行して食い違えば停止して報告）
- `tests/` に AppShell のマークアップ・ナビ数・スナップショットを照合するテストは無い（`early-access-security.test.ts` は service role 文字列の不在を検査するだけ）。
- `__snapshots__/` と Supabase の生成型は無い。PWA（`public/`・manifest・service worker）は無い。
- `proxy.ts` の `protectedPage` の配列に `/candidates` が**無い**。未ログインがログインへ転送されず、エラー画面になる。そのため R11 で `proxy.ts` に1項目を足す（既存テストは `protectedPage && !user` の存在と `"/api"` の不在だけを見るため影響しない）。
- `recommendation-pii-boundary.test.ts` は `from("contacts")` の不在を検査する。新規ファイルに `contacts` と書かない。

### 3. 変更してよいファイル（allowed-files.txt 案。最小）

新規：
- `src/app/candidates/page.tsx`
  - Server Component。`searchParams` は Promise なので await する。
  - 実装前に `node_modules/next/dist/docs/` で page・searchParams・Link の記述を読む。
- `src/lib/candidates/review.ts`
  - 純関数をまとめる：parseCandidateStatus / formatConfidence / formatEventDate / formatTokyoDate / safeExternalUrl / validateAndBuildAcceptPayload / candidateErrorMessage(status: number)。
  - candidateErrorMessage は引数をステータス番号だけにし、応答ボディを渡せない形にする。
- `src/components/candidate-review.tsx`
  - 表示専用：CandidateTabs、CandidateCard、空表示。
  - `next/navigation` は使わない。CandidateCard は操作部品を `actions?: React.ReactNode` で受け取る。
- `src/components/candidate-actions.tsx`
  - `"use client"`。採用フォームと却下。fetch の後に router.refresh を呼ぶ。
- `tests/candidate-review.test.ts`（純関数）
- `tests/candidate-review-ui.test.tsx`
  - renderToStaticMarkup で描画する。AppShell は `vi.mock("next/navigation")` と `vi.mock("@/lib/supabase/browser")` を付けて描画する。

既存の変更：
- `src/components/app-shell.tsx`（R8 だけ）
- `proxy.ts`（R11 だけ：`protectedPage` の配列へ `"/candidates"` を1つ足す。他の記述は変えない）
- `PROGRESS.md`（進捗欄だけ）

実装役は着手前に、新規パスが既に存在しないことを確認する。存在する場合は停止する。

### 4. 受け入れ基準（テストで判定）

前提として §3 の共通基準（check.sh の終了コードが 0）を満たすこと。

純関数（`tests/candidate-review.test.ts`）

A1. parseCandidateStatus
- "pending"／"accepted"／"rejected" はそのまま返す。
- undefined、""、"PENDING"、"x"、配列は "pending" を返す。

A2. formatConfidence
- 0 → "0%"、0.873 → "87%"、1 → "100%"、"0.5" → "50%"。
- null、undefined、NaN、-0.1、1.2、"abc" → "—"。

A3. formatEventDate と formatTokyoDate
- formatEventDate(null) → "日付未定"、"2026-12-01" → "2026-12-01"。
- formatTokyoDate("2026-11-08T15:30:00Z") → "2026-11-09"、null → "不明"。

A4. safeExternalUrl
- "https://example.com/a" は href を返す。
- "http://example.com"、"javascript:alert(1)"、"//example.com"、"" は null を返す。

A5. validateAndBuildAcceptPayload
- 変更が無く、元に日付がある場合：`{ organizationId }` だけを返す。
- 元の日付が null で、入力日付が空：日付エラーを返し、payload を作らない。
- 種別が空白だけ、または101文字：エラー。タイトルが301文字：エラー。
- 日付が "2026/12/01" や "2026-02-30"：エラー。
- 前後に空白がある変更値：trim した値だけを含める。
- 成功したすべての payload が、既存の `candidateAcceptSchema.safeParse` で success になる（既存スキーマを import して照合する）。

A6. candidateErrorMessage
- 400／404／409／401／403／500／0 がそれぞれ R7 の固定文言と完全一致する。

画面（`tests/candidate-review-ui.test.tsx`）

A7. CandidateCard（全項目あり）の描画
- 企業名、種別、タイトル、"87%"、抽出日、公開日、要約を含む。
- `href="https://…"`、`target="_blank"`、`rel` に noopener と noreferrer の両方を含む。

A8. CandidateCard（境界値）の描画
- occurred_on が null で「日付未定」、company が null で「企業不明」、published_at が null で「不明」を表示する。
- source_url が https でない場合は `<a` を含まず、URL をテキストで表示する。

A9. 文字のエスケープ
- タイトルが `<script>x</script>` のとき、出力に `<script>` を含まない。

A10. 操作部品の受け渡し
- `actions` を渡したときだけ操作部品を描画し、渡さなければ描画しない。
- page.tsx は status が pending のときだけ actions を渡す。この点はコード検収で確認する。

A11. CandidateTabs
- 3つのリンク（未確認・採用済み・却下）を描画する。
- 各 href に `organizationId=<id>` と `status=<値>` を含む。
- 選択中のタブだけが `aria-current="page"` と `tab-active` を持つ。

A12. 空の一覧
- 空配列で「該当する候補はありません」を表示する。

A13. AppShell
- 描画結果に `/candidates?organizationId=<id>` へのリンク「候補」が2つある（PC とモバイル）。
- モバイルナビが `grid-cols-4` を持つ。
- 既存の3リンクの href とラベルが変わっていない。

A14. 境界の検査
- 新規4ファイルの本文に `service.role`、`SUPABASE_SERVICE_ROLE_KEY`、`contacts`、`dangerouslySetInnerHTML` を含まない。

A15. ボタンのクラス
- 採用・却下・送信のボタンが `primary-button` か `secondary-button` を持つ（44px を保証するため）。
- 静的描画できない場合は、candidate-actions.tsx の本文検査で代える。

差分（check.sh で判定）

A16. 変更が §3 の一覧の範囲内に収まっている。supabase/、src/app/api/、src/lib/validation/、既存の tests/ に差分が無い。

R11. `proxy.ts` の `protectedPage` の配列に `"/candidates"` を足す。それ以外は変えない。

A17. `proxy.ts` の本文が `"/candidates"` を含み、`protectedPage && !user` を保ち、`"/api"` を含まない（本文を読む検査を `tests/candidate-review-ui.test.tsx` に置く）。

### 5. データ形式・DB・認可の変更

- いずれも変更しない。移行も RLS も既存 API の改修も無し。
- 読み取りは、ユーザー JWT を使うサーバー側の supabase クライアントで行う（`requireOrganizationContext`）。Service Role は使わない。
- 書き込みは既存の accept／reject API だけを使う。
- DB 移行が無いので、DB テストの新規項目は無い。既存の supabase test db は CI の結果を PR に記載する。

### 6. 本人の画面・実機確認（PC 合格では完了にしない。未確認の項目は「未」）

- [ ] PC のヘッダーとスマホの下部ナビの「候補」から開ける。4項目が崩れずに並ぶ。
- [ ] タブを切り替えると一覧が変わる。URL を直接開いても同じ状態になる。
- [ ] 日付がある候補を、無修正で採用できる。採用済みタブに移り、カレンダーと営業対象に反映され、推奨が再計算される。
- [ ] 種別・日付・タイトルを修正して採用できる。採用済みタブの表示が元の値と修正後の値のどちらになるかを確認する（確定：候補の行が修正値に更新されるため、修正後の値が表示される）。
- [ ] 日付未定の候補は、日付を入れないと送信できない。
- [ ] 却下すると却下タブに移る。
- [ ] 2つのタブで同じ候補を操作し、後から押した側に 409 の文言が出る。
- [ ] 出典リンクが新しいタブで開く。
- [ ] スマホで次を確認する。
  - ボタンを押し間違えない大きさで、長いタイトルや URL が横にはみ出さない。
  - 日付入力が使える。
  - 下部ナビがフォームのボタンを隠さない（pb-20）。
- [ ] 所属していない組織の organizationId で開くと、既存ページと同じく拒否される。他組織の候補が表示されない。
- [ ] 候補が100件を超える組織で、注記が表示される（該当データがあれば）。

### 7. 確定事項（2026-11-09 本人承認。Discord 1569229947422113893）
- Q1：**案A**。`page.tsx`（Server Component）が `event_candidates` を直接読む。条件は organization_id・status・created_at 降順・limit 100、`companies(id,name)` を埋め込み。既存 `GET /api/candidates` は変更せず、この画面では使わない。書き込みは既存の accept／reject API だけ。
- Q2：スマホ下部ナビのリンクにも `min-h-11`（44px）を付ける（既存リンクを含む）。
- Q3：`accept_event_candidate` は候補の行も修正値で更新する（移行SQLで確認済み）。画面は候補の行の値をそのまま表示する。
- Q4：日付は `YYYY-MM-DD`（timestamptz は Asia/Tokyo の暦日）。
- Q5：却下の確認ダイアログは出さない。却下の取り消しは今回の範囲外。
- Q6：R7 の固定文言のとおり。
- Q7：採用済み・却下のタブは閲覧だけ。reviewed_at は表示しない。

### 8. ループ（安いモデルの反復）で完遂できる見込み：中〜高（案A確定。事前確認で `proxy.ts` の1項目が必要と判明したが、変更は軽微）

根拠
- 変更のほとんどが新規ファイル。既存ファイルの変更は app-shell.tsx の数行だけで、DB・SQL・API に触れない。照合テストが連鎖して壊れる危険は低い。
- 受け入れ基準の多くは純関数の入出力と静的描画で機械的に判定できる。`candidateAcceptSchema` との照合（A5）で、API との食い違いもテストで捕まえられる。

下げる要因
- Next 16 の API の差異。
- `useRouter` を含む部品を静的描画するテスト（vi.mock が必要）。
- 既存の UI テストが AppShell のマークアップを照合している可能性（§2-1）。
- fetch して refresh する対話の挙動はテストで判定できず、実機確認に依存する。

推奨
- §2 の grep による事前確認は、ループに入れる前に親（アイ）が機械的に実行して結果を確定させる。
- 既存テストが AppShell の HTML を照合していると分かった場合、ループに既存テストの literal を書き写させてはいけない。その場合は R8 だけを親の手作業に切り出すか、SPEC を改訂して既存テストの変更範囲を明記してから再開する。


### F-A4：毎日の自動取得（2026-11-09 計画。Opus）

状態：確定（2026-11-09。§6 の確定事項を含む）。着手してよい。
承認：Discord 1569540426833334363・1569544066843148460（Service Role 導入を含む）

### 1. 要件（確定部分）

R1. `public_sources` のうち `next_check_at` が null または現在時刻以前のものを、1日1回自動で取得する。

- 取得・安全性・候補保存は既存の `collectPublicSource`、`RssSourceAdapter` / `HtmlSourceAdapter`、`HeuristicEventAnalyzer` をそのまま使う。
- 書き込み先は既存経路と同じ `public_sources` / `source_documents` / `event_candidates` に限る。`events` と推奨には書かない。

R2. 実行は Vercel Cron（確定）から専用エンドポイント `GET /api/cron/collect` を呼ぶ形とする。

- エンドポイントは、環境変数 `CRON_SECRET` と一致する `Authorization: Bearer <CRON_SECRET>` が無ければ拒否する。
- 秘密は未設定・短すぎ（32文字未満）の場合も拒否する（fail-closed）。
- 比較は定数時間で行う（両辺を SHA-256 にしてから比較するなど。方法は実装役に任せる）。
- 秘密値とリクエストヘッダはログ・レスポンスに出さない。

R3. Service Role（`createSupabaseAdminClient`）はこのエンドポイントだけで使う。

- 管理クライアントの生成は、認証が通った後に限る。拒否する経路では生成しない。
- コードが触るテーブルは `public_sources`、`source_documents`、`event_candidates` の3つだけとする。`contacts` は参照しない。
- 注意：Service Role は DB 上は全権限を持つ。この制限はコード上のものにすぎず、DB で強制されるものではない。

R4. 上限と失敗の扱い。

- 1回の実行で処理する件数の上限は `MAX_SOURCES_PER_RUN`、時間の予算は `TIME_BUDGET_MS` とする。どちらも export した定数にし、テストは定数を参照する（数字を直接書かない）。
- 時間の判定：「経過時間 ＋ 1件あたりの最悪時間 `PER_SOURCE_WORST_MS`」が予算を超えるなら、新しい1件を始めない。
- 処理順は `next_check_at` の昇順で、null を先頭にする。
- 取得元は1件ずつ直列に処理する。並列にはしない。
- 同じホストの連続処理：同一ホストの前の1件が終わってから 1,100ms 以上空けて次を始める。既存の `HostRateLimiter`（1秒）の例外が失敗として数えられ、バックオフが進んでしまうのを防ぐため。待ち時間は注入できる sleep と時計で行う。
- 失敗は既存のバックオフ（`collectPublicSource` 内の処理）に任せる。実行役は1件ごとに例外を捕まえて失敗として数え、次の1件へ進む。
- 上限・時間切れで処理しなかった取得元は変更しない（期限切れのまま翌日に回る）。
- 取得元の `organization_id`・`company_id`・`source_url`・`source_type`・`refresh_interval_minutes` は DB の行の値をそのまま `collectPublicSource` に渡す。

R5. レスポンスは PII なし。成功時は `{ data: { selected, succeeded, failed, skipped, documents, analyzedDocuments, extractedEvents, stoppedBy } }` だけを返す。

- 数値以外の値は `stoppedBy`（`"none" | "limit" | "time"`）のみ。
- 返さないもの：URL、各種 ID、組織名・会社名、エラーメッセージ。
- `extractedEvents` は注入した解析器の出力件数を数える。重複で保存されなかった分も含むので「保存された候補数」ではない。
- 全体の失敗（取得元一覧の取得失敗、環境変数の不足）は 500 と固定文言 `{"error":"Internal server error"}` を返す。
- 環境変数の ZodError を既存の `safeErrorResponse` に渡すと 400 になり、変数名が漏れる。この経路では使わない。

R6. 変更しないもの：既存の RLS、既存 API（`POST /api/collection/run` を含む）、既存テスト、`service.ts`、`adapters.ts`、`rate-limiter.ts`、`admin.ts`、`env.ts`、migration、`.github/`。DB 変更は無し。

### 2. 連鎖して壊れる箇所の洗い出し（RULES §2-14）

- 既存ファイルの変更は実装役には無い（`vercel.json` と `.env.example` は親が追加）。
- migration は変更しないので、`tests/*migration-security.test.ts` には影響しない。
- 新しく作る静的テスト（後述の AC9・AC10）は `service.ts` の本文を読む。将来 `service.ts` を変えると、このテストが意図どおり失敗する。これは仕様であり、連鎖ではない。
- `server-only` を import するモジュールを Vitest で読み込めるかは、既存テストのやり方（alias・mock）に従う。
  - Vitest 設定やゲートファイルの変更が必要になった場合は、停止して報告する（自分で変えない）。
- `check:secrets`：テスト内のダミー秘密値（例：`test-cron-secret-` で始まる32文字以上の値）が検出に引っかかった場合は、停止して報告する。検出を回避する書き方はしない。
- build：`CRON_SECRET` と `SUPABASE_SERVICE_ROLE_KEY` が無い状態でも build が通ること。環境変数の読み込みはリクエスト時に行い、モジュールの読み込み時には行わない。
- Next.js について：ルートを動的にする指定、実行環境（Node）、実行時間の指定（maxDuration 相当）は、`node_modules/next/dist/docs/` を読んで、この版での正しい書き方に従う。既知の書き方を推測で書かない。

### 3. 変更してよいファイル（allowed-files.txt）

    src/app/api/cron/collect/route.ts          新規（薄く：認証→管理クライアント生成→実行役→応答）
    src/lib/collection/scheduled.ts            新規（実行役。client・collect関数・adapter生成・analyzer・時計・sleep を注入可能に）
    src/lib/collection/cron-auth.ts            新規（ヘッダ検証。env を引数か注入で受ける）
    tests/collection-scheduled.test.ts         新規
    tests/cron-auth.test.ts                    新規
    tests/cron-boundary.test.ts                新規（静的境界テスト・ルートの拒否経路テスト）
    （vercel.json と .env.example は親が追加する。実装役は触らない）
    PROGRESS.md                                進捗欄のみ

`.env.example` と `vercel.json` は親が変更する（実装役の範囲外）。

### 4. 受け入れ基準（テストで判定）

共通：SPEC §3 の1〜3（check.sh 終了コード0、凍結 SHA 不変、変更は範囲内）。

認証（cron-auth.test / cron-boundary.test）

- AC1. 次の場合は検証結果が「拒否」になる：ヘッダ無し、`Bearer` 以外の形式、値の不一致、`CRON_SECRET` 未設定、`CRON_SECRET` が32文字未満。一致した場合だけ「許可」になる。
- AC2. 拒否経路のルート（`GET` を呼ぶ）は 401 と固定の本文を返す。さらに、`@/lib/supabase/admin` の `createSupabaseAdminClient` を mock して、呼ばれていないことを確認する。
- AC3. 拒否時の本文と、`console` に記録された内容（spy で取得）に、秘密値と受け取ったヘッダ値が含まれない。

実行役（collection-scheduled.test。偽の client・偽の collect・偽の時計と sleep を使う）

- AC4. 期限切れの行だけが選ばれる。境界値（`next_check_at` が今と等しい、null、未来）を含める。順序は null が先、その後は古い順。選ばれる件数は `MAX_SOURCES_PER_RUN` 以下。
- AC5. collect に渡す organizationId・companyId・config は各行の値と一致する。組織の異なる2行を入れて、取り違えないことを確認する。
- AC6. 3件中2件目が例外を投げても、3件目は処理される。数は `failed=1`・`succeeded=2` になる。
- AC7. 時計を進めると、予算の規則（R4）で新しい1件を始めず、`stoppedBy="time"` になる。件数上限に達した場合は `stoppedBy="limit"` になる。処理しなかった行に対して collect は呼ばれない。
- AC8. 同じホストの2件では、1件目が終わってから2件目を始めるまでに、注入した sleep・時計の上で 1,100ms 以上空く。別ホストの場合は待たない。

境界（cron-boundary.test）

- AC9. 静的検査：新規3ファイルと `service.ts` の中の `.from("…")` が、`public_sources` / `source_documents` / `event_candidates` 以外を参照していない。また、これらのファイルに文字列 `contacts` が含まれない。
- AC10. 静的検査：`src/app/` の中で `@/lib/supabase/admin` を import しているのは `src/app/api/cron/collect/route.ts` だけである。
  - 着手時点で既に import しているファイルがあれば、許可リストに加える。そのリストは親が loop-base 時点の grep 結果で確定し、PROGRESS の指示欄に書く。

応答（cron-boundary.test または collection-scheduled.test）

- AC11. 成功時の本文のキーは R5 の集合と完全に一致し、値は数値または `stoppedBy` の列挙値だけである。
  - 失敗させる collect に `https://x.example/a user@example.com` を含むエラーを投げさせ、その文字列と URL・ID が本文に出ないことを確認する。
- AC12. 取得元一覧の取得に失敗した場合と、環境変数の解析に失敗した場合は、どちらも 500 と `{"error":"Internal server error"}` を返す。変数名は本文に出ない。

その他

- AC13. 既存テストは1件も変更していない。テスト件数は基準以上。
- AC14. DB テストは CI で実行し、結果を PR に記載する（DB 変更は無いが、CI の結果は残す）。

### 5. データ形式・DB・認可の変更

- データ形式：変更なし。
- DB スキーマ・migration：変更なし。
- RLS：変更なし。
- 認可経路：Service Role を使う経路が新しく1本増える（承認済み）。制限はコード上のものだけで、DB では強制されない。
- 環境変数：`CRON_SECRET`（新規）と `SUPABASE_SERVICE_ROLE_KEY`（定義は既存、本番で使うのは初めて）を本人が Vercel に登録する。

### 6. 確定事項（2026-11-09 本人承認。Discord 1569545858016481311ほか）
- Q1：**Vercel Cron**。`vercel.json` の crons と `.env.example` の `CRON_SECRET` 行は親（アイ）が機械的に追加する（実装役は触らない）。
- Q2：Service Role の制限は**コード上の制限と静的な境界テスト（AC9・AC10）で受け入れる**。DB 側での強制は運用実績ができた後に別 SPEC で検討する。
- Q3（公式ドキュメントで確認）：Hobby の関数の最大実行時間は 300 秒。定数は `MAX_SOURCES_PER_RUN=100`、`TIME_BUDGET_MS=240000`、`PER_SOURCE_WORST_MS=20000`（既存アダプタのタイムアウトは1取得15秒）。ルートの最大実行時間指定は 300 秒（書き方は Next.js の docs に従う）。
- Q4：日本時間6時（UTC `0 21 * * *`）。Hobby の起動は指定時刻から最大59分ずれる。毎朝の取得なので許容。
- Q5：候補数は抽出件数（`extractedEvents`）で足りる。保存件数は返さない。
- Q6：組織間の公平性は考えない。上限を超えた分は翌日に回る。足りなければ後で枠を調整する。
- Q7：`.env.example` は存在する。`CRON_SECRET` の行は親が足す。
- Q8：手動実行との衝突で失敗が1回数えられることは受け入れる。
- **追加要件 R12（再試行）**：一通り処理した後、時間予算が残っていれば、**失敗した取得元を1回だけ**再試行する（同じ予約規則：経過時間＋`PER_SOURCE_WORST_MS` が予算を超えるなら再試行しない。同一ホストの間隔規則も守る）。再試行で成功した件は `succeeded` に、失敗のままの件は `failed` に数える（二重に数えない）。再試行しなかった失敗は `failed` のまま翌日に回る。
- **追加の受け入れ基準 AC15**：失敗した取得元が、時間に余裕があるとき1回だけ再試行され、2回目の成功で `succeeded` に数えられる／再試行も失敗なら `failed` に1回だけ数えられる／時間が足りなければ再試行されない。

### 7. 本人の画面・実機確認（PC の合格だけでは完了にしない）

- [未] Vercel に `CRON_SECRET`（32文字以上のランダム値）と `SUPABASE_SERVICE_ROLE_KEY` を Production に登録したか。Preview への登録の要否も決めたか。
- [未] Vercel の Cron 画面にジョブが1件表示され、有効になっているか。Cron は Production デプロイでのみ動く想定（要確認）。
- [未] 秘密なしで本番 URL を叩くと 401 が返るか。
- [未] 翌朝の実行ログで status 200 になり、本文が数値だけであること（URL・ID・メールアドレスが出ていないこと）。
- [未] Supabase 上で、期限切れだった取得元の `next_check_at` が先に進んだか。失敗した取得元は `failure_count` が増え、バックオフが効いているか。
- [未] 候補画面に新しい候補が `pending` で並び、events と推奨は変わっていないか。
- [未] Vercel のログに秘密値・ヘッダが出ていないか。
- [未] DB テストの CI 結果を PR で確認したか。

### 8. 実装役がループで完遂できる見込み：中（高寄り）

根拠（＋）

- 既存ファイルの変更が実装役には無く、すべて新規ファイル。DB・migration・RLS は変えないため、連鎖して壊れる危険が小さい。
- 実行役は依存をすべて注入できる形にしており、受け入れ基準は偽の client・時計・sleep と静的検査で機械的に判定できる。
- 合否の判定に外部通信も DB も要らない。

根拠（−）

- Next.js の版が未知。ルートを動的にする指定・Node 実行環境・maxDuration の書き方は docs を読む必要があり、外すと build や本番の挙動がずれる。build が通っても、本番で静的扱いになっていないかは実機でしか分からない。
- `server-only` と `vi.mock` の効き方は既存の設定に依存する。ゲート側の変更が必要になれば、ループでは止まる。
- 定数（100件・240秒・300秒）は Hobby の公式上限に基づく確定値。

推奨

- 確定済み（§6）。実装役は §3 の新規ファイルだけを作る。
- `vercel.json` の crons と AC10 の許可リストは、回答を受けて親（アイ）が機械的に確定させ、loop-base に含める。ループには `vercel.json` を触らせない（その場合は allowed-files から外す）。
- 残りの新規ファイルとテストはループに乗せる。
