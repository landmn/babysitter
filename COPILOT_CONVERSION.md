# Babysitter — GitHub Copilot Conversion Guide

This guide documents what was built to integrate Babysitter with GitHub Copilot / VS Code.

## What Was Built

### 1. Copilot Instructions (`.github/copilot-instructions.md`)

Automatically read by GitHub Copilot in any workspace that contains this file. Teaches
Copilot orchestration patterns, SDK CLI commands, task types, and process definition structure.
No installation required.

### 2. `@babysitter` Chat Participant

Registered in the VS Code extension. Handles natural language requests in Copilot Chat and
delegates to extension commands.

```
@babysitter implement user authentication with TDD and 85% quality target
@babysitter resume
@babysitter status
@babysitter list
@babysitter processes
@babysitter help
```

Source: `packages/vscode-extension/src/copilot/participant.ts`

### 3. Background Orchestration Agent (`BabysitterBackgroundAgent`)

Drives the `run:iterate` loop as a VS Code background operation. Shows progress in the status
bar, detects breakpoints, handles cancellation, and retries on transient waits.

Source: `packages/vscode-extension/src/copilot/backgroundAgent.ts`

### 4. Chat Sessions Panel Integration (`BabysitterSessionController`)

Uses the VS Code 1.111 `chatSessionsProvider` proposed API (`enabledApiProposals:
["chatSessionsProvider"]`) to surface babysitter runs as native items in the Chat Sessions
panel, with `ChatSessionStatus` enum for status indicators.

Source: `packages/vscode-extension/src/copilot/sessionController.ts`

### 5. Breakpoint Notifications (`BabysitterBreakpointNotifier`)

Watches for pending breakpoints and surfaces them as VS Code notifications, which VS Code
automatically escalates to OS-level notifications when `chat.notifyWindowOnConfirmation` is
enabled.

Source: `packages/vscode-extension/src/copilot/breakpointNotifier.ts`

### 6. Agent Plugin (`packages/agent-plugin/`)

A plugin manifest (`plugin.json`) and natural language instructions (`instructions.md`) for
the babysitter agent, updated for SDK v0.0.180 (plugin management, profile commands, new
harnesses).

---

## Conversion Mapping

| Claude Code Feature | Copilot / VS Code Equivalent | Status |
|---------------------|------------------------------|--------|
| `SKILL.md` | `.github/copilot-instructions.md` | Done |
| `/babysitter:call` | `@babysitter` chat participant | Done |
| SessionStart hook | `extension.activate()` | Already existed |
| SessionEnd hook | `extension.deactivate()` | Already existed |
| Process definitions | `.a5c/processes/*.js` | Universal — unchanged |
| Event journal | `.a5c/runs/*/journal/` | Universal — unchanged |
| Runs TreeView | `chatSessionsProvider` sessions panel (1.111) | Done |
| Auto-approve toggle | VS Code native `/autoApprove`, `/yolo` | Delegated |

---

## How to Use

### Install the VS Code extension

```bash
cd packages/vscode-extension
npm install && npm run build && npm run package
code --install-extension babysitter-vscode-0.0.180.vsix
```

Restart VS Code. `@babysitter` is now available in Copilot Chat.

### Use SDK CLI directly (no extension needed)

```bash
npm install -g @a5c-ai/babysitter-sdk

babysitter run:create \
  --process-id tdd-quality-convergence \
  --entry .a5c/processes/tdd.js#process \
  --inputs inputs.json

babysitter run:iterate .a5c/runs/<runId>
babysitter run:status .a5c/runs/<runId>
```

---

## What Is Different from Claude Code

| Feature | Claude Code | GitHub Copilot |
|---------|-------------|----------------|
| Skill invocation | `/babysitter:call` | `@babysitter` or Command Palette |
| Instructions file | `CLAUDE.md`, `SKILL.md` | `.github/copilot-instructions.md` |
| Plugin system | Claude plugins | VS Code extensions |
| Session hooks | Shell scripts | Extension lifecycle |
| Natural language | Slash commands | Chat participants |

### Features delegated to VS Code 1.110+

- Auto-approval: use native `/autoApprove` and `/yolo` slash commands
- Run session UI: native Chat Sessions panel via `chatSessionsProvider` (1.111)

### What stayed the same

- SDK/CLI commands (identical)
- Process definitions (`.js` files)
- Journal event format
- Run directory structure (`.a5c/runs/`)
- Breakpoints service

---

## VS Code API Versions

| Feature | Min Version | API |
|---------|-------------|-----|
| `@babysitter` chat participant | 1.90.0 | Stable |
| Background agent steering | 1.110 | Stable |
| Auto Approval slash commands | 1.110 | Stable |
| OS notifications for confirmations | 1.110 | Stable |
| `chatSessionsProvider` (run surfacing) | 1.111 | Proposed (`enabledApiProposals`) |
| `/fork` session support | 1.110 | Stable |
| `/compact` support | 1.110 | Stable |

---

## Troubleshooting

**`@babysitter` not found**
```bash
cd packages/vscode-extension
npm run build && npm run package
code --install-extension babysitter-vscode-0.0.180.vsix
# Restart VS Code
```

**Chat Sessions panel shows no runs**
- Requires VS Code 1.111+ for `chatSessionsProvider` API
- Check `babysitter.runsRoot` setting points to `.a5c/runs`

**SDK commands not found**
```bash
npm install -g @a5c-ai/babysitter-sdk
# or
npx @a5c-ai/babysitter-sdk --version
```
