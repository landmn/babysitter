# VS Code Copilot Integration — API Research and Implementation Status

Covers VS Code 1.110 (February 2026) and 1.111 (March 2026) features relevant to the
Babysitter Copilot integration. Updated as APIs stabilize and features are implemented.

## Executive Summary

VS Code 1.110–1.111 introduced significant improvements to the agent/chat ecosystem that
directly benefit the babysitter-to-Copilot integration. The releases focus heavily on
**agent extensibility**, **session management**, **auto-approval workflows**, and **plugin
packaging** — all of which map cleanly onto babysitter's existing orchestration model.

The highest-impact features are:
1. **Agent Plugins (Experimental)** — babysitter can be packaged as a prebuilt agent plugin with its MCP servers, hooks, and agents bundled together.
2. **Chat Session Item Controller API (Proposed)** — enables babysitter's run lifecycle to surface as first-class chat sessions in the VS Code sessions view.
3. **Auto Approval Slash Commands** — `/autoApprove`/`/yolo` directly replace babysitter's breakpoint auto-approval concept.
4. **Create Customizations from Chat** — `/create-skill`, `/create-agent`, `/create-hook` commands align with babysitter's process definition model.
5. **OS Notifications for Confirmations** — enables breakpoint notifications even when VS Code is not focused.

**Conversion status before this release:** ~70% complete (participant.ts exists, SDK works, extension lifecycle wired).
**Conversion status with v1.110 features applied:** Can reach ~90%+ with the new APIs.

---

## Feature-by-Feature Analysis

### 1. Agent Plugins (Experimental)

**What it is:** A new packaging format for "prepackaged bundles of chat customizations" that can contain skills, commands, agents, MCP servers, and hooks. Installable via the Extensions view with `@agentPlugins` filter or via `Chat: Plugins` command.

**Configuration settings:**
- `chat.plugins.enabled` — toggles plugin support
- `chat.plugins.marketplaces` — points to GitHub/git repositories or Claude-style marketplaces (e.g., `anthropics/claude-code`)
- `chat.plugins.paths` — registers local plugin directories with enable/disable toggles

**Relevance to conversion:** HIGH

**Impact:** Babysitter can be packaged as an Agent Plugin rather than a full VS Code extension. This is a more lightweight distribution channel. The `chat.plugins.marketplaces` setting can reference the babysitter repository directly, making installation trivial. This also aligns with how Claude Code's skill marketplace (`plugins/babysitter/`) currently works — the same manifest structure could potentially be reused.

**Conversion use case:**
- Package `.a5c/processes/`, `.a5c/hooks/`, and skill definitions as an Agent Plugin
- Users install with `@agentPlugins` search instead of VSIX install
- The existing Claude Code plugin format (`plugins/babysitter/`) may map directly to the Agent Plugin format since it explicitly supports `anthropics/claude-code`-style marketplaces

---

### 2. Chat Session Item Controller API (Proposed)

**What it is:** A proposed API that lets extensions contribute items to VS Code's built-in chat sessions view. New additions in v1.110:
- `ChatSessionsProvider / ChatSessionItemControllerNewItemHandler` — controllers can specify the URI for new sessions
- `ChatSessionProviderOptions.newSessionOptions` — sets default options when creating sessions
- Significant performance optimizations to support large numbers of sessions

**Relevance to conversion:** HIGH

**Impact:** Babysitter runs (stored in `.a5c/runs/<runId>/`) can be surfaced as native chat sessions in the VS Code Sessions panel. Each run's journal events could map to chat session history items. This provides deep integration beyond just the `@babysitter` participant — runs become first-class VS Code sessions that users can switch between, fork, and resume.

**Conversion use case:**
- Implement `ChatSessionsProvider / ChatSessionItemController` to register babysitter runs as chat sessions
- Use `ChatSessionsProvider / ChatSessionItemControllerNewItemHandler` to create the `.a5c/runs/<runId>/` directory structure when a new chat session is initiated
- Expose run IDs through session URIs (e.g., `babysitter://runs/<runId>`)
- This replaces the need for a custom `RunsManager` TreeView — runs would appear in the native chat sessions panel

