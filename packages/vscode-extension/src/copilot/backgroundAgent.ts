import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

export type AgentStatus = 'idle' | 'running' | 'waiting-breakpoint' | 'completed' | 'failed';

interface IterateJsonOutput {
  status?: string;
  reason?: string;
  message?: string;
  runId?: string;
  error?: string;
}

interface PendingBreakpoint {
  runId: string;
  message: string;
  detectedAt: Date;
}

/**
 * Resolves the babysitter CLI path for a given workspace root.
 * Checks local node_modules first, then .a5c-local node_modules, then falls back to npx.
 */
function resolveBabysitterCliPath(workspaceRoot: string): { command: string; args: string[] } {
  const candidates = [
    path.join(workspaceRoot, 'node_modules', '.bin', 'babysitter'),
    path.join(workspaceRoot, '.a5c', 'node_modules', '.bin', 'babysitter'),
  ];

  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return { command: candidate, args: [] };
    } catch {
      // Not found or not executable — try next
    }
  }

  // Fall back to npx
  return { command: 'npx', args: ['-y', '@a5c-ai/babysitter-sdk'] };
}

/**
 * Generates a UUID v4.
 */
function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * BabysitterBackgroundAgent wraps the babysitter `run:iterate` loop as a VS Code
 * background operation, showing progress in the status bar and handling breakpoints,
 * completion, and failures.
 */
export class BabysitterBackgroundAgent {
  private _status: AgentStatus = 'idle';
  private _childProcess: cp.ChildProcess | undefined;
  private _cancelTokenSource: vscode.CancellationTokenSource | undefined;
  private _pendingBreakpoint: PendingBreakpoint | undefined;
  private _runId: string | undefined;
  private _runsDir: string | undefined;
  private _progressResolve: (() => void) | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  getStatus(): AgentStatus {
    return this._status;
  }

