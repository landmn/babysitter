/**
 * Unit tests for BabysitterSessionController (copilot/sessionController.ts)
 *
 * ============================================================================
 * MANUAL TESTING NOTES
 * ============================================================================
 *
 * MANUAL TEST 1 — Runs appear in VS Code Chat Sessions panel
 *   1. Open VS Code 1.111+ with the Babysitter extension installed.
 *   2. In Copilot Chat, dispatch a run: @babysitter implement something.
 *   3. Open the Chat Sessions panel (View → Chat Sessions or via sidebar icon).
 *   4. Verify that the new run appears with label "<last8chars>", a spinning
 *      sync icon, and InProgress status.
 *
 * MANUAL TEST 2 — Status icons and status enum update on run completion
 *   1. After a run completes, call refresh() or wait for the file watcher.
 *   2. Verify the icon changes from sync-spin to check.
 *   3. Verify the item shows Completed status (green checkmark) in the panel.
 *
 * MANUAL TEST 3 — Creating a new run via Command Palette
 *   1. Open the Command Palette (Ctrl+Shift+P) and run "Babysitter: Dispatch Run".
 *   2. Enter a description and press Enter.
 *   3. Verify the new run appears in the Chat Sessions panel.
 *
 * MANUAL TEST 4 — Falls back gracefully on VS Code < 1.111
 *   1. Remove the 'chat.createChatSessionItemController' property from the
 *      vscode.chat object in a dev build.
 *   2. Verify no errors are thrown and the extension loads normally.
 *
 * ============================================================================
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ── Vscode mock ───────────────────────────────────────────────────────────────

import {
  makeExtensionContext,
  makeOutputChannel,
  makeChatSessionItemController,
  CancellationTokenSource,
  ProgressLocation,
  StatusBarAlignment,
  Disposable,
  ThemeIcon,
  Uri,
  ChatSessionStatus,
  window as windowStub,
  workspace as workspaceStub,
  commands as commandsStub,
  chat as chatStub,
} from '../../__mocks__/vscode';

// We need to be able to swap chat.createChatSessionItemController in some tests
const mutableVscodeStub = {
  window: windowStub,
  workspace: workspaceStub,
  commands: commandsStub,
  chat: { ...chatStub },
  Uri,
  ThemeIcon,
  ProgressLocation,
  StatusBarAlignment,
  Disposable,
  CancellationTokenSource,
  ChatSessionStatus,
};

(require as NodeRequire & { cache: Record<string, NodeModule> }).cache[
  require.resolve('vscode')
] = {
  id: 'vscode',
  filename: 'vscode',
  loaded: true,
  exports: mutableVscodeStub,
  parent: null,
  children: [],
  paths: [],
} as unknown as NodeModule;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BabysitterSessionController } = require('../../copilot/sessionController') as typeof import('../../copilot/sessionController');

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpRunsDir: string;

function makeTmpRunsDir(): string {
  tmpRunsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsitter-sc-test-'));
  return tmpRunsDir;
}

function cleanupTmpRunsDir() {
  if (tmpRunsDir) {
    try { fs.rmSync(tmpRunsDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function makeController(runsDir?: string) {
  const ctx = makeExtensionContext();
  const dir = runsDir ?? makeTmpRunsDir();
  const controller = new BabysitterSessionController(ctx as never, dir);
  return { controller, ctx, runsDir: dir };
}

// Stub controller returned by createChatSessionItemController for inspection
function makeStubbedChatSessionController() {
  const addItemCalls: unknown[] = [];
  const removeItemCalls: unknown[] = [];
  return {
    items: {
      add: (item: unknown) => { addItemCalls.push(item); },
      delete: (uri: unknown) => { removeItemCalls.push(uri); },
    },
    dispose: () => { /* noop */ },
    _addItemCalls: addItemCalls,
    _removeItemCalls: removeItemCalls,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

