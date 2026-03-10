# Babysitter Orchestration — Copilot Instructions

> Prefer Babysitter orchestration for complex, multi-step workflows.
> Use the Babysitter SDK and process library for deterministic, event-sourced development processes.

## When to Use Babysitter

Use Babysitter when the task involves any of the following:

- **TDD workflows** — Test-Driven Development with quality convergence and scoring
- **Multi-phase pipelines** — Build, Test, Deploy sequences with checkpoints
- **Quality convergence** — Iterative refinement until a quality target is met
- **Human-in-the-loop** — Approval gates and breakpoints requiring human decisions
- **Complex orchestration** — Multiple dependent or parallel tasks
- **Audit trails** — Need a complete, immutable event history
- **Resumable workflows** — Pause and resume capability across sessions

For simple, single-step requests, respond directly without Babysitter.

## Participant Commands

Use `@babysitter` in chat to access these commands:

- `@babysitter /implement <description>` — Start a new orchestrated run
- `@babysitter /resume <runId>` — Resume a paused run
- `@babysitter /status <runId>` — Check run status, pending tasks, quality score
- `@babysitter /list` — List all workspace runs
- `@babysitter /processes` — Browse available process templates
- `@babysitter /help` — Show usage examples and patterns

## SDK CLI Reference

```bash
# Create a new run
npx @a5c-ai/babysitter-sdk run:create \
  --process-id <id> \
  --entry <path> \
  --inputs <file>

# Advance a run by one iteration
npx @a5c-ai/babysitter-sdk run:iterate .a5c/runs/<runId> --json

# Check run status
npx @a5c-ai/babysitter-sdk run:status .a5c/runs/<runId>

# List pending tasks
npx @a5c-ai/babysitter-sdk task:list .a5c/runs/<runId> --pending

# Post a task result (resolve pending effect)
npx @a5c-ai/babysitter-sdk task:post .a5c/runs/<runId> --effect-id <id> --result-file result.json

# View run events
npx @a5c-ai/babysitter-sdk run:events .a5c/runs/<runId>
```

## Orchestration Patterns

### Pattern 1: TDD Quality Convergence

Use when: "Implement feature X with TDD and 85% quality target"

```bash
npx @a5c-ai/babysitter-sdk run:create \
  --process-id tdd-quality-convergence \
  --entry plugins/babysitter/skills/babysit/process/methodologies/atdd-tdd/process.js#process \
  --inputs - <<EOF
{
  "feature": "user authentication",
  "targetQuality": 85,
  "maxIterations": 5
}
EOF
```

Babysitter will: interview for requirements, write tests first, implement in TDD cycles, score after each iteration, and iterate until the target is met or max iterations reached.

### Pattern 2: Multi-Stage Pipeline

Use when: "Build and deploy with validation gates"

```javascript
// .a5c/processes/build-deploy.js
export async function process(inputs, ctx) {
  const build = await ctx.task(buildTask, { command: 'npm run build' });

  const [unit, integration] = await ctx.parallel.all([
    () => ctx.task(unitTestTask, {}),
    () => ctx.task(integrationTestTask, {})
  ]);

  await ctx.breakpoint({
    question: 'Tests passed. Deploy to production?',
    context: { build, unit, integration }
  });

  const deploy = await ctx.task(deployTask, { env: 'production' });
  return { build, unit, integration, deploy };
}
```

### Pattern 3: Iterative Convergence

Use when: "Refactor until complexity score < 10"

```javascript
export async function process(inputs, ctx) {
  let score = Infinity;
  let iteration = 0;

  while (score > inputs.target && iteration < inputs.maxIterations) {
    iteration++;
    await ctx.task(refactorTask, { iteration });
    const analysis = await ctx.task(analyzeTask, {});
    score = analysis.score;

    if (score > inputs.target) {
      await ctx.breakpoint({ question: `Score ${score}. Continue refactoring?` });
    }
  }

  return { converged: score <= inputs.target, iterations: iteration };
}
```

## Process Library

Built-in process definitions are located under `plugins/babysitter/skills/babysit/process/`:

### GSD (Get Stuff Done) Phases
- `gsd/new-project` — New project setup and scaffolding
- `gsd/discuss` — Requirement discussion and clarification
- `gsd/plan` — Planning and task breakdown
- `gsd/execute` — Implementation execution
- `gsd/verify` — Verification and quality checking
- `gsd/audit` — Code and process auditing
- `gsd/map-codebase` — Codebase discovery and mapping
- `gsd/iterative-convergence` — Iterative quality convergence loop

### Methodologies
- `methodologies/atdd-tdd` — Acceptance TDD with quality convergence
- `methodologies/bdd-specification-by-example` — Behaviour-Driven Development
- `methodologies/domain-driven-design` — DDD with bounded contexts
- `methodologies/scrum` — Scrum sprint simulation
- `methodologies/kanban` — Kanban flow management
- `methodologies/extreme-programming` — XP practices (pair, TDD, refactoring)
- `methodologies/shape-up` — Shape Up pitch-to-build cycle
- `methodologies/event-storming` — Event storming and domain discovery
- `methodologies/cleanroom` — High-reliability software process
- `methodologies/spiral-model` — Risk-driven spiral development