---

### 3. Auto Approval Slash Commands

**What it is:** New slash commands that toggle global auto-approval in agent sessions:
- `/autoApprove` and `/disableAutoApprove` — enable/disable confirmation skipping for tool calls
- `/yolo` and `/disableYolo` — aliases for the above

**Warning from docs:** "Global auto approve skips all tool confirmation prompts, letting the agent run tools and terminal commands without waiting for your approval."

**Relevance to conversion:** HIGH

**Impact:** This directly addresses babysitter's breakpoint model. Currently, babysitter breakpoints halt a run and wait for human approval. The `/autoApprove` command provides a native mechanism to bypass these gates when desired. More importantly, the presence of this API means the VS Code team has invested in the approval-flow model that babysitter's `ctx.breakpoint()` relies on.

**Conversion use case:**
- When a babysitter run hits a `ctx.breakpoint()`, surface it through the chat confirmation UI
- Users can use `/autoApprove` to run babysitter without breakpoint interruptions (equivalent to setting `BABYSITTER_ALLOW_AUTO_APPROVE=true`)
- The `/disableAutoApprove` command can re-enable breakpoint prompts mid-session
- Wire babysitter's `on-breakpoint` hook to VS Code's confirmation prompt API

---

### 4. Create Customizations from Chat

**What it is:** New slash commands that generate VS Code chat customization files from natural language descriptions:
- `/create-prompt` — create a prompt file
- `/create-instruction` — create an instruction file
- `/create-skill` — create a skill definition
- `/create-agent` — create an agent definition
- `/create-hook` — create a hook definition

Natural language recognition also supported (e.g., "create a skill that does X").

**Relevance to conversion:** MEDIUM

**Impact:** Babysitter's process definitions (`.a5c/processes/*.js`) can be created through chat using `/create-skill` or `/create-agent`. This provides a natural onboarding path: users describe what they want babysitter to do, and VS Code generates the process definition. The hook creation (`/create-hook`) aligns with babysitter's 13 hook types.

**Conversion use case:**
- Register babysitter's process definitions as discoverable skills so `/create-skill` generates valid babysitter process JS files
- Map babysitter hook types to VS Code hook schema so `/create-hook` generates compatible hook files
- Add a `@babysitter create-process <description>` command that delegates to `/create-skill`

---

### 5. Session Memory for Plans

**What it is:** Plans now persist across conversation turns and remain accessible during context compaction. Session memory for plans is maintained even when the context window is compacted.

**Relevance to conversion:** MEDIUM

**Impact:** Babysitter's multi-iteration runs involve long-running processes where context compaction could lose track of the current plan or phase. With session memory for plans, the orchestrator can maintain awareness of the overall run goal across many iterations without re-injecting the full context each time.

**Conversion use case:**
- Store babysitter's run metadata (processId, qualityTarget, currentPhase) as a persistent plan in the chat session
- The plan persists even when the journal grows large and context is compacted
- This solves the problem of Copilot "forgetting" what run it is orchestrating after many tool calls

---

### 6. Fork Chat Sessions (`/fork`)

**What it is:** Users can create independent chat sessions that inherit the current conversation history via `/fork` or via per-checkpoint "Fork Conversation" button.

**Relevance to conversion:** MEDIUM

**Impact:** Babysitter runs are inherently branchable — the event journal is append-only and runs can be resumed from any checkpoint. The `/fork` command provides a native UI expression of this concept. A forked session could map to starting a new babysitter run that inherits the parent run's context.

**Conversion use case:**
- Wire `/fork` to babysitter's run branching capability
- When a user forks a chat session at a breakpoint, create a new run that starts from the current journal head
- Expose fork points in the babysitter breakpoint response, allowing users to explore alternative paths

---

### 7. Context Compaction (`/compact`)

**What it is:** Manual context compaction via `/compact` slash command. Available for local, background, and Claude sessions. Context window controls available in the UI.

