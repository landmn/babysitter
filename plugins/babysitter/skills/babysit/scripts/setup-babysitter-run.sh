#!/bin/bash
# Setup a new babysitter run session - delegates to SDK CLI
set -euo pipefail

SESSION_ID=""
PROMPT=""
MAX_ITERATIONS=256

# Parse arguments (same interface as original)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --claude-session-id) SESSION_ID="$2"; shift 2 ;;
    --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
    *) PROMPT="$1"; shift ;;
  esac
done

if [[ -z "$SESSION_ID" ]]; then
  echo "Error: --claude-session-id is required" >&2
  exit 1
fi

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
STATE_DIR="$PLUGIN_ROOT/skills/babysit/state"

babysitter session:init \
  --session-id "$SESSION_ID" \
  --state-dir "$STATE_DIR" \
  --max-iterations "$MAX_ITERATIONS" \
  --prompt "$PROMPT" \
  --json
