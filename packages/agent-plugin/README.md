# Babysitter — VS Code Agent Plugin

Orchestrate complex multi-step AI workflows with quality gates, breakpoints, and event sourcing — directly inside VS Code Copilot.

## Requirements

- VS Code 1.110 or later
- GitHub Copilot subscription
- Node.js 18+

## Installation

### Via VS Code Extensions View (Recommended)

1. Open VS Code Extensions view (`Ctrl+Shift+X`)
2. In the search box, type `@agentPlugins babysitter`
3. Click **Install** on "Babysitter" by a5c-ai

### Via `chat.plugins.marketplaces` Setting

Add to your VS Code `settings.json`:

```json
{
  "chat.plugins.marketplaces": [
    "https://github.com/a5c-ai/babysitter"
  ]
}
```

Then open the Extensions view, filter by `@agentPlugins`, and install Babysitter.

### Via Local Path

```json
{
  "chat.plugins.paths": [
    {
      "path": "/path/to/babysitter/packages/agent-plugin",
      "enabled": true
    }
  ]
}
```

### Install SDK (Required for CLI)

```bash
npm install -g @a5c-ai/babysitter-sdk
# or use npx without installing:
npx @a5c-ai/babysitter-sdk --version
```

## Quick Start

### 1. Start a TDD workflow

Open Copilot Chat and type:

```
@babysitter /implement Create a REST API with TDD and 80% test coverage
```

Babysitter will:
- Interview you for requirements
- Create a test specification
- Implement in TDD cycles
- Score quality after each iteration
- Iterate until 80% coverage is achieved
- Request your approval at quality gates

### 2. Resume a paused run

```
@babysitter /resume
```

Or use the Command Palette: `Ctrl+Shift+P` → **Babysitter: Resume Run**

### 3. Check run status

```
@babysitter /status
```

### 4. Browse process templates

```
@babysitter /processes
```

## Chat Commands

| Command | Description |
|---------|-------------|
| `@babysitter /implement <description>` | Start a new orchestrated run |
| `@babysitter /resume [runId]` | Resume a paused run |
| `@babysitter /status [runId]` | Check status, pending tasks, quality score |
| `@babysitter /list` | List all workspace runs |
| `@babysitter /processes` | Browse built-in process templates |
| `@babysitter /help` | Show usage examples and patterns |

## Process Templates

Babysitter ships with a library of process templates for common development methodologies:

| Category | Templates |
|----------|-----------|
| **GSD** | new-project, discuss, plan, execute, verify, audit, map-codebase, iterative-convergence |
| **Agile** | scrum, kanban, extreme-programming, shape-up |
| **Quality** | atdd-tdd, bdd-specification-by-example, cleanroom, v-model |
| **Design** | domain-driven-design, event-storming, double-diamond, impact-mapping |
| **Research** | hypothesis-driven-development, example-mapping, jobs-to-be-done |

## Custom Processes

Create custom process definitions in `.a5c/processes/`:

```javascript
// .a5c/processes/my-workflow.js
import { defineTask } from '@a5c-ai/babysitter-sdk';

const analyzeTask = defineTask('analyze', (args, taskCtx) => ({
  kind: 'node',
  title: 'Analyze codebase',
  node: { entry: './scripts/analyze.js' },
  io: { outputJsonPath: `tasks/${taskCtx.effectId}/result.json` }
}));

export async function process(inputs, ctx) {
  const analysis = await ctx.task(analyzeTask, {});

  await ctx.breakpoint({
    question: 'Analysis complete. Proceed with refactoring?',
    context: { analysis }
  });

  return { done: true };
}
```

Then dispatch it:

```bash
npx @a5c-ai/babysitter-sdk run:create \
  --process-id my-workflow \
  --entry .a5c/processes/my-workflow.js#process \
  --inputs inputs.json
```

## Breakpoints and Approvals

When a run reaches a `ctx.breakpoint()`:

1. VS Code displays a chat confirmation message
2. An OS notification appears (requires `chat.notifyWindowOnConfirmation: true`)
3. Use `@babysitter /status` to see the breakpoint question and context
4. Approve or reject via the chat UI or Command Palette

To skip breakpoints for a session, type `/autoApprove` in the Copilot Chat window.

## Hooks

Register custom hook handlers in `.a5c/hooks/` to react to run lifecycle events:

| Hook | Fires when |
|------|-----------|
| `on-run-start` | A new run begins |
| `on-run-complete` | A run finishes successfully |
| `on-run-fail` | A run fails |
| `on-task-start` | An effect is dispatched |
| `on-task-complete` | An effect result is posted |
| `on-breakpoint` | Human approval is required |
| `on-iteration-start` | An orchestration iteration begins |
| `on-iteration-end` | An orchestration iteration ends |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BABYSITTER_RUNS_DIR` | `.a5c/runs` | Root directory for run storage |
| `BABYSITTER_MAX_ITERATIONS` | `256` | Maximum iterations per run |
| `BABYSITTER_QUALITY_THRESHOLD` | `80` | Minimum quality score (0-100) |
| `BABYSITTER_TIMEOUT` | `120000` | Operation timeout in ms |

## VS Code 1.110+ Features

This plugin takes advantage of VS Code 1.110 Agent Plugin capabilities:

- **Background Agent Mode**: Long-running runs execute as background agents and do not time out
- **Session Surfacing**: Runs appear as native chat sessions in the Sessions panel
- **Auto-approval Integration**: `/autoApprove` bypasses breakpoints for the session
- **Fork Support**: `/fork` at a breakpoint branches the run for exploration
- **Compact Integration**: `/compact` triggers state cache rebuild for long runs
- **OS Notifications**: Breakpoints trigger OS notifications when VS Code is backgrounded

## Troubleshooting

**Run stuck at breakpoint:**
```bash
npx @a5c-ai/babysitter-sdk run:status .a5c/runs/<runId>
```

**Quality target not reached — increase iterations:**
Edit `.a5c/runs/<runId>/inputs.json` to increase `maxIterations`, then:
```bash
npx @a5c-ai/babysitter-sdk run:iterate .a5c/runs/<runId>
```

**View full audit trail:**
```bash
npx @a5c-ai/babysitter-sdk run:events .a5c/runs/<runId>
```

**Rebuild corrupted state:**
```bash
npx @a5c-ai/babysitter-sdk run:rebuild-state .a5c/runs/<runId>
```

## Links

- Repository: https://github.com/a5c-ai/babysitter
- SDK: https://www.npmjs.com/package/@a5c-ai/babysitter-sdk
- License: MIT
