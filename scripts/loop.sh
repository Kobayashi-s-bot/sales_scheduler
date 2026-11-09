#!/usr/bin/env bash
# 実装ループ（案件共通）。最大 MAX 回、毎回「新しいセッション」で実装役を1回走らせ、
# scripts/check.sh の終了コードだけで終了を判定する。LLM に「できたか」を聞かない。
# 出力と終了コード:
#   review-ready 0  : check 完全合格（かつ BASE 比で PROGRESS 以外の変更が1件以上）
#   stuck       10  : 詰まりレポート（PROGRESS の「## 詰まりレポート」節の行頭 `- STUCK:`）あり
#   limit       11  : MAX 回で check 未合格
#   quota       12  : 利用枠の上限（429 / usage limit）。周回を消費せず即停止。アイが本人に「待つか／モデルを替えるか」を確認する。
#                     実装役のモデルは自動で替えない。課金・プラン変更・クレジット購入は禁止。
#   no-change   13  : check は合格したが変更が0件（実装役が何もしていない。完了と見なさない）
#   error        2  : 想定外（agent が異常終了・出力なし 等）。原因を調べるまで再実行しない
# 環境変数: MAX（既定8） / LOOP_PROFILE（hermes のプロファイル名。必須。LOOP_AGENT_CMD を使うなら不要）
#           LOOP_AGENT_CMD（テスト用: 実装役の起動コマンドを差し替える。プロンプトは標準入力）
set -u
cd "$(dirname "$0")/.."
MAX="${MAX:-8}"
PROFILE="${LOOP_PROFILE:-}"
[ -n "${LOOP_AGENT_CMD:-}" ] || [ -n "$PROFILE" ] || { echo "error: LOOP_PROFILE（hermes のプロファイル名）か LOOP_AGENT_CMD を指定してください"; exit 2; }
BASE_TAG="$(python -B scripts/check.py --get base_tag --plain)"
PROGRESS="$(python -B scripts/check.py --get progress_file --plain)"
OUTDIR="$(python -B scripts/check.py --get out_dir --plain)"
LOGDIR="$OUTDIR/loop-logs/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$LOGDIR"
sed -n '/^## ② /,/^## ③ /p' PROMPTS.md | sed '1d;$d' > "$LOGDIR/prompt.txt"
[ -s "$LOGDIR/prompt.txt" ] || { echo "error: PROMPTS.md の ② が空"; exit 2; }

stuck() {  # 「## 詰まりレポート」節に、行頭が「- STUCK:」の行があれば 0（通常の進捗行は誤検出しない）
  sed -n '/^## 詰まりレポート/,/^## [^詰]/p' "$PROGRESS" | grep -q '^- STUCK:'
}
quota_hit() {  # agent ログに利用枠上限の痕跡があれば 0
  grep -qiE 'error code: *429|monthly usage limit|usage limit|RateLimitError|HTTP 429' "$1"
}
changed_count() {  # BASE 比（コミット済み＋未コミット＋未追跡）で PROGRESS 以外の変更ファイル数
  { git diff --name-only --no-renames "$BASE_TAG"; git ls-files -o --exclude-standard; } | grep -v "^$PROGRESS\$" | grep -v '^$' | grep -v "^$OUTDIR/" | sort -u | wc -l
}
stuck && { echo "stuck（開始時点で詰まりレポートあり。$PROGRESS を確認）"; exit 10; }

for i in $(seq 1 "$MAX"); do
  echo "== loop $i/$MAX =="
  if [ -n "${LOOP_AGENT_CMD:-}" ]; then
    bash -c "$LOOP_AGENT_CMD" < "$LOGDIR/prompt.txt" > "$LOGDIR/agent-$i.log" 2>&1; arc=$?
  else
    hermes -p "$PROFILE" chat --query-file "$LOGDIR/prompt.txt" --oneshot -Q > "$LOGDIR/agent-$i.log" 2>&1; arc=$?
  fi
  echo "agent exit=$arc（ログ: $LOGDIR/agent-$i.log）"; tail -n 5 "$LOGDIR/agent-$i.log"
  if quota_hit "$LOGDIR/agent-$i.log"; then
    echo "quota（利用枠の上限: 周回 $i で停止。モデルは自動で替えない。待つか別モデルに替えるかを本人に確認すること）"; exit 12
  fi
  [ "$arc" -ne 0 ] && { echo "error（agent が異常終了 exit=$arc。原因を調べるまで再実行しない）"; exit 2; }
  [ -s "$LOGDIR/agent-$i.log" ] || { echo "error（agent の出力が空。原因を調べるまで再実行しない）"; exit 2; }
  stuck && { echo "stuck"; exit 10; }
  bash scripts/check.sh > "$LOGDIR/check-$i.log" 2>&1; rc=$?
  tail -n 3 "$LOGDIR/check-$i.log"
  if [ "$rc" -eq 0 ]; then
    n=$(changed_count)
    [ "$n" -eq 0 ] && { echo "no-change（check は合格だが変更が0件。実装役が何もしていない。review-ready にしない）"; exit 13; }
    echo "review-ready（変更 ${n} ファイル）"; exit 0
  fi
done
echo "limit（${MAX} 回で check 未合格。$PROGRESS と $LOGDIR を確認）"; exit 11
