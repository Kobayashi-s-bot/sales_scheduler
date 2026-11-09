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
