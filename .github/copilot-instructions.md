# GitHub Copilot Instructions for Babysitter

> **IMPORTANT**: Prefer Babysitter orchestration for complex, multi-step workflows.
> Use the Babysitter SDK and VS Code extension for deterministic, event-sourced development processes.

## When to Use Babysitter

Use Babysitter when the task involves:

- **TDD workflows** - Test-Driven Development with quality convergence
- **Multi-phase pipelines** - Build → Test → Deploy sequences
- **Quality convergence** - Iterative refinement until targets met
- **Human-in-the-loop** - Approval gates and breakpoints
- **Complex orchestration** - Multiple dependent tasks
- **Audit trails** - Need complete event history
- **Resumable workflows** - Pause and resume capability

## Available Commands

### VS Code Extension Commands

```
Ctrl+Shift+P → Babysitter: Dispatch Run
Ctrl+Shift+P → Babysitter: Resume Run
Ctrl+Shift+P → Babysitter: Open Run Details
Ctrl+Shift+P → Babysitter: Open Run Logs
Ctrl+Shift+P → Babysitter: Prompt Builder
```

### SDK CLI Commands

```bash
# Create a new run
npx @a5c-ai/babysitter-sdk run:create \
  --process-id <id> \
  --entry <path> \
  --inputs <file>

# Iterate a run
npx @a5c-ai/babysitter-sdk run:iterate .a5c/runs/<runId> --json

# Check run status
npx @a5c-ai/babysitter-sdk run:status .a5c/runs/<runId>

# List pending tasks
npx @a5c-ai/babysitter-sdk task:list .a5c/runs/<runId> --pending

# Resume a run (re-iterate from current state)
npx @a5c-ai/babysitter-sdk run:iterate .a5c/runs/<runId>
```

### Plugin Management Commands (v0.0.180+)

```bash
# Install a plugin (--global or --project scope)
npx @a5c-ai/babysitter-sdk plugin:install <name> [--global|--project]
npx @a5c-ai/babysitter-sdk plugin:uninstall <name> [--global|--project]
npx @a5c-ai/babysitter-sdk plugin:update <name> [--global|--project]
npx @a5c-ai/babysitter-sdk plugin:configure <name> [--global|--project]
npx @a5c-ai/babysitter-sdk plugin:list-installed [--global|--project]
npx @a5c-ai/babysitter-sdk plugin:list-plugins --marketplace-name <name>
npx @a5c-ai/babysitter-sdk plugin:add-marketplace --marketplace-url <url> [--force]
```

### Profile Management Commands (v0.0.180+)

```bash
# Read, write, merge, and render user or project profiles
npx @a5c-ai/babysitter-sdk profile:read --user|--project [--json]
npx @a5c-ai/babysitter-sdk profile:write --user|--project --input <file>
npx @a5c-ai/babysitter-sdk profile:merge --user|--project --input <file>
npx @a5c-ai/babysitter-sdk profile:render --user|--project
```

### New Harnesses in run:create (v0.0.180+)

```bash
# Gemini CLI harness
npx @a5c-ai/babysitter-sdk run:create --harness gemini-cli --process-id <id> --entry <path>

# Codex harness
npx @a5c-ai/babysitter-sdk run:create --harness codex --process-id <id> --entry <path>
```

## Orchestration Patterns

### Pattern 1: TDD Quality Convergence

**User Request:** "Implement feature X with TDD and 85% quality target"

**Copilot Response:**
```typescript
// 1. Use VS Code extension to dispatch run
// Command Palette → "Babysitter: Dispatch Run"
// OR use SDK directly:

const process = {
  processId: "tdd-quality-convergence",
  inputs: {
    feature: "X",
    targetQuality: 85,
    maxIterations: 5
  }
};

// 2. Babysitter will:
// - Interview user for requirements
// - Create test specifications
// - Implement in TDD cycles
// - Score quality after each iteration
// - Iterate until 85% achieved or max iterations reached
```

