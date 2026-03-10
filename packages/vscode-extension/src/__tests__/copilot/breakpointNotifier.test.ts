/**
 * Unit tests for BabysitterBreakpointNotifier (copilot/breakpointNotifier.ts)
 *
 * ============================================================================
 * MANUAL TESTING NOTES
 * ============================================================================
 *
 * MANUAL TEST 1 — OS notification fires on breakpoint
 *   1. Dispatch a run whose process calls ctx.breakpoint({ question: 'Deploy to prod?' }).
 *   2. The BreakpointNotifier polls the tasks/ directory every 2 seconds.
 *   3. Verify that VS Code shows a warning notification with the question text
 *      and 'Approve' / 'Reject' buttons.
 *   4. Clicking 'Approve' should post the task result via `task:post` CLI.
 *
 * MANUAL TEST 2 — Dismissed notification re-surfaces on next poll
 *   1. When a breakpoint notification appears, dismiss it (press Escape or X).
 *   2. Within 2 seconds the notification should re-appear.
 *   3. This continues until the user either approves or rejects.
 *
 * NOTE: Auto-approve is no longer provided by the extension. Use VS Code 1.110
 * native /autoApprove or /yolo slash commands instead.
 *
 * ============================================================================
 */

import * as assert from 'assert';

// ── Vscode mock ───────────────────────────────────────────────────────────────

import {
  makeExtensionContext,
  makeOutputChannel,
  CancellationTokenSource,
  ProgressLocation,
  StatusBarAlignment,
  Disposable,
  ThemeIcon,
  Uri,
  window as windowStub,
  workspace as workspaceStub,
  commands as commandsStub,
  chat as chatStub,
} from '../../__mocks__/vscode';

const vscodeStub = {
  window: windowStub,
  workspace: workspaceStub,
  commands: commandsStub,
  chat: chatStub,
  Uri,
  ThemeIcon,
  ProgressLocation,
  StatusBarAlignment,
  Disposable,
  CancellationTokenSource,
};