**Relevance to conversion:** MEDIUM

**Impact:** Babysitter's `rebuildStateCache()` function (`runtime/`) already handles state reconstruction from the journal. The `/compact` command provides a user-facing equivalent: compress the current conversation while preserving the derived state. Babysitter's state cache (`state/state.json`) maps directly to what gets preserved after compaction.

**Conversion use case:**
- Hook `/compact` to trigger `rebuildStateCache()` in babysitter's runtime
- After compaction, re-inject babysitter's `state.json` as the preserved context
- This allows long-running babysitter sessions (many iterations, large journals) to stay within context limits

---

### 8. Background Agent Improvements

**What it is:** Background agents now align with local/cloud agents. New capabilities include:
- `/compact` command support
- Slash command support for customizations
- Session renaming capability
- Steering/queuing for mid-conversation adjustments

**Relevance to conversion:** HIGH

**Impact:** Babysitter runs are inherently background operations — they run asynchronously and iterate without requiring the user to remain active. The background agent model is the correct VS Code primitive for babysitter's orchestration pattern. The steering/queuing feature (ability to send adjustments mid-run) maps to babysitter's ability to resume with modified inputs.

**Conversion use case:**
- Implement babysitter orchestration as a background agent rather than a foreground chat participant
- Use background agent session IDs to replace `CLAUDE_SESSION_ID` / `BABYSITTER_SESSION_ID`
- Steering messages → babysitter run resume with updated prompt
- Session renaming → run labeling in `.a5c/runs/<runId>/run.json`

---

### 9. OS Notifications for Chat Responses and Confirmations

**What it is:** Chat responses and confirmation requests now trigger OS-level notifications, even when the VS Code window is focused. Settings:
- `chat.notifyWindowOnResponseReceived`
- `chat.notifyWindowOnConfirmation`

**Relevance to conversion:** MEDIUM

**Impact:** Babysitter breakpoints require human attention and approval. Previously, if VS Code was backgrounded, users might miss a breakpoint. OS notifications ensure breakpoints surface even when users switch to other applications during long-running operations.

**Conversion use case:**
- Wire babysitter's `on-breakpoint` hook to trigger a chat confirmation, which VS Code will surface as an OS notification via `chat.notifyWindowOnConfirmation`
- No extra code needed — implementing breakpoints as chat confirmations automatically gets notification support

---

### 10. Explore Subagent (Dedicated Read-Only Research Agent)

**What it is:** A dedicated read-only research agent that can be delegated to by the Plan agent. Uses fast models (Claude Haiku 4.5, Gemini 3 Flash) by default. Setting: `chat.exploreAgent.defaultModel`.

**Relevance to conversion:** LOW

**Impact:** Babysitter's orchestrator tasks (`ctx.orchestratorTask()`) could delegate analysis/discovery work to the Explore subagent, which is optimized for fast, cheap, read-only operations. This could speed up the interview/discovery phase of babysitter runs.

**Conversion use case:**
- Map babysitter's `map-codebase` and `01-discovery-analysis` phases to use the Explore subagent
- Use `chat.exploreAgent.defaultModel` to configure cost/speed tradeoffs for exploration tasks

---

### 11. Agentic Browser Tools (Experimental)

**What it is:** Autonomous browser interaction tools available to agents: `openBrowserPage`, `navigatePage`, `readPage`, `screenshotPage`, `clickElement`, `hoverElement`, `dragElement`, `typeInPage`, `handleDialog`, `runPlaywrightCode`. Setting: `workbench.browser.enableChatTools`.

**Relevance to conversion:** LOW

**Impact:** Babysitter's task system (`defineTask`) could define browser automation tasks that leverage these tools. E2E testing workflows (currently in `e2e-tests/docker/`) could use browser tools instead of Docker-based Playwright.

**Conversion use case:**
- Define babysitter tasks of kind `browser` that wrap VS Code's native browser tools
- Use `runPlaywrightCode` for complex browser automation in babysitter processes