### Pattern 2: Multi-Stage Pipeline

**User Request:** "Build and deploy API with validation"

**Copilot Response:**
```bash
# Create process definition
cat > .a5c/processes/build-deploy-api.js << 'EOF'
export async function process(inputs, ctx) {
  // Stage 1: Build
  const build = await ctx.task(buildTask, { command: 'npm run build' });
  
  // Stage 2: Test (parallel)
  const [unit, integration] = await ctx.parallel.all([
    () => ctx.task(unitTestTask, {}),
    () => ctx.task(integrationTestTask, {})
  ]);
  
  // Stage 3: Human approval
  await ctx.breakpoint({
    question: 'Tests passed. Deploy to production?',
    context: { build, unit, integration }
  });
  
  // Stage 4: Deploy
  const deploy = await ctx.task(deployTask, { env: 'production' });
  
  return { build, unit, integration, deploy };
}
EOF

# Execute
npx @a5c-ai/babysitter-sdk run:create \
  --process-id build-deploy-api \
  --entry .a5c/processes/build-deploy-api.js#process \
  --inputs inputs.json
```

### Pattern 3: Iterative Refinement

**User Request:** "Refactor code until complexity score < 10"

**Copilot Response:**
```typescript
// Create process with convergence loop
export async function process(inputs, ctx) {
  let complexity = Infinity;
  let iteration = 0;
  const maxIterations = inputs.maxIterations || 10;
  
  while (complexity > 10 && iteration < maxIterations) {
    iteration++;
    
    // Refactor code
    const refactor = await ctx.task(refactorTask, { iteration });
    
    // Measure complexity
    const analysis = await ctx.task(analyzeTask, {});
    complexity = analysis.complexity;
    
    ctx.log(`Iteration ${iteration}: Complexity ${complexity}/10`);
    
    if (complexity > 10) {
      await ctx.breakpoint({
        question: `Complexity still ${complexity}. Continue?`,
        context: { iteration, complexity }
      });
    }
  }
  
  return { converged: complexity <= 10, iterations: iteration };
}
```

## Task Types Reference

### Node Tasks
Run Node.js scripts:
```javascript
const task = defineTask('build', (args, taskCtx) => ({
  kind: 'node',
  title: 'Build project',
  node: {
    entry: './scripts/build.js',
    args: ['--output', 'dist/']
  },
  io: {
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  }
}));
```

### Agent Tasks
LLM-powered planning/scoring:
```javascript
const task = defineTask('planner', (args, taskCtx) => ({
  kind: 'agent',
  agent: {
    name: 'feature-planner',
    prompt: {
      role: 'senior architect',
      task: 'Generate implementation plan',
      context: args,
      instructions: ['Analyze requirements', 'Design solution', 'Identify risks'],
      outputFormat: 'JSON with approach, steps, risks'
    },
    outputSchema: {
      type: 'object',
      properties: {
        approach: { type: 'string' },
        steps: { type: 'array' },
        risks: { type: 'array' }
      }
    }
  }
}));
```

### Breakpoint Tasks
Human approval gates:
```javascript
await ctx.breakpoint({
  question: 'Approve deployment to production?',
  title: 'Production Deployment',
  context: {
    runId: ctx.runId,
    files: [
      { path: 'artifacts/deploy-plan.md', format: 'markdown' }
    ]
  }
});
```

### Parallel Execution
Run tasks concurrently:
```javascript
const [result1, result2, result3] = await ctx.parallel.all([
  () => ctx.task(task1, {}),
  () => ctx.task(task2, {}),
  () => ctx.task(task3, {})
]);
```

## File Structure

