#!/bin/bash

# Babysitter Session Start Hook
# Extracts session_id from hook input and persists it as CLAUDE_SESSION_ID
# This makes the session ID available to command scripts via environment variable
# Also captures project context for use across the session

set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Extract session_id from hook input
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')

if [[ -z "$SESSION_ID" ]]; then
  # No session ID available - this shouldn't happen but exit gracefully
  exit 0
fi

# Detect project context
# PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")
# PROJECT_NAME=$(basename "$PROJECT_ROOT")
# PROJECT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# # CLAUDE_ENV_FILE is provided by Claude Code for SessionStart hooks
# # Writing to this file persists environment variables for the session
if [[ -n "${CLAUDE_ENV_FILE:-}" ]]; then
  # Session identity
  echo "export CLAUDE_SESSION_ID=\"$SESSION_ID\"" >> "$CLAUDE_ENV_FILE"

  # Project context
  # echo "export PROJECT_ROOT=\"$PROJECT_ROOT\"" >> "$CLAUDE_ENV_FILE"
  # echo "export PROJECT_NAME=\"$PROJECT_NAME\"" >> "$CLAUDE_ENV_FILE"
  # [[ -n "$PROJECT_BRANCH" ]] && echo "export PROJECT_BRANCH=\"$PROJECT_BRANCH\"" >> "$CLAUDE_ENV_FILE"

  # Inherit from wrapper if present (e.g., mycc wrapper)
  # [[ -n "${myccpid:-}" ]] && echo "export myccpid=\"$myccpid\"" >> "$CLAUDE_ENV_FILE"
  # [[ -n "${ai_model:-}" ]] && echo "export ai_model=\"$ai_model\"" >> "$CLAUDE_ENV_FILE"
fi

# Log session start (optional, can be disabled)
if [[ "${BABYSITTER_VERBOSE:-}" == "true" ]]; then
  echo "Babysitter session started: $SESSION_ID" >&2
  # echo "Project: $PROJECT_NAME ($PROJECT_ROOT)" >&2
  # [[ -n "$PROJECT_BRANCH" ]] && echo "Branch: $PROJECT_BRANCH" >&2
fi

exit 0