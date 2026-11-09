"""凍結ファイルの SHA 一覧を作る（アイ専用）。check は基準点側のこの一覧と live の byte を照合する。

対象: scripts/check.config.json の frozen_roots 配下の既存ファイル（既存テストの書き換え・削除を機械で止める）。
新規テストの追加は妨げない（一覧に無いパスだから）。受理して基準点を進めるときに作り直して含める。
使い方: python -B scripts/make_frozen.py [--git REF] [--exclude PATH ...]
  --git REF    作業ツリーでなく REF の内容から作る
  --exclude P  今回の機能で変更を許すファイルを一覧から外す（許可リストと同じパスを渡す）
出力: scripts/frozen-sha256.txt（<sha256>\t<path> の行、path 順）
"""
import hashlib, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
conf = json.loads((ROOT / "scripts/check.config.json").read_text(encoding="utf-8"))
roots = conf.get("frozen_roots", [])
if not roots:
    sys.exit("frozen_roots が空。凍結対象が無いなら一覧は不要")
args = sys.argv[1:]
ref = args[args.index("--git") + 1] if "--git" in args else None
excluded = [args[i + 1] for i, a in enumerate(args) if a == "--exclude"]

if ref:
    names = subprocess.run(["git", "-c", "core.quotepath=false", "ls-tree", "-r", "--name-only", ref, "--", *roots],
                           cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout.splitlines()
    pairs = [(p, hashlib.sha256(subprocess.run(["git", "show", f"{ref}:{p}"], cwd=ROOT, capture_output=True).stdout).hexdigest())
             for p in names]
else:
    pairs = [(str(p.relative_to(ROOT)).replace("\\", "/"), hashlib.sha256(p.read_bytes()).hexdigest())
             for r in roots for p in (ROOT / r).rglob("*")
             if p.is_file() and "__pycache__" not in p.parts and "node_modules" not in p.parts]
pairs = sorted((p, h) for p, h in pairs if p not in excluded)
(ROOT / "scripts/frozen-sha256.txt").write_text("".join(f"{h}\t{p}\n" for p, h in pairs), encoding="utf-8", newline="\n")
print(f"frozen {len(pairs)} files -> scripts/frozen-sha256.txt")