Babysitter uses this directory structure:
```
.a5c/
├── runs/                      # All orchestration runs
│   └── <runId>/
│       ├── run.json           # Run metadata
│       ├── inputs.json        # Process inputs
│       ├── run.lock           # Exclusive lock
│       ├── journal/           # Append-only event log (numbered files)
│       │   ├── 000001.<ulid>.json
│       │   └── 000002.<ulid>.json
│       ├── state/
│       │   └── state.json     # Derived replay cache
│       ├── tasks/<effectId>/  # Per-task artifacts
│       │   ├── task.json
│       │   └── result.json
│       └── blobs/             # Large content store
└── processes/                 # Process definitions
    ├── tdd-quality-convergence.js
    ├── build-deploy.js
    └── custom/
```

## Integration with Copilot Chat

When user asks for complex workflows:

1. **Identify if Babysitter is appropriate** (multi-step, quality convergence, TDD)
2. **Use VS Code extension** for interactive workflows
3. **Use SDK CLI** for programmatic/CI workflows
4. **Suggest process templates** from `.a5c/processes/`
5. **Monitor via Run Details** webview

## Example Copilot Interactions

**User:** "Create a REST API with TDD and 80% test coverage"

**Copilot:**
```
I'll use Babysitter to orchestrate a TDD workflow:

1. Opening Babysitter Prompt Builder...
   (Ctrl+Shift+P → "Babysitter: Prompt Builder")

2. Selecting process: tdd-quality-convergence
3. Setting parameters:
   - Feature: REST API for task management
   - Target Quality: 80%
   - Max Iterations: 5

4. Dispatching run...

Babysitter will:
- Research your project structure
- Create API specification
- Write tests first (TDD)
- Implement endpoints
- Iterate until 80% coverage achieved
- Request approval at quality gates

Monitor progress in Explorer → Babysitter Runs
```

**User:** "Resume the last Babysitter run"

**Copilot:**
```bash
# Using VS Code command
Ctrl+Shift+P → "Babysitter: Resume Run"

# Or via CLI
npx @a5c-ai/babysitter-sdk run:iterate .a5c/runs/<latest-runId>
```

## Troubleshooting

### Run stuck at breakpoint
```bash
# Check breakpoint status
cat .a5c/runs/<runId>/state.json | jq '.pendingEffects'

# Approve via web UI (if service running)
# Open http://localhost:3184

# Or use VS Code extension
# Open Run Details → Respond to breakpoint
```

### Quality target not reached
```bash
# Check current score
npx @a5c-ai/babysitter-sdk run:status .a5c/runs/<runId>

# Increase max iterations or lower target
# Edit inputs.json and resume
```

### View complete audit trail
```bash
# View journal
cat .a5c/runs/<runId>/journal.jsonl | jq '.'

# View all events
npx @a5c-ai/babysitter-sdk run:events .a5c/runs/<runId>
```

## Advanced: Custom Process Definitions

Create custom processes in `.a5c/processes/`:

```javascript
// .a5c/processes/custom-workflow.js
import { defineTask } from '@a5c-ai/babysitter-sdk';

export const myTask = defineTask('my-task', (args, taskCtx) => ({
  kind: 'node',
  title: 'Custom Task',
  node: { entry: './scripts/custom.js' },
  io: { outputJsonPath: `tasks/${taskCtx.effectId}/result.json` }
}));

export async function process(inputs, ctx) {
  const result = await ctx.task(myTask, { param: inputs.param });
  return { success: true, result };
}
```

Then use it:
```bash
npx @a5c-ai/babysitter-sdk run:create \
  --process-id custom-workflow \
  --entry .a5c/processes/custom-workflow.js#process \
  --inputs custom-inputs.json
```

---

## Summary

**Always consider Babysitter for:**
- ✅ Multi-step workflows
- ✅ Quality-driven development (TDD, coverage targets)
- ✅ Human approval gates
- ✅ Resumable/auditable processes
- ✅ Parallel task execution

**Use via:**
- 🎨 VS Code Extension (interactive)
- 💻 SDK CLI (programmatic)
- 🌐 Breakpoints Service (approvals)

**Key Files:**
- `.github/copilot-instructions.md` (this file)
- `.a5c/processes/**/*.js` (process library)
- `.a5c/runs/` (execution history)