---

### 12. Webview ThemeIcon Support

**What it is:** Webview Panels and custom editors can now use `ThemeIcon` for tab icons:
```typescript
webviewPanel.iconPath = new vscode.ThemeIcon('octoface');
```

**Relevance to conversion:** LOW

**Impact:** The babysitter Run Details webview can use a proper VS Code ThemeIcon instead of a file-based icon, improving visual consistency with the VS Code theme.

**Conversion use case:**
- Update the Run Details webview to use `new vscode.ThemeIcon('sync')` or similar for the tab icon
- Minor improvement to visual polish

---

### 13. Agent Debug Panel (Preview)

**What it is:** A new debug panel giving deeper visibility into chat sessions and customizations. Shows real-time chat events, tool calls, and loaded customizations with chart visualization. Access via Command Palette.

**Relevance to conversion:** MEDIUM

**Impact:** During development of the babysitter-Copilot integration, the debug panel enables inspection of tool call flow, hook loading, and session state — equivalent to babysitter's own journal/event log. This is a development tool, not a production feature, but significantly speeds up debugging the conversion.

**Conversion use case:**
- Use during development to verify that babysitter's hooks, skills, and agents load correctly
- Debug tool call sequences to ensure babysitter's `task:post` flow surfaces correctly in the UI
- Verify that breakpoint confirmations appear in the correct order

---

### 14. Portable Mode Detection API (Stable)

**What it is:** `env.isAppPortable` is now stable (no `enabledApiProposals` needed). Detects whether VS Code is running from a folder containing a `data` directory.

**Relevance to conversion:** LOW

**Impact:** The babysitter extension can now detect portable mode to adjust default run directory paths. In portable mode, `.a5c/runs/` should be relative to the portable VS Code location.

**Conversion use case:**
- Check `vscode.env.isAppPortable` to set `BABYSITTER_RUNS_DIR` correctly when the extension activates in portable mode

---

## Actionable Recommendations

### Priority: HIGH

#### 1. Implement Babysitter as an Agent Plugin

**Recommendation:** Package babysitter's process definitions, hooks, and skills as a VS Code Agent Plugin alongside (or instead of) the full VSIX extension.

**Implementation:**
1. Create a plugin manifest in the babysitter repository root (or `packages/agent-plugin/`)
2. Include: process definitions from `.a5c/processes/`, hook definitions, the `@babysitter` participant, MCP server configuration
3. Publish to the marketplace or reference via `chat.plugins.marketplaces`
4. Users install with: `@agentPlugins` search → "babysitter" → Install

**VS Code Version:** 1.110+ (experimental)

**Why high priority:** This is a lighter-weight distribution path than the full VSIX, and directly replaces the Claude Code plugin marketplace experience. It also makes the `anthropics/claude-code` marketplace reference in `chat.plugins.marketplaces` directly usable for babysitter.

---

#### 2. Implement Chat Session Item Controller for Run Surfacing

**Recommendation:** Implement the `ChatSessionsProvider / ChatSessionItemController` proposed API to surface babysitter runs as native VS Code chat sessions.

**Implementation:**
```typescript
// In extension.ts activation
const controller = vscode.chat.createChatSessionsProvider / ChatSessionItemController('babysitter-runs', {
  newSessionOptions: {
    newItemHandler: async () => {
      const runId = await createNewBabysitterRun();
      return vscode.Uri.parse(`babysitter://runs/${runId}`);
    }
  }
});

// Register existing runs as session items
for (const run of await runsManager.listRuns()) {
  controller.addItem({
    label: run.id,
    uri: vscode.Uri.parse(`babysitter://runs/${run.id}`),
    iconPath: new vscode.ThemeIcon('sync')
  });
}
```

**VS Code Version:** 1.111+ (proposed — requires `enabledApiProposals: ["chatSessionsProvider"]`)

**Why high priority:** Replaces the custom TreeView with native VS Code chat session management. Users get run switching, history, and forking for free.

---

#### 3. Wire Breakpoints to Chat Confirmation API

**Recommendation:** Implement babysitter's `on-breakpoint` hook to surface as a VS Code chat confirmation, getting OS notification support for free.

**Implementation:**
```typescript
// In hooks dispatcher / extension
callHook('on-breakpoint', {
  runId,
  message: breakpointMessage,
  options: breakpointOptions
});

