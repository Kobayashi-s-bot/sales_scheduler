#!/usr/bin/env bash
# ループの合否判定。終了コード 0 = 合格、1 = 不合格、3 = 部分合格(--quick)。LLM の判断は入れない。
# 使い方: scripts/check.sh [--quick]
set -u
cd "$(dirname "$0")/.."
exec python -B scripts/check.py "$@"