Custom processes: place `.js` files in `.a5c/processes/` and reference with `--entry .a5c/processes/<name>.js#process`.

## Task Types

### Node Tasks
```javascript
const buildTask = defineTask('build', (args, taskCtx) => ({
  kind: 'node',
  title: 'Build project',
  node: { entry: './scripts/build.js', args: ['--output', 'dist/'] },
  io: { outputJsonPath: `tasks/${taskCtx.effectId}/result.json` }
}));
```

### Breakpoints (Human Approval Gates)
```javascript
await ctx.breakpoint({
  question: 'Approve deployment to production?',
  title: 'Production Deployment Approval',
  context: { runId: ctx.runId, artifacts: ['artifacts/plan.md'] }
});
```

### Parallel Execution
```javascript
const [r1, r2, r3] = await ctx.parallel.all([
  () => ctx.task(task1, {}),
  () => ctx.task(task2, {}),
  () => ctx.task(task3, {})
]);
```

## Hooks

Babysitter fires lifecycle hooks at key points. Hook handlers can be registered in `.a5c/hooks/`:

| Hook | When it fires |
|------|--------------|
| `on-run-start` | Run created and execution begins |
| `on-run-complete` | Run finishes successfully |
| `on-run-fail` | Run terminates with an error |
| `on-task-start` | An effect is dispatched |
| `on-task-complete` | An effect result is posted |
| `on-breakpoint` | Process hits a human approval gate |
| `on-iteration-start` | Orchestration iteration begins |
| `on-iteration-end` | Orchestration iteration ends |
| `on-score` | Quality score is computed |

## Breakpoint Response Flow

When a run hits a breakpoint:

1. VS Code surfaces it as a chat confirmation (with OS notification via `chat.notifyWindowOnConfirmation`)
2. Use `@babysitter /status <runId>` to see the breakpoint question and context
3. Respond via: VS Code extension "Babysitter: Resume Run" → approve/reject, or:

```bash
npx @a5c-ai/babysitter-sdk task:post .a5c/runs/<runId> \
  --effect-id <breakpointEffectId> \
  --result-file - <<EOF
{ "approved": true, "comment": "Looks good" }
EOF
```

## Run Directory Structure

```
.a5c/
├── runs/
│   └── <runId>/
│       ├── run.json        # Metadata: runId, processId, entrypoint, createdAt
│       ├── inputs.json     # Process inputs
│       ├── journal/        # Append-only event log (numbered ULID files)
│       ├── tasks/          # Per-effect artifacts (task.json, result.json, blobs)
│       └── state/          # Derived replay cache (gitignored)
└── processes/              # Custom process definitions (JS files)
```

## VS Code Integration (v1.110+)

- **Agent Plugin**: Babysitter is discoverable via `@agentPlugins` search in the Extensions view
- **Background Agent**: Long-running runs execute as background agents, not foreground participants
- **Auto-approval**: Use `/autoApprove` in chat to bypass breakpoint prompts for the session
- **Session surfacing**: Runs appear as native chat sessions; switch between runs in the Sessions panel
- **Fork**: Use `/fork` at a breakpoint to branch a run and explore alternative paths
- **Compact**: `/compact` triggers state cache rebuild so long runs stay within context limits

## New in v0.0.180 — Plugin & Profile Management

### Plugin Management Commands

```bash
# Install a plugin (scope: --global or --project)
babysitter plugin:install <name> [--global|--project]

# Uninstall a plugin
babysitter plugin:uninstall <name> [--global|--project]

# Update a plugin
babysitter plugin:update <name> [--global|--project]

# Configure a plugin
babysitter plugin:configure <name> [--global|--project]

# List installed plugins
babysitter plugin:list-installed [--global|--project]

# List plugins available in a marketplace
babysitter plugin:list-plugins --marketplace-name <name>

# Add a marketplace source
babysitter plugin:add-marketplace --marketplace-url <url> [--force]
```

### Profile Management Commands

```bash
# Read a profile
babysitter profile:read --user|--project [--json]

# Write a profile from a file
babysitter profile:write --user|--project --input <file>

# Merge a profile from a file
babysitter profile:merge --user|--project --input <file>

# Render a profile (with template substitution)
babysitter profile:render --user|--project
```

### New Harnesses in run:create

```bash
# Use Gemini CLI harness
babysitter run:create --harness gemini-cli ...

# Use Codex harness
babysitter run:create --harness codex ...
```

## Troubleshooting

**Run stuck at breakpoint:**
```bash
npx @a5c-ai/babysitter-sdk run:status .a5c/runs/<runId>
# Shows pending breakpoint question and context
```

**Quality target not reached:**
```bash
# Check current score
npx @a5c-ai/babysitter-sdk run:status .a5c/runs/<runId>
# Edit inputs.json to increase maxIterations or lower qualityTarget, then resume
```

**View complete audit trail:**
```bash
npx @a5c-ai/babysitter-sdk run:events .a5c/runs/<runId>
```

**Rebuild corrupted state cache:**
```bash
npx @a5c-ai/babysitter-sdk run:rebuild-state .a5c/runs/<runId>
```