// Hook implementation triggers chat confirmation
async function onBreakpointHook(payload) {
  // VS Code's chat confirmation API surfaces this as:
  // 1. A chat message with approve/reject buttons
  // 2. An OS notification (via chat.notifyWindowOnConfirmation)
  const result = await vscode.window.showWarningMessage(
    `Babysitter breakpoint: ${payload.message}`,
    'Approve', 'Reject', 'Modify'
  );
  return { approved: result === 'Approve', action: result };
}
```

**VS Code Version:** 1.90.0+ (existing API), OS notifications require 1.110+

**Why high priority:** Breakpoints are a key differentiator of babysitter's UX. Surfacing them as OS notifications ensures users don't miss them during long-running operations.

---

#### 4. Implement Background Agent Mode for Babysitter Orchestration

**Recommendation:** Register babysitter orchestration as a background agent, not just a foreground chat participant.

**Implementation:**
- Move the primary orchestration loop from `@babysitter` participant handler to a background agent definition
- The `@babysitter` participant becomes a thin coordinator that starts/monitors background agents
- Steering messages (mid-session adjustments) map to `run:iterate` with modified inputs
- Background agent session ID replaces `CLAUDE_SESSION_ID` / workspace-based session IDs

**VS Code Version:** 1.110+

**Why high priority:** Babysitter's multi-iteration, long-running nature matches background agents exactly. Foreground participants time out; background agents persist. This solves the fundamental architectural mismatch between babysitter's async orchestration and Copilot's request/response chat model.

---

### Priority: MEDIUM

#### 5. Register Session Memory for Run Plans

**Recommendation:** When a babysitter run starts, create a persistent chat session plan capturing the run goal, process ID, quality target, and current phase.

**Implementation:**
- On `on-run-start` hook: inject a plan summary into the chat session
- On context compaction: the plan persists, allowing the orchestrator to re-orient
- Plan content: `{ runId, processId, qualityTarget, currentPhase, iteration, qualityScore }`

**VS Code Version:** 1.110+

---

#### 6. Support `/fork` for Babysitter Run Branching

**Recommendation:** Detect when a user forks a chat session at a babysitter breakpoint and create a new run branching from the current journal head.

**Implementation:**
- Monitor for fork events in the chat session lifecycle
- On fork: copy the current run's journal to a new run directory, creating a branch point
- Both runs then iterate independently from the fork point
- Surface both runs in the chat sessions view as siblings

**VS Code Version:** 1.110+

---

#### 7. Use `/compact` to Trigger State Cache Rebuild

**Recommendation:** Hook into the `/compact` event to proactively rebuild babysitter's state cache and re-inject the condensed state.

**Implementation:**
- Register a listener for the `/compact` slash command
- On compact: call `rebuildStateCache(runDir)` to ensure state cache is current
- Re-inject `state.json` summary into the compacted context as the preserved run state

**VS Code Version:** 1.110+

---

### Priority: LOW

#### 8. Update Run Details Webview to Use ThemeIcon

**Recommendation:** Replace file-based webview icons with `new vscode.ThemeIcon()`.

**Implementation:**
```typescript
webviewPanel.iconPath = new vscode.ThemeIcon('sync-spin'); // or 'run-all'
```

**VS Code Version:** 1.110+

---

#### 9. Add Portable Mode Detection to Extension Activation

**Recommendation:** Check `vscode.env.isAppPortable` on activation to adjust default `BABYSITTER_RUNS_DIR`.

**Implementation:**
```typescript
if (vscode.env.isAppPortable) {
  process.env.BABYSITTER_RUNS_DIR = path.join(
    path.dirname(vscode.env.appRoot), 'data', '.a5c', 'runs'
  );
}
```

**VS Code Version:** 1.110+ (stable, no proposals needed)

---

#### 10. Configure Process Definitions via `/create-skill`

**Recommendation:** Register babysitter process definitions as discoverable skills so `/create-skill` generates valid babysitter process JS files.

**Implementation:**
- Add a skill schema definition to the agent plugin manifest
- When `/create-skill` runs, it generates a properly structured babysitter process file in `.a5c/processes/`

**VS Code Version:** 1.110+

---

## Implementation Notes

### Minimum Version Requirements

| Feature | Min VS Code Version | API Status |
|---------|---------------------|------------|
| `@babysitter` chat participant | 1.90.0 | Stable |
| `chatSessionsProvider` API | 1.111 | Proposed |
| Agent Plugins | 1.110 | Experimental |
| Auto Approval slash commands | 1.110 | Stable |
| Background agent steering | 1.110 | Stable |
| OS notifications for confirmations | 1.110 | Stable |
| `env.isAppPortable` | 1.110 | Stable (was proposed) |
| Webview ThemeIcon | 1.110 | Stable |
| `/fork` session support | 1.110 | Stable |
| `/compact` support | 1.110 | Stable |

### Implementation Status (as of v0.0.180)

| Gap | Status |
|-----|--------|
| Background agent support | **Done** — `BabysitterBackgroundAgent` drives the `run:iterate` loop with VS Code progress, cancellation, and breakpoint detection |
| Session surfacing | **Done** — `BabysitterSessionController` uses VS Code 1.111 `chatSessionsProvider` proposed API (`enabledApiProposals: ["chatSessionsProvider"]`) with `ChatSessionStatus` enum |
| Breakpoint notifications | **Done** — `BabysitterBreakpointNotifier` uses `showWarningMessage` → OS notification via `chat.notifyWindowOnConfirmation` |
| Auto-approval | Delegated to VS Code native `/autoApprove` and `/yolo` |
| `/compact` integration | Not implemented |
| Fork support | Not implemented |

### API Proposals Requiring enabledApiProposals

The following features require adding to `enabledApiProposals` in `package.json`:
```json
{
  "enabledApiProposals": ["chatSessionsProvider"]
}
```

All other v1.110 features listed above use stable APIs.

### Backward Compatibility

All high-priority recommendations are additive — they do not break the existing `@babysitter` participant implementation in `participant.ts`. They can be layered on top:

1. Agent Plugin packaging is a separate distribution artifact
2. `ChatSessionsProvider / ChatSessionItemController` supplements the existing TreeView
3. Breakpoint notifications enhance the existing `on-breakpoint` hook
4. Background agent mode is a new code path; the existing participant stays as a fallback

---

## Summary Table

| Feature | Relevance | Impact | Priority |
|---------|-----------|--------|----------|
| Agent Plugins (Experimental) | High | Lightweight distribution replacing VSIX | High |
| Chat Session Item Controller API | High | Native run surfacing in sessions view | High |
| Auto Approval Slash Commands | High | Breakpoint bypass / approve-all mode | High |
| Background Agent Improvements | High | Correct primitive for async orchestration | High |
| Create Customizations from Chat | Medium | Process definition authoring flow | Medium |
| Session Memory for Plans | Medium | Context persistence across long runs | Medium |
| Fork Chat Sessions | Medium | Run branching from breakpoints | Medium |
| Context Compaction | Medium | State cache rebuild integration | Medium |
| OS Notifications | Medium | Breakpoint attention when VS Code backgrounded | Medium |
| Agent Debug Panel | Medium | Development/debugging tool | Medium |
| Explore Subagent | Low | Fast model for discovery phases | Low |
| Agentic Browser Tools | Low | E2E test automation tasks | Low |
| Webview ThemeIcon | Low | Visual polish | Low |
| Portable Mode Detection | Low | Path correction in portable VS Code | Low |

**Total features identified:** 14
**High impact:** 4
**Medium impact:** 6
**Low impact:** 4