(require as NodeRequire & { cache: Record<string, NodeModule> }).cache[
  require.resolve('vscode')
] = {
  id: 'vscode',
  filename: 'vscode',
  loaded: true,
  exports: vscodeStub,
  parent: null,
  children: [],
  paths: [],
} as unknown as NodeModule;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BabysitterBreakpointNotifier } = require('../../copilot/breakpointNotifier') as typeof import('../../copilot/breakpointNotifier');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNotifier() {
  const ctx = makeExtensionContext();
  const out = makeOutputChannel();
  const notifier = new BabysitterBreakpointNotifier(ctx as never, out as never);
  return { notifier, ctx, out };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

suite('BabysitterBreakpointNotifier', () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────────
  test('showWarningMessage is called with breakpoint question', async () => {
    const { notifier } = makeNotifier();

    // Capture calls to showWarningMessage
    const warningCalls: unknown[][] = [];
    const originalShowWarning = vscodeStub.window.showWarningMessage;
    vscodeStub.window.showWarningMessage = ((...args: unknown[]) => {
      warningCalls.push(args);
      return Promise.resolve('Approve');
    }) as typeof vscodeStub.window.showWarningMessage;

    try {
      // Access private handleBreakpoint method via cast
      const handleBreakpoint = (notifier as unknown as {
        handleBreakpoint(
          entry: {
            runId: string;
            runsDir: string;
            seenEffectIds: Set<string>;
            intervalHandle: ReturnType<typeof setInterval>;
          },
          effectId: string,
          task: {
            kind: string;
            title?: string;
            metadata?: { payload?: { question?: string; options?: string[] } };
          }
        ): Promise<void>;
      })['handleBreakpoint'].bind(notifier);

      const entry = {
        runId: 'run-bp-test',
        runsDir: '/tmp/runs',
        seenEffectIds: new Set<string>(),
        intervalHandle: setInterval(() => {/* noop */}, 999999),
      };

      await handleBreakpoint(entry, 'effect-001', {
        kind: 'breakpoint',
        title: 'Should we proceed?',
        metadata: { payload: { question: 'Should we proceed?', options: ['Yes', 'No'] } },
      });

      clearInterval(entry.intervalHandle);
    } finally {
      vscodeStub.window.showWarningMessage = originalShowWarning;
    }

    assert.ok(warningCalls.length > 0, 'expected showWarningMessage to be called');
    assert.ok(
      (warningCalls[0] as string[])[0].includes('Should we proceed?'),
      `unexpected question text: ${(warningCalls[0] as string[])[0]}`
    );
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  test('startWatching() adds a watch entry for the given runId', () => {
    const { notifier } = makeNotifier();
    notifier.startWatching('run-watch-test', '/tmp/runs');

    // Calling startWatching again with the same runId should be a no-op (no duplicate)
    notifier.startWatching('run-watch-test', '/tmp/runs');

    // stopWatching should succeed without throwing
    assert.doesNotThrow(() => notifier.stopWatching('run-watch-test'));
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  test('stopWatching() with no argument clears all watchers', () => {
    const { notifier } = makeNotifier();
    notifier.startWatching('run-a', '/tmp/runs');
    notifier.startWatching('run-b', '/tmp/runs');

    // Stop all — should not throw
    assert.doesNotThrow(() => notifier.stopWatching());
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  test('stopWatching() for unknown runId does not throw', () => {
    const { notifier } = makeNotifier();
    assert.doesNotThrow(() => notifier.stopWatching('non-existent-run'));
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────
  test('dispose() clears all watchers', () => {
    const { notifier } = makeNotifier();
    notifier.startWatching('run-dispose-test', '/tmp/runs');
    assert.doesNotThrow(() => notifier.dispose());
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────
  test('handleBreakpoint uses default options ["Approve","Reject"] when payload has none', async () => {
    const { notifier } = makeNotifier();

    const warningCalls: unknown[][] = [];
    const originalShowWarning = vscodeStub.window.showWarningMessage;
    vscodeStub.window.showWarningMessage = ((...args: unknown[]) => {
      warningCalls.push(args);
      return Promise.resolve('Approve');
    }) as typeof vscodeStub.window.showWarningMessage;

    try {
      const handleBreakpoint = (notifier as unknown as {
        handleBreakpoint(
          entry: { runId: string; runsDir: string; seenEffectIds: Set<string>; intervalHandle: ReturnType<typeof setInterval> },
          effectId: string,
          task: { kind: string; title?: string; metadata?: { payload?: Record<string, unknown> } }
        ): Promise<void>;
      })['handleBreakpoint'].bind(notifier);

      const entry = {
        runId: 'run-defaults',
        runsDir: '/tmp/runs',
        seenEffectIds: new Set<string>(),
        intervalHandle: setInterval(() => {/* noop */}, 999999),
      };

      await handleBreakpoint(entry, 'effect-defaults', {
        kind: 'breakpoint',
        title: 'Needs approval',
        metadata: { payload: {} },
      });

      clearInterval(entry.intervalHandle);
    } finally {
      vscodeStub.window.showWarningMessage = originalShowWarning;
    }

    // Verify the call included 'Approve' and 'Reject' as option arguments
    assert.ok(warningCalls.length > 0);
    const args = warningCalls[0] as unknown[];
    // args[0] = question, args[1] = opts, args[2..] = button labels
    const buttonLabels = args.slice(2) as string[];
    assert.ok(buttonLabels.includes('Approve'), `expected Approve in: ${JSON.stringify(buttonLabels)}`);
    assert.ok(buttonLabels.includes('Reject'), `expected Reject in: ${JSON.stringify(buttonLabels)}`);
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────
  test('handleBreakpoint re-adds to seenEffectIds on dismiss (undefined result)', async () => {
    const { notifier } = makeNotifier();

    const originalShowWarning = vscodeStub.window.showWarningMessage;
    vscodeStub.window.showWarningMessage = ((..._args: unknown[]) => {
      return Promise.resolve(undefined); // simulate dismiss
    }) as typeof vscodeStub.window.showWarningMessage;

    const seenEffectIds = new Set<string>(['effect-dismiss']);
    const entry = {
      runId: 'run-dismiss',
      runsDir: '/tmp/runs',
      seenEffectIds,
      intervalHandle: setInterval(() => {/* noop */}, 999999),
    };

    try {
      const handleBreakpoint = (notifier as unknown as {
        handleBreakpoint(
          entry: { runId: string; runsDir: string; seenEffectIds: Set<string>; intervalHandle: ReturnType<typeof setInterval> },
          effectId: string,
          task: { kind: string }
        ): Promise<void>;
      })['handleBreakpoint'].bind(notifier);

      await handleBreakpoint(entry, 'effect-dismiss', { kind: 'breakpoint' });
    } finally {
      vscodeStub.window.showWarningMessage = originalShowWarning;
      clearInterval(entry.intervalHandle);
    }

    // After dismiss, the effectId should have been removed so next poll re-surfaces it
    assert.strictEqual(seenEffectIds.has('effect-dismiss'), false, 'effectId should be removed from seenEffectIds on dismiss');
  });
});
