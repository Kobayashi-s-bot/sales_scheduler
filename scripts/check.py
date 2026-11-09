"""開発ループの機械判定（案件共通・設定駆動）。合格=exit 0。LLM の判断は入れない。

案件ごとの違いは scripts/check.config.json だけに置く（このファイル自体は案件で書き換えない）。
基準点: git タグ（既定 `loop-base`）。アイが「受理済みの状態」に置く。ループ（実装役）は触らない。

段階:
  0) 基準点タグ・残存プロセス
  1) ゲート改ざん（scripts/ RULES/SPEC/PROMPTS 等の変更は不合格）と変更範囲（allowed-files.txt は基準点側から読む）
     ＋ PROGRESS の「指示」欄の改ざん検出 ＋ 凍結ファイルの SHA 照合
  2) steps（型・lint・テスト・build など。案件が config で宣言）。count_regex/count_min でテスト削除を検出
  3) advisory（不合格にしない参考検査。例: npm audit）
exit: 0=完全合格 / 1=不合格 / 3=部分合格（--quick。quick:true の step だけ実行＝完全な合格ではない）
結果: <out_dir>/summary.json と標準出力の最終行。
補助: --get KEY [--plain] で config の値を返す（loop.sh / review-packet.sh が使う）
"""
import hashlib, json, os, re, shutil, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONF_PATH = ROOT / "scripts" / "check.config.json"
DEFAULTS = {
    "base_tag": "loop-base",
    "out_dir": "build/check",
    "progress_file": "PROGRESS.md",
    "instruction_section": "こばやしさんからの指示",
    "gate_prefixes": ["scripts/", "RULES.md", "PROMPTS.md", "SPEC.md", ".gitignore"],
    "frozen_roots": [],
    "ignored_scan_roots": [],
    "ignored_scan_exclude": ["__pycache__", ".pyc", "node_modules", "/.next/", ".tsbuildinfo", "/build/", "/dist/", "/coverage/"],
    "forbid_processes": [],
    "product_paths": [],
    "steps": [],
    "advisory": [],
}


def load_conf():
    c = dict(DEFAULTS)
    c.update(json.loads(CONF_PATH.read_text(encoding="utf-8")))
    return c