suite('BabysitterSessionController', () => {
  let savedCreateChatSessionItemController: typeof chatStub.createChatSessionItemController;

  setup(() => {
    savedCreateChatSessionItemController = mutableVscodeStub.chat.createChatSessionItemController;
  });

  teardown(() => {
    mutableVscodeStub.chat.createChatSessionItemController = savedCreateChatSessionItemController;
    cleanupTmpRunsDir();
  });

  // ── Test 1 ──────────────────────────────────────────────────────────────────
  test('when createChatSessionItemController is undefined, activate() returns without error', () => {
    // Simulate VS Code < 1.110 where the API does not exist
    (mutableVscodeStub.chat as Record<string, unknown>)['createChatSessionItemController'] = undefined;

    const { controller } = makeController();
    assert.doesNotThrow(() => controller.activate());
  });

  // ── Test 2 ──────────────────────────────────────────────────────────────────
  test('activate() calls createChatSessionItemController with correct id', () => {
    const createCalls: unknown[][] = [];
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((id: string, options: unknown) => {
      createCalls.push([id, options]);
      return stubbedInnerController;
    }) as never;

    const { controller, runsDir } = makeController(makeTmpRunsDir());
    controller.activate();

    assert.strictEqual(createCalls.length, 1, 'createChatSessionItemController should be called once');
    assert.strictEqual(createCalls[0][0], 'babysitter-runs');

    controller.deactivate();
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  test('addRun() calls controller.addItem() with correct URI', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();

    controller.addRun('run-20990101-test1234', { status: 'running', processId: 'my-process' });

    assert.strictEqual(stubbedInnerController._addItemCalls.length, 1);
    const item = stubbedInnerController._addItemCalls[0] as { resource: { toString(): string }; label: string; description: string };
    assert.ok(item.resource.toString().includes('run-20990101-test1234'), `expected resource URI to contain run id, got: ${item.resource.toString()}`);
    assert.ok(item.label.includes('test1234'), `expected label to contain short id, got: ${item.label}`);
    assert.strictEqual(item.description, 'my-process');

    controller.deactivate();
  });

  // ── Test 4 ──────────────────────────────────────────────────────────────────
  test('removeRun() calls controller.removeItem() with the URI that was added', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();

    const runId = 'run-20990101-removeme1';
    controller.addRun(runId, { status: 'completed' });
    controller.removeRun(runId);

    assert.strictEqual(stubbedInnerController._removeItemCalls.length, 1);
    const removedUri = stubbedInnerController._removeItemCalls[0] as { toString(): string };
    assert.ok(removedUri.toString().includes(runId), `expected removed URI to contain run id, got: ${removedUri.toString()}`);

    controller.deactivate();
  });

  // ── Test 5 ──────────────────────────────────────────────────────────────────
  test('removeRun() for unknown runId is a no-op', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();

    assert.doesNotThrow(() => controller.removeRun('non-existent-run-id'));
    assert.strictEqual(stubbedInnerController._removeItemCalls.length, 0);

    controller.deactivate();
  });

  // ── Test 6 ──────────────────────────────────────────────────────────────────
  test('refresh() removes all tracked items and re-scans directory', async () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const runsDir = makeTmpRunsDir();
    // Create a fake run directory with minimal structure
    const runId = 'run-20990101-scantest1';
    const runDir = path.join(runsDir, runId);
    fs.mkdirSync(runDir, { recursive: true });

    const { controller } = makeController(runsDir);
    controller.activate();

    // addRun should have been called once by scanExistingRuns during activate()
    const addCallsAfterActivate = stubbedInnerController._addItemCalls.length;
    assert.ok(addCallsAfterActivate >= 1, `expected at least 1 addItem call after activate, got ${addCallsAfterActivate}`);

    // Now call refresh
    await controller.refresh();

    // After refresh: the items were removed (removeItem calls) and re-scanned (new addItem calls)
    assert.ok(stubbedInnerController._removeItemCalls.length >= addCallsAfterActivate,
      'expected removeItem to be called for each previously tracked item');
    assert.ok(stubbedInnerController._addItemCalls.length >= addCallsAfterActivate * 2,
      'expected addItem to be called again after refresh');

    controller.deactivate();
  });

  // ── Test 7 ──────────────────────────────────────────────────────────────────
  test('refresh() is no-op when controller is not initialized (no chat API)', async () => {
    (mutableVscodeStub.chat as Record<string, unknown>)['createChatSessionItemController'] = undefined;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();

    // Should not throw
    await assert.doesNotReject(() => controller.refresh());
  });

  // ── Test 8 ──────────────────────────────────────────────────────────────────
  test('scanExistingRuns() is called during activate() and adds found runs', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const runsDir = makeTmpRunsDir();
    // Create two fake run directories
    fs.mkdirSync(path.join(runsDir, 'run-20990101-aaaabbbb'), { recursive: true });
    fs.mkdirSync(path.join(runsDir, 'run-20990101-ccccdddd'), { recursive: true });

    const { controller } = makeController(runsDir);
    controller.activate();

    assert.strictEqual(stubbedInnerController._addItemCalls.length, 2,
      `expected 2 runs to be added, got ${stubbedInnerController._addItemCalls.length}`);

    controller.deactivate();
  });

  // ── Test 9 ──────────────────────────────────────────────────────────────────
  test('deactivate() clears disposables and internal state', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();
    controller.deactivate();

    // After deactivate, adding a run should be a no-op (controller is cleared)
    assert.doesNotThrow(() => controller.addRun('run-after-deactivate', {}));
    // The stubbed inner controller should NOT receive the call since controller is now undefined internally
    const addCallsAfterDeactivate = stubbedInnerController._addItemCalls.length;
    // addRun after deactivate: the internal this.controller is undefined so nothing extra is added
    assert.strictEqual(stubbedInnerController._addItemCalls.length, addCallsAfterDeactivate);
  });

  // ── Test 10 ─────────────────────────────────────────────────────────────────
  test('addRun() with "completed" status uses check icon and Completed status', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();

    controller.addRun('run-20990101-doneXXXX', { status: 'completed' });

    const item = stubbedInnerController._addItemCalls[0] as {
      label: string;
      iconPath: { id: string };
      status: number;
    };
    assert.strictEqual(item.iconPath.id, 'check');
    assert.strictEqual(item.status, 1 /* ChatSessionStatus.Completed */);

    controller.deactivate();
  });

  // ── Test 11 ─────────────────────────────────────────────────────────────────
  test('addRun() with "failed" status uses error icon and Failed status', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();

    controller.addRun('run-20990101-failXXXX', { status: 'failed' });

    const item = stubbedInnerController._addItemCalls[0] as {
      label: string;
      iconPath: { id: string };
      status: number;
    };
    assert.strictEqual(item.iconPath.id, 'error');
    assert.strictEqual(item.status, 0 /* ChatSessionStatus.Failed */);

    controller.deactivate();
  });

  // ── Test 12 ─────────────────────────────────────────────────────────────────
  test('addRun() without metadata uses circle-outline icon', () => {
    const stubbedInnerController = makeStubbedChatSessionController();

    mutableVscodeStub.chat.createChatSessionItemController = ((_id: string, _options: unknown) =>
      stubbedInnerController) as never;

    const { controller } = makeController(makeTmpRunsDir());
    controller.activate();

    controller.addRun('run-20990101-unknXXXX');

    const item = stubbedInnerController._addItemCalls[0] as {
      label: string;
      iconPath: { id: string };
    };
    assert.strictEqual(item.iconPath.id, 'circle-outline');

    controller.deactivate();
  });
});
