# セキュリティ

## 必須ルール

- 未認証アクセスをRoute HandlerとRLSの両方で拒否する。
- URLやbodyのorganization_idを信用せず、サーバー側でmembershipを照合する。
- 全業務テーブルのRLSを無効化しない。Service RoleでRLSを迂回する通常APIを作らない。
- 秘密鍵、実データをGitへcommitしない。秘密鍵に `NEXT_PUBLIC_` を付けない。
- ログへ氏名、部署、電話、メール、cookie、token、秘密鍵、request body全体を出さない。
- contactsを分析・AI層から参照せず、AIへPIIを送らない。
- クライアントへ内部例外、SQL、stack traceを返さない。

| 脅威 | 対策 |
| --- | --- |
| 未認証アクセス | `auth.getUser()` とauthenticated限定RLS |
| IDOR | サーバーmembership照合、organization_id RLS |
| 組織をまたぐ外部キー | company/organization整合トリガー |
| Service Role漏洩 | `server-only`、公開env名禁止、CIスキャン |
| PIIのAI・ログ流出 | contacts分離、分析allowlist、境界テスト、ログ禁止 |
| 不正入力 | strict Zod schemaとDB制約 |
| 内部情報露出 | 固定エラーレスポンス |
| 依存脆弱性 | lockfile、npm audit |

## PRチェック

- [ ] 新規テーブルにorganization_id、RLS、policyがある
- [ ] 認証と組織認可を迂回する経路がない
- [ ] 入力をサーバー側で検証している
- [ ] 秘密情報がclient bundle・ログ・fixtureにない
- [ ] contacts/PIIが分析・AI入力へ渡らない
- [ ] エラーが内部情報を返さない
- [ ] typecheck、lint、test、build、secret scan、npm auditが成功する

Supabase Dashboardで本番URL、Auth provider、バックアップ、監査ログ保持、秘密鍵ローテーションを環境ごとに設定する。Service Roleを利用する管理ジョブは個別レビューし、最小権限のサーバー環境に限定する。