def git(*a):
    r = subprocess.run(["git", "-c", "core.quotepath=false", *a], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.returncode, r.stdout


def running_processes(names):
    if not names or os.name != "nt":
        return 0
    r = subprocess.run(["tasklist.exe", "/FO", "CSV", "/NH"], capture_output=True, text=True, errors="replace")
    low = tuple('"%s"' % n.lower() for n in names)
    return sum(1 for l in r.stdout.splitlines() if l.lower().startswith(low))


def section(text, head):
    m = re.search(r"^## " + re.escape(head) + r".*?(?=^## |\Z)", text, re.S | re.M)
    return m.group(0).strip() if m else None


def changed_vs_base(conf, base):
    """BASE との差（コミット済み・未コミット・未追跡）。.gitignore 対象でも、ソース配下は拾う。"""
    st = {}
    _, o = git("diff", "--name-status", "--no-renames", base)
    for l in o.splitlines():
        s, p = l.split("\t", 1); st[p] = s
    _, o = git("ls-files", "-o", "--exclude-standard")
    for p in o.splitlines():
        st.setdefault(p, "A")
    roots = conf["ignored_scan_roots"]
    if roots:
        _, o = git("ls-files", "-o", "-i", "--exclude-standard", "--", *roots)
        for p in o.splitlines():
            if any(x in "/" + p for x in conf["ignored_scan_exclude"]):
                continue
            st.setdefault(p, "A(ignored)")
    return st


def run_step(conf, step, out):
    exe = shutil.which(step["cmd"][0]) or step["cmd"][0]
    env = dict(os.environ); env.update(step.get("env", {}))
    t0 = time.time()
    log = out / (step["name"] + ".log")
    try:
        r = subprocess.run([exe, *step["cmd"][1:]], cwd=ROOT, env=env, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", stdin=subprocess.DEVNULL,
                           timeout=step.get("timeout_s", 900))
        text = (r.stdout or "") + (r.stderr or ""); rc = r.returncode
    except subprocess.TimeoutExpired as e:
        text = "TIMEOUT\n" + str(e); rc = 124
    except FileNotFoundError as e:
        text = "COMMAND NOT FOUND: %s" % e; rc = 127
    log.write_text(text, encoding="utf-8")
    res = {"name": step["name"], "exit": rc, "seconds": round(time.time() - t0, 1), "log": str(log.relative_to(ROOT)).replace("\\", "/")}
    if step.get("count_regex"):
        m = re.search(step["count_regex"], text)
        res["count"] = int(m.group(1)) if m else None
        res["count_min"] = step.get("count_min")
    return res


def main():
    conf = load_conf()
    args = sys.argv[1:]
    if "--get" in args:
        v = conf.get(args[args.index("--get") + 1])
        print(" ".join(map(str, v)) if ("--plain" in args and isinstance(v, list)) else (v if "--plain" in args else json.dumps(v, ensure_ascii=False)))
        return
    quick = "--quick" in args
    out = ROOT / conf["out_dir"]; out.mkdir(parents=True, exist_ok=True)
    S = {"started": time.strftime("%Y-%m-%d %H:%M:%S"), "mode": "quick" if quick else "full"}

    def finish(ok, why="", partial=False):
        S["pass"] = ok and not partial
        S["reason"] = why
        (out / "summary.json").write_text(json.dumps(S, ensure_ascii=False, indent=1), encoding="utf-8")
        print("CHECK PARTIAL: " + why if partial else ("CHECK PASS" if ok else "CHECK FAIL: " + why))
        sys.exit(3 if partial else (0 if ok else 1))

    # 0) 基準点・プロセス
    rc, base = git("rev-parse", "--verify", "-q", conf["base_tag"] + "^{commit}")
    base = base.strip()
    if rc != 0 or not base:
        finish(False, "基準点 git タグ `%s` が無い（アイが受理済みの状態に置く。ループは作らない）" % conf["base_tag"])
    S["base"] = base[:12]
    n = running_processes(conf["forbid_processes"]); S["forbidden_processes_before"] = n
    if n:
        finish(False, "preflight: %s が %d 件残存（並列起動は偽の失敗を生む。停止して原因を確認）" % (conf["forbid_processes"], n))

    # 1) ゲート・範囲・指示欄・凍結
    ch = changed_vs_base(conf, base)
    outp = conf["out_dir"].rstrip("/") + "/"
    ch = {p: s for p, s in ch.items() if not p.startswith(outp)}
    gate = sorted(p for p in ch if p.startswith(tuple(conf["gate_prefixes"])))
    if gate:
        finish(False, "gate: ゲートファイルの変更 %s（check・基準値・RULES/SPEC/PROMPTS はループが変えてはいけない）" % gate)
    _, al = git("show", "%s:scripts/allowed-files.txt" % base)  # 許可リストは基準点側から読む
    allowed = {l.strip() for l in al.splitlines() if l.strip() and not l.startswith("#")}
    outside = sorted(p for p in ch if p != conf["progress_file"] and p not in allowed)
    S["scope"] = {"allowed_from_base": len(allowed), "changed": sorted(ch), "outside_allowed": outside}
    if outside:
        finish(False, "scope: 許可リスト外の変更 %s（リストが空なら変更を許していない）" % outside)
    if conf["progress_file"] in ch:
        _, old = git("show", "%s:%s" % (base, conf["progress_file"]))
        new = (ROOT / conf["progress_file"]).read_text(encoding="utf-8")
        h = conf["instruction_section"]
        if section(old.replace("\r\n", "\n"), h) != section(new.replace("\r\n", "\n"), h):
            finish(False, "progress: 「%s」欄が変更されている（書けるのはアイだけ）" % h)
    if conf["frozen_roots"]:
        rc, man = git("show", "%s:scripts/frozen-sha256.txt" % base)
        if rc != 0:
            finish(False, "frozen: frozen_roots があるのに scripts/frozen-sha256.txt が基準点に無い（make_frozen.py を実行して含める）")
        frozen = dict((p, h) for h, p in (l.split("\t", 1) for l in man.splitlines() if "\t" in l))
        bad = [p for p, h in frozen.items()
               if not (ROOT / p).is_file() or hashlib.sha256((ROOT / p).read_bytes()).hexdigest() != h]
        S["frozen"] = {"count": len(frozen), "changed": bad}
        if bad:
            finish(False, "frozen: 凍結ファイルが変更/削除された %s" % bad)

    # 2) steps
    S["steps"] = []
    ran_full = True
    for step in conf["steps"]:
        if quick and not step.get("quick"):
            ran_full = False
            continue
        r = run_step(conf, step, out); S["steps"].append(r)
        if r["exit"] != 0:
            finish(False, "%s: 失敗 exit=%s（%s。起動失敗とテスト失敗を区別して読むこと）" % (r["name"], r["exit"], r["log"]))
        if step.get("count_regex") and (r["count"] is None or r["count"] < (step.get("count_min") or 0)):
            finish(False, "%s: 件数が基準未満または読み取れない count=%s min=%s（テスト削除の疑い。%s）" % (r["name"], r["count"], r["count_min"], r["log"]))

    # 3) advisory（不合格にしない）
    S["advisory"] = []
    if not quick:
        for step in conf["advisory"]:
            r = run_step(conf, step, out); S["advisory"].append(r)

    if quick and not ran_full:
        finish(True, "quick: 一部の step のみ実行（完全な合格ではない）", partial=True)
    finish(True)


main()
