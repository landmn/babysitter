#!/bin/bash
# Babysitter Session Start Hook - delegates to SDK CLI
exec babysitter hook:run session-start --json < /dev/stdin
