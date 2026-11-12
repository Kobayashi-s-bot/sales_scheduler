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
- **追加要件 R12（再試行しない・2026-11-10 本人指示で変更）**：失敗した取得元は同じ実行の中で再試行しない。失敗は `failed` に1回だけ数え、翌日以降の通常の予約（`failure_count` に基づくバックオフ）に任せる。理由：`collectPublicSource` は呼ぶたびに `failure_count` を加算するため、同日の再試行は失敗回数を1日に2回進め、バックオフが倍速で進むから。同一ホストの間隔規則は失敗した後も守る（失敗した試行の終了時刻も記録する）。
- **追加の受け入れ基準 AC15（変更後）**：失敗した取得元は1回の実行で `collectPublicSource` が1回だけ呼ばれ、`failed` に1回だけ数えられる（再試行しない）／失敗した後も同一ホストの次の取得元との間隔が空く。

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

### F-A4.5：取得元の登録

#### 1. 要件

- 企業詳細画面 /companies/[companyId] に「取得元」欄を追加する。
- 欄の中身は、その会社の public_sources 行の一覧、追加フォーム、行ごとの削除ボタン。
- 登録するだけで、取得はしない。
  - 追加時に外部 URL へ通信しない。
  - POST /api/collection/run や取得処理を呼ばない。
- 取得は既存の毎朝の /api/cron/collect に任せる。
  - 新規行は next_check_at を null のまま登録し、次回の cron で処理対象になるようにする。
- 登録時の入力値は以下に限る。
  - source_url：https のみ、2048 字以下、SSRF 対策として既存の assertPublicHttpsUrl と同等の検証を通す。
  - source_type：rss か html。
- 以下はサーバ側で決め、クライアントからは受け付けない。
  - organization_id：書き込む値は requireOrganizationMembership が返した membership の値。body の organizationId は、認可の対象組織を指定するためにだけ使う（既存 API と同方式。2026-11-12 改訂）。スネークケースの organization_id など、他のキーは strict スキーマで拒否する。
  - company_id：body の companyId を使い、membership の組織に属する会社であることをサーバで確認する（route にパス引数が無いため。2026-11-12 改訂）。
  - refresh_interval_minutes：DB 既定値 1440 に任せ、入力欄は設けない。
  - last_checked_at / next_check_at / failure_count / last_error：DB 既定値に任せ、insert に含めない。
- 一覧に出す項目
  - source_url、source_type、last_checked_at（未取得なら「未取得」）、last_error（ある場合のみ）。
  - 並びは created_at 昇順。
- 削除は「id・organization_id・company_id がすべて一致する行」だけを対象にする。
- 一覧の読み込みは A3 と同じ方針とする。page.tsx（Server Component）が requireOrganizationContext の supabase クライアントで public_sources を直接 select する。
- 追加・削除は新しい API を fetch で呼ぶ。成功後は画面の一覧を更新する。
  - 更新方法は data-forms.tsx の既存方式に合わせる。
  - Next.js の API（router.refresh 等）を使う場合は、先に node_modules/next/dist/docs/ を読む。

#### 2. 連鎖して直すファイルの洗い出し（実装前に親が機械的に確認する）

想定では連鎖する変更は無い。ただし次の点は grep で確認し、結果を PROGRESS に記録すること。

- C1：凍結テスト 30 本が、次のファイルを読んで中身を照合・スナップショットしていないか。
  - 対象：src/app/companies/[companyId]/page.tsx、src/lib/validation/collection.ts
  - 方法：tests/ を "companies/[companyId]"、"page.tsx"、"collection.ts"、"toMatchSnapshot"、"readFileSync" で検索する。
  - 照合していた場合は、着手せず本人へ報告する。
- C2：src/app/api/**/route.ts を列挙して「全 route が requireOrganizationMembership を使うこと」などを検査する凍結テストが無いか。
  - あれば、新しい route もその検査を満たすように書く（テスト側は変えない）。
- C3：assertPublicHttpsUrl が export されているか、同期か非同期か、DNS 解決をするか。
  - DNS 解決（外部通信）をする場合はテストで名前解決が走るため、Q5 で判断を仰ぐ。
- C4：生成された DB 型（例：src/types/database.ts）に public_sources が含まれているか。
  - 含まれていなければ、型の再生成はせず停止して報告する（生成物は範囲外）。
