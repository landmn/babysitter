/**
 * Mock of the 'vscode' module for unit tests.
 *
 * This file provides hand-rolled stubs for the VS Code API surface used by the
 * four copilot feature files. Tests override individual stub functions by
 * replacing them before each test and restoring them in afterEach.
 *
 * Usage (in a test file):
 *   // At the top, before any imports of source-under-test:
 *   const vscodeStub = require('../__mocks__/vscode');
 *   // Point the module resolver at this file:
 *   require.cache[require.resolve('vscode')] = { id: 'vscode', filename: 'vscode', loaded: true, exports: vscodeStub };
 */

// ── Utility ──────────────────────────────────────────────────────────────────

/** Creates a simple call-recording stub function. */
function stub<T = unknown>(defaultReturn?: T): ((...args: unknown[]) => T) & { calls: unknown[][] } {
  const fn = function (...args: unknown[]): T {
    fn.calls.push(args);
    return defaultReturn as T;
  };
  fn.calls = [] as unknown[][];
  return fn;
}

function asyncStub<T = unknown>(defaultReturn?: T): ((...args: unknown[]) => Promise<T>) & { calls: unknown[][] } {
  const fn = function (...args: unknown[]): Promise<T> {
    fn.calls.push(args);
    return Promise.resolve(defaultReturn as T);
  };
  fn.calls = [] as unknown[][];
  return fn;
}

// ── StatusBarItem ─────────────────────────────────────────────────────────────

export function makeStatusBarItem() {
  return {
    text: '',
    tooltip: '',
    command: '',
    show: stub(),
    hide: stub(),
    dispose: stub(),
  };
}

// ── OutputChannel ─────────────────────────────────────────────────────────────

export function makeOutputChannel() {
  return {
    append: stub(),
    appendLine: stub(),
    show: stub(),
    dispose: stub(),
    name: 'Babysitter',
  };
}

// ── window ────────────────────────────────────────────────────────────────────

export const window = {
  showWarningMessage: asyncStub<string | undefined>('Approve'),
  showInformationMessage: asyncStub<string | undefined>(undefined),
  showErrorMessage: asyncStub<string | undefined>(undefined),
  showInputBox: asyncStub<string | undefined>('test input'),
  withProgress: (
    _opts: unknown,
    task: (progress: { report: (v: unknown) => void }, token: { isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => void }) => Promise<void>
  ) => {
    const token = {
      isCancellationRequested: false,
      onCancellationRequested: (_cb: () => void) => { /* noop */ },
    };
    return task({ report: stub() }, token);
  },
  createOutputChannel: (_name: string) => makeOutputChannel(),
  createStatusBarItem: (_alignment?: unknown, _priority?: number) => makeStatusBarItem(),
  registerUriHandler: stub<{ dispose: () => void }>({ dispose: stub() }),
};

// ── workspace ─────────────────────────────────────────────────────────────────

export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/tmp/test-workspace' } }],
  getConfiguration: (_section?: string) => ({
    get: (_key: string, defaultVal?: unknown) => defaultVal ?? '',
    update: asyncStub<void>(undefined),
  }),
};

// ── commands ──────────────────────────────────────────────────────────────────

export const commands = {
  executeCommand: asyncStub<{ runId: string; processId: string; status?: string }>({
    runId: 'test-run-123',
    processId: 'test-process',
  }),
  registerCommand: stub<{ dispose: () => void }>({ dispose: stub() }),
};

// ── ChatSessionStatus ─────────────────────────────────────────────────────────

export enum ChatSessionStatus {
  Failed = 0,
  Completed = 1,
  InProgress = 2,
  NeedsInput = 3,
}

// ── chat ──────────────────────────────────────────────────────────────────────

export const makeChatSessionItemController = () => ({
  items: {
    add: stub(),
    delete: stub(),
  },
  dispose: stub(),
});

export const chat = {
  createChatParticipant: (_id: string, _handler: unknown) => ({
    iconPath: undefined as unknown,
    dispose: stub(),
  }),
  createChatSessionItemController: (_id: string, _options: unknown) => makeChatSessionItemController(),
};

// ── Uri ───────────────────────────────────────────────────────────────────────

export const Uri = {
  parse: (s: string) => ({ toString: () => s, scheme: s.split('://')[0], authority: s.split('://')[1]?.split('/')[0] ?? '' }),
  file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` }),
};

// ── ThemeIcon ─────────────────────────────────────────────────────────────────

export class ThemeIcon {
  constructor(public id: string) {}
}

// ── ProgressLocation ──────────────────────────────────────────────────────────

export const ProgressLocation = {
  Window: 10,
  Notification: 15,
  SourceControl: 1,
};

// ── StatusBarAlignment ────────────────────────────────────────────────────────

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

// ── CancellationTokenSource ───────────────────────────────────────────────────

export class CancellationTokenSource {
  private _listeners: Array<() => void> = [];
  token = {
    isCancellationRequested: false,
    onCancellationRequested: (cb: () => void) => {
      this._listeners.push(cb);
      return { dispose: () => { /* noop */ } };
    },
  };
  cancel() {
    this.token.isCancellationRequested = true;
    for (const l of this._listeners) l();
  }
  dispose() { /* noop */ }
}

// ── Disposable ────────────────────────────────────────────────────────────────

export class Disposable {
  constructor(private fn: () => void) {}
  dispose() { this.fn(); }
  static from(...disposables: Array<{ dispose: () => void }>) {
    return new Disposable(() => { for (const d of disposables) d.dispose(); });
  }
}

// ── ExtensionContext (factory) ────────────────────────────────────────────────

export function makeExtensionContext(initialState: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initialState));
  const subscriptions: Array<{ dispose: () => void }> = [];
  return {
    subscriptions,
    workspaceState: {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        return store.has(key) ? (store.get(key) as T) : defaultValue;
      },
      update: (key: string, value: unknown): Promise<void> => {
        store.set(key, value);
        return Promise.resolve();
      },
    },
    globalState: {
      get: <T>(key: string, defaultValue?: T): T | undefined => defaultValue,
      update: (_key: string, _value: unknown): Promise<void> => Promise.resolve(),
    },
    asAbsolutePath: (rel: string) => `/mock/extension/${rel}`,
  };
}
