# Babysitter Chat Participant (`@babysitter`)

The `@babysitter` chat participant is included in the Babysitter VS Code extension and
integrates with GitHub Copilot Chat.

## Installation

```bash
cd packages/vscode-extension
npm install && npm run build && npm run package
code --install-extension babysitter-vscode-0.0.180.vsix
# Restart VS Code
```

## Commands

| Command | Description |
|---------|-------------|
| `@babysitter <request>` | Start a new run |
| `@babysitter resume` | Resume the last run |
| `@babysitter resume <runId>` | Resume a specific run |
| `@babysitter status` | Show last run status |
| `@babysitter status <runId>` | Show specific run status |
| `@babysitter list` | List all runs |
| `@babysitter processes` | List available processes |
| `@babysitter help` | Show help |

## Usage Examples

**Start a TDD workflow:**
```
@babysitter implement user authentication with TDD and 85% quality target
```

**Multi-stage pipeline:**
```
@babysitter build, test, and deploy the API with approval gates
```

**Custom process with inputs:**
```
@babysitter use process tdd-quality-convergence with inputs: {"feature": "payment gateway", "targetQuality": 85}
```

**Resume after a breakpoint:**
```
@babysitter resume
```

## How it works

The participant delegates to VS Code extension commands:

- `@babysitter <request>` → `babysitter.dispatchRun`
- `@babysitter resume` → `babysitter.resumeRun`
- `@babysitter status` → opens Run Details webview
- `@babysitter list` → shows runs in the Chat Sessions panel

Source: `packages/vscode-extension/src/copilot/participant.ts`

## VS Code Extension Settings

```json
{
  "babysitter.sdk.binaryPath": "",
  "babysitter.runsRoot": "",
  "babysitter.breakpoints.apiUrl": "http://localhost:3185",
  "babysitter.breakpoints.enabled": true
}
```

## SDK CLI (no extension required)

```bash
# Create a run
babysitter run:create \
  --process-id tdd-quality-convergence \
  --entry .a5c/processes/tdd.js#process \
  --inputs inputs.json

# Iterate
babysitter run:iterate .a5c/runs/<runId>

# Check status
babysitter run:status .a5c/runs/<runId>

# List tasks
babysitter task:list .a5c/runs/<runId> --pending
```

## Troubleshooting

**`@babysitter` not found in Copilot Chat**
- Rebuild and reinstall the VSIX, then restart VS Code
- Confirm the extension appears in the Installed Extensions list

**SDK not found**
- `npm install -g @a5c-ai/babysitter-sdk` or use `npx @a5c-ai/babysitter-sdk`

**No runs found on resume**
- Runs are stored in `.a5c/runs/` in the workspace root
- Check `babysitter.runsRoot` setting if using a non-default location