- C5：移行 SQL（supabase/migrations/）には触れない。
  - tests/*migration-security.test.ts との照合が連鎖して壊れることは無い想定。

#### 3. 変更してよいファイル（allowed-files.txt）

- 新規 src/app/api/public-sources/route.ts
  - POST（追加）と DELETE（削除）を置く。GET は作らない。一覧は page.tsx が直接読む。
- 新規 src/lib/validation/public-source.ts
  - 入力スキーマを置く。URL 検証は assertPublicHttpsUrl を import して再利用する。
- 新規 src/components/public-sources-panel.tsx
  - クライアントコンポーネント。一覧表示、追加フォーム、削除ボタン。
- 変更 src/app/companies/[companyId]/page.tsx
  - public_sources を select し、パネルを差し込む。それ以外の既存表示は変えない。
- 新規 tests/public-source-validation.test.ts
- 新規 tests/public-sources-api.test.ts
- 新規 src/lib/validation/public-source-type.ts（2026-11-12 追記。suggestSourceType の置き場。クライアントコンポーネントから読むため、Node 専用の import を含めない。collection/policy 経由で node:dns/promises が入ると build が失敗する）
- 新規 tests/public-sources-panel.test.tsx（2026-11-12 追記。@testing-library は未導入で package.json を変更できないため、renderToStaticMarkup と文字列検査で書く）
- PROGRESS.md（進捗欄のみ）
- 条件付き：src/lib/validation/collection.ts
  - C3 で assertPublicHttpsUrl が export されていない場合に限り、export を付ける 1 箇所の変更だけを許す。ロジックは変えない。

触らないファイル：data-forms.tsx、既存の API route、supabase/ 以下すべて、凍結テスト、scripts/。
新規ファイルは LF で作る。

#### 4. 受け入れ基準（Vitest で判定する。最終的な合否は scripts/check.sh の終了コード 0）

入力の検証（tests/public-source-validation.test.ts）

- AC1：次の入力を受理する。
  - https://example.com/feed.xml と sourceType "rss"
  - https://example.com/news と sourceType "html"
- AC2：次の sourceUrl を拒否する。
  - http://example.com/
  - ftp://example.com/
  - 空文字
  - 2049 字の https URL
  - https://127.0.0.1/、https://10.0.0.1/、https://192.168.1.1/、https://169.254.169.254/
  - 既存 collectSourceInputSchema が拒否するものと同じ範囲で、https://localhost/ も拒否する。
- AC3：次の入力を拒否する。
  - sourceType が "rss"・"html" 以外の値（"atom"、空、未指定）
  - companyId が UUID でない値
- AC4：スキーマは organizationId / refreshIntervalMinutes / nextCheckAt / failureCount を受け付けない。
  - 余分なキーは strict で拒否するか、strip で捨てる。どちらにするかは既存スキーマの方式に合わせる。
  - いずれの場合も、出力オブジェクトにこれらのキーが含まれないことをテストする。

API（tests/public-sources-api.test.ts。requireOrganizationMembership と supabase クライアントは既存 API テストと同じ方式でモックする）

- AC5：未認証・非メンバーの POST と DELETE は、既存 API と同じエラーステータスを返し、DB 操作を呼ばない。
- AC6：正常な POST
  - public_sources への insert がちょうど 1 回呼ばれる。
  - insert に渡すオブジェクトのキーは organization_id, company_id, source_url, source_type の 4 つだけ。
  - organization_id はモックした membership の組織 ID と一致する。
  - レスポンスは 201 で、作成した行を返す。
- AC7：body に別の organization_id を入れても、insert される organization_id は membership の値である。
- AC8：companyId が自組織の companies に存在しない場合は 404 を返し、insert を呼ばない。
- AC9：insert が一意制約違反（code 23505）を返した場合は 409 を返す。
- AC10：POST の処理中に globalThis.fetch が一度も呼ばれない（spy で検証）。
  - 加えて route.ts の本文に "collection/run" の文字列が無く、取得処理モジュールも import していないことを、テキスト検査で確認する。
- AC11：検証エラー（AC2・AC3 相当の入力）は 400 を返し、insert を呼ばない。
- AC12：正常な DELETE
  - delete に対して eq("id")、eq("organization_id", membership の組織)、eq("company_id") の 3 条件がすべて付く。
- AC13：DELETE の結果
  - 該当 0 行なら 404。
  - id または companyId が UUID でなければ 400。
  - 成功時は 200 または 204（既存 API の方式に合わせる）。

全体

- AC14：scripts/check.sh が終了コード 0。
  - 内訳：typecheck、lint、test、check:secrets、build（ダミー env）、loop-base との差分が allowed-files.txt の範囲内であること。
  - 凍結テスト 30 本は無変更で通る。

#### 5. データ形式・DB・認可の変更の有無

- DB スキーマの変更：なし。移行 SQL は追加・変更しない。
- RLS の変更：なし。既存の public_sources_member_all に依存する。
- 認可の追加：あり（アプリ層のみ）。
  - 新しい API は requireOrganizationMembership を必須とする。
  - 会社の所属をサーバ側で確認する（AC8）。
- データ形式：既存の列に既存の制約どおりの値を入れるだけ。既存データは変更しない。
- 外部通信：追加しない（AC10）。
- 秘密情報：Service Role を使わない。利用者の権限（anon キーとセッション）のクライアントで操作する。contacts には触れない。
- DB の検証：DB 移行が無いため、supabase test db の対象は変わらない。ただし実 DB の RLS 下での insert・delete はユニットテストではモックであり、未検証になる。本人の実機確認で検証する（第 6 節）。

#### 6. 本人の画面・実機確認項目（本番 Vercel + Supabase、ダミーデータ）

- V1：/companies/[companyId] に「取得元」欄が表示される。登録が 0 件のときは空の状態として表示される。
- V2：https の RSS URL を種別 rss で追加すると、すぐ一覧に出る。
  - Supabase のテーブルで以下を確認する。
    - next_check_at が null であること。
    - refresh_interval_minutes が 1440 であること。
    - organization_id と company_id が正しいこと。
- V3：同じ URL を再度追加すると、重複エラーの表示が出て、行は増えない。
- V4：http:// の URL や https://192.168.1.1/ を入力するとエラーが表示され、登録されない。
- V5：削除すると一覧から消え、DB からも消える。別の会社の取得元は残っている。
- V6：翌朝の /api/cron/collect 実行後、追加した行の last_checked_at が埋まり、一覧の表示が更新される。
  - これは cron 連携の確認で、A4.5 自体の合否とは切り分けて記録する。
- V7：（可能なら）別組織のユーザーで同じ companyId の URL を開いても、取得元が見えず、追加・削除もできない。
- V8：スマートフォン（PWA）で表示が崩れず、追加・削除の操作ができる。

上記はすべて PC の check 合格とは別で、本人が確認するまで「未」とする。

#### 6-2. 本人の決定と確認結果（2026-11-12 アイ追記。Opus の下書きに対する確定事項）

- **Q1 確定**：種別は利用者が選ぶ（案A）。**初期値は URL から自動入力**する（折衷案）。URL の末尾が `.xml`・`.rss`・`.atom`、またはパスに `/feed` か `/rss` を含めば `rss`、それ以外は `html`。選び直せる。推定関数は純粋関数 `suggestSourceType(url)` として `src/lib/validation/public-source-type.ts` に置く（2026-11-12 改訂：当初は public-source.ts だったが、クライアントから読むと build が失敗するため分離）。判定は URL のパスで行い、末尾が `.xml`・`.rss`・`.atom`、またはパスの区切り単位が `feed`・`rss` なら rss。`/feeds/all` や `/rss.php` は html になる（選び直せるので許容）。**追加の受け入れ基準 AC16**：`suggestSourceType` が、`https://github.blog/feed/`→rss、`https://example.com/a.xml`→rss、`https://example.com/rss`→rss、`https://example.com/news`→html、解析できない文字列→html を返す。例外を投げない。
- **Q2 確定**：削除は、取得元と連動して `source_documents` が消え、`event_candidates` は残る（`public_source_id` が null になる）。実測：`20260908…sql:23` は `on delete cascade`、`20260909…sql:7` は `on delete set null`。削除が FK で失敗することはない。**削除前にブラウザ標準の `confirm` で確認する**（部品の追加なし）。確認文に「この取得元から取り込んだ記事の記録は消えます。採用前の候補は残ります」を含める。**追加の受け入れ基準 AC17**：`public-sources-panel.tsx` が、削除の fetch を呼ぶ前に `confirm` を呼ぶ。`confirm` が false を返したら fetch を呼ばない（コンポーネントテスト、または文字列検査）。
- **Q5 確定**：登録時は `assertPublicHttpsUrl`（同期・DNS 解決なし）だけを使い、`assertPublicHostResolves` は呼ばない。取得時の DNS 再検証は A1 で実装済みの取得処理が行う。
- **Q3・Q4・Q6〜Q8**：Opus の前提どおり。URL は trim のみ、`last_error` のみ表示、取得間隔は 1440 固定、件数上限なし。
- **C1〜C4 の実測結果（親が実施済み）**：C1：凍結テスト `early-access-security.test.ts` は `src/app/companies/[companyId]/page.tsx` に文字列 `requireOrganizationContext` が含まれることだけを検査している。**この文字列を page.tsx から消さないこと**。他に照合・スナップショットなし。C2：`app/api` を列挙する凍結テストなし（`cron-boundary.test.ts` は `supabase/admin` の import 元が `cron/collect/route.ts` だけであることを検査する。新しい route で `supabase/admin` を import してはならない）。C3：`assertPublicHttpsUrl` は `src/lib/collection/policy.ts` で export 済み、同期。**`validation/collection.ts` の変更は不要**（allowed から外す）。C4：DB 型定義ファイルは存在しない。
- 新しい API の認可は、既存の `requireOrganizationMembership` を使う。`supabase/admin` は import しない（上記 C2 の検査に当たる）。
- 実装役への注意：追加・削除後の画面更新は `data-forms.tsx` の既存方式（`useRouter`）に合わせる。Next.js の API を使う前に `node_modules/next/dist/docs/` を読み、読んだパスを PROGRESS に記録する。

#### 7. 要確認（推測せず、本人の判断を待つ）【解消済み。上記 6-2 を参照】

- Q1：source_type の決め方。
  - 案 A：利用者がセレクトで選ぶ（初期値は html）。
  - 案 B：URL から推定する。
  - 本 SPEC の AC は案 A を前提にしている。案 B にする場合は推定規則（拡張子 .xml/.rss、パスに /feed を含む等）の決定が必要で、AC1・AC3 を改める。
- Q2：取得元を削除したとき、その取得元から集めたデータ（public_sources を参照するテーブルがあるか）をどう扱うか。
  - FK が cascade なら収集データも消え、restrict なら削除が失敗する。
  - 実装前に移行 SQL で FK を確認し、望む挙動を本人が決める。
  - restrict で失敗する場合のエラー表示（409 にするか等）も決める。
- Q3：削除前に確認ダイアログを出すか。出す場合、shadcn/ui の AlertDialog が導入済みでないと、コンポーネントの追加（範囲外のファイル）が必要になる。
- Q4：URL の正規化（前後の空白除去以外に、末尾スラッシュや大文字小文字を同一視するか）。
  - 本 SPEC は「trim のみ、ほかは正規化しない」を前提にしている。
- Q5：assertPublicHttpsUrl が DNS 解決をする場合、登録時にも実行してよいか（外部通信にあたる、RULES §2-6）。
  - 実行しない場合は「登録時は文字列とリテラル IP の検査のみ、取得時に cron 側が再検証する」とする。cron 側が再検証していることも確認する。
- Q6：一覧に last_error と failure_count を表示するか（本 SPEC は last_error のみ表示)。
- Q7：refresh_interval_minutes を将来画面から変えられるようにするか。本 SPEC では対象外（既定 1440 固定）。
- Q8：1 社あたりの登録件数に上限を設けるか。本 SPEC では設けない。

Q1・Q2・Q5 は実装前に解消が必要。Q3・Q4・Q6〜Q8 は本 SPEC の前提どおりで進め、本人の判断で後から変えてよい。

#### 8. 実装役がループで完遂できる見込み

見込み：中。Q1・Q2・Q5 と C1〜C4 が解消されていれば高。

根拠（高い要因）

- 変更は新規ファイル 5 本と、既存ファイル 1 本（page.tsx）への追記で、小さく局所的。
- 既存の API route、データ入力フォーム、requireOrganizationMembership、assertPublicHttpsUrl という手本と部品がそろっている。
- DB と RLS の変更が無い。
- 受け入れ基準は、モックへの呼び出し引数とステータスコードで機械的に判定できる。

根拠（下げる要因）

- Next.js が既知の版と異なる。route handler の params の型、router.refresh などの API の違いで typecheck や build に何度も失敗する可能性がある。
- supabase クライアントのチェーン（from().insert().select()、delete().eq().eq().eq()）のモックが既存テストに無い場合、安いモデルは試行錯誤しやすい。
- assertPublicHttpsUrl が非同期で DNS を使う場合（C3・Q5）、テストが外部通信に依存して不安定になる。
- 画面の正しさはテストで判定できず、実機確認（第 6 節）に依存する。

推奨

- C1〜C4 の grep 確認と、Q2 の FK 確認は、ループに渡さず親（アイ）が機械的に行い、結果を PROGRESS の指示欄に追記してから起動する。
- C1 で照合テストが見つかった場合や、C4 で型の再生成が必要な場合は、ループに乗せない。本人判断で SPEC を改訂する。
