import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';

// ── Types ────────────────────────────────────────────────────────────────────

interface BreakpointPayload {
  question?: string;
  title?: string;
  options?: string[];
  context?: { files?: string[] };
}

interface TaskJson {
  kind: string;
  title?: string;
  effectId?: string;
  metadata?: {
    payload?: BreakpointPayload;
  };
}

interface WatchEntry {
  runId: string;
  runsDir: string;
  /** polling interval handle */
  intervalHandle: ReturnType<typeof setInterval>;
  /** task effectIds we have already surfaced or resolved */
  seenEffectIds: Set<string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2_000;

// ── CLI resolution ────────────────────────────────────────────────────────────

/**
 * Resolves the babysitter CLI binary, mirroring the backgroundAgent pattern:
 *   1. node_modules/.bin/babysitter  (workspace-local)
 *   2. .a5c/node_modules/.bin/babysitter
 *   3. fallback: npx @a5c-ai/babysitter-sdk
 */
function resolveBabysitterBinary(workspaceRoot: string): {
  command: string;
  prefixArgs: string[];
} {
  const candidates = [
    path.join(workspaceRoot, 'node_modules', '.bin', 'babysitter'),
    path.join(workspaceRoot, '.a5c', 'node_modules', '.bin', 'babysitter'),
  ];

  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return { command: candidate, prefixArgs: [] };
    } catch {
      // not accessible — try next
    }
  }

  // fallback to npx
  return { command: 'npx', prefixArgs: ['@a5c-ai/babysitter-sdk'] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readTaskJson(taskDir: string): TaskJson | undefined {
  const taskFile = path.join(taskDir, 'task.json');
  try {
    const raw = fs.readFileSync(taskFile, 'utf8');
    return JSON.parse(raw) as TaskJson;
  } catch {
    return undefined;
  }
}

/** Derive effectId from task directory name (the directory IS the effectId). */
function effectIdFromDir(taskDir: string): string {
  return path.basename(taskDir);
}

function runDir(runsDir: string, runId: string): string {
  return path.join(runsDir, runId);
}

function tasksDir(runsDir: string, runId: string): string {
  return path.join(runDir(runsDir, runId), 'tasks');
}

function writeJsonTemp(value: unknown): string {
  const tmp = path.join(os.tmpdir(), `babysitter-bp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf8');
  return tmp;
}

function postTaskResult(
  workspaceRoot: string,
  runDirectory: string,
  effectId: string,
  valueFile: string,
  outputChannel: vscode.OutputChannel,
): void {
  const { command, prefixArgs } = resolveBabysitterBinary(workspaceRoot);
  const args = [
    ...prefixArgs,
    'task:post',
    runDirectory,
    effectId,
    '--status', 'ok',
    '--value', valueFile,
  ];

  outputChannel.appendLine(`[BreakpointNotifier] posting result: ${command} ${args.join(' ')}`);

  execFile(command, args, { cwd: workspaceRoot }, (err, stdout, stderr) => {
    if (err) {
      outputChannel.appendLine(`[BreakpointNotifier] task:post error: ${err.message}`);
      if (stderr.trim()) outputChannel.appendLine(`  stderr: ${stderr.trim()}`);
      return;
    }
    if (stdout.trim()) outputChannel.appendLine(`[BreakpointNotifier] task:post stdout: ${stdout.trim()}`);
    // Clean up temp file
    try { fs.unlinkSync(valueFile); } catch { /* ignore */ }
  });
}

// ── Main class ────────────────────────────────────────────────────────────────

export class BabysitterBreakpointNotifier {
  private readonly watches = new Map<string, WatchEntry>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  startWatching(runId: string, runsDir: string): void {
    if (this.watches.has(runId)) {
      return; // already watching
    }

    this.outputChannel.appendLine(`[BreakpointNotifier] watching run ${runId} in ${runsDir}`);

    const entry: WatchEntry = {
      runId,
      runsDir,
      seenEffectIds: new Set(),
      intervalHandle: setInterval(() => {
        this.pollTasksDir(entry).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.outputChannel.appendLine(`[BreakpointNotifier] poll error for ${runId}: ${msg}`);
        });
      }, POLL_INTERVAL_MS),
    };

    this.watches.set(runId, entry);
  }

  stopWatching(runId?: string): void {
    if (runId !== undefined) {
      const entry = this.watches.get(runId);
      if (entry) {
        clearInterval(entry.intervalHandle);
        this.watches.delete(runId);
        this.outputChannel.appendLine(`[BreakpointNotifier] stopped watching run ${runId}`);
      }
    } else {
      for (const [id, entry] of this.watches) {
        clearInterval(entry.intervalHandle);
        this.outputChannel.appendLine(`[BreakpointNotifier] stopped watching run ${id}`);
      }
      this.watches.clear();
    }
  }

  dispose(): void {
    this.stopWatching();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async pollTasksDir(entry: WatchEntry): Promise<void> {
    const dir = tasksDir(entry.runsDir, entry.runId);

    let subdirs: string[];
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      subdirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => path.join(dir, e.name));
    } catch {
      // tasks dir may not exist yet
      return;
    }

    for (const taskDir of subdirs) {
      const effectId = effectIdFromDir(taskDir);
      if (entry.seenEffectIds.has(effectId)) continue;

      const task = readTaskJson(taskDir);
      if (!task) continue;

      // Only handle breakpoint kind that is still requested (no result.json)
      if (task.kind !== 'breakpoint') {
        entry.seenEffectIds.add(effectId);
        continue;
      }

      const resultFile = path.join(taskDir, 'result.json');
      try {
        await fs.promises.access(resultFile);
        // result already exists — already resolved
        entry.seenEffectIds.add(effectId);
        continue;
      } catch {
        // no result yet — this one needs attention
      }

      // Mark as seen so we don't surface it twice
      entry.seenEffectIds.add(effectId);

      await this.handleBreakpoint(entry, effectId, task);
    }
  }

  private async handleBreakpoint(
    entry: WatchEntry,
    effectId: string,
    task: TaskJson,
  ): Promise<void> {
    const payload = task.metadata?.payload ?? {};
    const question = payload.question ?? payload.title ?? task.title ?? 'Babysitter needs approval';
    const rawOptions: string[] = Array.isArray(payload.options) && payload.options.length > 0
      ? payload.options
      : ['Approve', 'Reject'];

    this.outputChannel.appendLine(
      `[BreakpointNotifier] breakpoint for run ${entry.runId} effectId=${effectId}: ${question}`,
    );

    // showWarningMessage triggers OS notification via chat.notifyWindowOnConfirmation (VS Code 1.110+)
    const result = await vscode.window.showWarningMessage(
      question,
      { modal: false },
      ...rawOptions,
    );

    if (result === undefined) {
      // User dismissed — do not post; they can respond later via re-surface on next poll cycle.
      // Remove from seenEffectIds so we try again next poll.
      entry.seenEffectIds.delete(effectId);
      this.outputChannel.appendLine(
        `[BreakpointNotifier] dismissed breakpoint ${effectId}, will re-surface on next poll`,
      );
      return;
    }

    const chosen = result;

    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

    const responseValue = { response: chosen, effectId };
    const tmpFile = writeJsonTemp(responseValue);

    postTaskResult(
      workspaceRoot,
      runDir(entry.runsDir, entry.runId),
      effectId,
      tmpFile,
      this.outputChannel,
    );
  }
}