  /**
   * Starts the background orchestration agent for the given run.
   * Shows a cancellable progress indicator in the VS Code status bar.
   */
  async start(runId: string, runsDir: string): Promise<void> {
    if (this._status === 'running') {
      this.outputChannel.appendLine(
        `[BabysitterBackgroundAgent] Already running for run ${this._runId ?? '(unknown)'}. Stop first.`
      );
      return;
    }

    this._runId = runId;
    this._runsDir = runsDir;
    this._status = 'running';
    this._pendingBreakpoint = undefined;

    // Ensure a session ID is stored in workspace state
    let sessionId = this.context.workspaceState.get<string>('babysitter.sessionId');
    if (!sessionId) {
      sessionId = generateUuid();
      await this.context.workspaceState.update('babysitter.sessionId', sessionId);
    }

    this.outputChannel.appendLine(
      `[BabysitterBackgroundAgent] Starting run ${runId} (session: ${sessionId})`
    );

    this._cancelTokenSource = new vscode.CancellationTokenSource();
    const token = this._cancelTokenSource.token;

    // Run inside a progress notification so the user sees activity in the status bar
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Babysitter',
        cancellable: true,
      },
      async (progress, progressToken) => {
        // Forward VS Code progress cancellation to our internal token
        progressToken.onCancellationRequested(() => {
          this.stop();
        });

        // Also stop if our own cancel token is triggered
        token.onCancellationRequested(() => {
          this._terminateChild();
        });

        progress.report({ message: `Running ${runId}` });

        // Iterative loop: keep calling run:iterate until done, cancelled, or failed
        while (this._status === 'running') {
          if (token.isCancellationRequested) {
            break;
          }

          const iterationResult = await this._runIteration(runId, runsDir, token, progress);

          if (iterationResult === 'stop') {
            break;
          }
          // iterationResult === 'continue' → loop again
        }
      }
    );
  }

  /**
   * Executes a single `run:iterate` call and interprets the JSON output.
   * Returns 'continue' if iteration should continue, 'stop' if the loop should end.
   */
  private async _runIteration(
    runId: string,
    runsDir: string,
    token: vscode.CancellationToken,
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<'continue' | 'stop'> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const { command, args: baseArgs } = resolveBabysitterCliPath(workspaceRoot);

    const args = [
      ...baseArgs,
      'run:iterate',
      path.join(runsDir, runId),
      '--json',
    ];

    this.outputChannel.appendLine(
      `[BabysitterBackgroundAgent] Spawning: ${command} ${args.join(' ')}`
    );

    return new Promise<'continue' | 'stop'>((resolve) => {
      if (token.isCancellationRequested) {
        resolve('stop');
        return;
      }

      const child = cp.spawn(command, args, {
        cwd: workspaceRoot,
        env: { ...process.env },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this._childProcess = child;

      let stdout = '';
      let stderr = '';

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        this.outputChannel.append(chunk);
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        this.outputChannel.append(chunk);
      });

      child.on('error', (err: Error) => {
        this.outputChannel.appendLine(
          `[BabysitterBackgroundAgent] Spawn error: ${err.message}`
        );
        this._status = 'failed';
        void vscode.window.showErrorMessage(`Babysitter agent error: ${err.message}`);
        resolve('stop');
      });

      child.on('close', (code: number | null) => {
        this._childProcess = undefined;

        if (token.isCancellationRequested) {
          this._status = 'idle';
          resolve('stop');
          return;
        }

        // Parse JSON output from the CLI
        const parsed = this._parseIterateOutput(stdout);

        if (parsed) {
          this.outputChannel.appendLine(
            `[BabysitterBackgroundAgent] Parsed output: ${JSON.stringify(parsed)}`
          );

          const status = parsed.status;
          const reason = parsed.reason;

          if (status === 'completed') {
            this._status = 'completed';
            progress.report({ message: `Completed ${runId}` });
            void vscode.window.showInformationMessage(
              `Babysitter run ${runId} completed successfully.`
            );
            resolve('stop');
            return;
          }

          if (status === 'failed') {
            this._status = 'failed';
            const errMsg = parsed.error ?? parsed.message ?? stderr.trim() ?? 'Unknown error';
            progress.report({ message: `Failed ${runId}` });
            void vscode.window.showErrorMessage(
              `Babysitter run ${runId} failed: ${errMsg}`
            );
            resolve('stop');
            return;
          }

          if (status === 'waiting' && reason === 'breakpoint-waiting') {
            this._status = 'waiting-breakpoint';
            const bpMessage = parsed.message ?? 'Approval required';
            this._pendingBreakpoint = {
              runId,
              message: bpMessage,
              detectedAt: new Date(),
            };
            progress.report({ message: `Waiting for breakpoint: ${runId}` });
            this.outputChannel.appendLine(
              `[BabysitterBackgroundAgent] Breakpoint detected: ${bpMessage}`
            );
            void vscode.window.showInformationMessage(
              `Babysitter run ${runId} is waiting at a breakpoint: ${bpMessage}`,
              'View Details'
            ).then((selection) => {
              if (selection === 'View Details') {
                void vscode.commands.executeCommand('babysitter.openRunDetails', runId);
              }
            });
            // Stop iterating — external action needed to unblock the breakpoint
            resolve('stop');
            return;
          }

          if (status === 'waiting') {
            // Waiting for tasks to complete — continue iterating after a short delay
            progress.report({ message: `Waiting for tasks: ${runId}` });
            this.outputChannel.appendLine(
              `[BabysitterBackgroundAgent] Waiting (reason: ${reason ?? 'unknown'}), will retry...`
            );
            setTimeout(() => resolve('continue'), 2000);
            return;
          }
        }

        // Non-zero exit code without parseable output
        if (code !== 0) {
          this._status = 'failed';
          const errMsg = stderr.trim() || stdout.trim() || `exit code ${code ?? 'unknown'}`;
          void vscode.window.showErrorMessage(
            `Babysitter run ${runId} failed: ${errMsg}`
          );
          resolve('stop');
          return;
        }

        // Zero exit, no parseable status — treat as a completed iteration, continue
        resolve('continue');
      });
    });
  }

  /**
   * Attempts to parse JSON output from run:iterate.
   * The CLI may emit multiple lines; we look for the last valid JSON object.
   */
  private _parseIterateOutput(stdout: string): IterateJsonOutput | undefined {
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    // Scan from the end to find the last valid JSON line
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed: unknown = JSON.parse(lines[i]);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as IterateJsonOutput;
        }
      } catch {
        // Not JSON — skip
      }
    }
    return undefined;
  }

  /**
   * Terminates the currently running child process, if any.
   */
  private _terminateChild(): void {
    if (this._childProcess) {
      try {
        this._childProcess.kill('SIGTERM');
      } catch {
        // Ignore kill errors
      }
      this._childProcess = undefined;
    }
  }

  /**
   * Stops the agent and terminates any in-progress iteration.
   */
  stop(): void {
    this.outputChannel.appendLine(
      `[BabysitterBackgroundAgent] Stopping run ${this._runId ?? '(unknown)'}`
    );
    this._terminateChild();
    this._cancelTokenSource?.cancel();
    this._cancelTokenSource?.dispose();
    this._cancelTokenSource = undefined;
    if (this._status === 'running') {
      this._status = 'idle';
    }
  }

  /**
   * Provides mid-run steering feedback by writing it to a temp file and passing it
   * as `--steering-prompt <file>` on the next `run:iterate` invocation.
   *
   * TODO: The `--steering-prompt` flag may not yet be implemented in the babysitter
   * CLI. When available, the temp file approach below should wire up correctly.
   * Until then this method persists the feedback and logs a notice.
   */
  async steer(feedback: string): Promise<void> {
    if (!this._runId) {
      throw new Error('No active run to steer.');
    }

    // Write feedback to a temp file that can be passed on the next iterate call
    const tmpDir = os.tmpdir();
    const steeringFile = path.join(
      tmpDir,
      `babysitter-steering-${this._runId}-${Date.now()}.txt`
    );

    await fs.promises.writeFile(steeringFile, feedback, 'utf8');

    this.outputChannel.appendLine(
      `[BabysitterBackgroundAgent] Steering feedback written to ${steeringFile}`
    );

    // TODO: Pass --steering-prompt <steeringFile> to the next run:iterate invocation
    // once the CLI flag is supported. For now, log the feedback and notify the user.
    this.outputChannel.appendLine(
      `[BabysitterBackgroundAgent] Steering feedback (pending CLI support): ${feedback}`
    );

    void vscode.window.showInformationMessage(
      `Steering feedback recorded for run ${this._runId}. It will be applied when --steering-prompt is supported by the CLI.`
    );
  }

  /**
   * Returns the pending breakpoint, if the agent is currently waiting at one.
   */
  getPendingBreakpoint(): PendingBreakpoint | undefined {
    return this._pendingBreakpoint;
  }

  dispose(): void {
    this.stop();
  }
}
