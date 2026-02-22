#!/bin/bash
# Resume an existing babysitter run - delegates to SDK CLI
set -euo pipefail

SESSION_ID=""
RUN_ID=""
MAX_ITERATIONS=256

while [[ $# -gt 0 ]]; do
  case "$1" in
    --claude-session-id) SESSION_ID="$2"; shift 2 ;;
    --run-id) RUN_ID="$2"; shift 2 ;;
    --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$SESSION_ID" ]] || [[ -z "$RUN_ID" ]]; then
  echo "Error: --claude-session-id and --run-id are required" >&2
  exit 1
fi

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
STATE_DIR="$PLUGIN_ROOT/skills/babysit/state"

babysitter session:resume \
  --session-id "$SESSION_ID" \
  --state-dir "$STATE_DIR" \
  --run-id "$RUN_ID" \
  --max-iterations "$MAX_ITERATIONS" \
  --runs-dir ".a5c/runs" \
  --json
