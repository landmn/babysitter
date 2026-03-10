import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface RunMetadata {
  processId?: string;
  status?: 'running' | 'waiting' | 'completed' | 'failed';
  createdAt?: string;
}

type RunStatus = RunMetadata['status'];

function statusToIcon(status: RunStatus | undefined): string {
  switch (status) {
    case 'running':
      return 'sync-spin';
    case 'completed':
      return 'check';
    case 'failed':
      return 'error';
    case 'waiting':
      return 'clock';
    default:
      return 'circle-outline';
  }
}

function statusToChatSessionStatus(
  status: RunStatus | undefined
): vscode.ChatSessionStatus | undefined {
  switch (status) {
    case 'running':
      return vscode.ChatSessionStatus.InProgress;
    case 'completed':
      return vscode.ChatSessionStatus.Completed;
    case 'failed':
      return vscode.ChatSessionStatus.Failed;
    case 'waiting':
      return vscode.ChatSessionStatus.NeedsInput;
    default:
      return undefined;
  }
}

interface StateJson {
  status?: string;
}

interface JournalEvent {
  type?: string;
}

function readRunStatus(runsDir: string, runId: string): RunStatus | undefined {
  const stateJsonPath = path.join(runsDir, runId, 'state', 'state.json');
  try {
    const raw = fs.readFileSync(stateJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as StateJson;
    const s = parsed.status;
    if (s === 'running' || s === 'waiting' || s === 'completed' || s === 'failed') {
      return s;
    }
  } catch {
    // state.json not available; try journal
  }

  const journalDir = path.join(runsDir, runId, 'journal');
  try {
    const entries = fs.readdirSync(journalDir).sort((a, b) => b.localeCompare(a));
    for (const entry of entries) {
      const eventPath = path.join(journalDir, entry);
      try {
        const raw = fs.readFileSync(eventPath, 'utf8');
        const parsed = JSON.parse(raw) as JournalEvent;
        if (parsed.type === 'RUN_COMPLETED') return 'completed';
        if (parsed.type === 'RUN_FAILED') return 'failed';
        if (parsed.type === 'EFFECT_REQUESTED') return 'waiting';
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // journal dir not available
  }

  return undefined;
}

function isRunDirectory(runsDir: string, name: string): boolean {
  try {
    return fs.statSync(path.join(runsDir, name)).isDirectory();
  } catch {
    return false;
  }
}

export class BabysitterSessionController {
  private controller: vscode.ChatSessionItemController | undefined;
  private watchers: fs.FSWatcher[] = [];
  private disposables: vscode.Disposable[] = [];
  private itemUris = new Map<string, vscode.Uri>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly runsDir: string
  ) {}

  activate(): void {
    const chatNs = vscode.chat as typeof vscode.chat | undefined;
    if (!chatNs?.createChatSessionItemController) {
      console.log(
        'chatSessionsProvider API not available (requires VS Code 1.111+), using TreeView fallback'
      );
      return;
    }

    this.controller = chatNs.createChatSessionItemController('babysitter-runs', {
      refreshHandler: async (): Promise<void> => {
        await this.refresh();
      },
    });

    this.disposables.push(this.controller);

    // Register URI handler for babysitter-run:// scheme
    const uriHandler = vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri): void {
        const runId = uri.authority || uri.path.replace(/^\//, '');
        if (runId) {
          void vscode.commands.executeCommand('babysitter.openRunDetails', runId);
        }
      },
    });
    this.disposables.push(uriHandler);
    this.context.subscriptions.push(uriHandler);

    // Scan existing runs
    this.scanExistingRuns();

    // Watch for new runs
    this.watchRunsDir();
  }

  deactivate(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];

    this.controller = undefined;
    this.itemUris.clear();
  }

  addRun(runId: string, metadata?: RunMetadata): void {
    if (!this.controller) {
      return;
    }

    const status = metadata?.status;
    const shortId = runId.slice(-8);

    const item: vscode.ChatSessionItem = {
      label: shortId,
      resource: vscode.Uri.parse('babysitter-run://' + runId),
      iconPath: new vscode.ThemeIcon(statusToIcon(status)),
      description: metadata?.processId ?? '',
      status: statusToChatSessionStatus(status),
    };

    this.controller.items.add(item);
    this.itemUris.set(runId, item.resource);
  }

  removeRun(runId: string): void {
    if (!this.controller) {
      return;
    }

    const uri = this.itemUris.get(runId);
    if (uri) {
      this.controller.items.delete(uri);
      this.itemUris.delete(runId);
    }
  }

  async refresh(): Promise<void> {
    if (!this.controller) {
      return;
    }

    // Remove all tracked items
    for (const [runId, uri] of this.itemUris) {
      this.controller.items.delete(uri);
      this.itemUris.delete(runId);
    }

    // Re-scan
    this.scanExistingRuns();
  }

  private scanExistingRuns(): void {
    try {
      const entries = fs.readdirSync(this.runsDir);
      for (const name of entries) {
        if (!isRunDirectory(this.runsDir, name)) {
          continue;
        }
        const status = readRunStatus(this.runsDir, name);
        this.addRun(name, { status });
      }
    } catch {
      // runsDir may not exist yet — that is fine
    }
  }

  private watchRunsDir(): void {
    try {
      const watcher = fs.watch(this.runsDir, { persistent: false }, (_event, filename) => {
        if (!filename || !isRunDirectory(this.runsDir, filename)) {
          return;
        }

        if (!this.itemUris.has(filename)) {
          const status = readRunStatus(this.runsDir, filename);
          this.addRun(filename, { status });
        }
      });

      watcher.on('error', (_err: unknown) => {
        // Silently ignore watcher errors (e.g., dir removed)
      });

      this.watchers.push(watcher);
    } catch {
      // If the directory does not exist yet we cannot watch; this is acceptable
    }
  }
}
