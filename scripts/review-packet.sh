#!/usr/bin/env bash
# Opus 検収に渡す入力を作る（案件共通）。標準出力に出す。リポジトリの状態（index 含む）は変えない。
# 使い方: scripts/review-packet.sh [BASE_REF]   BASE_REF 省略時は基準点タグ（無ければ HEAD）
# 含める: RULES の要点 / SPEC の共通基準と該当節 / PROGRESS の指示・進捗・詰まりと PROGRESS の差分 / check 結果
#         / 変更ファイル（コミット済み・未コミット・未追跡）/ 製品コードの差分 / 差分
# 含めない: 会話ログ・過去の作業指示書・Vault の履歴
set -u
cd "$(dirname "$0")/.."
BASE_TAG="$(python -B scripts/check.py --get base_tag --plain)"
PROGRESS="$(python -B scripts/check.py --get progress_file --plain)"
OUTDIR="$(python -B scripts/check.py --get out_dir --plain)"
PRODUCT="$(python -B scripts/check.py --get product_paths --plain)"
BASE="${1:-$(git rev-parse -q --verify "$BASE_TAG^{commit}" || echo HEAD)}"
MAXDIFF="${MAXDIFF:-1500}"
UNTRACKED="$(git ls-files -o --exclude-standard | grep -v "^$OUTDIR/" || true)"
mkdir -p "$OUTDIR"
TMPF="$OUTDIR/packet-diff.$$"

echo "# 検収パケット（BASE=${BASE:0:12}, $(date '+%Y-%m-%d %H:%M')）"
CHECK_BASE="$(grep -o '"base": "[0-9a-f]*"' "$OUTDIR/summary.json" 2>/dev/null | grep -o '[0-9a-f]\{7,\}' || true)"
if [ -z "$CHECK_BASE" ]; then
  echo "⚠ 検収不可：check 未実行（$OUTDIR/summary.json に base が無い）。検収は check の完全合格の後に行う。"
elif [ "$(git rev-parse "$BASE" 2>/dev/null | cut -c1-12)" != "$CHECK_BASE" ]; then
  echo "⚠ 検収不可：check の基準点($CHECK_BASE)とこのパケットの BASE(${BASE:0:12})が違う。同じ基準で check をやり直す。"
fi
grep -q '"pass": true' "$OUTDIR/summary.json" 2>/dev/null || echo "⚠ 検収不可：直近の check が完全合格ではない（pass:true でない）。"
echo; echo "## RULES の要点（§2 絶対に守ること）"
sed -n '/^## 2\./,/^## 3\./p' RULES.md | sed '$d'
echo "## SPEC：共通の受け入れ基準と機能の節"
sed -n '/^## 3\./,$p' SPEC.md
echo; echo "## PROGRESS：指示・進捗・詰まり（現在の内容）"
sed -n '/^## こばやしさんからの指示/,/^## 次の作業候補/p' "$PROGRESS" | sed '$d'
sed -n '/^## 進捗ログ/,$p' "$PROGRESS"
echo; echo "## $PROGRESS の変更（BASE 比。指示欄が変わっていたら RULES 違反）"
git diff "$BASE" -- "$PROGRESS"
echo; echo "## check 結果（$OUTDIR/summary.json）"
cat "$OUTDIR/summary.json" 2>/dev/null || echo "（無い＝check 未実行。検収に進んではいけない）"
echo; echo "## 変更ファイル（BASE 比：コミット済み＋未コミット）"
git diff --stat --no-renames "$BASE" | tail -40
echo "### 未追跡ファイル"; [ -n "$UNTRACKED" ] && echo "$UNTRACKED" || echo "（なし）"
if [ -n "$PRODUCT" ]; then
  echo; echo "## 製品コードの差分（$PRODUCT。保存形式・権限・DB・認可の変更は目視で確認する。最大800行）"
  PD=$(git diff --no-renames "$BASE" -- $PRODUCT | wc -l)
  git diff --no-renames "$BASE" -- $PRODUCT | head -n 800
  [ "$PD" -gt 800 ] && echo "...（製品コードの差分は全 ${PD} 行。省略分は git diff $BASE -- $PRODUCT で見る）"
fi
echo; echo "## 差分（最大 ${MAXDIFF} 行。超過分は省略。$PROGRESS は上で別掲）"
{
  git diff --no-renames "$BASE" -- . ":!$PROGRESS"
  for f in $UNTRACKED; do git diff --no-index --no-renames -- /dev/null "$f"; done
} > "$TMPF" 2>/dev/null
head -n "$MAXDIFF" "$TMPF"
TOTAL=$(wc -l < "$TMPF")
[ "$TOTAL" -gt "$MAXDIFF" ] && echo "...（省略：全 ${TOTAL} 行中 ${MAXDIFF} 行まで）"
rm -f "$TMPF"
exit 0
