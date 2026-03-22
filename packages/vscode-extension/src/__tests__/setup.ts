import Module = require('module');

type ResolveFilename = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: unknown
) => string;

type PatchedModule = typeof Module & {
  _resolveFilename?: ResolveFilename;
};

declare global {
  var __babysitterVscodeMockInstalled: boolean | undefined;
}

const mockExports = require('../__mocks__/vscode');
const moduleCache = (require as NodeRequire & { cache: Record<string, NodeModule> }).cache;

if (!moduleCache['vscode']) {
  moduleCache['vscode'] = {
    id: 'vscode',
    filename: 'vscode',
    loaded: true,
    exports: mockExports,
    parent: module.parent ?? null,
    children: [],
    paths: [],
  } as unknown as NodeModule;
}

const patchedModule = Module as PatchedModule;
const originalResolveFilename = patchedModule._resolveFilename;

if (originalResolveFilename && !globalThis.__babysitterVscodeMockInstalled) {
  patchedModule._resolveFilename = ((request, parent, isMain, options) => {
    if (request === 'vscode') {
      return 'vscode';
    }

    return originalResolveFilename.call(Module, request, parent, isMain, options);
  }) as ResolveFilename;

  globalThis.__babysitterVscodeMockInstalled = true;
}