# AGENTS.md

共通ルールのみを記載する。個別仕様・完了条件はGitHub Issueを正とする。

## 優先順位
1. トークン消費を最小化
2. 品質・精度・安全性を維持
3. ユーザーの指示回数を削減

迷ったら「最小変更・既存仕様維持・既存実装再利用」を優先する。

## 作業
- 最初に対象Issueを読む。親Goalは必要な場合だけ読む。
- Repository全体を無目的に走査せず、関連ファイル・テスト・docsから確認する。
- 既存コード/型/utility/service/test helperを検索し、再利用する。
- Issueで仕様が足りるなら質問せず実装する。質問は重大な矛盾、安全性、不可逆変更のみ。
- Issue単位でbranchを分け、Issue外の機能追加・過剰抽象化・不要依存を避ける。
- 決定論的処理（日付、score、重複排除、権限）は通常コード、AIは文章理解・分類・要約に限定する。
- 既存挙動を変える場合は、その挙動を固定するテストを追加する。

## 推論コスト
実際のreasoning設定をこのファイルが強制できない場合でも、作業の思考深度は以下を目安に必要最小限とする。

- Low相当：文言/docs、単純な型修正、既存パターンに沿う小変更、明確なテスト追加、lint修正。
- Medium相当（原則）：通常のIssue実装、API/UI/CRUD、既存ロジック拡張、一般的なバグ修正、複数ファイル変更。
- High相当：DB schema/Migration、RLS/RBAC/Auth、security、複数層にまたがる設計変更、再現困難なbug、推薦/scoreロジックの設計変更、data破壊や互換性リスク。
- Extra High相当：原則使わない。Highで解決できず、重大なsecurity/data integrity/architecture問題がある場合のみ。

推論量を上げる前に、既存コード・既存テスト・Issue内の情報だけで解決できないか確認する。単純作業でHigh以上を使わない。

## セキュリティ
- `contacts`等のPIIをAIへ渡さない。担当者名/電話/メールを外部AIへ送信しない。
- Secrets/API Key/Service Role Keyをclient、ログ、Repositoryへ出さない。
- RLS、サーバー認可、IDOR対策、組織境界、owner/admin制御を維持する。
- 入力はサーバー側で検証し、ログへPII/Secretsを残さない。
- 外部API/依存追加時は無料/低コスト、規約、license、securityを確認する。
- 詳細は`docs/security.md`。

## DB / Test
- Schema変更はMigration。DB制約とAPI/Zod検証を一致させる。
- RLS/RBAC変更時はMigration実適用 + 実DBテストを追加する。
- 実装中は対象テストだけ優先し、PR前に既存CI相当（typecheck/lint/unit/build/secret scan/npm audit、DB変更時Supabase検証）を通す。

## GitHub
- Issue → branch → PR → CI → review → merge。
- README/docsは内容が変わる場合だけ更新する。
- PR作成後は承認なしにmainへマージしない。レビュー中は次Issueへ進まない。

## トークン節約
- Issue本文、読んだファイル、diffをチャットで繰り返さない。
- 必要な情報だけ調査・報告し、既存CIの成功項目を長文で再掲しない。
- 途中報告はブロッカー/重要判断がある時だけ。
- コードコメント・docsの重複を増やさない。

## 完了報告
原則5点だけ：PR、主変更（最大5件）、テスト結果、残リスク、main未マージ。

## 通常指示
`Issue #NをAGENTS.mdに従って実装し、テスト後にPR作成まで進めてください。mainへはマージしないでください。`
