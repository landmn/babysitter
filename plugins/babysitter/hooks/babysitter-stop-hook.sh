#!/bin/bash
# Babysitter Stop Hook - delegates to SDK CLI
# All logic is implemented in: babysitter hook:run stop
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
exec babysitter hook:run stop --plugin-root "$PLUGIN_ROOT" --json < /dev/stdin
