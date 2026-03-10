# Babysitter – VS Code Copilot Integration

Adds `@babysitter` as a Copilot Chat participant and integrates babysitter runs
into the VS Code Chat Sessions panel.

## Requirements

- VS Code 1.111+
- GitHub Copilot extension
- Node.js 20+

## Installation

### Build and install the VSIX

```bash
# From the repo root
cd packages/vscode-extension
npm install
npm run build
npm run package
code --install-extension babysitter-vscode-0.0.180.vsix
```

Restart VS Code. The `@babysitter` participant will appear in Copilot Chat.

### Diagnostic script

The setup scripts verify that the prerequisites are in place and print the
correct build steps if anything is missing:

**Windows (PowerShell):**
```powershell
.\setup-copilot.ps1
```

**Mac/Linux:**
```bash
chmod +x setup-copilot.sh && ./setup-copilot.sh
```

## Usage

### Copilot Chat

```
@babysitter implement user authentication with TDD and 85% quality target
@babysitter resume
@babysitter status
@babysitter list
```

### Command Palette

```
Ctrl+Shift+P → Babysitter: Dispatch Run
Ctrl+Shift+P → Babysitter: Resume Run
Ctrl+Shift+P → Babysitter: Open Run Details
```

### Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Dispatch run | Ctrl+Alt+B N |
| Resume run | Ctrl+Alt+B R |
| Open run details | Ctrl+Alt+B D |
| Open run logs | Ctrl+Alt+B L |
| Refresh runs | Ctrl+Alt+B Shift+R |

### SDK CLI (no extension required)

```bash
npm install -g @a5c-ai/babysitter-sdk

babysitter run:create \
  --process-id tdd-quality-convergence \
  --entry .a5c/processes/tdd.js#process \
  --inputs inputs.json

babysitter run:iterate .a5c/runs/<runId>
babysitter run:status .a5c/runs/<runId>
```

## How it works

```
Copilot Chat (@babysitter participant)
        |
        v
packages/vscode-extension/src/copilot/participant.ts
        |
        v
BabysitterBackgroundAgent  (run:iterate loop, breakpoint detection)
BabysitterSessionController (VS Code Chat Sessions panel via chatSessionsProvider API)
BabysitterBreakpointNotifier (surfaces pending breakpoints as notifications)
        |
        v
Babysitter SDK  (.a5c/runs/ — event-sourced, resumable)
```

The `.github/copilot-instructions.md` file is read automatically by GitHub
Copilot and teaches it babysitter orchestration patterns without the extension.

## Documentation

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Copilot context — orchestration patterns and SDK reference |
| `docs/copilot-participant.md` | `@babysitter` commands reference |
| `COPILOT_CONVERSION.md` | Implementation notes and conversion guide |

## Troubleshooting

**`@babysitter` not found in Copilot Chat**
- Rebuild and reinstall the VSIX, then restart VS Code.
- Confirm the extension is listed under installed extensions.

**SDK commands not found**
- `npm install -g @a5c-ai/babysitter-sdk` or use `npx @a5c-ai/babysitter-sdk`.

**Chat Sessions panel shows no runs**
- Confirm VS Code 1.111+ is installed (required for `chatSessionsProvider` API).
- Check `babysitter.runsRoot` in settings points to your `.a5c/runs` directory.
